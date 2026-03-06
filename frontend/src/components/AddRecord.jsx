// src/components/AddRecord.jsx
// Komponen untuk mencatat vaksinasi baru ke blockchain

import { useState } from "react";
import {
  addVaccineRecord,
  generateVaccineHash,
  generateSalt,
} from "../utils/contract";

const JENIS_VAKSIN = [
  "Sinovac (CoronaVac)",
  "AstraZeneca (Vaxzevria)",
  "Pfizer-BioNTech (Comirnaty)",
  "Moderna (Spikevax)",
  "Janssen (Johnson & Johnson)",
  "Sinopharm",
  "Vaksin Meningitis",
  "Vaksin Influenza",
  "Vaksin Hepatitis B",
  "Lainnya",
];

export default function AddRecord({ signer, issuerAddress }) {
  const [form, setForm] = useState({
    nik:          "",
    namaVaksin:   "",
    kodeProduksi: "",
    tanggal:      new Date().toISOString().split("T")[0],
  });
  const [status, setStatus] = useState(null); // null | loading | success | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async () => {
    // Validasi
    if (!form.nik || !form.namaVaksin || !form.kodeProduksi || !form.tanggal) {
      setErrorMsg("Semua field wajib diisi!");
      return;
    }
    if (form.nik.length !== 16 || !/^\d+$/.test(form.nik)) {
      setErrorMsg("NIK harus terdiri dari 16 digit angka.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setResult(null);

    try {
      // 1. Generate salt unik
      const salt = generateSalt();

      // 2. Hash data (NIK tidak masuk ke blockchain mentah!)
      const hashData = generateVaccineHash(
        form.nik,
        form.namaVaksin,
        form.kodeProduksi,
        form.tanggal,
        salt
      );

      // 3. Kirim ke blockchain
      const receipt = await addVaccineRecord(signer, hashData);

      setResult({
        hash:         hashData,
        salt,
        txHash:       receipt.hash,
        blockNumber:  receipt.blockNumber,
        rawData: `${form.nik}|${form.namaVaksin}|${form.kodeProduksi}|${form.tanggal}|${salt}`,
      });
      setStatus("success");

      // Reset form
      setForm({
        nik: "", namaVaksin: "", kodeProduksi: "",
        tanggal: new Date().toISOString().split("T")[0],
      });
    } catch (e) {
      console.error(e);
      setErrorMsg(e.reason || e.message || "Transaksi gagal");
      setStatus("error");
    }
  };

  return (
    <div style={s.container}>
      <h2 style={s.title}>
        <span style={s.titleIcon}>💉</span>
        Catat Rekam Vaksin Baru
      </h2>
      <p style={s.subtitle}>
        Data pasien akan di-<em>hash</em> sebelum disimpan. NIK tidak pernah muncul di blockchain.
      </p>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <div style={s.form}>
        <Field
          label="NIK Pasien"
          hint="16 digit Nomor Induk Kependudukan"
          required
        >
          <input
            style={s.input}
            name="nik"
            value={form.nik}
            onChange={handleChange}
            placeholder="3201234567890001"
            maxLength={16}
            pattern="\d*"
          />
        </Field>

        <Field label="Jenis Vaksin" required>
          <select style={s.input} name="namaVaksin" value={form.namaVaksin} onChange={handleChange}>
            <option value="">-- Pilih Jenis Vaksin --</option>
            {JENIS_VAKSIN.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>

        <Field
          label="Kode Produksi / Nomor Batch"
          hint="Tertera pada kemasan vaksin"
          required
        >
          <input
            style={s.input}
            name="kodeProduksi"
            value={form.kodeProduksi}
            onChange={handleChange}
            placeholder="BATCH-001 / LOT-XYZ123"
          />
        </Field>

        <Field label="Tanggal Vaksinasi" required>
          <input
            style={s.input}
            type="date"
            name="tanggal"
            value={form.tanggal}
            onChange={handleChange}
          />
        </Field>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div style={s.errorBox}>⚠️ {errorMsg}</div>
      )}

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <button
        style={{
          ...s.btn,
          opacity: status === "loading" ? 0.7 : 1,
        }}
        onClick={handleSubmit}
        disabled={status === "loading"}
      >
        {status === "loading" ? (
          <>
            <span style={s.spinner} />
            Mengirim ke Blockchain...
          </>
        ) : (
          "✅ Catat ke Blockchain"
        )}
      </button>

      {/* ── Hasil sukses ─────────────────────────────────────────────────── */}
      {status === "success" && result && (
        <div style={s.successBox} className="fade-in">
          <div style={s.successHeader}>🎉 Rekam Vaksin Berhasil Dicatat!</div>

          <InfoRow label="Hash Sertifikat" value={result.hash} mono copy />
          <InfoRow label="Salt (SIMPAN INI!)" value={result.salt} mono copy
            hint="Salt diperlukan untuk membuktikan kepemilikan. Simpan di tempat aman!" />
          <InfoRow label="Transaction Hash" value={result.txHash} mono />
          <InfoRow label="Block Number" value={result.blockNumber?.toString()} />

          <div style={s.warningBox}>
            ⚠️ <strong>PENTING:</strong> Simpan salt di atas dengan aman. Salt + data asli
            diperlukan untuk verifikasi manual kepemilikan sertifikat.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Komponen kecil ────────────────────────────────────────────────────────────
function Field({ label, hint, required, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>
        {label} {required && <span style={{ color: "#ef4444" }}>*</span>}
      </label>
      {hint && <span style={s.hint}>{hint}</span>}
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, copy, hint }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={s.infoRow}>
      <div style={s.infoLabel}>{label}</div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ ...s.infoValue, fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit" }}>
          {value}
        </div>
        {copy && (
          <button style={s.copyBtn} onClick={handleCopy}>
            {copied ? "✓" : "⎘"}
          </button>
        )}
      </div>
      {hint && <div style={s.infoHint}>{hint}</div>}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  container: { display: "flex", flexDirection: "column", gap: "20px" },
  title: {
    fontSize: "20px", fontWeight: 700,
    display: "flex", alignItems: "center", gap: "10px",
  },
  titleIcon: { fontSize: "24px" },
  subtitle: { color: "#64748b", fontSize: "14px" },
  form: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px",
    padding: "24px", borderRadius: "12px",
    background: "#111827", border: "1px solid #1e293b",
  },
  field: { display: "flex", flexDirection: "column", gap: "4px" },
  label: { fontSize: "13px", fontWeight: 600, color: "#94a3b8" },
  hint:  { fontSize: "11px", color: "#4b5563" },
  input: {
    padding: "10px 14px", borderRadius: "8px",
    background: "#1a2332", border: "1px solid #1e293b",
    color: "#f1f5f9", fontSize: "14px",
    transition: "border-color 0.15s",
  },
  btn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    padding: "14px", borderRadius: "10px",
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    color: "white", fontSize: "15px", fontWeight: 700,
    cursor: "pointer",
  },
  spinner: {
    width: "16px", height: "16px", borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white",
    animation: "spin 0.8s linear infinite", display: "inline-block",
  },
  errorBox: {
    padding: "12px 16px", borderRadius: "8px",
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5", fontSize: "14px",
  },
  successBox: {
    padding: "20px", borderRadius: "12px",
    background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
    display: "flex", flexDirection: "column", gap: "12px",
  },
  successHeader: {
    fontSize: "16px", fontWeight: 700, color: "#10b981", marginBottom: "4px",
  },
  infoRow: {
    padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
    display: "flex", flexDirection: "column", gap: "4px",
  },
  infoLabel: { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" },
  infoValue: { fontSize: "13px", color: "#94a3b8", wordBreak: "break-all" },
  infoHint:  { fontSize: "11px", color: "#f59e0b" },
  copyBtn: {
    padding: "4px 8px", borderRadius: "4px", fontSize: "14px",
    background: "#1e293b", color: "#94a3b8", cursor: "pointer", flexShrink: 0,
  },
  warningBox: {
    padding: "12px", borderRadius: "8px", fontSize: "13px",
    background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)",
    color: "#fcd34d",
  },
};
