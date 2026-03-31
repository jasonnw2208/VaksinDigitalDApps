require("@nomicfoundation/hardhat-toolbox");

// ⚠️ JANGAN pernah commit file ini dengan private key asli ke GitHub!
// Gunakan environment variable atau .env file (lihat README)

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
      viaIR: true,
    },
  },

  networks: {
    // ── 1. LOCAL (untuk development & testing) ──────────────────────────
    // Jalankan: npx hardhat node
    // Lalu deploy: npx hardhat run scripts/deploy.js --network localhost
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // ── 2. POLYGON AMOY TESTNET (gratis, untuk demo) ─────────────────────
    // Dapatkan MATIC gratis di: https://faucet.polygon.technology/
    // RPC URL: https://rpc-amoy.polygon.technology/
    // Chain ID: 80002
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology/",
      chainId: 80002,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },

    // ── 3. POLYGON MAINNET (production — butuh MATIC asli) ───────────────
    polygon: {
      url: process.env.POLYGON_RPC || "https://polygon-rpc.com",
      chainId: 137,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },

  // Untuk verifikasi kontrak di PolygonScan (opsional)
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
      polygon:     process.env.POLYGONSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL:     "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },
};
