#  VaxChain — DApps Rekam Vaksin Digital Terverifikasi

> **Tugas Mata Kuliah Blockchain** — Jonathan Albertus Widjaja, Raphael Yoshua Echad, Jason Nathan Winarko, Daniel Sean Wesley Karamoy

---

##  Struktur Project

```
vaccine-dapp/
├── contracts/
│   └── VaccineRegistry.sol       ← Smart contract utama
├── scripts/
│   └── deploy.js                 ← Script deploy + auto-update ABI
├── test/
│   └── VaccineRegistry.test.js   ← Unit test (18 test cases)
├── hardhat.config.js
├── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx               ← Root component + Google login
    │   ├── components/
    │   │   ├── AddRecord.jsx     ← Form catat vaksin (issuer only)
    │   │   ├── VerifyRecord.jsx  ← Verifikasi sertifikat (public)
    │   │   ├── RevokeRecord.jsx  ← Revoke sertifikat (issuer only)
    │   │   └── AdminPanel.jsx    ← Kelola issuer (owner only)
    │   ├── utils/
    │   │   ├── contract.js       ← Semua interaksi ethers.js
    │   │   └── web3auth.js       ← Google Login via Web3Auth
    │   └── abi/
    │       └── VaccineRegistry.json  ← Auto-generated setelah deploy
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

##  Cara Menjalankan (Step by Step)

### LANGKAH 0: Persiapan

Pastikan sudah terinstall:
- **Node.js** v18+ → https://nodejs.org

> Login sekarang menggunakan **Google** via Web3Auth. MetaMask **tidak diperlukan**.

### LANGKAH 1: Daftar Web3Auth & Dapatkan Client ID

1. Buka https://dashboard.web3auth.io → daftar gratis
2. Klik **Create Project**
3. Isi nama project (misal: `VaxChain`)
4. Salin **Client ID** yang digenerate
5. Di bagian **Whitelist URLs**, tambahkan:
   - `http://localhost:5173`
   - URL deploy kamu jika ada (misal: `https://vaxchain.vercel.app`)

### LANGKAH 2: Install Dependencies Contract

```bash
# Masuk ke folder utama
cd vaccine-dapp

# Install hardhat dan tools
npm install
```

### LANGKAH 3: Compile Smart Contract

```bash
npx hardhat compile
```

Output yang diharapkan:
```
Compiled 1 Solidity file successfully
```

### LANGKAH 4: Jalankan Node Lokal (Blockchain Simulasi)

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

### LANGKAH 5: Deploy Kontrak ke Lokal

Di terminal **asli** (bukan yang menjalankan node):
```bash
npx hardhat run scripts/deploy.js --network localhost
```

Output sukses:
```
 VaccineRegistry deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
 ABI & address saved to frontend/src/abi/VaccineRegistry.json
 .env saved to frontend/.env
```

### LANGKAH 6: Setup .env Frontend

Buka file `frontend/.env`, pastikan isinya seperti ini (sesuaikan Client ID kamu):

```env
VITE_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
VITE_CHAIN_ID=31337
VITE_CHAIN_NAME=Hardhat Local
VITE_RPC_URL=http://127.0.0.1:8545
VITE_WEB3AUTH_CLIENT_ID=CLIENT_ID_DARI_DASHBOARD_WEB3AUTH
```

### LANGKAH 7: Jalankan Frontend

```bash
cd frontend
npm install
npm run dev
```

Buka browser: **http://localhost:5173**

### LANGKAH 8: Login & Gunakan DApps

1. Buka http://localhost:5173
2. Klik **Masuk dengan Google**
3. Modal Web3Auth akan muncul → pilih akun Google
4. Wallet blockchain dibuat otomatis — tidak perlu MetaMask
5. Akun yang login akan dikenali sebagai **Public** secara default
6. Untuk akses **Issuer** atau **Admin**, wallet address perlu didaftarkan lewat Admin Panel

> **Catatan untuk Owner:** Wallet address yang dihasilkan Web3Auth perlu didaftarkan sebagai Authorized Issuer melalui Admin Panel. Gunakan akun yang sama setiap login karena Web3Auth menggunakan private key deterministik per akun Google.

---

##  Deploy ke Polygon Amoy Testnet (Gratis!)

