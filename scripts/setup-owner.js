// scripts/setup-owner.js
// Jalankan setelah deploy untuk transfer ownership ke wallet Google
// Usage: npx hardhat run scripts/setup-owner.js --network localhost

const { ethers } = require("hardhat");

// ── GANTI INI dengan address Google kamu ─────────────────────────────────────
const GOOGLE_WALLET = "0x08CFD34e48f47e2699B196Fb8eE7AFFAcC58fDCc";
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();

  // Ambil address kontrak dari ABI yang sudah di-deploy
  const deploymentInfo = require("../frontend/src/abi/VaccineRegistry.json");
  const contractAddress = deploymentInfo.address;

  console.log("Contract :", contractAddress);
  console.log("Deployer :", deployer.address);
  console.log("New Owner:", GOOGLE_WALLET);

  const contract = await ethers.getContractAt("VaccineRegistry", contractAddress, deployer);

  const tx = await contract.transferOwnership(GOOGLE_WALLET);
  await tx.wait();

  console.log("\n✅ Ownership berhasil dipindah ke:", GOOGLE_WALLET);
  console.log("   Logout dari UI → login ulang dengan Google → Owner ✅");
}

main().catch((e) => {
  console.error("❌ Gagal:", e.message);
  process.exit(1);
});
