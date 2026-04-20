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

export function getContract(sp) {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, sp);
}

// ── Hashing ───────────────────────────────────────────────────────────────────

export function generateVaccineHash(nik, jenis, kode, tgl, salt) {
  return ethers.keccak256(ethers.toUtf8Bytes(`${nik}|${jenis}|${kode}|${tgl}|${salt}`));
}
export function generateNikHash(nik) {
  return ethers.keccak256(ethers.toUtf8Bytes(nik));
}
export function generateSalt() { return crypto.randomUUID(); }

/** Format token ID menjadi Certificate ID yang mudah dibaca */
export function formatCertId(tokenId, timestamp) {
  const year = new Date((timestamp || Date.now() / 1000) * 1000).getFullYear();
  const id   = String(tokenId);
  // Untuk ID kompleks (>6 digit), tampilkan langsung
  // Untuk ID lama sequential, pad dengan 0
  const formatted = id.length > 6 ? id : id.padStart(6, "0");
  return `VAX-${year}-${formatted}`;
}

// ── Issuer ────────────────────────────────────────────────────────────────────

export async function addVaccineRecord(signer, patient, dataHash, vaccineType, nikHash) {
  const tx = await getContract(signer).addVaccineRecord(patient, dataHash, vaccineType, nikHash);
  return await tx.wait();
}

export async function addBatchRoot(signer, root) {
  const tx = await getContract(signer).addBatchRoot(root);
  return await tx.wait();
}

export async function claimCertificate(signer, proof, root, dataHash, vaccineType, nikHash) {
  const tx = await getContract(signer).claimCertificate(
    proof, root, dataHash, vaccineType, nikHash || ethers.ZeroHash
  );
  return await tx.wait();
}

/** Faskes request revoke — tidak langsung execute */
export async function requestRevoke(signer, tokenId, reason) {
  const tx = await getContract(signer).requestRevoke(tokenId, reason);
  return await tx.wait();
}

// ── Admin / Owner ─────────────────────────────────────────────────────────────

export async function authorizeIssuer(signer, address, facilityName) {
  const tx = await getContract(signer).authorizeIssuer(address, facilityName);
  return await tx.wait();
}

export async function removeIssuer(signer, address) {
  const tx = await getContract(signer).removeIssuer(address);
  return await tx.wait();
}

export async function approveRevoke(signer, requestId) {
  const tx = await getContract(signer).approveRevoke(requestId);
  return await tx.wait();
}

export async function rejectRevoke(signer, requestId, note) {
  const tx = await getContract(signer).rejectRevoke(requestId, note);
  return await tx.wait();
}

export async function emergencyRevoke(signer, tokenId, reason) {
  const tx = await getContract(signer).emergencyRevoke(tokenId, reason);
  return await tx.wait();
}

export async function undoRevoke(signer, tokenId, reason) {
  const tx = await getContract(signer).undoRevoke(tokenId, reason);
  return await tx.wait();
}

export async function resetNikBinding(signer, walletAddress) {
  const tx = await getContract(signer).resetNikBinding(walletAddress);
  return await tx.wait();
}

// ── NIK ───────────────────────────────────────────────────────────────────────

/**
 * Faskes/Owner ikat NIK ke wallet pasien
 * Hanya bisa dipanggil oleh authorized issuer atau owner
 * Pasien tidak bisa bind NIK sendiri (mencegah klaim NIK orang lain)
 */
export async function bindNikForPatient(signer, patientAddress, nikHash) {
  const tx = await getContract(signer).bindNikForPatient(patientAddress, nikHash);
  return await tx.wait();
}

export async function getTokensByNik(provider, nikHash) {
  return await getContract(provider).getTokensByNik(nikHash);
}

export async function getNikHashByWallet(provider, wallet) {
  try { return await getContract(provider).getNikHashByWallet(wallet); }
  catch { return null; }
}

// ── NFT / Records ─────────────────────────────────────────────────────────────

export async function getTokenMetadata(provider, tokenId) {
  try {
    const uri = await getContract(provider).tokenURI(tokenId);
    if (uri.startsWith("data:application/json;base64,"))
      return JSON.parse(atob(uri.split(",")[1]));
  } catch {}
  return { name: `VaxChain #${tokenId}`, image: "", attributes: [] };
}

export async function getOwnedCertificates(provider, address) {
  try {
    const c      = getContract(provider);
    // Gunakan getAllTokenIds() untuk dapat semua tokenId yang kompleks
    const allIds = await c.getAllTokenIds();
    const owned  = [];
    for (const id of allIds) {
      try {
        const owner = await c.ownerOf(id);
        if (owner.toLowerCase() === address.toLowerCase()) owned.push(id);
      } catch {}
    }
    return owned;
  } catch { return []; }
}

export async function getRecordByTokenId(provider, tokenId) {
  const rec = await getContract(provider).records(tokenId);
  return {
    isValid:      Number(rec.status) === 1,
    issuer:       rec.issuer,
    facilityName: rec.facilityName,
    vaccineType:  rec.vaccineType,
    timestamp:    Number(rec.timestamp),
    statusCode:   Number(rec.status),
    dataHash:     rec.dataHash,
    certId:       formatCertId(tokenId, Number(rec.timestamp)),
  };
}

export async function verifyRecord(provider, tokenId) {
  return await getRecordByTokenId(provider, Number(tokenId));
}

export async function getTokenHistory(provider, tokenId) {
  try {
    const entries = await getContract(provider).getTokenHistory(tokenId);
    return entries.map(e => ({
      action:    e.action,
      actor:     e.actor,
      note:      e.note,
      timestamp: Number(e.timestamp),
    }));
  } catch { return []; }
}

export async function getPendingRevokeRequests(provider) {
  try {
    const c       = getContract(provider);
    const ids     = await c.getPendingRequests();
    const results = await Promise.all(ids.map(async id => {
      const req = await c.revokeRequests(id);
      return {
        requestId:    Number(id),
        tokenId:      Number(req.tokenId),
        requestedBy:  req.requestedBy,
        facilityName: req.facilityName,
        reason:       req.reason,
        timestamp:    Number(req.timestamp),
        status:       Number(req.status), // 0=Pending
      };
    }));
    return results.filter(r => r.status === 0);
  } catch { return []; }
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

export function formatTimestamp(ts) {
  if (!ts) return "-";
  return new Date(ts * 1000).toLocaleString("id-ID", {
    day:"2-digit", month:"long", year:"numeric", hour:"2-digit", minute:"2-digit"
  });
}
export function shortAddress(addr) {
  if (!addr) return "-";
  return `${addr.slice(0,6)}...${addr.slice(-4)}`;
}
