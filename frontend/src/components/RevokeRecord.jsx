// src/components/RevokeRecord.jsx
import { useState } from "react";
import { revokeCertificate, shortAddress } from "../utils/contract";

export default function RevokeRecord({ signer }) {
  const [tokenId, setTokenId] = useState("");
  const [status, setStatus] = useState(null); // null | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleRevoke = async () => {
    if (!tokenId.trim()) return setErrorMsg("Masukkan Token ID!");
    
    if (!window.confirm(`Apakah Anda yakin ingin membatalkan Sertifikat #${tokenId}? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      await revokeCertificate(signer, tokenId);
      setStatus("success");
    } catch (e) {
      console.error(e);
      setErrorMsg(e.reason || e.message || "Gagal membatalkan sertifikat");
      setStatus("error");
    }
  };

  return (
    <div style={s.container}>
      <h2 style={s.title}>
        <span style={s.titleIcon}>⚠️</span>
        Revoke Sertifikat Vaksin
      </h2>
      <p style={s.subtitle}>
        Gunakan menu ini untuk membatalkan sertifikat yang salah input atau terdeteksi fraud.
        <strong> Masukkan Token ID sertifikat.</strong>
      </p>

      <div style={s.card}>
        <label style={s.label}>Token ID Sertifikat</label>
        <div style={s.inputGroup}>
          <input
            style={s.input}
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            placeholder="Contoh: 0, 1, 2..."
          />
          <button
            style={{
              ...s.btn,
              opacity: status === "loading" ? 0.7 : 1,
            }}
            onClick={handleRevoke}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Memproses..." : "Batalkan Sertifikat"}
          </button>
        </div>
      </div>

      {errorMsg && <div style={s.errorBox}>⚠️ {errorMsg}</div>}

      {status === "success" && (
        <div style={s.successBox}>
          ✅ Sertifikat #{tokenId} berhasil dibatalkan di blockchain.
          Status sertifikat sekarang adalah <strong>Revoked</strong>.
        </div>
      )}
    </div>
  );
}

const s = {
  container: { display: "flex", flexDirection: "column", gap: "20px" },
  title: { fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" },
  titleIcon: { fontSize: "24px" },
  subtitle: { color: "#64748b", fontSize: "14px", lineHeight: "1.6" },
  card: {
    padding: "24px", borderRadius: "12px",
    background: "#111827", border: "1px solid #1e293b",
    display: "flex", flexDirection: "column", gap: "12px",
  },
  label: { fontSize: "13px", fontWeight: 600, color: "#94a3b8" },
  inputGroup: { display: "flex", gap: "12px" },
  input: {
    flex: 1, padding: "12px 16px", borderRadius: "10px",
    background: "#1a2332", border: "1px solid #1e293b",
    color: "white", fontSize: "15px",
  },
  btn: {
    padding: "12px 24px", borderRadius: "10px",
    background: "linear-gradient(135deg, #ef4444, #b91c1c)",
    color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer",
  },
  errorBox: {
    padding: "12px 16px", borderRadius: "8px",
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5", fontSize: "14px",
  },
  successBox: {
    padding: "16px", borderRadius: "10px",
    background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
    color: "#10b981", fontSize: "14px",
  },
};
