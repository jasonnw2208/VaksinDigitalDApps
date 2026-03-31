# VaxChain Upgraded: NFT, Merkle, & Seamless Web3

Presentasi peningkatan sistem rekam vaksin digital berbasis blockchain.

---

## 1. Penjelasan Sederhana (Untuk Umum)
Sistem VaxChain telah ditingkatkan dari sekedar pencatatan data menjadi sistem **Sertifikat Digital (NFT)** yang lebih modern. 
- **Sertifikat adalah NFT**: Sertifikat vaksin Anda sekarang berupa gambar unik (NFT) yang tersimpan permanen di blockchain. Sertifikat ini tidak bisa dijual atau dipindahkan ke orang lain (**Soulbound**).
- **Batch Upload (Merkle)**: Rumah sakit sekarang bisa mengunggah ribuan data sekaligus dengan biaya yang sangat murah karena semua data dipadatkan menjadi satu kode unik (Merkle Root).
- **Login Mudah**: Rakyat tidak perlu lagi pusing dengan "Private Key" atau MetaMask. Cukup login dengan Email/Sosial Media (Simulasi Account Abstraction) untuk melihat sertifikat.
- **Verifikasi Instant**: Cukup scan QR Code pada sertifikat menggunakan kamera untuk memastikan keasliannya secara detik itu juga.

---

## 2. Penjelasan Teknis (Untuk Developer/Tech-Savvy)
Upgrade ini melibatkan perubahan fundamental pada arsitektur smart contract dan frontend:
- **EVM Smart Contract (ERC-721)**: Migrasi dari mapping sederhana ke standar NFT. Ditambahkan logika `_update` untuk memblokir fungsi transfer, menjadikannya **Soulbound Token (SBT)**.
- **On-chain Metadata (SVG)**: Gambar sertifikat dihasilkan langsung di dalam kontrak menggunakan `abi.encodePacked` dan Base64 encoding. Tidak ada dependensi ke penyimpanan eksternal (IPFS/Cloud).
- **Merkle Tree Integration**: 
    - **Issuer**: Menghasilkan Merkle Tree dari data CSV, hanya mengunggah **Merkle Root** ke contract.
    - **Citizen**: Melakukan klaim dengan menyerahkan **Merkle Proof**. Contract memverifikasi proof terhadap root menggunakan library `MerkleProof` OpenZeppelin.
- **Account Abstraction (Social Login)**: Implementasi simulasi login sosial yang memetakan identitas email ke alamat wallet deterministik, menyembunyikan kompleksitas infrastruktur blockchain dari pengguna akhir.
- **QR Verification**: QR Code berisi Token ID yang di-scan via `html5-qrcode` library, memicu pemanggilan fungsi `records(tokenId)` secara otomatis.

---

## 3. Cara Mempresentasikan (Demo Guide)

### Fase A: Admin & Faskes (Efisiensi)
1. Buka tab **Admin**, tunjukkan otoritas pendaftaran Faskes.
2. Buka tab **Catat Vaksin**, unggah CSV (6 baris data).
3. Tunjukkan visualisasi **Merkle Tree** yang muncul. Jelaskan: *"Hanya 1 Root Hash yang masuk ke blockchain untuk memverifikasi 6 data ini. Sangat hemat biaya!"*

### Fase B: Warga (User Experience)
1. Logout, lalu klik **Social Login (Demo)**.
2. Buka tab **Sertifikat**. Tunjukkan kotak biru "Claim".
3. Klik **Klaim**, perhatikan animasi **Merkle Proof Path**. Jelaskan: *"Proses ini memverifikasi data saya secara matematis terhadap Root yang diunggah faskes tadi."*
4. Tunjukkan NFT yang berhasil di-mint. Klik detail untuk melihat QR Code.

### Fase C: Verifikasi (Keamanan)
1. Buka tab **Verifikasi**.
2. Klik **📷 Pindai QR**. 
3. (Opsional) Scan QR dari layar atau tulis Token ID-nya.
4. Tunjukkan status **ASLI & TERVERIFIKASI** yang muncul.

---

## 4. Kesimpulan
VaxChain kini bukan sekadar database, melainkan ekosistem identitas digital yang **Scalable** (via Merkle), **Secure** (via NFT/SBT), dan **Accessible** (via Social Login).
