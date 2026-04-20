// src/components/CertificateGallery.jsx
import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import {
  getOwnedCertificates, getTokenMetadata, getRecordByTokenId,
  claimCertificate, generateNikHash, getTokensByNik,
  bindNik, getNikHashByWallet, formatTimestamp,
} from "../utils/contract";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

export default function CertificateGallery({ session }) {
  const { signer, provider, address } = session;

  const [certs,         setCerts]         = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedCert,  setSelectedCert]  = useState(null);
  const [claiming,      setClaiming]      = useState(null);
  const [proofStep,     setProofStep]     = useState(null);

  // NIK state
  const [nikBound,   setNikBound]   = useState(false);
  const [nikInput,   setNikInput]   = useState("");
  const [nikLoading, setNikLoading] = useState(false);
  const [nikError,   setNikError]   = useState("");
  const [nikSuccess, setNikSuccess] = useState("");

  useEffect(() => { loadAll(); }, [address]);

  async function loadAll() {
    setLoading(true);
    try {
      // Cek NIK binding
      const boundHash = await getNikHashByWallet(provider, address);
      const isBound   = !!boundHash && boundHash !== ZERO_HASH;
      setNikBound(isBound);

      // Load owned NFTs
      const ids   = await getOwnedCertificates(provider, address);
      const metas = await Promise.all(
        ids.map(async (id) => {
          const [meta, rec] = await Promise.all([
            getTokenMetadata(provider, id),
            getRecordByTokenId(provider, id),
          ]);
          return { id: id.toString(), ...meta, ...rec };
        })
      );
      setCerts(metas);

      // Pending Merkle claims dari sessionStorage
      const stored = JSON.parse(sessionStorage.getItem("vax_claims") || "[]");
      const mine   = stored.filter(c =>
        c.patientAddress?.toLowerCase() === address.toLowerCase()
      );
      setPendingClaims(mine);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleBindNik() {
    if (!nikInput || nikInput.length !== 16 || !/^\d+$/.test(nikInput)) {
      setNikError("NIK harus 16 digit angka."); return;
    }
    setNikLoading(true); setNikError(""); setNikSuccess("");
    try {
      const nikHash = generateNikHash(nikInput);
      await bindNik(signer, nikHash);
      setNikSuccess(`✅ NIK berhasil dihubungkan!`);
      setNikBound(true);
      setNikInput("");
      await loadAll();
    } catch (e) {
      const msg = e.reason || e.message || "";
      if (msg.includes("sudah terikat ke NIK") || msg.includes("already")) {
        // Wallet sudah bound — anggap berhasil, refresh state
        setNikBound(true);
        setNikSuccess("NIK sudah terhubung ke akun ini ✅");
        await loadAll();
      } else if (msg.includes("sudah terikat ke wallet lain")) {
        setNikError("NIK ini sudah terikat ke akun lain. Hubungi faskes untuk reset.");
      } else {
        setNikError(e.reason || e.message || "Gagal bind NIK");
      }
    } finally {
      setNikLoading(false);
    }
  }

  async function handleClaim(claim) {
    setClaiming(claim.dataHash);
    const nikHash = nikInput ? generateNikHash(nikInput) : ZERO_HASH;

    setProofStep("Menghitung Leaf Hash...");
    await new Promise(r => setTimeout(r, 800));
    setProofStep("Mengambil Merkle Proof...");
    await new Promise(r => setTimeout(r, 800));
    setProofStep(`Memverifikasi Proof (${claim.proof.length} level)...`);
    await new Promise(r => setTimeout(r, 1200));
    setProofStep("Mengirim ke Smart Contract...");

    try {
      await claimCertificate(signer, claim.proof, claim.root, claim.dataHash, claim.vaccineType, nikHash);
      setProofStep("✅ NFT Berhasil Diklaim!");
      await new Promise(r => setTimeout(r, 1000));

      const stored  = JSON.parse(sessionStorage.getItem("vax_claims") || "[]");
      const updated = stored.filter(c => c.dataHash !== claim.dataHash);
      sessionStorage.setItem("vax_claims", JSON.stringify(updated));
      await loadAll();
    } catch (e) {
      setProofStep("❌ Gagal: " + (e.reason || e.message));
      await new Promise(r => setTimeout(r, 2000));
    } finally {
      setClaiming(null); setProofStep(null);
    }
  }

  if (loading) {
    return (
      <div style={s.center}>
        <span style={s.spinner}/>&nbsp; Memuat sertifikat...
      </div>
    );
  }

  return (
    <div style={s.container}>

      {/* ── NIK Section ──────────────────────────────────────────────────── */}
      {nikBound ? (
        // Sudah bound — tampilkan badge saja
        <div style={s.nikBoundBadge}>
          🪪 NIK sudah terhubung ke akun ini ✅
          <span style={s.nikBoundSub}>
            Sertifikat yang dicatat oleh faskes dengan NIK kamu akan muncul otomatis.
          </span>
        </div>
      ) : (
        // Belum bound — tampilkan form
        <div style={s.nikCard}>
          <div style={s.nikCardTitle}>🪪 Hubungkan NIK ke Akun Ini</div>
          <p style={s.nikCardDesc}>
            Ikat NIK agar sertifikat yang dicatat oleh faskes bisa ditemukan otomatis,
            bahkan jika faskes input NIK sebelum kamu login.
          </p>
          <div style={s.nikRow}>
            <input
              style={s.nikInput}
              placeholder="Masukkan 16 digit NIK"
              value={nikInput}
              onChange={e => setNikInput(e.target.value.replace(/\D/g, ""))}
              maxLength={16}
            />
            <button
              style={{...s.nikBtn, opacity: nikLoading ? 0.7 : 1}}
              onClick={handleBindNik}
              disabled={nikLoading}
            >
              {nikLoading ? "Memproses..." : "🔗 Hubungkan"}
            </button>
          </div>
          {nikError   && <div style={s.errMini}>⚠️ {nikError}</div>}
          {nikSuccess && <div style={s.okMini}>{nikSuccess}</div>}
        </div>
      )}

      {/* ── Pending Merkle Claims ───────────────────────────────────────────── */}
      {pendingClaims.length > 0 && (
        <div style={s.pendingBox}>
          <h3 style={s.pendingTitle}>🎁 {pendingClaims.length} Sertifikat Menunggu Diklaim</h3>
          {proofStep && <div style={s.proofVisual}>🛠️ <strong>Merkle Verification:</strong> {proofStep}</div>}
          <div style={s.pendingList}>
            {pendingClaims.map(c => (
              <div key={c.dataHash} style={s.pendingItem}>
                <div>
                  <div style={s.pLabel}>{c.vaccineType}</div>
                  <div style={s.pSub}>Root: {c.root?.slice(0, 12)}...</div>
                </div>
                <button
                  style={{...s.claimBtn, opacity: !!claiming ? 0.7 : 1}}
                  disabled={!!claiming}
                  onClick={() => handleClaim(c)}
                >
                  {claiming === c.dataHash ? "Claiming..." : "Klaim NFT"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NFT Gallery ────────────────────────────────────────────────────── */}
      <h2 style={s.title}>📜 Sertifikat NFT Saya</h2>

      {certs.length === 0 ? (
        <div style={s.empty}>
          <div style={{fontSize:"48px",marginBottom:"12px"}}>💉</div>
          <div style={{fontWeight:600,marginBottom:"8px"}}>Belum ada sertifikat</div>
          <div style={{color:"#64748b",fontSize:"14px"}}>
            Sertifikat akan muncul setelah faskes mencatat vaksinasi untuk wallet kamu.<br/>
            Pastikan faskes menggunakan wallet address kamu yang benar.
          </div>
        </div>
      ) : (
        <div style={s.grid}>
          {certs.map(cert => (
            <div key={cert.id} style={s.card} onClick={() => setSelectedCert(cert)}>
              {cert.image
                ? <img src={cert.image} alt={cert.name} style={s.cardImg}/>
                : <div style={s.cardImgPlaceholder}>🏥</div>
              }
              <div style={s.cardBody}>
                <div style={s.cardTitle}>{cert.name || `VaxChain #${cert.id}`}</div>
                <div style={s.cardSub}>{cert.vaccineType || cert.attributes?.find(a=>a.trait_type==="Vaccine")?.value}</div>
                <div style={{
                  ...s.cardStatus,
                  color:      cert.isValid ? "#10b981" : "#ef4444",
                  background: cert.isValid ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                }}>
                  {cert.isValid ? "✅ Valid" : "❌ Direvoke"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Detail + QR ──────────────────────────────────────────────── */}
      {selectedCert && (
        <div style={s.overlay} onClick={() => setSelectedCert(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setSelectedCert(null)}>✕</button>
            <div style={s.modalHeader}>Detail Sertifikat</div>
            <div style={s.modalBody}>
              {selectedCert.image && (
                <div style={s.certPreview}>
                  <img src={selectedCert.image} alt="NFT" style={s.modalImg}/>
                </div>
              )}
              <div style={s.certInfo}>
                <h3 style={s.infoTitle}>{selectedCert.name || `VaxChain #${selectedCert.id}`}</h3>

                <div style={s.qrSection}>
                  <div style={s.qrWrapper}>
                    <QRCode
                      value={`vaxchain:verify:${selectedCert.id}`}
                      size={120}
                      bgColor="#ffffff"
                      fgColor="#0f172a"
                    />
                  </div>
                  <div style={s.qrText}>
                    <strong style={{color:"#f1f5f9"}}>QR Verifikasi</strong>
                    <span style={{color:"#64748b",fontSize:"12px"}}>
                      Tunjukkan ke petugas untuk verifikasi sertifikat
                    </span>
                    <span style={{color:"#60a5fa",fontSize:"12px",fontWeight:600}}>
                      Token ID: #{selectedCert.id}
                    </span>
                  </div>
                </div>

                <div style={s.attrGrid}>
                  {selectedCert.vaccineType && (
                    <div style={s.attrItem}>
                      <span style={s.attrLabel}>Jenis Vaksin</span>
                      <span style={s.attrValue}>{selectedCert.vaccineType}</span>
                    </div>
                  )}
                  {selectedCert.facilityName && (
                    <div style={s.attrItem}>
                      <span style={s.attrLabel}>Faskes</span>
                      <span style={s.attrValue}>{selectedCert.facilityName}</span>
                    </div>
                  )}
                  {selectedCert.timestamp > 0 && (
                    <div style={s.attrItem}>
                      <span style={s.attrLabel}>Tanggal</span>
                      <span style={s.attrValue}>{formatTimestamp(selectedCert.timestamp)}</span>
                    </div>
                  )}
                  <div style={s.attrItem}>
                    <span style={s.attrLabel}>Token ID</span>
                    <span style={s.attrValue}>#{selectedCert.id}</span>
                  </div>
                  <div style={s.attrItem}>
                    <span style={s.attrLabel}>Status</span>
                    <span style={{...s.attrValue, color: selectedCert.isValid ? "#10b981" : "#ef4444"}}>
                      {selectedCert.isValid ? "✅ Valid" : "❌ Direvoke"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  container:    {display:"flex",flexDirection:"column",gap:"20px"},
  center:       {display:"flex",alignItems:"center",justifyContent:"center",padding:"60px",gap:"12px",color:"#64748b"},
  spinner:      {width:"20px",height:"20px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.2)",borderTopColor:"#3b82f6",display:"inline-block",animation:"spin 0.8s linear infinite"},

  // NIK bound badge
  nikBoundBadge:{display:"flex",flexDirection:"column",gap:"4px",padding:"14px 18px",borderRadius:"10px",background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.25)",color:"#6ee7b7",fontSize:"14px",fontWeight:600},
  nikBoundSub:  {fontSize:"12px",color:"#64748b",fontWeight:400},

  // NIK form
  nikCard:      {padding:"20px",borderRadius:"12px",background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.2)"},
  nikCardTitle: {fontSize:"16px",fontWeight:700,marginBottom:"8px"},
  nikCardDesc:  {fontSize:"13px",color:"#64748b",lineHeight:"1.6",marginBottom:"16px"},
  nikRow:       {display:"flex",gap:"10px"},
  nikInput:     {flex:1,padding:"10px 14px",borderRadius:"8px",background:"#1a2332",border:"1px solid #1e293b",color:"#f1f5f9",fontSize:"15px",letterSpacing:"1px"},
  nikBtn:       {padding:"10px 20px",borderRadius:"8px",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"white",fontWeight:600,border:"none",cursor:"pointer"},
  errMini:      {marginTop:"10px",padding:"8px 12px",borderRadius:"6px",background:"rgba(239,68,68,0.1)",color:"#fca5a5",fontSize:"13px"},
  okMini:       {marginTop:"10px",padding:"8px 12px",borderRadius:"6px",background:"rgba(16,185,129,0.1)",color:"#6ee7b7",fontSize:"13px"},

  // Pending claims
  pendingBox:   {padding:"20px",background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:"12px"},
  pendingTitle: {fontSize:"15px",fontWeight:700,color:"#10b981",marginBottom:"12px"},
  proofVisual:  {padding:"10px",background:"rgba(59,130,246,0.1)",borderRadius:"8px",border:"1px dashed #3b82f6",color:"#60a5fa",fontSize:"12px",marginBottom:"12px",textAlign:"center"},
  pendingList:  {display:"flex",flexDirection:"column",gap:"10px"},
  pendingItem:  {display:"flex",justifyContent:"space-between",alignItems:"center",background:"#111827",padding:"12px",borderRadius:"8px"},
  pLabel:       {fontSize:"14px",fontWeight:600,color:"#f1f5f9"},
  pSub:         {fontSize:"10px",color:"#64748b"},
  claimBtn:     {padding:"8px 16px",background:"#10b981",color:"white",borderRadius:"6px",fontWeight:600,border:"none",cursor:"pointer"},

  // Gallery
  title:        {fontSize:"20px",fontWeight:700},
  empty:        {padding:"60px 20px",borderRadius:"12px",background:"#111827",border:"1px solid #1e293b",textAlign:"center"},
  grid:         {display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"20px"},
  card:         {borderRadius:"12px",background:"#111827",border:"1px solid #1e293b",overflow:"hidden",cursor:"pointer",transition:"transform 0.15s"},
  cardImg:      {width:"100%",aspectRatio:"2/3",objectFit:"cover"},
  cardImgPlaceholder:{width:"100%",aspectRatio:"2/3",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"48px",background:"#1e293b"},
  cardBody:     {padding:"12px",display:"flex",flexDirection:"column",gap:"6px"},
  cardTitle:    {fontSize:"14px",fontWeight:600,color:"#f1f5f9"},
  cardSub:      {fontSize:"12px",color:"#64748b"},
  cardStatus:   {fontSize:"11px",fontWeight:600,padding:"3px 8px",borderRadius:"4px",alignSelf:"flex-start"},

  // Modal
  overlay:      {position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"20px"},
  modal:        {maxWidth:"820px",width:"100%",background:"#0f172a",borderRadius:"20px",border:"1px solid #1e293b",position:"relative",overflow:"hidden",maxHeight:"90vh",overflowY:"auto"},
  closeBtn:     {position:"absolute",top:"16px",right:"16px",background:"none",color:"#94a3b8",fontSize:"20px",cursor:"pointer",zIndex:10,border:"none"},
  modalHeader:  {padding:"20px",borderBottom:"1px solid #1e293b",fontWeight:700,fontSize:"18px"},
  modalBody:    {display:"flex",gap:"32px",padding:"32px",flexWrap:"wrap"},
  certPreview:  {flex:"1",minWidth:"200px",maxWidth:"260px"},
  modalImg:     {width:"100%",borderRadius:"12px",border:"1px solid #1e293b"},
  certInfo:     {flex:"1.5",minWidth:"240px",display:"flex",flexDirection:"column",gap:"16px"},
  infoTitle:    {fontSize:"22px",fontWeight:800,color:"#10b981"},
  qrSection:    {display:"flex",alignItems:"center",gap:"16px",padding:"16px",background:"#1a2332",borderRadius:"12px",border:"1px solid #1e293b"},
  qrWrapper:    {padding:"8px",background:"white",borderRadius:"8px",flexShrink:0},
  qrText:       {display:"flex",flexDirection:"column",gap:"6px"},
  attrGrid:     {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},
  attrItem:     {padding:"10px",borderRadius:"8px",background:"#111827",border:"1px solid #1e293b",display:"flex",flexDirection:"column",gap:"3px"},
  attrLabel:    {fontSize:"10px",color:"#64748b",textTransform:"uppercase",letterSpacing:"0.5px"},
  attrValue:    {fontSize:"13px",color:"#f1f5f9",fontWeight:600},
};
