// src/components/RevokeRecord.jsx
// Revoke / batalkan sertifikat yang salah input

import { useState } from "react";
import { revokeCertificate } from "../utils/contract";

export default function RevokeRecord({ signer }) {
  const [hash, setHash]       = useState("");
  const [reason, setReason]   = useState("");
  const [status, setStatus]   = useState(null);
  const [txHash, setTxHash]   = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleRevoke = async () => {
    const h = hash.trim();
    if (!h) { setErrorMsg("Masukkan hash sertifikat!"); return; }
    if (!/^0x[0-9a-fA-F]{64}$/.test(h)) {
      setErrorMsg("Format hash tidak valid.");
      return;
    }
    if (!reason.trim()) { setErrorMsg("Mohon isi alasan revoke."); return; }

    // Konfirmasi
    const ok = window.confirm(
      `Anda akan merevoke sertifikat:\n${h}\n\nAlasan: ${reason}\n\nLanjutkan?`
    );
    if (!ok) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const receipt = await revokeCertificate(signer, h);
      setTxHash(receipt.hash);
      setStatus("success");
      setHash("");
      setReason("");
    } catch (e) {
      console.error(e);
      setErrorMsg(e.reason || e.message || "Revoke gagal");
      setStatus("error");
    }
  };

  return (
    <div style={s.container}>
      <h2 style={s.title}>
        <span style={s.titleIcon}>🚫</span>
        Revoke Sertifikat
      </h2>
      <p style={s.subtitle}>
        Gunakan fitur ini untuk membatalkan sertifikat yang salah input atau penipuan.
        Data tidak dihapus dari blockchain — hanya ditandai sebagai <em>revoked</em>.
        Jejak audit tetap tercatat secara transparan.
      </p>

      <div style={s.warningBanner}>
        ⚠️ <strong>Perhatian:</strong> Tindakan revoke bersifat permanen dan tidak dapat diurungkan.
        Pastikan hash yang dimasukkan sudah benar.
      </div>

      <div style={s.form}>
        <div style={s.field}>
          <label style={s.label}>Hash Sertifikat yang Akan Direvoke *</label>
          <input
            style={s.input}
            value={hash}
            onChange={e => setHash(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
          />
        </div>

        <div style={s.field}>
          <label style={s.label}>Alasan Revoke *</label>
          <textarea
            style={{ ...s.input, height: "80px", resize: "vertical" }}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Contoh: Salah input NIK, Pasien tidak jadi divaksin, Dugaan pemalsuan..."
          />
        </div>
      </div>

      {errorMsg && (
        <div style={s.errorBox}>⚠️ {errorMsg}</div>
      )}

      <button
        style={{ ...s.btn, opacity: status === "loading" ? 0.7 : 1 }}
        onClick={handleRevoke}
        disabled={status === "loading"}
      >
        {status === "loading" ? (
          <><span style={s.spinner} /> Memproses Revoke...</>
        ) : (
          "🚫 Revoke Sertifikat"
        )}
      </button>

      {status === "success" && txHash && (
        <div style={s.successBox} className="fade-in">
          <div style={s.successTitle}>✅ Sertifikat Berhasil Direvoke</div>
          <div style={s.txRow}>
            <span style={s.txLabel}>Transaction Hash:</span>
            <span style={s.txValue}>{txHash}</span>
          </div>
          <p style={{ fontSize: "13px", color: "#64748b" }}>
            Sertifikat tidak akan lolos verifikasi mulai sekarang. Jejak revoke telah
            dicatat secara permanen di blockchain.
          </p>
        </div>
      )}
    </div>
  );
}

const s = {
  container:    { display: "flex", flexDirection: "column", gap: "20px" },
  title:        { fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" },
  titleIcon:    { fontSize: "24px" },
  subtitle:     { color: "#64748b", fontSize: "14px" },
  warningBanner: {
    padding: "12px 16px", borderRadius: "8px", fontSize: "14px",
    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
    color: "#fca5a5",
  },
  form: {
    display: "flex", flexDirection: "column", gap: "16px",
    padding: "24px", borderRadius: "12px",
    background: "#111827", border: "1px solid #1e293b",
  },
  field:  { display: "flex", flexDirection: "column", gap: "6px" },
  label:  { fontSize: "13px", fontWeight: 600, color: "#94a3b8" },
  input: {
    padding: "10px 14px", borderRadius: "8px",
    background: "#1a2332", border: "1px solid #1e293b",
    color: "#f1f5f9", fontSize: "13px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  errorBox: {
    padding: "12px 16px", borderRadius: "8px",
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5", fontSize: "14px",
  },
  btn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    padding: "14px", borderRadius: "10px",
    background: "linear-gradient(135deg, #ef4444, #b91c1c)",
    color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer",
  },
  spinner: {
    width: "16px", height: "16px", borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white",
    animation: "spin 0.8s linear infinite", display: "inline-block",
  },
  successBox: {
    padding: "20px", borderRadius: "12px",
    background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
    display: "flex", flexDirection: "column", gap: "12px",
  },
  successTitle: { fontSize: "16px", fontWeight: 700, color: "#10b981" },
  txRow:   { display: "flex", flexDirection: "column", gap: "4px" },
  txLabel: { fontSize: "11px", color: "#64748b", textTransform: "uppercase" },
  txValue: { fontSize: "12px", fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8", wordBreak: "break-all" },
};
