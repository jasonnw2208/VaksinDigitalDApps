// src/components/VerifyRecord.jsx
import { useState, useEffect, useRef } from "react";
import { verifyRecordByTokenId, formatTimestamp, shortAddress } from "../utils/contract";
import { Html5Qrcode } from "html5-qrcode";
import { ethers } from "ethers";

export default function VerifyRecord({ provider }) {
  const [idInput, setIdInput] = useState("");
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);

  const handleVerify = async (manualId) => {
    const input = manualId || idInput.trim();
    if (!input) return setErrorMsg("Masukkan Token ID sertifikat!");

    setStatus("loading");
    setErrorMsg("");
    setResult(null);

    try {
      if (/^\d+$/.test(input)) {
        const data = await verifyRecordByTokenId(provider, input);
        setResult(data);
        setStatus(data.isValid ? "valid" : (data.statusCode === 0 ? "notfound" : "revoked"));
      } else {
        setErrorMsg("Format tidak valid. Masukkan Token ID (Angka).");
        setStatus("error");
      }
    } catch (e) {
      setErrorMsg("Sertifikat tidak ditemukan atau terjadi kesalahan.");
      setStatus("error");
    }
  };

  // ── Camera Scanner Logic ──────────────────────────────────────────────────
  const startScanner = async () => {
    setIsScanning(true);
    setResult(null);
    setErrorMsg("");
    
    // Tunggu sebentar agar div render
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            // Format QR: verify:ID
            if (decodedText.startsWith("verify:")) {
              const tokenId = decodedText.split(":")[1];
              setIdInput(tokenId);
              stopScanner();
              handleVerify(tokenId);
            }
          },
          () => {} // silent error for frame scanning
        );
      } catch (err) {
        console.error("Scanner error:", err);
        setErrorMsg("Gagal mengakses kamera.");
        setIsScanning(false);
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (e) { console.error(e); }
    }
    setIsScanning(false);
  };

  useEffect(() => {
    return () => { if (isScanning) stopScanner(); };
  }, [isScanning]);

  const statusConfig = {
    valid:    { bg: "rgba(16,185,129,0.08)", border: "#10b981", color: "#10b981", icon: "✅", text: "ASLI & TERVERIFIKASI" },
    notfound: { bg: "rgba(239,68,68,0.08)", border: "#ef4444", color: "#ef4444", icon: "❌", text: "TIDAK DITEMUKAN" },
    revoked:  { bg: "rgba(245,158,11,0.08)", border: "#f59e0b", color: "#f59e0b", icon: "⚠️", text: "DIREVOKE" },
    error:    { bg: "rgba(239,68,68,0.08)", border: "#ef4444", color: "#ef4444", icon: "⚠️", text: "KESALAHAN" },
  };

  const sc = statusConfig[status] || {};

  return (
    <div style={s.container}>
      <h2 style={s.title}>🔍 Verifikasi Sertifikat</h2>
      <p style={s.subtitle}>Verifikasi keaslian sertifikat NFT VaxChain menggunakan Token ID atau Scan QR.</p>

      {isScanning ? (
        <div style={s.scannerBox}>
          <div id="reader" style={{ width: "100%", borderRadius: "12px", overflow: "hidden" }}></div>
          <button style={{...s.btn, background: "#ef4444", marginTop: "12px"}} onClick={stopScanner}>
            Batal Scan
          </button>
        </div>
      ) : (
        <div style={s.inputGroup}>
          <input 
            style={s.input} 
            value={idInput} 
            onChange={e => setIdInput(e.target.value)} 
            placeholder="Masukkan Token ID (Contoh: 0, 1, 2...)"
          />
          <button style={s.btn} onClick={() => handleVerify()} disabled={status === "loading"}>
            {status === "loading" ? "Memproses..." : "Cek Keaslian"}
          </button>
          <button style={{...s.btn, background: "#10b981"}} onClick={startScanner}>
            📷 Pindai QR
          </button>
        </div>
      )}

      {errorMsg && <div style={s.error}>{errorMsg}</div>}

      {result && status !== "loading" && (
        <div style={{...s.result, background: sc.bg, border: `1px solid ${sc.border}`}}>
          <div style={{...s.statusText, color: sc.color}}>
            <span style={{fontSize: "24px"}}>{sc.icon}</span>
            <strong>{sc.text}</strong>
          </div>
          
          {result.isValid && (
            <div style={s.details}>
              <Row label="Jenis Vaksin" value={result.vaccineType} />
              <Row label="Fasilitas Kesehatan" value={result.facilityName} />
              <Row label="Waktu Recording" value={formatTimestamp(result.timestamp)} />
              <Row label="Data Hash" value={shortAddress(result.dataHash)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowValue}>{value}</span>
    </div>
  );
}

const s = {
  container: { display: "flex", flexDirection: "column", gap: "20px" },
  title: { fontSize: "20px", fontWeight: 700 },
  subtitle: { color: "#64748b", fontSize: "14px" },
  inputGroup: { display: "flex", gap: "10px" },
  input: { flex: 1, padding: "12px", background: "#111827", border: "1px solid #1e293b", color: "white", borderRadius: "10px" },
  btn: { padding: "12px 24px", background: "#3b82f6", color: "white", fontWeight: 700, borderRadius: "10px", border: "none", cursor: "pointer", whiteSpace: "nowrap" },
  scannerBox: { display: "flex", flexDirection: "column", alignItems: "center", background: "#111827", padding: "20px", borderRadius: "16px", border: "1px solid #1e293b" },
  error: { color: "#ef4444", fontSize: "14px" },
  result: { padding: "20px", borderRadius: "12px", display: "flex", flexDirection: "column", gap: "16px" },
  statusText: { display: "flex", alignItems: "center", gap: "12px", fontSize: "18px" },
  details: { display: "flex", flexDirection: "column", gap: "8px", background: "rgba(0,0,0,0.2)", padding: "16px", borderRadius: "8px" },
  row: { display: "flex", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "4px" },
  rowLabel: { fontSize: "12px", color: "#64748b" },
  rowValue: { fontSize: "13px", color: "#f1f5f9", fontWeight: 600 }
};
