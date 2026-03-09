// scripts/deploy.js
// Jalankan: npx hardhat run scripts/deploy.js --network localhost
//       atau: npx hardhat run scripts/deploy.js --network polygonAmoy

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("   DApps Rekam Vaksin Digital — Deploy Script");
  console.log("═══════════════════════════════════════════════════\n");

  // Ambil info deployer
  const [deployer] = await ethers.getSigners();
  console.log(" Deployer address :", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(" Balance          :", ethers.formatEther(balance), "ETH/MATIC\n");

  // Deploy kontrak
  console.log(" Deploying VaccineRegistry...");
  const VaccineRegistry = await ethers.getContractFactory("VaccineRegistry");
  const contract = await VaccineRegistry.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(" VaccineRegistry deployed to:", contractAddress);

  // Tambahkan beberapa issuer contoh (hanya untuk testing lokal)
  const network = await ethers.provider.getNetwork();
  if (network.chainId === 31337n) {
    console.log("\n Adding sample issuers for local testing...");
    const signers = await ethers.getSigners();

    // Signer[1] = RSCM
    await contract.authorizeIssuer(
      signers[1].address,
      "RSUP Dr. Cipto Mangunkusumo"
    );
    console.log("   RSUP Dr. Cipto Mangunkusumo:", signers[1].address);

    // Signer[2] = Puskesmas
    await contract.authorizeIssuer(
      signers[2].address,
      "Puskesmas Kebayoran Baru"
    );
    console.log("   Puskesmas Kebayoran Baru   :", signers[2].address);
  }

  // ─── Simpan ABI + address ke folder frontend ───────────────────────────
  const artifact = await artifacts.readArtifact("VaccineRegistry");

  const deploymentInfo = {
    address:   contractAddress,
    network:   network.chainId.toString(),
    deployer:  deployer.address,
    timestamp: new Date().toISOString(),
    abi:       artifact.abi,
  };

  // Tulis ke folder frontend/src/abi/
  const abiDir = path.join(__dirname, "../frontend/src/abi");
  if (!fs.existsSync(abiDir)) fs.mkdirSync(abiDir, { recursive: true });

  fs.writeFileSync(
    path.join(abiDir, "VaccineRegistry.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n ABI & address saved to frontend/src/abi/VaccineRegistry.json");

  // Tulis juga .env untuk frontend
  const envContent = `VITE_CONTRACT_ADDRESS=${contractAddress}\nVITE_CHAIN_ID=${network.chainId}\n`;
  fs.writeFileSync(path.join(__dirname, "../frontend/.env"), envContent);
  console.log(" .env saved to frontend/.env");

  console.log("\n═══════════════════════════════════════════════════");
  console.log(" DEPLOYMENT BERHASIL!");
  console.log("   Contract address:", contractAddress);
  console.log("\n Langkah selanjutnya:");
  console.log("   1. cd frontend && npm install && npm run dev");
  console.log("   2. Buka browser: http://localhost:5173");
  console.log("   3. Connect MetaMask ke jaringan yang sesuai");
  console.log("═══════════════════════════════════════════════════");
}

main().catch((error) => {
  console.error(" Deploy gagal:", error);
  process.exit(1);
});
