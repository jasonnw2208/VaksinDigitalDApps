// test/VaccineRegistry.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

describe("VaccineRegistry NFT & Merkle", function () {
  let contract, owner, issuer, patient;

  beforeEach(async () => {
    [owner, issuer, patient] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("VaccineRegistry");
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    await contract.authorizeIssuer(issuer.address, "RSCM");
  });

  describe("1. NFT functionality", () => {
    it("Should mint a single NFT record", async () => {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test-data"));
      await contract.connect(issuer).addVaccineRecord(patient.address, dataHash, "Sinovac");
      
      expect(await contract.balanceOf(patient.address)).to.equal(1);
      const rec = await contract.records(0);
      expect(rec.vaccineType).to.equal("Sinovac");
    });

    it("Should be Soulbound (non-transferable)", async () => {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test-data"));
      await contract.connect(issuer).addVaccineRecord(patient.address, dataHash, "Sinovac");
      
      await expect(
        contract.connect(patient).transferFrom(patient.address, owner.address, 0)
      ).to.be.revertedWith("Sertifikat ini bersifat Soulbound (tidak bisa dipindah tangankan)");
    });
  });

  describe("2. Merkle Tree Batching", () => {
    it("Should allow claiming from a verified batch", async () => {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("batch-data-1"));
      const vaccineType = "Pfizer";
      
      // Build Merkle Tree
      const leaf = ethers.solidityPackedKeccak256(
        ["address", "bytes32", "string"],
        [patient.address, dataHash, vaccineType]
      );
      const tree = new MerkleTree([leaf], keccak256, { sortPairs: true });
      const root = tree.getHexRoot();
      const proof = tree.getHexProof(leaf);

      // Issuer adds root
      await contract.connect(issuer).addBatchRoot(root);
      
      // Patient claims
      await contract.connect(patient).claimCertificate(proof, root, dataHash, vaccineType);
      
      expect(await contract.ownerOf(0)).to.equal(patient.address);
      const rec = await contract.records(0);
      expect(rec.vaccineType).to.equal("Pfizer");
    });

    it("Should fail with invalid proof", async () => {
       const dataHash = ethers.keccak256(ethers.toUtf8Bytes("batch-data-1"));
       await contract.connect(issuer).addBatchRoot(ethers.ZeroHash);
       await expect(
         contract.connect(patient).claimCertificate([], ethers.ZeroHash, dataHash, "Pfizer")
       ).to.be.reverted;
    });
  });

  describe("3. Revoking", () => {
    it("Should allow issuer to revoke a certificate", async () => {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("revoke-test"));
      await contract.connect(issuer).addVaccineRecord(patient.address, dataHash, "Sinovac");
      
      await contract.connect(issuer).revokeCertificate(0);
      const rec = await contract.records(0);
      expect(rec.status).to.equal(2); // 2 = Revoked
    });

    it("Should not allow non-authorized user to revoke", async () => {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("revoke-test-2"));
      await contract.connect(issuer).addVaccineRecord(patient.address, dataHash, "Sinovac");
      
      await expect(
        contract.connect(patient).revokeCertificate(0)
      ).to.be.revertedWith("Hanya penerbit atau admin yang bisa merevoke");
    });
  });

  describe("4. SVG Rendering", () => {
    it("Should return a valid data URI", async () => {
      const dataHash = ethers.keccak256(ethers.toUtf8Bytes("test-data"));
      await contract.connect(issuer).addVaccineRecord(patient.address, dataHash, "Moderna");
      
      const uri = await contract.tokenURI(0);
      expect(uri).to.contain("data:application/json;base64,");
    });
  });
});
