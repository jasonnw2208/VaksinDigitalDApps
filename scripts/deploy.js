// scripts/deploy.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("   DApps Rekam Vaksin Digital — Deploy Script");
  console.log("═══════════════════════════════════════════════════\n");

  const [deployer] = await ethers.getSigners();
  console.log(" Deployer address :", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(" Balance          :", ethers.formatEther(balance), "ETH/MATIC\n");

  console.log(" Deploying VaccineRegistry...");
  const VaccineRegistry = await ethers.getContractFactory("VaccineRegistry");
  const contract = await VaccineRegistry.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(" VaccineRegistry deployed to:", contractAddress);

  const network = await ethers.provider.getNetwork();
  if (network.chainId === 31337n) {
    console.log("\n Adding sample issuers for local testing...");
    const signers = await ethers.getSigners();

    await contract.authorizeIssuer(signers[1].address, "RSUP Dr. Cipto Mangunkusumo");
    console.log("   RSUP Dr. Cipto Mangunkusumo:", signers[1].address);

    await contract.authorizeIssuer(signers[2].address, "Puskesmas Kebayoran Baru");
    console.log("   Puskesmas Kebayoran Baru   :", signers[2].address);
  }

  // Simpan ABI + address ke folder frontend
  const artifact = await artifacts.readArtifact("VaccineRegistry");
  const deploymentInfo = {
    address:   contractAddress,
    network:   network.chainId.toString(),
    deployer:  deployer.address,
    timestamp: new Date().toISOString(),
    abi:       artifact.abi,
  };

  const abiDir = path.join(__dirname, "../frontend/src/abi");
  if (!fs.existsSync(abiDir)) fs.mkdirSync(abiDir, { recursive: true });

  fs.writeFileSync(
    path.join(abiDir, "VaccineRegistry.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n ABI & address saved to frontend/src/abi/VaccineRegistry.json");

  // ─── Update .env tanpa menghapus variabel lain yang sudah ada ───────────
  const envPath = path.join(__dirname, "../frontend/.env");

  // Baca .env yang ada (kalau ada)
  let existingEnv = "";
  if (fs.existsSync(envPath)) {
    existingEnv = fs.readFileSync(envPath, "utf8");
  }

  // Parse baris-baris yang sudah ada ke dalam object
  const envVars = {};
  existingEnv.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx > -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        envVars[key] = val;
      }
    }
  });

  // Update/tambah hanya 2 variabel yang berkaitan dengan deploy
  envVars["VITE_CONTRACT_ADDRESS"] = contractAddress;
  envVars["VITE_CHAIN_ID"]         = network.chainId.toString();

  // Pastikan variabel Web3Auth ada (isi default kalau belum ada)
  if (!envVars["VITE_CHAIN_NAME"]) envVars["VITE_CHAIN_NAME"] = "Hardhat Local";
  if (!envVars["VITE_RPC_URL"])    envVars["VITE_RPC_URL"]    = "http://127.0.0.1:8545";
  if (!envVars["VITE_WEB3AUTH_CLIENT_ID"]) envVars["VITE_WEB3AUTH_CLIENT_ID"] = "YOUR_WEB3AUTH_CLIENT_ID_HERE";

  // Tulis kembali semua variabel
  const newEnvContent = Object.entries(envVars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n";

  fs.writeFileSync(envPath, newEnvContent);
  console.log(" .env updated (variabel lain tetap tersimpan)");

  console.log("\n═══════════════════════════════════════════════════");
  console.log(" DEPLOYMENT BERHASIL!");
  console.log("   Contract address:", contractAddress);
  console.log("\n Langkah selanjutnya:");
  console.log("   1. cd frontend && npm run dev");
  console.log("   2. Buka browser: http://localhost:5173");
  console.log("═══════════════════════════════════════════════════");
}

main().catch((error) => {
  console.error(" Deploy gagal:", error);
  process.exit(1);
});
