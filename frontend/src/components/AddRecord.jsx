// src/components/AddRecord.jsx
import { useState } from "react";
import {
  addVaccineRecord,
  generateVaccineHash,
  generateNikHash,
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
  const [status,   setStatus]   = useState(null);
  const [result,   setResult]   = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
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
      const salt     = generateSalt();
      const hashData = generateVaccineHash(form.nik, form.namaVaksin, form.kodeProduksi, form.tanggal, salt);
      // Hash NIK untuk mapping pasien (NIK tidak disimpan plaintext)
      const nikHash  = generateNikHash(form.nik);

      const receipt = await addVaccineRecord(signer, hashData, nikHash);

      setResult({
        hash:        hashData,
        salt,
        nikHash,
        txHash:      receipt.hash,
        blockNumber: receipt.blockNumber,
        nik:         form.nik,
        namaVaksin:  form.namaVaksin,
        tanggal:     form.tanggal,
      });
      setStatus("success");
      setForm({ nik: "", namaVaksin: "", kodeProduksi: "", tanggal: new Date().toISOString().split("T")[0] });
    } catch (e) {
      console.error(e);
      setErrorMsg(e.reason || e.message || "Transaksi gagal");
      setStatus("error");
    }
  };

  return (
    <div style={s.container}>
      <h2 style={s.title}><span style={s.titleIcon}>💉</span>Catat Rekam Vaksin Baru</h2>
      <p style={s.subtitle}>
        Data pasien akan di-<em>hash</em> sebelum disimpan. NIK tidak pernah muncul di blockchain.
        Pasien bisa lihat sertifikat dengan login akun sosial + input NIK mereka.
      </p>

      <div style={s.form}>
        <Field label="NIK Pasien" hint="16 digit Nomor Induk Kependudukan" required>
          <input style={s.input} name="nik" value={form.nik} onChange={handleChange}
            placeholder="3201234567890001" maxLength={16} pattern="\d*" />
        </Field>

        <Field label="Jenis Vaksin" required>
          <select style={s.input} name="namaVaksin" value={form.namaVaksin} onChange={handleChange}>
            <option value="">-- Pilih Jenis Vaksin --</option>
            {JENIS_VAKSIN.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>

        <Field label="Kode Produksi / Nomor Batch" hint="Tertera pada kemasan vaksin" required>
          <input style={s.input} name="kodeProduksi" value={form.kodeProduksi} onChange={handleChange}
            placeholder="BATCH-001 / LOT-XYZ123" />
        </Field>

        <Field label="Tanggal Vaksinasi" required>
          <input style={s.input} type="date" name="tanggal" value={form.tanggal} onChange={handleChange} />
        </Field>
      </div>

      {errorMsg && <div style={s.errorBox}>⚠️ {errorMsg}</div>}

      <button style={{ ...s.btn, opacity: status === "loading" ? 0.7 : 1 }}
        onClick={handleSubmit} disabled={status === "loading"}>
        {status === "loading" ? <><span style={s.spinner} />Mengirim ke Blockchain...</> : "✅ Catat ke Blockchain"}
      </button>

      {status === "success" && result && (
        <div style={s.successBox} className="fade-in">
          <div style={s.successHeader}>🎉 Rekam Vaksin Berhasil Dicatat!</div>

          <div style={s.infoCard}>
            <div style={s.infoCardTitle}>📋 Instruksi untuk Pasien</div>
            <p style={s.infoCardText}>
              Minta pasien untuk login di aplikasi ini menggunakan akun Google/sosial mereka,
              lalu buka tab <strong>"Sertifikat Saya"</strong> dan masukkan NIK mereka.
              Sertifikat akan muncul otomatis beserta QR code untuk verifikasi.
            </p>
            <p style={s.infoCardText}>
              <strong>NIK Pasien:</strong> <code style={s.code}>{result.nik}</code>
            </p>
          </div>

          <InfoRow label="Hash Sertifikat" value={result.hash} mono copy />
          <InfoRow label="Transaction Hash" value={result.txHash} mono />
          <InfoRow label="Block Number" value={result.blockNumber?.toString()} />
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label} {required && <span style={{ color: "#ef4444" }}>*</span>}</label>
      {hint && <span style={s.hint}>{hint}</span>}
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, copy }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={s.infoRow}>
      <div style={s.infoLabel}>{label}</div>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ ...s.infoValue, fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit" }}>{value}</div>
        {copy && (
          <button style={s.copyBtn} onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            {copied ? "✓" : "⎘"}
          </button>
        )}
      </div>
    </div>
  );
}

const s = {
  container:    { display: "flex", flexDirection: "column", gap: "20px" },
  title:        { fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" },
  titleIcon:    { fontSize: "24px" },
  subtitle:     { color: "#64748b", fontSize: "14px", lineHeight: "1.6" },
  form:         { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "24px", borderRadius: "12px", background: "#111827", border: "1px solid #1e293b" },
  field:        { display: "flex", flexDirection: "column", gap: "4px" },
  label:        { fontSize: "13px", fontWeight: 600, color: "#94a3b8" },
  hint:         { fontSize: "11px", color: "#4b5563" },
  input:        { padding: "10px 14px", borderRadius: "8px", background: "#1a2332", border: "1px solid #1e293b", color: "#f1f5f9", fontSize: "14px" },
  btn:          { display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", borderRadius: "10px", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", border: "none" },
  spinner:      { width: "16px", height: "16px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", animation: "spin 0.8s linear infinite", display: "inline-block" },
  errorBox:     { padding: "12px 16px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: "14px" },
  successBox:   { padding: "20px", borderRadius: "12px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", display: "flex", flexDirection: "column", gap: "12px" },
  successHeader:{ fontSize: "16px", fontWeight: 700, color: "#10b981" },
  infoCard:     { padding: "14px 16px", borderRadius: "8px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" },
  infoCardTitle:{ fontSize: "13px", fontWeight: 700, color: "#60a5fa", marginBottom: "8px" },
  infoCardText: { fontSize: "13px", color: "#94a3b8", lineHeight: "1.6", margin: "0 0 6px 0" },
  code:         { fontFamily: "'JetBrains Mono', monospace", background: "#1e293b", padding: "2px 6px", borderRadius: "4px" },
  infoRow:      { padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", gap: "4px" },
  infoLabel:    { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" },
  infoValue:    { fontSize: "13px", color: "#94a3b8", wordBreak: "break-all" },
  copyBtn:      { padding: "4px 8px", borderRadius: "4px", fontSize: "14px", background: "#1e293b", color: "#94a3b8", cursor: "pointer", flexShrink: 0, border: "none" },
};
