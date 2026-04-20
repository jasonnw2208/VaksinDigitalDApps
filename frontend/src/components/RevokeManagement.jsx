// src/components/RevokeManagement.jsx
// Owner: approve / reject revoke requests + emergency revoke + undo revoke

import { useState, useEffect } from "react";
import {
  getPendingRevokeRequests, approveRevoke, rejectRevoke,
  emergencyRevoke, undoRevoke, getTokenHistory, formatTimestamp, shortAddress,
} from "../utils/contract";

export default function RevokeManagement({ signer, provider }) {
  const [requests,    setRequests]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [processing,  setProcessing]  = useState(null);
  const [rejectNote,  setRejectNote]  = useState({});
  const [showReject,  setShowReject]  = useState(null);

  // Emergency / Undo panel
  const [emergencyId,     setEmergencyId]     = useState("");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [undoId,          setUndoId]          = useState("");
  const [undoReason,      setUndoReason]      = useState("");
  const [actionResult,    setActionResult]    = useState(null);
  const [actionError,     setActionError]     = useState("");

  useEffect(() => { loadRequests(); }, []);

  async function loadRequests() {
    setLoading(true);
    try {
      const reqs = await getPendingRevokeRequests(provider);
      setRequests(reqs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleApprove(requestId) {
    setProcessing(requestId);
    try {
      await approveRevoke(signer, requestId);
      await loadRequests();
    } catch (e) { alert("Gagal approve: " + (e.reason || e.message)); }
    finally { setProcessing(null); }
  }

  async function handleReject(requestId) {
    const note = rejectNote[requestId] || "";
    if (!note.trim()) { alert("Isi alasan penolakan dulu."); return; }
    setProcessing(requestId);
    try {
      await rejectRevoke(signer, requestId, note);
      setShowReject(null);
      await loadRequests();
    } catch (e) { alert("Gagal reject: " + (e.reason || e.message)); }
    finally { setProcessing(null); }
  }

  async function handleEmergency() {
    if (!emergencyId || !emergencyReason.trim()) {
      setActionError("Token ID dan alasan wajib diisi."); return;
    }
    setActionError(""); setActionResult(null);
    try {
      const receipt = await emergencyRevoke(signer, Number(emergencyId), emergencyReason);
      setActionResult({ type:"revoke", tokenId:emergencyId, txHash:receipt.hash });
      setEmergencyId(""); setEmergencyReason("");
    } catch (e) { setActionError(e.reason || e.message || "Gagal"); }
  }

  async function handleUndo() {
    if (!undoId || !undoReason.trim()) {
      setActionError("Token ID dan alasan wajib diisi."); return;
    }
    setActionError(""); setActionResult(null);
    try {
      const receipt = await undoRevoke(signer, Number(undoId), undoReason);
      setActionResult({ type:"undo", tokenId:undoId, txHash:receipt.hash });
      setUndoId(""); setUndoReason("");
    } catch (e) { setActionError(e.reason || e.message || "Gagal"); }
  }

  return (
    <div style={s.container}>
      <h2 style={s.title}><span>⚖️</span> Revoke Management</h2>
      <p style={s.subtitle}>
        Review permintaan revoke dari faskes. Approve untuk eksekusi, atau reject dengan alasan.
        Owner juga bisa emergency revoke dan undo revoke.
      </p>

      {/* ── Pending Requests ───────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>
          📬 Pending Revoke Requests
          <span style={s.badge}>{requests.length}</span>
          <button style={s.refreshBtn} onClick={loadRequests}>🔄 Refresh</button>
        </div>

        {loading ? (
          <div style={s.center}><span style={s.spinner}/> Memuat...</div>
        ) : requests.length === 0 ? (
          <div style={s.empty}>✅ Tidak ada permintaan revoke yang pending</div>
        ) : (
          <div style={s.requestList}>
            {requests.map(req => (
              <div key={req.requestId} style={s.requestCard}>
                <div style={s.reqHeader}>
                  <div>
                    <div style={s.reqTitle}>Token #{req.tokenId} — {req.facilityName}</div>
                    <div style={s.reqTime}>{formatTimestamp(req.timestamp)}</div>
                  </div>
                  <div style={s.reqIdBadge}>Req #{req.requestId}</div>
                </div>

                <div style={s.reqReason}>
                  <span style={s.reqReasonLabel}>Alasan:</span> {req.reason}
                </div>
                <div style={s.reqBy}>
                  <span style={s.reqReasonLabel}>Diajukan oleh:</span> {shortAddress(req.requestedBy)}
                </div>

                <div style={s.reqActions}>
                  <button
                    style={{...s.approveBtn, opacity: processing===req.requestId ? 0.7 : 1}}
                    onClick={() => handleApprove(req.requestId)}
                    disabled={processing===req.requestId}
                  >
                    {processing===req.requestId ? "Memproses..." : "✅ Approve Revoke"}
                  </button>

                  {showReject === req.requestId ? (
                    <div style={s.rejectForm}>
                      <input style={s.rejectInput}
                        placeholder="Alasan penolakan..."
                        value={rejectNote[req.requestId] || ""}
                        onChange={e => setRejectNote(p => ({...p, [req.requestId]: e.target.value}))} />
                      <button style={s.rejectConfirm} onClick={() => handleReject(req.requestId)}>
                        Kirim Penolakan
                      </button>
                      <button style={s.rejectCancel} onClick={() => setShowReject(null)}>Batal</button>
                    </div>
                  ) : (
                    <button style={s.rejectBtn} onClick={() => setShowReject(req.requestId)}>
                      ❌ Reject
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Emergency Revoke ───────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>🚨 Emergency Revoke (Langsung)</div>
        <p style={s.sectionDesc}>
          Revoke tanpa perlu request dari faskes. Gunakan hanya untuk kasus mendesak.
        </p>
        <div style={s.actionForm}>
          <input style={s.actionInput} type="number" min="0" placeholder="Token ID"
            value={emergencyId} onChange={e => setEmergencyId(e.target.value)} />
          <input style={{...s.actionInput, flex:2}} placeholder="Alasan emergency revoke..."
            value={emergencyReason} onChange={e => setEmergencyReason(e.target.value)} />
          <button style={s.emergencyBtn} onClick={handleEmergency}>🚨 Revoke</button>
        </div>
      </div>

      {/* ── Undo Revoke ────────────────────────────────────────────────────── */}
      <div style={s.section}>
        <div style={s.sectionTitle}>↩️ Undo Revoke (Kembalikan ke Valid)</div>
        <p style={s.sectionDesc}>
          Kembalikan sertifikat yang sudah direvoke menjadi Valid kembali.
          Semua aksi tercatat di riwayat sertifikat.
        </p>
        <div style={s.actionForm}>
          <input style={s.actionInput} type="number" min="0" placeholder="Token ID"
            value={undoId} onChange={e => setUndoId(e.target.value)} />
          <input style={{...s.actionInput, flex:2}} placeholder="Alasan pemulihan..."
            value={undoReason} onChange={e => setUndoReason(e.target.value)} />
          <button style={s.undoBtn} onClick={handleUndo}>↩️ Undo</button>
        </div>
      </div>

      {actionError  && <div style={s.errorBox}>⚠️ {actionError}</div>}
      {actionResult && (
        <div style={s.resultBox}>
          {actionResult.type === "revoke"
            ? `✅ Token #${actionResult.tokenId} berhasil direvoke!`
            : `↩️ Token #${actionResult.tokenId} berhasil dikembalikan ke Valid!`}
          <div style={{fontSize:"11px",color:"#64748b",marginTop:"4px",fontFamily:"monospace"}}>
            Tx: {actionResult.txHash}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container:    {display:"flex",flexDirection:"column",gap:"24px"},
  title:        {fontSize:"20px",fontWeight:700,display:"flex",alignItems:"center",gap:"10px"},
  subtitle:     {color:"#64748b",fontSize:"14px",lineHeight:"1.6"},
  section:      {padding:"20px",borderRadius:"12px",background:"#111827",border:"1px solid #1e293b",display:"flex",flexDirection:"column",gap:"14px"},
  sectionTitle: {fontSize:"15px",fontWeight:700,display:"flex",alignItems:"center",gap:"10px"},
  sectionDesc:  {fontSize:"13px",color:"#64748b",lineHeight:"1.6",margin:0},
  badge:        {padding:"2px 8px",borderRadius:"20px",background:"rgba(239,68,68,0.15)",color:"#fca5a5",fontSize:"12px",fontWeight:700},
  refreshBtn:   {marginLeft:"auto",padding:"6px 12px",borderRadius:"6px",background:"#1e293b",border:"1px solid #334155",color:"#94a3b8",cursor:"pointer",fontSize:"12px"},
  center:       {padding:"20px",textAlign:"center",color:"#64748b",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"},
  spinner:      {width:"16px",height:"16px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.2)",borderTopColor:"#3b82f6",display:"inline-block",animation:"spin 0.8s linear infinite"},
  empty:        {padding:"20px",textAlign:"center",color:"#64748b",fontSize:"14px"},
  requestList:  {display:"flex",flexDirection:"column",gap:"12px"},
  requestCard:  {padding:"16px",borderRadius:"10px",background:"#0f172a",border:"1px solid #1e293b",display:"flex",flexDirection:"column",gap:"10px"},
  reqHeader:    {display:"flex",justifyContent:"space-between",alignItems:"flex-start"},
  reqTitle:     {fontSize:"15px",fontWeight:600,color:"#f1f5f9"},
  reqTime:      {fontSize:"11px",color:"#64748b",marginTop:"2px"},
  reqIdBadge:   {padding:"4px 10px",borderRadius:"6px",background:"rgba(59,130,246,0.1)",color:"#60a5fa",fontSize:"12px",fontWeight:600,flexShrink:0},
  reqReason:    {fontSize:"13px",color:"#94a3b8",lineHeight:"1.5"},
  reqBy:        {fontSize:"12px",color:"#64748b",fontFamily:"'JetBrains Mono',monospace"},
  reqReasonLabel:{fontWeight:600,color:"#64748b",marginRight:"6px"},
  reqActions:   {display:"flex",gap:"10px",flexWrap:"wrap"},
  approveBtn:   {padding:"10px 20px",borderRadius:"8px",background:"linear-gradient(135deg,#10b981,#059669)",color:"white",fontWeight:700,border:"none",cursor:"pointer",fontSize:"13px"},
  rejectBtn:    {padding:"10px 20px",borderRadius:"8px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#fca5a5",fontWeight:600,cursor:"pointer",fontSize:"13px"},
  rejectForm:   {display:"flex",gap:"8px",flex:1,flexWrap:"wrap"},
  rejectInput:  {flex:1,padding:"8px 12px",borderRadius:"6px",background:"#1a2332",border:"1px solid #1e293b",color:"#f1f5f9",fontSize:"13px",minWidth:"150px"},
  rejectConfirm:{padding:"8px 14px",borderRadius:"6px",background:"rgba(239,68,68,0.8)",color:"white",border:"none",cursor:"pointer",fontSize:"13px",fontWeight:600},
  rejectCancel: {padding:"8px 14px",borderRadius:"6px",background:"#1e293b",color:"#94a3b8",border:"none",cursor:"pointer",fontSize:"13px"},
  actionForm:   {display:"flex",gap:"10px",flexWrap:"wrap"},
  actionInput:  {flex:1,minWidth:"100px",padding:"10px 14px",borderRadius:"8px",background:"#1a2332",border:"1px solid #1e293b",color:"#f1f5f9",fontSize:"13px"},
  emergencyBtn: {padding:"10px 18px",borderRadius:"8px",background:"linear-gradient(135deg,#ef4444,#dc2626)",color:"white",fontWeight:700,border:"none",cursor:"pointer",fontSize:"13px"},
  undoBtn:      {padding:"10px 18px",borderRadius:"8px",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"white",fontWeight:700,border:"none",cursor:"pointer",fontSize:"13px"},
  errorBox:     {padding:"12px 16px",borderRadius:"8px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#fca5a5",fontSize:"14px"},
  resultBox:    {padding:"16px",borderRadius:"8px",background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.25)",color:"#6ee7b7",fontSize:"14px"},
};
