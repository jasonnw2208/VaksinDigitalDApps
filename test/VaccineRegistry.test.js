// test/VaccineRegistry.test.js
// Jalankan: npx hardhat test

const { expect } = require("chai");
const { ethers }  = require("hardhat");

describe("VaccineRegistry", function () {
  let contract, owner, issuer1, issuer2, publicUser;

  // Helper: buat hash seperti yang dilakukan frontend
  function makeHash(nik, vaccine, batch, date, salt) {
    const raw = `${nik}|${vaccine}|${batch}|${date}|${salt}`;
    return ethers.keccak256(ethers.toUtf8Bytes(raw));
  }

  // Deploy segar sebelum setiap test
  beforeEach(async () => {
    [owner, issuer1, issuer2, publicUser] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("VaccineRegistry");
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    // Daftarkan issuer1
    await contract.authorizeIssuer(issuer1.address, "RSUP Dr. Cipto Mangunkusumo");
  });

  // ────────────────────────────────────────────────────────────────────────
  describe("1. Deployment", () => {
    it("Owner tercatat dengan benar", async () => {
      expect(await contract.owner()).to.equal(owner.address);
    });

    it("Owner otomatis jadi authorized issuer", async () => {
      expect(await contract.isAuthorizedIssuer(owner.address)).to.be.true;
    });

    it("Total records awal = 0", async () => {
      expect(await contract.totalRecords()).to.equal(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe("2. Manajemen Issuer (Admin)", () => {
    it("Owner bisa daftarkan issuer baru", async () => {
      await contract.authorizeIssuer(issuer2.address, "Puskesmas Tebet");
      expect(await contract.isAuthorizedIssuer(issuer2.address)).to.be.true;
      expect(await contract.issuerNames(issuer2.address)).to.equal("Puskesmas Tebet");
    });

    it("Non-owner tidak bisa daftarkan issuer → revert", async () => {
      await expect(
        contract.connect(publicUser).authorizeIssuer(issuer2.address, "Test")
      ).to.be.revertedWith("Hanya owner yang bisa melakukan ini");
    });

    it("Owner bisa cabut issuer", async () => {
      await contract.removeIssuer(issuer1.address);
      expect(await contract.isAuthorizedIssuer(issuer1.address)).to.be.false;
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe("3. Pencatatan Vaksin (addVaccineRecord)", () => {
    it("Issuer bisa catat hash vaksin", async () => {
      const hash = makeHash("3201234567890001", "Sinovac", "BATCH001", "2024-01-15", "salt-abc");

      await expect(contract.connect(issuer1).addVaccineRecord(hash))
        .to.emit(contract, "RecordAdded")
        .withArgs(hash, issuer1.address, "RSUP Dr. Cipto Mangunkusumo", await getLatestTimestamp());

      expect(await contract.totalRecords()).to.equal(1);
    });

    it("Non-issuer tidak bisa catat → revert", async () => {
      const hash = makeHash("3201234567890001", "Sinovac", "BATCH001", "2024-01-15", "salt-xyz");
      await expect(
        contract.connect(publicUser).addVaccineRecord(hash)
      ).to.be.revertedWith("Wallet ini belum terdaftar sebagai fasilitas kesehatan");
    });

    it("Hash duplikat tidak bisa dicatat → revert", async () => {
      const hash = makeHash("3201234567890001", "Sinovac", "BATCH001", "2024-01-15", "salt-dup");
      await contract.connect(issuer1).addVaccineRecord(hash);
      await expect(
        contract.connect(issuer1).addVaccineRecord(hash)
      ).to.be.revertedWith("Hash ini sudah pernah dicatat");
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe("4. Verifikasi Sertifikat (verifyRecord)", () => {
    it("Hash valid → isValid=true, data issuer benar", async () => {
      const hash = makeHash("3201234567890001", "Moderna", "MOD-001", "2024-03-10", "s1");
      await contract.connect(issuer1).addVaccineRecord(hash);

      const result = await contract.verifyRecord(hash);
      expect(result.isValid).to.be.true;
      expect(result.issuer).to.equal(issuer1.address);
      expect(result.facilityName).to.equal("RSUP Dr. Cipto Mangunkusumo");
      expect(result.statusCode).to.equal(1); // 1 = Valid
    });

    it("Hash tidak ada → isValid=false, statusCode=0", async () => {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("fake-certificate"));
      const result = await contract.verifyRecord(fakeHash);
      expect(result.isValid).to.be.false;
      expect(result.statusCode).to.equal(0); // 0 = NotExists
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  describe("5. Revoke Sertifikat", () => {
    it("Issuer bisa revoke sertifikat valid", async () => {
      const hash = makeHash("3201234567890001", "Pfizer", "PFZ-002", "2024-05-20", "s2");
      await contract.connect(issuer1).addVaccineRecord(hash);

      await expect(contract.connect(issuer1).revokeCertificate(hash))
        .to.emit(contract, "RecordRevoked");

      const result = await contract.verifyRecord(hash);
      expect(result.isValid).to.be.false;
      expect(result.statusCode).to.equal(2); // 2 = Revoked
    });

    it("Non-issuer tidak bisa revoke → revert", async () => {
      const hash = makeHash("3201234567890001", "Pfizer", "PFZ-002", "2024-05-20", "s3");
      await contract.connect(issuer1).addVaccineRecord(hash);
      await expect(
        contract.connect(publicUser).revokeCertificate(hash)
      ).to.be.revertedWith("Wallet ini belum terdaftar sebagai fasilitas kesehatan");
    });

    it("Revoke hash yang tidak ada → revert", async () => {
      const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("ghost"));
      await expect(
        contract.connect(issuer1).revokeCertificate(fakeHash)
      ).to.be.revertedWith("Sertifikat tidak ditemukan atau sudah direvoke");
    });
  });
});

// Helper untuk ambil timestamp block terbaru (pendekatan)
async function getLatestTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}
