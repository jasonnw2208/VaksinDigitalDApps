// src/utils/merkleHelper.js
import { MerkleTree } from "merkletreejs";
import { ethers } from "ethers";

/**
 * Membangun Merkle Tree dari daftar rekam vaksin
 * 
 * @param {Array} records - Array of { patientAddress, dataHash, vaccineType }
 * @returns {MerkleTree} 
 */
export function buildMerkleTree(records) {
  const leaves = records.map(rec => {
    // abi.encodePacked(address, bytes32, string)
    return ethers.solidityPackedKeccak256(
      ["address", "bytes32", "string"],
      [rec.patientAddress, rec.dataHash, rec.vaccineType]
    );
  });
  
  // Merkletreejs can take a custom hash function that takes a Buffer/Uint8Array and returns a Buffer/Uint8Array
  // Ethers keccak256 returns a hex string, so we need to convert to/from Uint8Array
  const hashFn = (data) => ethers.getBytes(ethers.keccak256(data));
  
  return new MerkleTree(leaves, hashFn, { sortPairs: true });
}

/**
 * Menghitung root hash dari tree
 */
export function getRoot(tree) {
  return tree.getHexRoot();
}

/**
 * Mengambil proof untuk sebuah leaf (record)
 */
export function getProof(tree, record) {
  const leaf = ethers.solidityPackedKeccak256(
    ["address", "bytes32", "string"],
    [record.patientAddress, record.dataHash, record.vaccineType]
  );
  return tree.getHexProof(leaf);
}
