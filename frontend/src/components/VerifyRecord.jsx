// src/components/VerifyRecord.jsx
// Verifikasi sertifikat by Token ID (NFT) — siapa saja bisa verifikasi

import { useState } from "react";
import { getRecordByTokenId, getTokenMetadata, formatTimestamp, shortAddress } from "../utils/contract";
import { ethers } from "ethers";

export default function VerifyRecord({ provider }) {
  const [input,    setInput]    = useState("");
  const [status,   setStatus]   = useState(null);
  const [result,   setResult]   = useState(null);
  const [meta,     setMeta]     = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleVerify = async () => {
    const tokenId = input.trim();
    if (!tokenId) { setErrorMsg("Masukkan Token ID sertifikat!"); return; }
    if (isNaN(tokenId) || Number(tokenId) < 0) {
      setErrorMsg("Token ID harus berupa angka (misal: 0, 1, 2, ...)"); return;
    }

    setStatus("loading"); setErrorMsg(""); setResult(null); setMeta(null);

    try {
      const [rec, metadata] = await Promise.all([
        getRecordByTokenId(provider, Number(tokenId)),
        getTokenMetadata(provider, Number(tokenId)).catch(() => null),
      ]);

      setResult(rec);
      setMeta(metadata);
      setStatus(rec.statusCode === 0 ? "notfound" : rec.isValid ? "valid" : "revoked");
    } catch (e) {
      if (e.message?.includes("nonexistent") || e.message?.includes("ERC721")) {
        setStatus("notfound");
        setResult(null);
      } else {
        setErrorMsg(e.message || "Gagal memverifikasi");
        setStatus("error");
      }
    }
  };

  const statusConfig = {
    valid:    { bg:"rgba(16,185,129,0.08)",  border:"rgba(16,185,129,0.3)",  color:"#10b981", icon:"✅", text:"SERTIFIKAT VALID" },
    notfound: { bg:"rgba(239,68,68,0.08)",   border:"rgba(239,68,68,0.3)",   color:"#ef4444", icon:"❌", text:"TOKEN ID TIDAK DITEMUKAN" },
    revoked:  { bg:"rgba(245,158,11,0.08)",  border:"rgba(245,158,11,0.3)",  color:"#f59e0b", icon:"⚠️", text:"SERTIFIKAT DIREVOKE" },
    error:    { bg:"rgba(239,68,68,0.08)",   border:"rgba(239,68,68,0.3)",   color:"#ef4444", icon:"⚠️", text:"ERROR" },
  };
  const sc = statusConfig[status] || {};

  return (
    <div style={s.container}>
      <h2 style={s.title}><span style={s.titleIcon}>🔍</span>Verifikasi Sertifikat Vaksin</h2>
      <p style={s.subtitle}>
        Masukkan <strong>Token ID NFT</strong> untuk memverifikasi keaslian sertifikat.
        Token ID tersedia di QR code sertifikat atau di tab "Sertifikat Saya".
      </p>

      <div style={s.inputGroup}>
        <div style={s.inputWrapper}>
          <span style={s.inputPrefix}>#</span>
          <input
            style={s.input}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleVerify()}
            placeholder="Token ID (contoh: 0, 1, 2, ...)"
            type="number"
            min="0"
          />
        </div>
        <button style={{...s.btn, opacity: status==="loading" ? 0.7 : 1}}
          onClick={handleVerify} disabled={status==="loading"}>
          {status==="loading" ? <><span style={s.spinner}/> Memverifikasi...</> : "Verifikasi"}
        </button>
      </div>

      {errorMsg && <div style={s.errorBox}>⚠️ {errorMsg}</div>}

      {result !== null && status !== "loading" && (
        <div style={{...s.resultCard, background:sc.bg, border:`1px solid ${sc.border}`}} className="fade-in">
          <div style={{...s.statusBanner, color:sc.color}}>
            <span style={{fontSize:"28px"}}>{sc.icon}</span>
            <div>
              <div style={{fontSize:"18px",fontWeight:800}}>{sc.text}</div>
              <div style={{fontSize:"12px",opacity:0.7}}>
                {status==="valid"    && "Token NFT ditemukan dan valid di blockchain."}
                {status==="notfound" && "Token ID tidak ditemukan. Sertifikat mungkin tidak ada."}
                {status==="revoked"  && "Sertifikat ini telah dibatalkan oleh penerbit."}
              </div>
            </div>
          </div>

          {/* NFT Image */}
          {meta?.image && status === "valid" && (
            <div style={s.nftPreview}>
              <img src={meta.image} alt="NFT Certificate" style={s.nftImg}/>
            </div>
          )}

          {result.issuer && result.issuer !== ethers.ZeroAddress && (
            <div style={s.details}>
              <DetailRow label="Jenis Vaksin"       value={result.vaccineType || "-"} />
              <DetailRow label="Penerbit (Faskes)"  value={result.facilityName || "-"} />
              <DetailRow label="Wallet Penerbit"    value={shortAddress(result.issuer)} mono />
              <DetailRow label="Waktu Pencatatan"   value={formatTimestamp(result.timestamp)} />
              <DetailRow label="Status"             value={["Tidak Ada","Valid","Direvoke"][result.statusCode]||"-"} />
              <DetailRow label="Data Hash"          value={result.dataHash ? `${result.dataHash.slice(0,18)}...` : "-"} mono />
            </div>
          )}

          <div style={s.tokenDisplay}>
            <span style={s.tokenLabel}>Token ID yang Diverifikasi:</span>
            <span style={s.tokenValue}>#{input}</span>
          </div>
        </div>
      )}

      <div style={s.infoPanel}>
        <div style={s.infoPanelTitle}>ℹ️ Cara Mendapatkan Token ID</div>
        <div style={s.infoPanelBody}>
          Token ID tersedia di: (1) QR Code pada sertifikat — scan lalu lihat angka setelah "vaxchain:verify:",
          (2) Tab "Sertifikat Saya" — klik sertifikat, Token ID tampil di detail,
          (3) Dokumen sertifikat digital dari fasilitas kesehatan.
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div style={dr.row}>
      <span style={dr.label}>{label}</span>
      <span style={{...dr.value, fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit"}}>{value}</span>
    </div>
  );
}

const dr = {
  row:   {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"},
  label: {fontSize:"13px",color:"#64748b"},
  value: {fontSize:"13px",color:"#f1f5f9",fontWeight:500},
};

const s = {
  container:    {display:"flex",flexDirection:"column",gap:"20px"},
  title:        {fontSize:"20px",fontWeight:700,display:"flex",alignItems:"center",gap:"10px"},
  titleIcon:    {fontSize:"24px"},
  subtitle:     {color:"#64748b",fontSize:"14px",lineHeight:"1.6"},
  inputGroup:   {display:"flex",gap:"12px"},
  inputWrapper: {flex:1,display:"flex",alignItems:"center",background:"#111827",border:"1px solid #1e293b",borderRadius:"10px",overflow:"hidden"},
  inputPrefix:  {padding:"0 12px",color:"#64748b",fontSize:"18px",fontFamily:"'JetBrains Mono',monospace",borderRight:"1px solid #1e293b"},
  input:        {flex:1,padding:"12px 14px",background:"none",border:"none",color:"#f1f5f9",fontSize:"16px",fontFamily:"'JetBrains Mono',monospace"},
  btn:          {display:"flex",alignItems:"center",gap:"8px",padding:"12px 24px",borderRadius:"10px",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"white",fontSize:"14px",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",border:"none"},
  spinner:      {width:"14px",height:"14px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",animation:"spin 0.8s linear infinite",display:"inline-block"},
  errorBox:     {padding:"12px 16px",borderRadius:"8px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#fca5a5",fontSize:"14px"},
  resultCard:   {borderRadius:"12px",padding:"20px",display:"flex",flexDirection:"column",gap:"16px"},
  statusBanner: {display:"flex",alignItems:"center",gap:"16px"},
  nftPreview:   {display:"flex",justifyContent:"center"},
  nftImg:       {maxWidth:"200px",borderRadius:"12px",border:"1px solid #1e293b"},
  details:      {display:"flex",flexDirection:"column",padding:"16px",borderRadius:"8px",background:"rgba(0,0,0,0.2)"},
  tokenDisplay: {display:"flex",gap:"12px",alignItems:"center",padding:"12px",borderRadius:"8px",background:"rgba(0,0,0,0.2)"},
  tokenLabel:   {fontSize:"11px",color:"#64748b",textTransform:"uppercase"},
  tokenValue:   {fontSize:"18px",fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:"#60a5fa"},
  infoPanel:    {padding:"16px",borderRadius:"10px",background:"#111827",border:"1px solid #1e293b"},
  infoPanelTitle:{fontSize:"13px",fontWeight:600,marginBottom:"8px",color:"#94a3b8"},
  infoPanelBody: {fontSize:"13px",color:"#64748b",lineHeight:"1.6"},
};