### 1. Dapatkan MATIC gratis
- Buka: https://faucet.polygon.technology/
- Masukkan wallet address Anda
- Pilih **Polygon Amoy**

### 2. Buat file `.env` di folder root `vaccine-dapp/`
```env
PRIVATE_KEY=0x_private_key_kamu_disini
POLYGON_AMOY_RPC=https://rpc-amoy.polygon.technology/
```

> ⚠️ **JANGAN** commit `.env` ke GitHub! Tambahkan ke `.gitignore`

### 3. Deploy
```bash
npx hardhat run scripts/deploy.js --network polygonAmoy
```

### 4. Update frontend/.env untuk Amoy
```env
VITE_CHAIN_ID=80002
VITE_CHAIN_NAME=Polygon Amoy
VITE_RPC_URL=https://rpc-amoy.polygon.technology/
VITE_WEB3AUTH_CLIENT_ID=CLIENT_ID_DARI_DASHBOARD_WEB3AUTH
```

---

##  Menjalankan Test

```bash
npx hardhat test
```

Test mencakup:
-  Deployment & initial state
-  Manajemen issuer (authorize, remove)
-  Pencatatan vaksin (addVaccineRecord)
-  Verifikasi sertifikat
-  Revoke sertifikat
-  Access control (non-issuer ditolak)

---

##  Cara Kerja Login (Web3Auth)

Login sebelumnya menggunakan MetaMask langsung. Sekarang diganti dengan **Web3Auth** yang mendukung Google Login:

```
User klik "Masuk dengan Google"
          ↓
  Modal Web3Auth muncul
          ↓
  User pilih akun Google
          ↓
Web3Auth generate private key
deterministik dari akun Google
          ↓
  ethers.js provider & signer
  tersedia — DApps berjalan normal
```

Keuntungan pendekatan ini:
- **Tidak perlu MetaMask** — lebih mudah diakses siapa saja
- **Wallet persisten** — akun Google yang sama selalu menghasilkan wallet address yang sama
- **Tetap Web3** — signer dan provider ethers.js tetap bisa dipakai untuk transaksi on-chain

---

##  Cara Kerja Hash

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

##  Peran dalam Sistem

| Peran | Bisa Apa |
|-------|----------|
| **Owner** | Daftarkan/hapus issuer + semua hak issuer |
| **Authorized Issuer** | Catat vaksin + revoke sertifikat |
| **Public** | Verifikasi sertifikat (read-only) |

---

##  Dependensi Frontend

| Package | Versi | Fungsi |
|---------|-------|--------|
| `react` | ^18.3.1 | UI framework |
| `ethers` | ^6.13.0 | Interaksi blockchain |
| `@web3auth/modal` | 8.12.7 | Google Login modal |
| `@web3auth/base` | 8.12.4 | Web3Auth core |
| `@web3auth/ethereum-provider` | 8.12.4 | EVM provider |
| `html5-qrcode` | latest | QR scan untuk verifikasi |
| `vite-plugin-node-polyfills` | latest | Polyfill Node.js untuk browser |

---

##  FAQ Troubleshooting

**Q: Modal Google Login tidak muncul?**
A: Pastikan `VITE_WEB3AUTH_CLIENT_ID` sudah diisi di `frontend/.env` dan `http://localhost:5173` sudah diwhitelist di dashboard Web3Auth.

**Q: Error `@web3auth/modal` tidak ditemukan?**
A: Jalankan `npm install` di dalam folder `frontend/`, bukan di root project.

**Q: "Wallet ini belum terdaftar sebagai issuer"?**
A: Salin wallet address yang tampil di header setelah login, lalu daftarkan lewat Admin Panel menggunakan akun Owner.

**Q: Wallet address berubah setiap login?**
A: Tidak seharusnya — Web3Auth menghasilkan wallet yang sama selama akun Google-nya sama. Pastikan login dengan akun Google yang sama.

**Q: Transaction gagal gas?**
A: Di hardhat lokal, gas gratis. Di testnet, pastikan punya MATIC.

**Q: Frontend tidak berubah setelah deploy ulang?**
A: Hapus `frontend/src/abi/VaccineRegistry.json` lalu deploy ulang.
