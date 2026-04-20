// src/utils/web3auth.js
// Web3Auth dipakai HANYA untuk Google OAuth (nama, email, foto).
// Semua interaksi blockchain pakai JsonRpcProvider langsung ke Hardhat.
// Wallet di-derive deterministik dari Google UID → email yang sama = address yang sama.

import { Web3Auth } from "@web3auth/modal";
import { ethers } from "ethers";

const WEB3AUTH_CLIENT_ID = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || "";
const RPC_TARGET = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";

let _web3auth    = null;
let _initPromise = null;

async function getWeb3Auth() {
  if (!_web3auth) {
    _web3auth = new Web3Auth({
      clientId:        WEB3AUTH_CLIENT_ID,
      web3AuthNetwork: "sapphire_devnet",
      chainConfig: {
        chainNamespace: "eip155",
        chainId:        "0x" + Number(import.meta.env.VITE_CHAIN_ID || 31337).toString(16),
        rpcTarget:      RPC_TARGET,
        displayName:    import.meta.env.VITE_CHAIN_NAME || "Hardhat Local",
        ticker:         "ETH",
        tickerName:     "Ethereum",
      },
    });
  }
  if (!_initPromise) _initPromise = _web3auth.init();
  await _initPromise;
  return _web3auth;
}

export async function loginWithGoogle() {
  const web3auth = await getWeb3Auth();
  await web3auth.connect();
  return _buildSession(web3auth);
}

export async function restoreSession() {
  try {
    const web3auth = await getWeb3Auth();
    if (!web3auth.connected) return null;
    return _buildSession(web3auth);
  } catch {
    return null;
  }
}

export async function logoutWeb3Auth() {
  try {
    if (_web3auth?.connected) await _web3auth.logout();
  } finally {
    _web3auth    = null;
    _initPromise = null;
  }
}

async function _buildSession(web3auth) {
  const userInfo = await web3auth.getUserInfo();

  // ── Derive wallet deterministik dari Google UID ──────────────────────────
  // verifierId = Google sub (unique per akun Google, tidak berubah)
  const seed       = "vaxchain-local-" + (userInfo.verifierId || userInfo.email || "unknown");
  const privateKey = ethers.keccak256(ethers.toUtf8Bytes(seed));

  // ── Provider langsung ke Hardhat lokal ───────────────────────────────────
  const provider = new ethers.JsonRpcProvider(RPC_TARGET);
  const signer   = new ethers.Wallet(privateKey, provider);
  const address  = signer.address;

  // ── Auto-fund wallet di Hardhat (gratis, tidak perlu ETH asli) ───────────
  try {
    await provider.send("hardhat_setBalance", [
      address,
      "0x56BC75E2D63100000", // 100 ETH
    ]);
  } catch {
    // Bukan Hardhat / tidak perlu (di testnet/mainnet abaikan)
  }

  const network = await provider.getNetwork();

  return {
    provider,
    signer,
    address,
    chainId: Number(network.chainId),
    userInfo, // { name, email, profileImage }
  };
}
