// src/components/VerifyRecord.jsx
// Verifikasi by Token ID + QR Scanner

import { useState, useRef, useEffect } from "react";
import { getRecordByTokenId, getTokenHistory, getTokenMetadata, formatTimestamp, shortAddress } from "../utils/contract";
import { ethers } from "ethers";

export default function VerifyRecord({ provider }) {
  const [input,    setInput]    = useState("");
  const [status,   setStatus]   = useState(null);
  const [result,   setResult]   = useState(null);
  const [meta,     setMeta]     = useState(null);
  const [history,  setHistory]  = useState([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef  = useRef(null);
  const html5QrRef  = useRef(null);

  // ── QR Scanner ─────────────────────────────────────────────────────────────
  async function startScanner() {
    setScanning(true);
    const { Html5Qrcode } = await import("html5-qrcode");
    html5QrRef.current = new Html5Qrcode("qr-reader");
    try {
      await html5QrRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Parse token ID dari QR value: "vaxchain:verify:123" atau langsung "123"
          let tokenId = decodedText.trim();
          if (tokenId.includes("vaxchain:verify:")) {
            tokenId = tokenId.split("vaxchain:verify:")[1];
          }
          setInput(tokenId);
          stopScanner();
          // Auto verify setelah scan
          setTimeout(() => handleVerify(tokenId), 300);
        },
        () => {} // frame error — abaikan
      );
    } catch (e) {
      setErrorMsg("Tidak bisa akses kamera: " + e.message);
      setScanning(false);
    }
  }

  async function stopScanner() {
    if (html5QrRef.current) {
      try { await html5QrRef.current.stop(); } catch {}
      html5QrRef.current = null;
    }
    setScanning(false);
  }

  useEffect(() => { return () => { stopScanner(); }; }, []);

  // ── Verifikasi ─────────────────────────────────────────────────────────────
  async function handleVerify(overrideInput) {
    const tokenId = (overrideInput ?? input).trim();
    if (!tokenId) { setErrorMsg("Masukkan Token ID!"); return; }
    if (isNaN(tokenId) || Number(tokenId) < 0) {
      setErrorMsg("Token ID harus berupa angka (contoh: 0, 1, 2)"); return;
    }

    setStatus("loading"); setErrorMsg(""); setResult(null); setMeta(null); setHistory([]);

    try {
      const [rec, metadata, hist] = await Promise.all([
        getRecordByTokenId(provider, Number(tokenId)),
        getTokenMetadata(provider, Number(tokenId)).catch(() => null),
        getTokenHistory(provider, Number(tokenId)).catch(() => []),
      ]);
      setResult(rec); setMeta(metadata); setHistory(hist);
      setStatus(rec.statusCode === 0 ? "notfound" : rec.isValid ? "valid" : "revoked");
    } catch (e) {
      if (e.message?.includes("nonexistent") || e.message?.includes("ERC721")) {
        setStatus("notfound");
      } else {
        setErrorMsg(e.message || "Gagal memverifikasi");
        setStatus("error");
      }
    }
  }

  const sc = {
    valid:    { bg:"rgba(16,185,129,0.08)",  border:"rgba(16,185,129,0.3)",  color:"#10b981", icon:" ", text:"SERTIFIKAT VALID" },
    notfound: { bg:"rgba(239,68,68,0.08)",   border:"rgba(239,68,68,0.3)",   color:"#ef4444", icon:" ", text:"TOKEN TIDAK DITEMUKAN" },
    revoked:  { bg:"rgba(245,158,11,0.08)",  border:"rgba(245,158,11,0.3)",  color:"#f59e0b", icon:" ", text:"SERTIFIKAT DIREVOKE" },
    error:    { bg:"rgba(239,68,68,0.08)",   border:"rgba(239,68,68,0.3)",   color:"#ef4444", icon:" ", text:"ERROR" },
  }[status] || {};

  return (
    <div style={s.container}>
      <h2 style={s.title}><span style={s.titleIcon}></span>Verifikasi Sertifikat Vaksin</h2>
      <p style={s.subtitle}>
        Masukkan <strong>Token ID</strong> atau <strong>scan QR code</strong> dari sertifikat untuk verifikasi.
      </p>

      {/* ── Input + Scan ─────────────────────────────────────────────────── */}
      <div style={s.inputGroup}>
        <div style={s.inputWrapper}>
          <span style={s.inputPrefix}>#</span>
          <input style={s.input} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==="Enter" && handleVerify()}
            placeholder="Token ID (contoh: 0)" type="number" min="0" />
        </div>
        <button style={s.scanBtn} onClick={scanning ? stopScanner : startScanner}>
          {scanning ? "Stop Scan" : "Scan QR"}
        </button>
        <button style={{...s.btn, opacity: status==="loading" ? 0.7 : 1}}
          onClick={() => handleVerify()} disabled={status==="loading"}>
          {status==="loading" ? <><span style={s.spinner}/> Verifikasi...</> : "Verifikasi"}
        </button>
      </div>

      {/* ── QR Scanner View ──────────────────────────────────────────────── */}
      {scanning && (
        <div style={s.scannerBox}>
          <div style={s.scannerHeader}>
            Arahkan kamera ke QR Code sertifikat
          </div>
          <div id="qr-reader" ref={scannerRef} style={s.scannerView}/>
          <div style={s.scannerHint}>
            QR code berisi Token ID yang akan otomatis diisi setelah scan berhasil
          </div>
        </div>
      )}

      {errorMsg && <div style={s.errorBox}>{errorMsg}</div>}

      {/* ── Hasil ────────────────────────────────────────────────────────── */}
      {result !== null && status !== "loading" && (
        <div style={{...s.resultCard, background:sc.bg, border:`1px solid ${sc.border}`}} className="fade-in">
          <div style={{...s.statusBanner, color:sc.color}}>
            <span style={{fontSize:"28px"}}>{sc.icon}</span>
            <div>
              <div style={{fontSize:"18px",fontWeight:800}}>{sc.text}</div>
              <div style={{fontSize:"12px",opacity:0.7}}>
                {status==="valid"    && "Token NFT valid dan tercatat di blockchain."}
                {status==="notfound" && "Token ID tidak ditemukan."}
                {status==="revoked"  && "Sertifikat ini telah direvoke oleh penerbit."}
              </div>
            </div>
          </div>

          {/* NFT image */}
          {meta?.image && status==="valid" && (
            <div style={{display:"flex",justifyContent:"center"}}>
              <img src={meta.image} alt="NFT" style={{maxWidth:"180px",borderRadius:"10px",border:"1px solid #1e293b"}}/>
            </div>
          )}

          {/* Certificate ID */}
          {result.certId && (
            <div style={s.certIdBadge}>
              <span style={s.certIdLabel}>Certificate ID</span>
              <span style={s.certIdValue}>{result.certId}</span>
            </div>
          )}

          {/* Detail */}
          {result.vaccineType && (
            <div style={s.details}>
              <DetailRow label="Jenis Vaksin"      value={result.vaccineType} />
              <DetailRow label="Fasilitas Kesehatan" value={result.facilityName} />
              {result.issuer && result.issuer !== ethers.ZeroAddress &&
                <DetailRow label="Wallet Penerbit"  value={shortAddress(result.issuer)} mono />}
              <DetailRow label="Waktu Pencatatan"   value={formatTimestamp(result.timestamp)} />
              <DetailRow label="Token ID"           value={`#${input}`} mono />
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div style={s.historySection}>
              <div style={s.historyTitle}>Riwayat Sertifikat</div>
              <div style={s.historyList}>
                {history.map((h, i) => (
                  <div key={i} style={s.historyItem}>
                    <div style={{...s.historyAction, color: actionColor(h.action)}}>
                      {actionIcon(h.action)} {h.action}
                    </div>
                    <div style={s.historyNote}>{h.note}</div>
                    <div style={s.historyTime}>{formatTimestamp(h.timestamp)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={s.infoPanel}>
        <div style={s.infoPanelTitle}>Cara Mendapatkan Token ID</div>
        <div style={s.infoPanelBody}>
          Scan QR code dari sertifikat digital, atau lihat Token ID di tab
          "Sertifikat Saya" → klik sertifikat → Token ID tertera di detail.
          Format: angka bulat (0, 1, 2, ...) atau Certificate ID (VAX-2024-000001).
        </div>
      </div>
    </div>
  );
}

function actionColor(action) {
  if (action.includes("Mint"))    return "#10b981";
  if (action.includes("Revoked")) return "#ef4444";
  if (action.includes("Restored")) return "#3b82f6";
  if (action.includes("Request")) return "#f59e0b";
  if (action.includes("Rejected")) return "#94a3b8";
  return "#64748b";
}

function actionIcon(action) {
  if (action.includes("Mint"))     return "🟢";
  if (action.includes("Revoked"))  return "🔴";
  if (action.includes("Restored")) return "🔵";
  if (action.includes("Request"))  return "🟡";
  if (action.includes("Rejected")) return "⚫";
  return "";
}

function DetailRow({ label, value, mono }) {
  return (
    <div style={dr.row}>
      <span style={dr.label}>{label}</span>
      <span style={{...dr.value, fontFamily:mono?"'JetBrains Mono',monospace":"inherit"}}>{value}</span>
    </div>
  );
}

const dr = {
  row:   {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"},
  label: {fontSize:"13px",color:"#64748b"},
  value: {fontSize:"13px",color:"#f1f5f9",fontWeight:500},
};

const s = {
  container:     {display:"flex",flexDirection:"column",gap:"20px"},
  title:         {fontSize:"20px",fontWeight:700,display:"flex",alignItems:"center",gap:"10px"},
  titleIcon:     {fontSize:"24px"},
  subtitle:      {color:"#64748b",fontSize:"14px",lineHeight:"1.6"},
  inputGroup:    {display:"flex",gap:"10px",flexWrap:"wrap"},
  inputWrapper:  {flex:1,minWidth:"200px",display:"flex",alignItems:"center",background:"#111827",border:"1px solid #1e293b",borderRadius:"10px",overflow:"hidden"},
  inputPrefix:   {padding:"0 12px",color:"#64748b",fontSize:"18px",fontFamily:"'JetBrains Mono',monospace",borderRight:"1px solid #1e293b"},
  input:         {flex:1,padding:"12px 14px",background:"none",border:"none",color:"#f1f5f9",fontSize:"16px",fontFamily:"'JetBrains Mono',monospace"},
  scanBtn:       {padding:"12px 18px",borderRadius:"10px",background:"#1e293b",border:"1px solid #334155",color:"#94a3b8",fontSize:"14px",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"},
  btn:           {display:"flex",alignItems:"center",gap:"8px",padding:"12px 24px",borderRadius:"10px",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"white",fontSize:"14px",fontWeight:700,cursor:"pointer",border:"none",whiteSpace:"nowrap"},
  spinner:       {width:"14px",height:"14px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",animation:"spin 0.8s linear infinite",display:"inline-block"},
  scannerBox:    {borderRadius:"12px",overflow:"hidden",border:"1px solid #1e293b",background:"#111827"},
  scannerHeader: {padding:"14px 16px",background:"rgba(59,130,246,0.1)",color:"#60a5fa",fontSize:"14px",fontWeight:600},
  scannerView:   {width:"100%",maxWidth:"500px",margin:"0 auto"},
  scannerHint:   {padding:"10px 16px",color:"#64748b",fontSize:"12px",textAlign:"center"},
  errorBox:      {padding:"12px 16px",borderRadius:"8px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#fca5a5",fontSize:"14px"},
  resultCard:    {borderRadius:"12px",padding:"20px",display:"flex",flexDirection:"column",gap:"16px"},
  statusBanner:  {display:"flex",alignItems:"center",gap:"16px"},
  certIdBadge:   {display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",borderRadius:"8px",background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.2)"},
  certIdLabel:   {fontSize:"11px",color:"#64748b",textTransform:"uppercase",letterSpacing:"0.5px",flexShrink:0},
  certIdValue:   {fontSize:"18px",fontFamily:"'JetBrains Mono',monospace",fontWeight:800,color:"#60a5fa"},
  details:       {display:"flex",flexDirection:"column",padding:"16px",borderRadius:"8px",background:"rgba(0,0,0,0.2)"},
  historySection:{display:"flex",flexDirection:"column",gap:"10px"},
  historyTitle:  {fontSize:"14px",fontWeight:600,color:"#94a3b8"},
  historyList:   {display:"flex",flexDirection:"column",gap:"8px"},
  historyItem:   {padding:"12px",borderRadius:"8px",background:"rgba(0,0,0,0.2)",display:"flex",flexDirection:"column",gap:"4px"},
  historyAction: {fontSize:"13px",fontWeight:600},
  historyNote:   {fontSize:"12px",color:"#64748b"},
  historyTime:   {fontSize:"11px",color:"#475569"},
  infoPanel:     {padding:"16px",borderRadius:"10px",background:"#111827",border:"1px solid #1e293b"},
  infoPanelTitle:{fontSize:"13px",fontWeight:600,marginBottom:"8px",color:"#94a3b8"},
  infoPanelBody: {fontSize:"13px",color:"#64748b",lineHeight:"1.6"},
};
