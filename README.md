# 🛡️ VaxChain — DApps Rekam Vaksin Digital Terverifikasi

> **Tugas Mata Kuliah Blockchain** — Jonathan, Raphael, Jason, Daniel

---

## 📦 Struktur Project

```
vaccine-dapp/
├── contracts/
│   └── VaccineRegistry.sol     ← Smart contract utama
├── scripts/
│   └── deploy.js               ← Script deploy + auto-update ABI
├── test/
│   └── VaccineRegistry.test.js ← Unit test (18 test cases)
├── hardhat.config.js
├── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx              ← Root component + wallet connection
    │   ├── components/
    │   │   ├── AddRecord.jsx    ← Form catat vaksin (issuer only)
    │   │   ├── VerifyRecord.jsx ← Verifikasi sertifikat (public)
    │   │   ├── RevokeRecord.jsx ← Revoke sertifikat (issuer only)
    │   │   └── AdminPanel.jsx   ← Kelola issuer (owner only)
    │   ├── utils/
    │   │   └── contract.js     ← Semua interaksi ethers.js
    │   └── abi/
    │       └── VaccineRegistry.json  ← Auto-generated setelah deploy
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## 🚀 Cara Menjalankan (Step by Step)

### LANGKAH 0: Persiapan

Pastikan sudah terinstall:
- **Node.js** v18+ → https://nodejs.org
- **MetaMask** browser extension → https://metamask.io

### LANGKAH 1: Install Dependencies Contract

```bash
# Masuk ke folder utama
cd vaccine-dapp

# Install hardhat dan tools
npm install
```

### LANGKAH 2: Compile Smart Contract

```bash
npx hardhat compile
```

Output yang diharapkan:
```
Compiled 1 Solidity file successfully
```

### LANGKAH 3: Jalankan Node Lokal (Blockchain Simulasi)

Buka **terminal baru** dan jalankan:
```bash
npx hardhat node
```

Terminal akan menampilkan 20 akun dengan private key.
**Salin private key akun pertama (Account #0)** — ini adalah owner/deployer.

Contoh output:
```
Account #0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### LANGKAH 4: Deploy Kontrak ke Lokal

Di terminal **asli** (bukan yang menjalankan node):
```bash
npx hardhat run scripts/deploy.js --network localhost
```

Output sukses:
```
✅ VaccineRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
📁 ABI & address saved to frontend/src/abi/VaccineRegistry.json
📁 .env saved to frontend/.env
```

### LANGKAH 5: Jalankan Frontend

```bash
cd frontend
npm install
npm run dev
```

Buka browser: **http://localhost:5173**

### LANGKAH 6: Setup MetaMask

1. Buka MetaMask → **Add Network** → **Add network manually**
2. Isi data:
   - Network Name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency Symbol: `ETH`
3. **Import Account** menggunakan private key dari LANGKAH 3

### LANGKAH 7: Gunakan DApps!

1. Buka http://localhost:5173
2. Klik **Connect MetaMask**
3. Pilih akun yang sudah diimport
4. Karena akun ini adalah Owner, Anda akan melihat semua tab: Verifikasi, Catat Vaksin, Revoke, Admin

---

## 🌐 Deploy ke Polygon Amoy Testnet (Gratis!)

### 1. Dapatkan MATIC gratis
- Buka: https://faucet.polygon.technology/
- Masukkan wallet address Anda
- Pilih **Polygon Amoy**

### 2. Buat file `.env` di folder `vaccine-dapp/`
```
PRIVATE_KEY=0x_private_key_metamask_kamu_disini
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology/
```

> ⚠️ **JANGAN** commit `.env` ke GitHub! Tambahkan ke `.gitignore`

### 3. Deploy
```bash
npx hardhat run scripts/deploy.js --network polygonAmoy
```

### 4. Setup MetaMask untuk Amoy
- Network Name: `Polygon Amoy`
- RPC URL: `https://rpc-amoy.polygon.technology/`
- Chain ID: `80002`
- Currency: `MATIC`

---

## 🧪 Menjalankan Test

```bash
npx hardhat test
```

Test mencakup:
- ✅ Deployment & initial state
- ✅ Manajemen issuer (authorize, remove)
- ✅ Pencatatan vaksin (addVaccineRecord)
- ✅ Verifikasi sertifikat
- ✅ Revoke sertifikat
- ✅ Access control (non-issuer ditolak)

---

## 🔑 Cara Kerja Hash

Data pasien TIDAK disimpan mentah di blockchain. Alurnya:

```
NIK + JenisVaksin + KodeProduksi + Tanggal + Salt (UUID acak)
                          ↓
               keccak256( raw string )
                          ↓
              Hash bytes32 → disimpan ke blockchain
```

Keuntungan:
- **Privasi**: NIK tidak bisa dibaca dari blockchain
- **Anti brute-force**: Salt unik mencegah rainbow table attack
- **Verifiable**: Pemilik sertifikat bisa buktikan keaslian dengan menunjukkan data asli + salt

---

## 👥 Peran dalam Sistem

| Peran | Bisa Apa |
|-------|----------|
| **Owner** | Daftarkan/hapus issuer + semua hak issuer |
| **Authorized Issuer** | Catat vaksin + revoke sertifikat |
| **Public** | Verifikasi sertifikat (read-only) |

---

## ❓ FAQ Troubleshooting

**Q: MetaMask menolak koneksi?**
A: Pastikan Chain ID = 31337 dan RPC URL = http://127.0.0.1:8545

**Q: "Wallet ini belum terdaftar"?**
A: Gunakan akun owner untuk mendaftarkan wallet Anda lewat Admin Panel

**Q: Transaction gagal gas?**
A: Di hardhat lokal, gas gratis. Di testnet, pastikan punya MATIC.

**Q: Frontend tidak berubah setelah deploy ulang?**
A: Hapus `frontend/src/abi/VaccineRegistry.json` lalu deploy ulang.
