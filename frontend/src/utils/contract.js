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

// ── Koneksi MetaMask ─────────────────────────────────────────────────────────

/**
 * Minta akses ke MetaMask dan kembalikan provider + signer
 */
export async function connectMetaMask() {
  if (!window.ethereum) {
    throw new Error("MetaMask tidak ditemukan. Silakan install MetaMask terlebih dahulu.");
  }

  // Minta permission akses akun
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer   = await provider.getSigner();
  const address  = await signer.getAddress();
  const network  = await provider.getNetwork();

  return { provider, signer, address, chainId: Number(network.chainId) };
}

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
 *
 * @param {string} nik           - Nomor Induk Kependudukan
 * @param {string} jenisVaksin   - Nama vaksin (misal: "Sinovac")
 * @param {string} kodeProduksi  - Nomor batch/lot vaksin
 * @param {string} tanggal       - Tanggal vaksinasi (YYYY-MM-DD)
 * @param {string} salt          - Nilai acak unik (UUID) — SIMPAN INI!
 * @returns {string}  Hash dalam format 0x...
 */
export function generateVaccineHash(nik, jenisVaksin, kodeProduksi, tanggal, salt) {
  const rawData = `${nik}|${jenisVaksin}|${kodeProduksi}|${tanggal}|${salt}`;
  return ethers.keccak256(ethers.toUtf8Bytes(rawData));
}

/**
 * Generate UUID v4 sebagai salt
 */
export function generateSalt() {
  return crypto.randomUUID();
}

// ── Fungsi Kontrak ────────────────────────────────────────────────────────────

/**
 * Catat rekam vaksin ke blockchain
 * @param signer - ethers Signer (dari MetaMask)
 * @param hashData - bytes32 hash
 * @returns tx receipt
 */
export async function addVaccineRecord(signer, hashData) {
  const contract = getContract(signer);
  const tx = await contract.addVaccineRecord(hashData);
  return await tx.wait(); // Tunggu konfirmasi
}

/**
 * Verifikasi sertifikat vaksin
 * @param provider - ethers Provider
 * @param hashData - bytes32 hash dari sertifikat
 */
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

/**
 * Revoke sertifikat
 */
export async function revokeCertificate(signer, hashData) {
  const contract = getContract(signer);
  const tx = await contract.revokeCertificate(hashData);
  return await tx.wait();
}

/**
 * Daftarkan issuer baru (hanya owner)
 */
export async function authorizeIssuer(signer, address, facilityName) {
  const contract = getContract(signer);
  const tx = await contract.authorizeIssuer(address, facilityName);
  return await tx.wait();
}

/**
 * Hapus issuer (hanya owner)
 */
export async function removeIssuer(signer, address) {
  const contract = getContract(signer);
  const tx = await contract.removeIssuer(address);
  return await tx.wait();
}

/**
 * Cek apakah alamat adalah authorized issuer
 */
export async function checkIsIssuer(provider, address) {
  const contract = getContract(provider);
  return await contract.isAuthorizedIssuer(address);
}

/**
 * Ambil nama fasilitas dari alamat
 */
export async function getIssuerName(provider, address) {
  const contract = getContract(provider);
  return await contract.issuerNames(address);
}

/**
 * Ambil owner kontrak
 */
export async function getOwner(provider) {
  const contract = getContract(provider);
  return await contract.owner();
}

/**
 * Format timestamp Unix ke string lokal Indonesia
 */
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

/**
 * Potong alamat wallet: 0x1234...abcd
 */
export function shortAddress(addr) {
  if (!addr) return "-";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
