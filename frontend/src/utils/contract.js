// src/utils/contract.js
// Semua logika interaksi dengan smart contract ada di sini

import { ethers } from "ethers";
import deploymentInfo from "../abi/VaccineRegistry.json";

// ── Konstanta ────────────────────────────────────────────────────────────────

export const CONTRACT_ADDRESS = deploymentInfo.address;
export const CONTRACT_ABI     = deploymentInfo.abi;

// Chain ID yang didukung
export const SUPPORTED_CHAINS = {
  31337: { name: "Hardhat Local",    rpc: "http://127.0.0.1:8545" },
  80002: { name: "Polygon Amoy",     rpc: "https://rpc-amoy.polygon.technology/" },
  137:   { name: "Polygon Mainnet",  rpc: "https://polygon-rpc.com" },
};

// ── Instance Kontrak ─────────────────────────────────────────────────────────

/**
 * Kembalikan instance kontrak (dengan signer untuk write, tanpa untuk read-only)
 */
export function getContract(signerOrProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
}

// ── Hashing ──────────────────────────────────────────────────────────────────

/**
 * Buat hash dari data vaksin pasien
 * Hash ini yang disimpan ke blockchain (bukan data mentah)
 */
export function generateVaccineHash(nik, jenisVaksin, kodeProduksi, tanggal, salt) {
  const rawData = `${nik}|${jenisVaksin}|${kodeProduksi}|${tanggal}|${salt}`;
  return ethers.keccak256(ethers.toUtf8Bytes(rawData));
}

export function generateSalt() {
  return crypto.randomUUID();
}

// ── Fungsi-Fungsi Kontrak ──────────────────────────────────────────────────────

/**
 * Catat rekam vaksin tunggal (Mint NFT)
 */
export async function addVaccineRecord(signer, patientAddress, dataHash, vaccineType) {
  const contract = getContract(signer);
  const tx = await contract.addVaccineRecord(patientAddress, dataHash, vaccineType);
  return await tx.wait();
}

/**
 * Tambahkan Merkle Root untuk batch upload
 */
export async function addBatchRoot(signer, root) {
  const contract = getContract(signer);
  const tx = await contract.addBatchRoot(root);
  return await tx.wait();
}

/**
 * Klaim sertifikat dari batch menggunakan proof
 */
export async function claimCertificate(signer, proof, root, dataHash, vaccineType) {
  const contract = getContract(signer);
  const tx = await contract.claimCertificate(proof, root, dataHash, vaccineType);
  return await tx.wait();
}

/**
 * Ambil metadata NFT (termasuk SVG Base64)
 */
export async function getTokenMetadata(provider, tokenId) {
  const contract = getContract(provider);
  const uri = await contract.tokenURI(tokenId);
  
  if (uri.startsWith("data:application/json;base64,")) {
    const json = atob(uri.split(",")[1]);
    return JSON.parse(json);
  }
  return null;
}

/**
 * Ambil semua ID sertifikat yang dimiliki oleh sebuah alamat
 */
export async function getOwnedCertificates(provider, address) {
  const contract = getContract(provider);
  // Karena ERC721 standar tidak ada function list by owner tanpa Enumerable, 
  // kita listen ke transfer events atau brute force per totalRecords untuk demo.
  // Cara paling efisien di demo: Query events.
  const filter = contract.filters.Transfer(null, address);
  const events = await contract.queryFilter(filter);
  return events.map(e => e.args.tokenId);
}

/**
 * Verifikasi sertifikat vaksin (Old way for legacy hashes or specific lookup)
 */
export async function verifyRecordByTokenId(provider, tokenId) {
  const contract = getContract(provider);
  const rec = await contract.records(tokenId);
  return {
    isValid:      Number(rec.status) === 1,
    issuer:       rec.issuer,
    facilityName: rec.facilityName,
    timestamp:    Number(rec.timestamp),
    statusCode:   Number(rec.status),
    vaccineType:  rec.vaccineType,
    dataHash:     rec.dataHash
  };
}

/**
 * Revoke sertifikat (NFT)
 */
export async function revokeCertificate(signer, tokenId) {
  const contract = getContract(signer);
  const tx = await contract.revokeCertificate(tokenId);
  return await tx.wait();
}

/**
 * Manajemen Issuer
 */
export async function authorizeIssuer(signer, address, facilityName) {
  const contract = getContract(signer);
  const tx = await contract.authorizeIssuer(address, facilityName);
  return await tx.wait();
}

export async function removeIssuer(signer, address) {
  const contract = getContract(signer);
  const tx = await contract.removeIssuer(address);
  return await tx.wait();
}

export async function checkIsIssuer(provider, address) {
  if (!address) return false;
  const contract = getContract(provider);
  return await contract.authorizedIssuers(address);
}

export async function getIssuerName(provider, address) {
  const contract = getContract(provider);
  return await contract.issuerNames(address);
}

export async function getOwner(provider) {
  const contract = getContract(provider);
  return await contract.owner();
}

// ── Utils ────────────────────────────────────────────────────────────────────

export function formatTimestamp(unixTimestamp) {
  if (!unixTimestamp) return "-";
  return new Date(unixTimestamp * 1000).toLocaleString("id-ID", {
    day:    "2-digit",
    month:  "long",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

export function shortAddress(addr) {
  if (!addr) return "-";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
