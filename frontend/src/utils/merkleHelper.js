import { MerkleTree } from "merkletreejs";
import { ethers } from "ethers";

function makeLeaf(patientAddress, dataHash, vaccineType) {
  return Buffer.from(
    ethers.solidityPackedKeccak256(
      ["address", "bytes32", "string"],
      [patientAddress, dataHash, vaccineType]
    ).slice(2),
    "hex"
  );
}

const keccak256Buf = (data) =>
  Buffer.from(ethers.keccak256(data).slice(2), "hex");

export function buildMerkleTree(records) {
  const leaves = records.map(r =>
    makeLeaf(r.patientAddress, r.dataHash, r.vaccineType)
  );
  return new MerkleTree(leaves, keccak256Buf, { sortPairs: true });
}

export function getRoot(tree) {
  return tree.getHexRoot();
}

export function getProof(tree, record) {
  const leaf = makeLeaf(record.patientAddress, record.dataHash, record.vaccineType);
  return tree.getHexProof(leaf);
}