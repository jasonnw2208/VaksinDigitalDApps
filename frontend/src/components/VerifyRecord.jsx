// src/components/VerifyRecord.jsx
// Siapa saja bisa verifikasi — tidak perlu wallet

import { useState } from "react";
import { verifyRecord, formatTimestamp, shortAddress } from "../utils/contract";
import { ethers } from "ethers";

export default function VerifyRecord({ provider }) {
  const [hashInput, setHashInput] = useState("");
  const [status, setStatus]       = useState(null);
  const [result, setResult]       = useState(null);
  const [errorMsg, setErrorMsg]   = useState("");

  const handleVerify = async () => {
    const hash = hashInput.trim();
    if (!hash) { setErrorMsg("Masukkan hash sertifikat!"); return; }

    // Validasi format bytes32
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      setErrorMsg("Format hash tidak valid. Harus berupa 0x diikuti 64 karakter hex.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setResult(null);

    try {
      const data = await verifyRecord(provider, hash);
      setResult(data);
      setStatus(data.isValid ? "valid" : (data.statusCode === 0 ? "notfound" : "revoked"));
    } catch (e) {
      console.error(e);
      setErrorMsg(e.message || "Gagal memverifikasi");
      setStatus("error");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleVerify();
  };

  const statusConfig = {
    valid:    { bg: "rgba(16,185,129,0.08)",  border: "rgba(16,185,129,0.3)",  color: "#10b981", icon: "✅", text: "SERTIFIKAT VALID" },
    notfound: { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   color: "#ef4444", icon: "❌", text: "TIDAK DITEMUKAN" },
    revoked:  { bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.3)",  color: "#f59e0b", icon: "⚠️", text: "SERTIFIKAT DIREVOKE" },
    error:    { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.3)",   color: "#ef4444", icon: "⚠️", text: "ERROR" },
  };

  const sc = statusConfig[status] || {};

  return (
    <div style={s.container}>
      <h2 style={s.title}>
        <span style={s.titleIcon}>🔍</span>
        Verifikasi Sertifikat Vaksin
      </h2>
      <p style={s.subtitle}>
        Masukkan hash sertifikat untuk memverifikasi keaslian.
        Siapa saja dapat melakukan verifikasi tanpa perlu wallet.
      </p>

      {/* ── Input hash ──────────────────────────────────────────────────── */}
      <div style={s.inputGroup}>
        <div style={s.inputWrapper}>
          <span style={s.inputPrefix}>#</span>
          <input
            style={s.input}
            value={hashInput}
            onChange={e => setHashInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0x a1b2c3d4... (64 karakter hex)"
            spellCheck={false}
          />
        </div>
        <button
          style={{ ...s.btn, opacity: status === "loading" ? 0.7 : 1 }}
          onClick={handleVerify}
          disabled={status === "loading"}
        >
          {status === "loading" ? (
            <><span style={s.spinner} /> Memverifikasi...</>
          ) : (
            "Verifikasi"
          )}
        </button>
      </div>

      {errorMsg && <div style={s.errorBox}>⚠️ {errorMsg}</div>}

      {/* ── Hasil ────────────────────────────────────────────────────────── */}
      {result !== null && status !== "loading" && (
        <div
          style={{ ...s.resultCard, background: sc.bg, border: `1px solid ${sc.border}` }}
          className="fade-in"
        >
          {/* Status banner */}
          <div style={{ ...s.statusBanner, color: sc.color }}>
            <span style={{ fontSize: "24px" }}>{sc.icon}</span>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 800 }}>{sc.text}</div>
              <div style={{ fontSize: "12px", opacity: 0.7 }}>
                {status === "valid"    && "Hash sertifikat ditemukan dan valid di blockchain."}
                {status === "notfound" && "Hash tidak ditemukan. Sertifikat mungkin palsu."}
                {status === "revoked"  && "Sertifikat ini telah dibatalkan oleh penerbit."}
              </div>
            </div>
          </div>

          {/* Detail — tampil jika ada data */}
          {result.issuer && result.issuer !== ethers.ZeroAddress && (
            <div style={s.details}>
              <DetailRow
                label="Penerbit (Faskes)"
                value={result.facilityName || "Unknown"}
              />
              <DetailRow
                label="Wallet Penerbit"
                value={shortAddress(result.issuer)}
                mono
              />
              <DetailRow
                label="Waktu Pencatatan"
                value={formatTimestamp(result.timestamp)}
              />
              <DetailRow
                label="Status Code"
                value={["Tidak Ada", "Valid", "Direvoke"][result.statusCode] || "-"}
              />
            </div>
          )}

          {/* Hash yang diverifikasi */}
          <div style={s.hashDisplay}>
            <span style={s.hashLabel}>Hash yang Diverifikasi:</span>
            <span style={s.hashValue}>{hashInput}</span>
          </div>
        </div>
      )}

      {/* ── Info cara verifikasi manual ──────────────────────────────────── */}
      <div style={s.infoPanel}>
        <div style={s.infoPanelTitle}>ℹ️ Cara Mendapatkan Hash Sertifikat</div>
        <div style={s.infoPanelBody}>
          Hash sertifikat tersedia di dokumen sertifikat digital yang diberikan oleh
          fasilitas kesehatan. Penerbit akan menyertakan hash (format: 0x + 64 karakter)
          bersama data vaksinasi Anda.
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div style={dr.row}>
      <span style={dr.label}>{label}</span>
      <span style={{ ...dr.value, fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit" }}>
        {value}
      </span>
    </div>
  );
}

const dr = {
  row:   { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  label: { fontSize: "13px", color: "#64748b" },
  value: { fontSize: "13px", color: "#f1f5f9", fontWeight: 500 },
};

const s = {
  container:   { display: "flex", flexDirection: "column", gap: "20px" },
  title:       { fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" },
  titleIcon:   { fontSize: "24px" },
  subtitle:    { color: "#64748b", fontSize: "14px" },
  inputGroup:  { display: "flex", gap: "12px" },
  inputWrapper: {
    flex: 1, display: "flex", alignItems: "center",
    background: "#111827", border: "1px solid #1e293b",
    borderRadius: "10px", overflow: "hidden",
  },
  inputPrefix: {
    padding: "0 12px", color: "#64748b", fontSize: "18px",
    fontFamily: "'JetBrains Mono', monospace",
    borderRight: "1px solid #1e293b",
  },
  input: {
    flex: 1, padding: "12px 14px",
    background: "none", border: "none",
    color: "#f1f5f9", fontSize: "13px",
    fontFamily: "'JetBrains Mono', monospace",
  },
  btn: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "12px 24px", borderRadius: "10px",
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    color: "white", fontSize: "14px", fontWeight: 700, cursor: "pointer",
    whiteSpace: "nowrap",
  },
  spinner: {
    width: "14px", height: "14px", borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white",
    animation: "spin 0.8s linear infinite", display: "inline-block",
  },
  errorBox: {
    padding: "12px 16px", borderRadius: "8px",
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5", fontSize: "14px",
  },
  resultCard: {
    borderRadius: "12px", padding: "20px",
    display: "flex", flexDirection: "column", gap: "16px",
  },
  statusBanner: {
    display: "flex", alignItems: "center", gap: "16px",
  },
  details: {
    display: "flex", flexDirection: "column",
    padding: "16px", borderRadius: "8px",
    background: "rgba(0,0,0,0.2)",
  },
  hashDisplay: {
    display: "flex", flexDirection: "column", gap: "4px",
    padding: "12px", borderRadius: "8px", background: "rgba(0,0,0,0.2)",
  },
  hashLabel: { fontSize: "11px", color: "#64748b", textTransform: "uppercase" },
  hashValue: {
    fontSize: "11px", fontFamily: "'JetBrains Mono', monospace",
    color: "#94a3b8", wordBreak: "break-all",
  },
  infoPanel: {
    padding: "16px", borderRadius: "10px",
    background: "#111827", border: "1px solid #1e293b",
  },
  infoPanelTitle: { fontSize: "13px", fontWeight: 600, marginBottom: "8px", color: "#94a3b8" },
  infoPanelBody:  { fontSize: "13px", color: "#64748b", lineHeight: "1.6" },
};
