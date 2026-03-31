// src/components/CertificateGallery.jsx
import { useState, useEffect } from "react";
import { getOwnedCertificates, getTokenMetadata, formatTimestamp } from "../utils/contract";
import QRCode from "react-qr-code";

export default function CertificateGallery({ wallet }) {
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCert, setSelectedCert] = useState(null);

  const [pendingClaims, setPendingClaims] = useState([]);
  const [claiming, setClaiming] = useState(null);
  const [proofStep, setProofStep] = useState(null);

  const loadAll = async () => {
    if (!wallet) return;
    setLoading(true);
    try {
      // Load owned NFTs
      const ids = await getOwnedCertificates(wallet.provider, wallet.address);
      const metadataPromises = ids.map(id => getTokenMetadata(wallet.provider, id));
      const metadataResults = await Promise.all(metadataPromises);
      const owned = ids.map((id, index) => ({ id: id.toString(), ...metadataResults[index] }));
      setCerts(owned);

      // Load pending claims from localStorage (Mock DB)
      const allClaims = JSON.parse(localStorage.getItem("vax_claims") || "[]");
      const userClaims = allClaims.filter(c => c.patientAddress.toLowerCase() === wallet.address.toLowerCase());
      setPendingClaims(userClaims);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [wallet]);

  const handleClaim = async (claim) => {
    setClaiming(claim.dataHash);
    
    // -- Visual Proof Path Simulation --
    setProofStep("Calculating Leaf Hash...");
    await new Promise(r => setTimeout(r, 800));
    setProofStep("Fetching Merkle Proof from Registry...");
    await new Promise(r => setTimeout(r, 800));
    setProofStep(`Hashing Proof (${claim.proof.length} levels)...`);
    await new Promise(r => setTimeout(r, 1200));
    setProofStep("Sending Verification to Smart Contract...");

    try {
      const { claimCertificate } = await import("../utils/contract");
      await claimCertificate(wallet.signer, claim.proof, claim.root, claim.dataHash, claim.vaccineType);
      
      setProofStep("Success! NFT Minted. ✅");
      await new Promise(r => setTimeout(r, 1000));

      // Remove from pending
      const allClaims = JSON.parse(localStorage.getItem("vax_claims") || "[]");
      const updated = allClaims.filter(c => c.dataHash !== claim.dataHash);
      localStorage.setItem("vax_claims", JSON.stringify(updated));
      
      await loadAll();
    } catch (e) {
      alert("Klaim gagal: " + e.message);
    } finally {
      setClaiming(null);
      setProofStep(null);
    }
  };

  if (loading) return <div style={s.center}>Memuat sertifikat Anda...</div>;

  return (
    <div style={s.container}>
      {pendingClaims.length > 0 && (
        <div style={s.pendingBox}>
          <h3 style={s.pendingTitle}>🎁 Anda Memiliki {pendingClaims.length} Sertifikat yang Belum Diklaim</h3>
          {proofStep && <div style={s.proofVisual}>🛠️ <strong>Merkle Verification:</strong> {proofStep}</div>}
          <div style={s.pendingList}>
            {pendingClaims.map(c => (
              <div key={c.dataHash} style={s.pendingItem}>
                <div>
                  <div style={s.pLabel}>{c.vaccineType}</div>
                  <div style={s.pSub}>Root: {c.root.slice(0,10)}...</div>
                </div>
                <button 
                  style={s.claimBtn} 
                  disabled={claiming === c.dataHash}
                  onClick={() => handleClaim(c)}
                >
                  {claiming === c.dataHash ? "Claiming..." : "Klaim NFT"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 style={s.title}>Sertifikat NFT Saya</h2>
      
      {certs.length === 0 ? (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>📜</div>
          <p>Belum ada sertifikat yang terdaftar untuk alamat ini.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {certs.map(cert => (
            <div key={cert.id} style={s.card} onClick={() => setSelectedCert(cert)}>
              <img src={cert.image} alt={cert.name} style={s.cardImg} />
              <div style={s.cardBody}>
                <div style={s.cardTitle}>{cert.name}</div>
                <div style={s.cardSub}>{cert.attributes?.find(a => a.trait_type === "Vaccine")?.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal Detail ─────────────────────────────────────────────────── */}
      {selectedCert && (
        <div style={s.modalOverlay} onClick={() => setSelectedCert(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setSelectedCert(null)}>✕</button>
            <div style={s.modalHeader}>Detail Sertifikat</div>
            
            <div style={s.modalContent}>
              <div style={s.certPreview}>
                <img src={selectedCert.image} alt="NFT" style={s.modalImg} />
              </div>
              
              <div style={s.certInfo}>
                <h3 style={s.infoTitle}>{selectedCert.name}</h3>
                <p style={s.infoDesc}>{selectedCert.description}</p>
                
                <div style={s.qrSection}>
                  <div style={s.qrWrapper}>
                    <QRCode 
                      value={`verify:${selectedCert.id}`} 
                      size={120}
                      bgColor="#ffffff"
                      fgColor="#0f172a"
                    />
                  </div>
                  <div style={s.qrText}>
                    <strong>QR Verification</strong>
                    <span>Scan untuk verifikasi keaslian via aplikasi VaxChain</span>
                  </div>
                </div>

                <div style={s.attrList}>
                  {selectedCert.attributes?.map(a => (
                    <div key={a.trait_type} style={s.attrItem}>
                      <span style={s.attrLabel}>{a.trait_type}</span>
                      <span style={s.attrValue}>{a.value}</span>
                    </div>
                  ))}
                  <div style={s.attrItem}>
                    <span style={s.attrLabel}>Token ID</span>
                    <span style={s.attrValue}>#{selectedCert.id}</span>
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
  container: { display: "flex", flexDirection: "column", gap: "20px" },
  title: { fontSize: "20px", fontWeight: 700 },
  center: { textAlign: "center", padding: "40px", color: "#64748b" },
  emptyState: {
    padding: "60px", textAlign: "center", borderRadius: "16px",
    background: "#111827", border: "1px solid #1e293b",
  },
  emptyIcon: { fontSize: "48px", marginBottom: "16px" },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "20px",
  },
  card: {
    borderRadius: "12px", background: "#111827", border: "1px solid #1e293b",
    overflow: "hidden", cursor: "pointer", transition: "transform 0.2s",
  },
  cardImg: { width: "100%", aspectRatio: "2/3", objectFit: "cover" },
  cardBody: { padding: "12px" },
  cardTitle: { fontSize: "14px", fontWeight: 600, color: "#f1f5f9" },
  cardSub: { fontSize: "12px", color: "#64748b" },
  
  modalOverlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    padding: "20px",
  },
  modal: {
    maxWidth: "800px", width: "100%", background: "#0f172a", borderRadius: "20px",
    border: "1px solid #1e293b", position: "relative", overflow: "hidden",
  },
  closeBtn: {
    position: "absolute", top: "16px", right: "16px", background: "none",
    color: "#94a3b8", fontSize: "20px", cursor: "pointer", zIndex: 10,
  },
  modalHeader: { padding: "20px", borderBottom: "1px solid #1e293b", fontWeight: 700, fontSize: "18px" },
  modalContent: { display: "flex", gap: "32px", padding: "32px", flexDirection: "row" },
  certPreview: { flex: "1", maxWidth: "300px" },
  modalImg: { width: "100%", borderRadius: "12px", border: "1px solid #1e293b" },
  certInfo: { flex: "1.5", display: "flex", flexDirection: "column", gap: "16px" },
  infoTitle: { fontSize: "24px", fontWeight: 800, color: "#10b981" },
  infoDesc: { color: "#64748b", fontSize: "14px", lineHeight: "1.6" },
  qrSection: {
    display: "flex", alignItems: "center", gap: "16px", padding: "16px",
    background: "#1a2332", borderRadius: "12px", border: "1px solid #1e293b",
  },
  qrWrapper: { padding: "8px", background: "white", borderRadius: "8px" },
  qrText: { display: "flex", flexDirection: "column", gap: "4px" },
  attrList: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "12px" },
  attrItem: {
    padding: "10px", borderRadius: "8px", background: "#111827", border: "1px solid #1e293b",
    display: "flex", flexDirection: "column", gap: "2px",
  },
  attrLabel: { fontSize: "10px", color: "#64748b", textTransform: "uppercase" },
  attrValue: { fontSize: "13px", color: "#f1f5f9", fontWeight: 600 },

  // New Claims Styles
  pendingBox: { padding: "20px", background: "rgba(16,185,129,0.1)", border: "1px solid #10b981", borderRadius: "12px", marginBottom: "20px" },
  pendingTitle: { fontSize: "16px", fontWeight: 700, color: "#10b981", marginBottom: "12px" },
  pendingList: { display: "flex", flexDirection: "column", gap: "10px" },
  pendingItem: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111827", padding: "12px", borderRadius: "8px" },
  pLabel: { fontSize: "14px", fontWeight: 600, color: "#f1f5f9" },
  pSub: { fontSize: "10px", color: "#64748b" },
  claimBtn: { padding: "8px 16px", background: "#10b981", color: "white", borderRadius: "6px", fontWeight: 600, border: "none", cursor: "pointer" },
  proofVisual: { padding: "10px", background: "rgba(59,130,246,0.1)", borderRadius: "8px", border: "1px dashed #3b82f6", color: "#60a5fa", fontSize: "12px", marginBottom: "12px", textAlign: "center" },
};
