// src/components/RevokeRecord.jsx
// Faskes mengajukan REQUEST revoke — bukan langsung execute
// Owner yang approve/reject di tab Admin

import { useState } from "react";
import { requestRevoke } from "../utils/contract";
import { ethers } from "ethers";

export default function RevokeRecord({ signer }) {
  const [tokenId,  setTokenId]  = useState("");
  const [reason,   setReason]   = useState("");
  const [status,   setStatus]   = useState(null);
  const [result,   setResult]   = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleRequest = async () => {
    if (!tokenId || isNaN(tokenId)) { setErrorMsg("Masukkan Token ID yang valid."); return; }
    if (!reason.trim())             { setErrorMsg("Alasan revoke wajib diisi."); return; }

    setStatus("loading"); setErrorMsg(""); setResult(null);
    try {
      const receipt = await requestRevoke(signer, Number(tokenId), reason);
      setResult({ txHash: receipt.hash, blockNumber: receipt.blockNumber, tokenId, reason });
      setStatus("success");
      setTokenId(""); setReason("");
    } catch (e) {
      setErrorMsg(e.reason || e.message || "Gagal mengajukan request");
      setStatus("error");
    }
  };

  return (
    <div style={s.container}>
      <h2 style={s.title}><span></span> Ajukan Permintaan Revoke</h2>
      <p style={s.subtitle}>
        Faskes tidak bisa langsung merevoke sertifikat. Permintaan akan dikirim ke <strong>Owner (Kemenkes)</strong>
        untuk di-approve atau ditolak. Owner juga bisa melakukan undo setelah revoke.
      </p>

      <div style={s.flowBox}>
        <div style={s.flowStep}>
          <div style={s.flowNum}>1</div>
          <div style={s.flowText}>Faskes ajukan request + alasan</div>
        </div>
        <div style={s.flowArrow}>→</div>
        <div style={s.flowStep}>
          <div style={s.flowNum}>2</div>
          <div style={s.flowText}>Owner review di tab Admin</div>
        </div>
        <div style={s.flowArrow}>→</div>
        <div style={s.flowStep}>
          <div style={s.flowNum}>3</div>
          <div style={s.flowText}>Approve / Reject / Undo</div>
        </div>
      </div>

      <div style={s.form}>
        <div style={s.field}>
          <label style={s.label}>Token ID Sertifikat <span style={{color:"#ef4444"}}>*</span></label>
          <span style={s.hint}>Angka token ID NFT yang ingin direvoke (contoh: 0, 1, 2)</span>
          <input style={s.input} type="number" min="0" placeholder="Contoh: 0"
            value={tokenId} onChange={e => setTokenId(e.target.value)} />
        </div>

        <div style={s.field}>
          <label style={s.label}>Alasan Revoke <span style={{color:"#ef4444"}}>*</span></label>
          <span style={s.hint}>Jelaskan alasan mengapa sertifikat ini perlu direvoke</span>
          <textarea style={s.textarea} rows={4}
            placeholder="Contoh: Data vaksin salah input, pasien meninggal, sertifikat duplikat, dll."
            value={reason} onChange={e => setReason(e.target.value)} />
        </div>
      </div>

      {errorMsg && <div style={s.errorBox}>{errorMsg}</div>}

      <button style={{...s.btn, opacity: status==="loading" ? 0.7 : 1}}
        onClick={handleRequest} disabled={status==="loading"}>
        {status==="loading"
          ? <><span style={s.spinner}/>Mengajukan Request...</>
          : "Ajukan Permintaan Revoke ke Owner"}
      </button>

      {status==="success" && result && (
        <div style={s.successBox}>
          <div style={s.successHeader}>Permintaan Revoke Berhasil Diajukan!</div>
          <p style={s.successText}>
            Permintaan telah tercatat di blockchain. Owner (Kemenkes) akan mereview
            dan melakukan approve atau reject melalui tab <strong>Admin → Revoke Management</strong>.
          </p>
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Token ID</span>
            <span style={s.infoValue}>#{result.tokenId}</span>
          </div>
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Alasan</span>
            <span style={s.infoValue}>{result.reason}</span>
          </div>
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Tx Hash</span>
            <span style={{...s.infoValue, fontFamily:"'JetBrains Mono',monospace", fontSize:"11px"}}>{result.txHash}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container:    {display:"flex",flexDirection:"column",gap:"20px"},
  title:        {fontSize:"20px",fontWeight:700,display:"flex",alignItems:"center",gap:"10px"},
  subtitle:     {color:"#64748b",fontSize:"14px",lineHeight:"1.6"},
  flowBox:      {display:"flex",alignItems:"center",gap:"8px",padding:"16px",borderRadius:"10px",background:"#111827",border:"1px solid #1e293b",flexWrap:"wrap"},
  flowStep:     {display:"flex",alignItems:"center",gap:"10px",padding:"8px 12px",borderRadius:"8px",background:"#1e293b"},
  flowNum:      {width:"24px",height:"24px",borderRadius:"50%",background:"#3b82f6",color:"white",fontSize:"12px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  flowText:     {fontSize:"13px",color:"#94a3b8"},
  flowArrow:    {color:"#334155",fontSize:"18px",fontWeight:700},
  form:         {display:"flex",flexDirection:"column",gap:"16px",padding:"24px",borderRadius:"12px",background:"#111827",border:"1px solid #1e293b"},
  field:        {display:"flex",flexDirection:"column",gap:"4px"},
  label:        {fontSize:"13px",fontWeight:600,color:"#94a3b8"},
  hint:         {fontSize:"11px",color:"#4b5563"},
  input:        {padding:"10px 14px",borderRadius:"8px",background:"#1a2332",border:"1px solid #1e293b",color:"#f1f5f9",fontSize:"14px"},
  textarea:     {padding:"10px 14px",borderRadius:"8px",background:"#1a2332",border:"1px solid #1e293b",color:"#f1f5f9",fontSize:"14px",resize:"vertical",fontFamily:"inherit"},
  errorBox:     {padding:"12px 16px",borderRadius:"8px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#fca5a5",fontSize:"14px"},
  btn:          {display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",padding:"14px",borderRadius:"10px",background:"linear-gradient(135deg,#ef4444,#dc2626)",color:"white",fontSize:"15px",fontWeight:700,cursor:"pointer",border:"none"},
  spinner:      {width:"16px",height:"16px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",animation:"spin 0.8s linear infinite",display:"inline-block"},
  successBox:   {padding:"20px",borderRadius:"12px",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.25)",display:"flex",flexDirection:"column",gap:"10px"},
  successHeader:{fontSize:"16px",fontWeight:700,color:"#f59e0b"},
  successText:  {fontSize:"13px",color:"#94a3b8",lineHeight:"1.6"},
  infoRow:      {display:"flex",justifyContent:"space-between",gap:"16px",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"},
  infoLabel:    {fontSize:"12px",color:"#64748b"},
  infoValue:    {fontSize:"13px",color:"#f1f5f9",fontWeight:500,wordBreak:"break-all"},
};
