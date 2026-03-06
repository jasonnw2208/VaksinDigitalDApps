// src/components/AdminPanel.jsx
// Panel admin untuk owner: daftarkan/hapus authorized issuer

import { useState } from "react";
import { authorizeIssuer, removeIssuer, checkIsIssuer, getIssuerName } from "../utils/contract";
import { ethers } from "ethers";

export default function AdminPanel({ signer, provider }) {
  const [mode, setMode]           = useState("add"); // add | remove | check
  const [address, setAddress]     = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [status, setStatus]       = useState(null);
  const [result, setResult]       = useState(null);
  const [errorMsg, setErrorMsg]   = useState("");

  const isValidAddress = (addr) => {
    try { ethers.getAddress(addr); return true; }
    catch { return false; }
  };

  const handleSubmit = async () => {
    const addr = address.trim();
    if (!addr) { setErrorMsg("Masukkan alamat wallet!"); return; }
    if (!isValidAddress(addr)) { setErrorMsg("Format alamat Ethereum tidak valid."); return; }

    if (mode === "add" && !facilityName.trim()) {
      setErrorMsg("Nama fasilitas kesehatan wajib diisi!"); return;
    }

    setStatus("loading");
    setErrorMsg("");
    setResult(null);

    try {
      let txReceipt;
      if (mode === "add") {
        txReceipt = await authorizeIssuer(signer, addr, facilityName.trim());
        setResult({ type: "add", txHash: txReceipt.hash, address: addr, name: facilityName });
      } else if (mode === "remove") {
        txReceipt = await removeIssuer(signer, addr);
        setResult({ type: "remove", txHash: txReceipt.hash, address: addr });
      } else if (mode === "check") {
        const [isAuth, name] = await Promise.all([
          checkIsIssuer(provider, addr),
          getIssuerName(provider, addr),
        ]);
        setResult({ type: "check", address: addr, isAuth, name });
      }

      setStatus("success");
      setAddress("");
      setFacilityName("");
    } catch (e) {
      console.error(e);
      setErrorMsg(e.reason || e.message || "Operasi gagal");
      setStatus("error");
    }
  };

  const modeConfig = {
    add:    { label: "Tambah Issuer",  color: "#10b981", btnColor: "linear-gradient(135deg,#10b981,#059669)" },
    remove: { label: "Hapus Issuer",   color: "#ef4444", btnColor: "linear-gradient(135deg,#ef4444,#b91c1c)" },
    check:  { label: "Cek Status",     color: "#3b82f6", btnColor: "linear-gradient(135deg,#3b82f6,#1d4ed8)" },
  };

  const mc = modeConfig[mode];

  return (
    <div style={s.container}>
      <h2 style={s.title}>
        <span style={s.titleIcon}>⚙️</span>
        Panel Administrator
      </h2>
      <p style={s.subtitle}>
        Kelola daftar fasilitas kesehatan yang berhak mencatat vaksinasi.
        Hanya owner/deployer kontrak yang dapat mengakses panel ini.
      </p>

      {/* ── Mode selector ──────────────────────────────────────────────── */}
      <div style={s.modeSelector}>
        {Object.entries(modeConfig).map(([m, cfg]) => (
          <button
            key={m}
            style={{
              ...s.modeBtn,
              ...(mode === m ? { ...s.modeBtnActive, color: cfg.color, borderColor: cfg.color + "40" } : {}),
            }}
            onClick={() => { setMode(m); setStatus(null); setResult(null); setErrorMsg(""); }}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* ── Form ─────────────────────────────────────────────────────── */}
      <div style={s.form}>
        <div style={s.field}>
          <label style={s.label}>Alamat Wallet Fasilitas Kesehatan *</label>
          <input
            style={s.input}
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
          />
        </div>

        {mode === "add" && (
          <div style={s.field}>
            <label style={s.label}>Nama Fasilitas Kesehatan *</label>
            <input
              style={s.inputText}
              value={facilityName}
              onChange={e => setFacilityName(e.target.value)}
              placeholder="Contoh: RSUP Dr. Cipto Mangunkusumo Jakarta"
            />
          </div>
        )}
      </div>

      {errorMsg && (
        <div style={s.errorBox}>⚠️ {errorMsg}</div>
      )}

      <button
        style={{ ...s.btn, background: mc.btnColor, opacity: status === "loading" ? 0.7 : 1 }}
        onClick={handleSubmit}
        disabled={status === "loading"}
      >
        {status === "loading" ? (
          <><span style={s.spinner} /> Memproses...</>
        ) : (
          mc.label
        )}
      </button>

      {/* ── Hasil ────────────────────────────────────────────────────── */}
      {status === "success" && result && (
        <div style={s.resultBox} className="fade-in">
          {result.type === "add" && (
            <>
              <div style={{ ...s.resultTitle, color: "#10b981" }}>
                ✅ Issuer Berhasil Didaftarkan
              </div>
              <InfoRow label="Fasilitas" value={result.name} />
              <InfoRow label="Alamat" value={result.address} mono />
              <InfoRow label="Tx Hash" value={result.txHash} mono />
            </>
          )}
          {result.type === "remove" && (
            <>
              <div style={{ ...s.resultTitle, color: "#ef4444" }}>
                ✅ Issuer Berhasil Dihapus
              </div>
              <InfoRow label="Alamat" value={result.address} mono />
              <InfoRow label="Tx Hash" value={result.txHash} mono />
            </>
          )}
          {result.type === "check" && (
            <>
              <div style={{
                ...s.resultTitle,
                color: result.isAuth ? "#10b981" : "#ef4444",
              }}>
                {result.isAuth ? "✅ Terdaftar sebagai Authorized Issuer" : "❌ Bukan Authorized Issuer"}
              </div>
              <InfoRow label="Alamat" value={result.address} mono />
              {result.name && <InfoRow label="Nama Fasilitas" value={result.name} />}
            </>
          )}
        </div>
      )}

      {/* ── Penjelasan sistem ──────────────────────────────────────────── */}
      <div style={s.infoPanel}>
        <div style={s.infoPanelTitle}>📋 Sistem Otorisasi Fasilitas Kesehatan</div>
        <ul style={s.infoList}>
          <li>Hanya <strong>Owner</strong> (deployer kontrak) yang bisa mendaftarkan issuer baru.</li>
          <li><strong>Authorized Issuer</strong> adalah wallet fasilitas kesehatan yang berhak mencatat dan merevoke sertifikat.</li>
          <li>Setiap tindakan otorisasi tercatat permanen di blockchain sebagai event.</li>
          <li>Issuer yang dihapus tidak bisa lagi mencatat vaksin, tapi rekam yang sudah ada tetap valid.</li>
        </ul>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: "12px", fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit", color: "#94a3b8", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

const s = {
  container:  { display: "flex", flexDirection: "column", gap: "20px" },
  title:      { fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" },
  titleIcon:  { fontSize: "24px" },
  subtitle:   { color: "#64748b", fontSize: "14px" },
  modeSelector: {
    display: "flex", gap: "8px",
    padding: "4px", borderRadius: "10px",
    background: "#111827", border: "1px solid #1e293b",
    width: "fit-content",
  },
  modeBtn: {
    padding: "8px 20px", borderRadius: "7px",
    background: "none", border: "1px solid transparent",
    color: "#64748b", fontSize: "13px", fontWeight: 500, cursor: "pointer",
  },
  modeBtnActive: {
    background: "#1e293b", fontWeight: 700,
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
  inputText: {
    padding: "10px 14px", borderRadius: "8px",
    background: "#1a2332", border: "1px solid #1e293b",
    color: "#f1f5f9", fontSize: "14px",
  },
  errorBox: {
    padding: "12px 16px", borderRadius: "8px",
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5", fontSize: "14px",
  },
  btn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    padding: "14px", borderRadius: "10px",
    color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer",
  },
  spinner: {
    width: "16px", height: "16px", borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white",
    animation: "spin 0.8s linear infinite", display: "inline-block",
  },
  resultBox: {
    padding: "20px", borderRadius: "12px",
    background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)",
    display: "flex", flexDirection: "column", gap: "4px",
  },
  resultTitle: { fontSize: "15px", fontWeight: 700, marginBottom: "8px" },
  infoPanel: {
    padding: "16px", borderRadius: "10px",
    background: "#111827", border: "1px solid #1e293b",
  },
  infoPanelTitle: { fontSize: "13px", fontWeight: 600, marginBottom: "10px", color: "#94a3b8" },
  infoList: {
    paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "6px",
    fontSize: "13px", color: "#64748b", lineHeight: "1.6",
  },
};
