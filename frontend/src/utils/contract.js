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

export function generateVaccineHash(nik, jenisVaksin, kodeProduksi, tanggal, salt) {
  return ethers.keccak256(ethers.toUtf8Bytes(`${nik}|${jenisVaksin}|${kodeProduksi}|${tanggal}|${salt}`));
}

export function generateNikHash(nik) {
  return ethers.keccak256(ethers.toUtf8Bytes(nik));
}

export function generateSalt() {
  return crypto.randomUUID();
}

// ── Issuer ────────────────────────────────────────────────────────────────────

export async function addVaccineRecord(signer, patient, dataHash, vaccineType, nikHash) {
  const contract = getContract(signer);
  const tx = await contract.addVaccineRecord(patient, dataHash, vaccineType, nikHash);
  return await tx.wait();
}

export async function addBatchRoot(signer, root) {
  const contract = getContract(signer);
  const tx = await contract.addBatchRoot(root);
  return await tx.wait();
}

export async function claimCertificate(signer, proof, root, dataHash, vaccineType, nikHash) {
  const contract = getContract(signer);
  const tx = await contract.claimCertificate(
    proof, root, dataHash, vaccineType,
    nikHash || ethers.ZeroHash
  );
  return await tx.wait();
}

export async function revokeCertificate(signer, tokenId) {
  const contract = getContract(signer);
  const tx = await contract.revokeCertificate(tokenId);
  return await tx.wait();
}

// ── Admin ─────────────────────────────────────────────────────────────────────

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

export async function resetNikBinding(signer, walletAddress) {
  const contract = getContract(signer);
  const tx = await contract.resetNikBinding(walletAddress);
  return await tx.wait();
}

// ── NIK Binding ───────────────────────────────────────────────────────────────

export async function bindNik(signer, nikHash) {
  const contract = getContract(signer);
  const tx = await contract.bindNik(nikHash);
  return await tx.wait();
}

export async function getTokensByNik(provider, nikHash) {
  const contract = getContract(provider);
  return await contract.getTokensByNik(nikHash);
}

export async function getNikHashByWallet(provider, walletAddress) {
  try {
    const contract = getContract(provider);
    return await contract.getNikHashByWallet(walletAddress);
  } catch {
    return null;
  }
}

// ── NFT ───────────────────────────────────────────────────────────────────────

export async function getTokenMetadata(provider, tokenId) {
  try {
    const contract = getContract(provider);
    const uri = await contract.tokenURI(tokenId);
    if (uri.startsWith("data:application/json;base64,")) {
      return JSON.parse(atob(uri.split(",")[1]));
    }
  } catch {}
  return { name: `VaxChain #${tokenId}`, image: "", attributes: [] };
}

/**
 * Ambil semua token ID yang dimiliki address
 * Menggunakan ownerOf loop (reliable untuk local/testnet)
 */
export async function getOwnedCertificates(provider, address) {
  try {
    const contract = getContract(provider);
    const total    = Number(await contract.nextTokenId());
    const owned    = [];
    for (let i = 0; i < total; i++) {
      try {
        const owner = await contract.ownerOf(i);
        if (owner.toLowerCase() === address.toLowerCase()) {
          owned.push(i);
        }
      } catch {}
    }
    return owned;
  } catch {
    return [];
  }
}

export async function getRecordByTokenId(provider, tokenId) {
  const contract = getContract(provider);
  const rec = await contract.records(tokenId);
  return {
    isValid:      Number(rec.status) === 1,
    issuer:       rec.issuer,
    facilityName: rec.facilityName,
    vaccineType:  rec.vaccineType,
    timestamp:    Number(rec.timestamp),
    statusCode:   Number(rec.status),
    dataHash:     rec.dataHash,
  };
}

// Alias untuk VerifyRecord.jsx
export async function verifyRecord(provider, tokenId) {
  return await getRecordByTokenId(provider, Number(tokenId));
}

// ── Publik ────────────────────────────────────────────────────────────────────

export async function checkIsIssuer(provider, address) {
  return await getContract(provider).isAuthorizedIssuer(address);
}

export async function getIssuerName(provider, address) {
  return await getContract(provider).issuerNames(address);
}

export async function getOwner(provider) {
  return await getContract(provider).owner();
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
