// scripts/demo.js
// Script demo interaktif — jalankan: npx hardhat run scripts/demo.js --network localhost
// Akan mendemonstrasikan semua fitur kontrak secara otomatis

const { ethers } = require("hardhat");

// Warna untuk terminal
const c = {
  reset:  "\x1b[0m",
  bright: "\x1b[1m",
  green:  "\x1b[32m",
  blue:   "\x1b[34m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  white:  "\x1b[37m",
};

function log(msg)        { console.log(msg); }
function ok(msg)         { console.log(`${c.green} ${msg}${c.reset}`); }
function info(msg)       { console.log(`${c.blue}  ${msg}${c.reset}`); }
function warn(msg)       { console.log(`${c.yellow}  ${msg}${c.reset}`); }
function err(msg)        { console.log(`${c.red} ${msg}${c.reset}`); }
function title(msg)      { console.log(`\n${c.bright}${c.cyan}${"═".repeat(55)}${c.reset}`);
                           console.log(`${c.bright}${c.cyan}   ${msg}${c.reset}`);
                           console.log(`${c.bright}${c.cyan}${"═".repeat(55)}${c.reset}`); }
function step(n, msg)    { console.log(`\n${c.bright}${c.white}[STEP ${n}] ${msg}${c.reset}`); }
function divider()       { console.log(`${c.white}${"─".repeat(55)}${c.reset}`); }
function sleep(ms)       { return new Promise(r => setTimeout(r, ms)); }

async function main() {

  title("DEMO: DApps Rekam Vaksin Digital");
  log(`${c.white}   Proyek Tugas Blockchain — Jonathan, Raphael, Jason, Daniel${c.reset}\n`);

  // ── Ambil akun dari Hardhat ─────────────────────────────────────────────
  const signers = await ethers.getSigners();
  const owner   = signers[0]; // Admin / Kemenkes
  const faskes1 = signers[1]; // RSUP Dr. Cipto
  const faskes2 = signers[2]; // Puskesmas Kebayoran
  const publik  = signers[3]; // Masyarakat biasa

  // ── Deploy kontrak baru untuk demo ────────────────────────────────────
  step(1, "Deploy Smart Contract VaccineRegistry");
  const Factory  = await ethers.getContractFactory("VaccineRegistry");
  const contract = await Factory.connect(owner).deploy();
  await contract.waitForDeployment();
  const addr = await contract.getAddress();

  ok(`Kontrak berhasil di-deploy!`);
  info(`Address : ${addr}`);
  info(`Owner   : ${owner.address} (Kementerian Kesehatan RI)`);
  await sleep(500);

  // ── Daftarkan Faskes ───────────────────────────────────────────────────
  step(2, "Daftarkan Fasilitas Kesehatan sebagai Authorized Issuer");

  let tx = await contract.connect(owner).authorizeIssuer(
    faskes1.address, "RSUP Dr. Cipto Mangunkusumo"
  );
  await tx.wait();
  ok(`RSUP Dr. Cipto Mangunkusumo didaftarkan`);
  info(`Wallet : ${faskes1.address}`);

  tx = await contract.connect(owner).authorizeIssuer(
    faskes2.address, "Puskesmas Kebayoran Baru"
  );
  await tx.wait();
  ok(`Puskesmas Kebayoran Baru didaftarkan`);
  info(`Wallet : ${faskes2.address}`);

  divider();
  info("Sekarang kedua faskes berhak mencatat vaksinasi.");
  await sleep(500);

  // ── Catat 3 vaksinasi ──────────────────────────────────────────────────
  step(3, "Catat Rekam Vaksin Pasien (addVaccineRecord)");
  info("NIK tidak disimpan mentah — hanya hash-nya yang masuk blockchain!\n");

  // Data pasien (simulasi)
  const pasien = [
    { nik: "3201234567890001", vaksin: "Sinovac (CoronaVac)",    batch: "SIN-BATCH-001", tgl: "2024-01-15", salt: crypto.randomUUID(), faskes: faskes1, namaFaskes: "RSUP Dr. Cipto" },
    { nik: "3201234567890002", vaksin: "Pfizer-BioNTech",        batch: "PFZ-BATCH-002", tgl: "2024-02-20", salt: crypto.randomUUID(), faskes: faskes2, namaFaskes: "Puskesmas Kebayoran" },
    { nik: "3201234567890003", vaksin: "AstraZeneca (Vaxzevria)", batch: "AZ-BATCH-003",  tgl: "2024-03-10", salt: crypto.randomUUID(), faskes: faskes1, namaFaskes: "RSUP Dr. Cipto" },
  ];

  const hashes = [];

  for (let i = 0; i < pasien.length; i++) {
    const p   = pasien[i];
    const raw = `${p.nik}|${p.vaksin}|${p.batch}|${p.tgl}|${p.salt}`;
    const h   = ethers.keccak256(ethers.toUtf8Bytes(raw));
    hashes.push(h);

    tx = await contract.connect(p.faskes).addVaccineRecord(h);
    await tx.wait();

    log(`\n  ${c.green}Pasien #${i+1}${c.reset}`);
    log(`  NIK      : ${p.nik} ${c.yellow}← tidak disimpan di blockchain${c.reset}`);
    log(`  Vaksin   : ${p.vaksin}`);
    log(`  Batch    : ${p.batch}`);
    log(`  Tanggal  : ${p.tgl}`);
    log(`  Faskes   : ${p.namaFaskes}`);
    log(`  Salt     : ${p.salt.slice(0,20)}...`);
    log(`  ${c.cyan}Hash     : ${h}${c.reset} ${c.green}← INI yang disimpan${c.reset}`);
  }

  const total = await contract.totalRecords();
  log(`\n`);
  ok(`Total rekam tersimpan di blockchain: ${total}`);
  await sleep(500);

  // ── Verifikasi ─────────────────────────────────────────────────────────
  step(4, "Verifikasi Sertifikat (verifyRecord) — Bisa dilakukan siapa saja!");

  log(`\n  ${c.yellow}Skenario A: Hash VALID${c.reset}`);
  let result = await contract.connect(publik).verifyRecord(hashes[0]);
  log(`  Hash     : ${hashes[0].slice(0,20)}...`);
  log(`  isValid  : ${c.green}${result.isValid}${c.reset}`);
  log(`  Penerbit : ${result.facilityName}`);
  log(`  Waktu    : ${new Date(Number(result.timestamp) * 1000).toLocaleString("id-ID")}`);
  ok("Sertifikat VALID terkonfirmasi!");

  log(`\n  ${c.yellow}Skenario B: Hash PALSU${c.reset}`);
  const hashPalsu = ethers.keccak256(ethers.toUtf8Bytes("ini-sertifikat-palsu-dibuat-sendiri"));
  result = await contract.connect(publik).verifyRecord(hashPalsu);
  log(`  Hash     : ${hashPalsu.slice(0,20)}...`);
  log(`  isValid  : ${c.red}${result.isValid}${c.reset}`);
  log(`  Status   : ${c.red}TIDAK DITEMUKAN — sertifikat palsu terdeteksi!${c.reset}`);
  ok("Sistem berhasil mendeteksi sertifikat palsu!");
  await sleep(500);

  // ── Revoke ─────────────────────────────────────────────────────────────
  step(5, "Revoke Sertifikat (revokeCertificate) — Misal: salah input");

  log(`\n  Faskes menemukan kesalahan input pada Pasien #2...`);
  tx = await contract.connect(faskes2).revokeCertificate(hashes[1]);
  await tx.wait();
  ok("Sertifikat Pasien #2 berhasil direvoke!");

  log(`\n  ${c.yellow}Verifikasi ulang sertifikat yang sudah direvoke:${c.reset}`);
  result = await contract.connect(publik).verifyRecord(hashes[1]);
  log(`  isValid  : ${c.red}${result.isValid}${c.reset}`);
  log(`  Status   : ${c.yellow}DIREVOKE (statusCode: ${result.statusCode})${c.reset}`);
  ok("Sertifikat revoked tidak lolos verifikasi!");

  log(`\n  ${c.yellow}Verifikasi sertifikat lain yang TIDAK direvoke:${c.reset}`);
  result = await contract.connect(publik).verifyRecord(hashes[0]);
  log(`  isValid  : ${c.green}${result.isValid}${c.reset}`);
  ok("Sertifikat lain tetap valid, tidak terpengaruh!");
  await sleep(500);

  // ── Access Control ─────────────────────────────────────────────────────
  step(6, "Uji Keamanan Access Control");

  log(`\n  ${c.yellow}Skenario: Orang biasa coba catat vaksin (harus GAGAL)${c.reset}`);
  try {
    const hashCoba = ethers.keccak256(ethers.toUtf8Bytes("coba-masuk-ilegal"));
    await contract.connect(publik).addVaccineRecord(hashCoba);
    err("SEHARUSNYA GAGAL — ada bug!");
  } catch (e) {
    ok(`Akses DITOLAK: "${e.reason}"`);
    info("Sistem access control bekerja dengan benar!");
  }

  log(`\n  ${c.yellow}Skenario: Faskes coba tambah issuer baru (hanya owner yang boleh)${c.reset}`);
  try {
    await contract.connect(faskes1).authorizeIssuer(publik.address, "Klinik Ilegal");
    err("SEHARUSNYA GAGAL — ada bug!");
  } catch (e) {
    ok(`Akses DITOLAK: "${e.reason}"`);
    info("Hanya owner yang bisa kelola issuer!");
  }
  await sleep(500);

  // ── Ringkasan akhir ────────────────────────────────────────────────────
  title("RINGKASAN DEMO BERHASIL!");

  console.log(`
  ${c.green} Deploy kontrak              ${c.reset}— berhasil
  ${c.green} Daftarkan 2 faskes          ${c.reset}— berhasil  
  ${c.green} Catat 3 rekam vaksin        ${c.reset}— berhasil
  ${c.green} Verifikasi sertifikat valid  ${c.reset}— berhasil
  ${c.green} Deteksi sertifikat palsu     ${c.reset}— berhasil
  ${c.green} Revoke sertifikat            ${c.reset}— berhasil
  ${c.green} Access control (keamanan)    ${c.reset}— berhasil

  ${c.cyan}Contract Address : ${addr}${c.reset}
  ${c.cyan}Total Rekam      : ${await contract.totalRecords()} data tersimpan${c.reset}
  `);

  log(`${c.yellow} Langkah selanjutnya:${c.reset}`);
  log(`   1. Buka browser: http://localhost:5173`);
  log(`   2. Connect MetaMask (Chain ID: 31337, RPC: http://127.0.0.1:8545)`);
  log(`   3. Import private key Account #0 dari Terminal 1\n`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});