// src/utils/contract.js
import { ethers } from "ethers";
import deploymentInfo from "../abi/VaccineRegistry.json";

export const CONTRACT_ADDRESS = deploymentInfo.address;
export const CONTRACT_ABI     = deploymentInfo.abi;

export const SUPPORTED_CHAINS = {
  31337: { name: "Hardhat Local",   rpc: "http://127.0.0.1:8545" },
  80002: { name: "Polygon Amoy",    rpc: "https://rpc-amoy.polygon.technology/" },
  137:   { name: "Polygon Mainnet", rpc: "https://polygon-rpc.com" },
};

export function getContract(signerOrProvider) {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signerOrProvider);
}

// ── Hashing ───────────────────────────────────────────────────────────────────

/** Hash data vaksin lengkap (disimpan ke blockchain) */
export function generateVaccineHash(nik, jenisVaksin, kodeProduksi, tanggal, salt) {
  const raw = `${nik}|${jenisVaksin}|${kodeProduksi}|${tanggal}|${salt}`;
  return ethers.keccak256(ethers.toUtf8Bytes(raw));
}

/** Hash NIK saja (untuk mapping pasien, tidak menyimpan NIK asli) */
export function generateNikHash(nik) {
  return ethers.keccak256(ethers.toUtf8Bytes(nik));
}

/** Generate UUID v4 sebagai salt */
export function generateSalt() {
  return crypto.randomUUID();
}

// ── Fungsi Kontrak — Issuer ───────────────────────────────────────────────────

/**
 * Catat rekam vaksin ke blockchain
 * @param signer     - ethers Signer
 * @param hashData   - hash data vaksin lengkap
 * @param nikHash    - hash NIK pasien (untuk mapping)
 */
export async function addVaccineRecord(signer, hashData, nikHash) {
  const contract = getContract(signer);
  const tx = await contract.addVaccineRecord(hashData, nikHash);
  return await tx.wait();
}

export async function revokeCertificate(signer, hashData) {
  const contract = getContract(signer);
  const tx = await contract.revokeCertificate(hashData);
  return await tx.wait();
}

// ── Fungsi Kontrak — Admin ────────────────────────────────────────────────────

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

/**
 * Reset binding NIK pasien (hanya owner/faskes)
 * Digunakan saat pasien lupa akun Google / ganti akun sosial
 */
export async function resetNikBinding(signer, walletAddress) {
  const contract = getContract(signer);
  const tx = await contract.resetNikBinding(walletAddress);
  return await tx.wait();
}

// ── Fungsi Kontrak — Pasien ───────────────────────────────────────────────────

/**
 * Pasien ikat wallet ke NIK mereka (sekali saja)
 * Jika sudah terikat sebelumnya, akan throw error dari contract
 */
export async function bindNik(signer, nikHash) {
  const contract = getContract(signer);
  const tx = await contract.bindNik(nikHash);
  return await tx.wait();
}

/**
 * Ambil semua record hash milik satu NIK
 */
export async function getRecordsByNik(provider, nikHash) {
  const contract = getContract(provider);
  return await contract.getRecordsByNik(nikHash);
}

/**
 * Cek apakah wallet sudah terikat ke NIK
 * Returns bytes32(0) jika belum terikat
 */
export async function getNikHashByWallet(provider, walletAddress) {
  const contract = getContract(provider);
  return await contract.getNikHashByWallet(walletAddress);
}

// ── Fungsi Kontrak — Publik ───────────────────────────────────────────────────

export async function verifyRecord(provider, hashData) {
  const contract = getContract(provider);
  const result   = await contract.verifyRecord(hashData);
  return {
    isValid:      result.isValid,
    issuer:       result.issuer,
    facilityName: result.facilityName,
    timestamp:    Number(result.timestamp),
    statusCode:   Number(result.statusCode),
  };
}

export async function checkIsIssuer(provider, address) {
  const contract = getContract(provider);
  return await contract.isAuthorizedIssuer(address);
}

export async function getIssuerName(provider, address) {
  const contract = getContract(provider);
  return await contract.issuerNames(address);
}

export async function getOwner(provider) {
  const contract = getContract(provider);
  return await contract.owner();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatTimestamp(unixTimestamp) {
  if (!unixTimestamp) return "-";
  return new Date(unixTimestamp * 1000).toLocaleString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function shortAddress(addr) {
  if (!addr) return "-";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
