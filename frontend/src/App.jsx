// src/App.jsx
import { useState, useEffect, useCallback } from "react";
import {
  connectMetaMask,
  checkIsIssuer,
  getOwner,
  getIssuerName,
  shortAddress,
  SUPPORTED_CHAINS,
  CONTRACT_ADDRESS,
} from "./utils/contract";
import { ethers } from "ethers";

import AddRecord    from "./components/AddRecord.jsx";
import VerifyRecord from "./components/VerifyRecord.jsx";
import RevokeRecord from "./components/RevokeRecord.jsx";
import AdminPanel   from "./components/AdminPanel.jsx";

// ── Icon SVG kecil ────────────────────────────────────────────────────────────
const Icons = {
  shield: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  check: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  add: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  ),
  revoke: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  ),
  admin: (
    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  wallet: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
      <path d="M16 3.5l-4 3.5-4-3.5"/>
    </svg>
  ),
};

export default function App() {
  const [activeTab, setActiveTab]     = useState("verify");
  const [wallet, setWallet]           = useState(null);
  const [isIssuer, setIsIssuer]       = useState(false);
  const [isOwner, setIsOwner]         = useState(false);
  const [facilityName, setFacilityName] = useState("");
  const [connecting, setConnecting]   = useState(false);
  const [error, setError]             = useState("");

  // ── Koneksi wallet ──────────────────────────────────────────────────────────
  const connect = useCallback(async () => {
    setConnecting(true);
    setError("");
    try {
      const { provider, signer, address, chainId } = await connectMetaMask();
      const [issuer, owner, name] = await Promise.all([
        checkIsIssuer(provider, address),
        getOwner(provider),
        getIssuerName(provider, address),
      ]);

      setWallet({ provider, signer, address, chainId });
      setIsIssuer(issuer);
      setIsOwner(owner.toLowerCase() === address.toLowerCase());
      setFacilityName(name || "");

      // Dengarkan perubahan akun
      window.ethereum.on("accountsChanged", () => window.location.reload());
      window.ethereum.on("chainChanged",    () => window.location.reload());
    } catch (e) {
      setError(e.message || "Gagal terhubung ke MetaMask");
    } finally {
      setConnecting(false);
    }
  }, []);

  // Auto-reconnect kalau sudah pernah konek sebelumnya
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: "eth_accounts" }).then(accounts => {
        if (accounts.length > 0) connect();
      });
    }
  }, []);

  // ── Tab definitions ─────────────────────────────────────────────────────────
  const tabs = [
    { id: "verify",  label: "Verifikasi",  icon: Icons.check,  show: true },
    { id: "add",     label: "Catat Vaksin",icon: Icons.add,     show: isIssuer },
    { id: "revoke",  label: "Revoke",      icon: Icons.revoke,  show: isIssuer },
    { id: "admin",   label: "Admin",       icon: Icons.admin,   show: isOwner  },
  ].filter(t => t.show);

  const chainInfo = wallet ? SUPPORTED_CHAINS[wallet.chainId] : null;

  return (
    <div style={styles.root}>
      {/* ── Background decoration ─────────────────────────────────────────── */}
      <div style={styles.bgGlow1} />
      <div style={styles.bgGlow2} />

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>{Icons.shield}</span>
          <div>
            <div style={styles.logoTitle}>VaxChain</div>
            <div style={styles.logoSub}>Rekam Vaksin Digital Terverifikasi</div>
          </div>
        </div>

        <div style={styles.headerRight}>
          {/* Chain badge */}
          {chainInfo && (
            <div style={styles.chainBadge}>
              <span style={{...styles.dot, background: "#10b981"}} />
              {chainInfo.name}
            </div>
          )}

          {/* Wallet button */}
          {!wallet ? (
            <button
              style={styles.btnConnect}
              onClick={connect}
              disabled={connecting}
            >
              {connecting ? (
                <span style={styles.spinner} />
              ) : (
                Icons.wallet
              )}
              {connecting ? "Menghubungkan..." : "Connect MetaMask"}
            </button>
          ) : (
            <div style={styles.walletInfo}>
              <span style={{...styles.dot, background: "#3b82f6"}} />
              <span style={styles.walletAddress}>{shortAddress(wallet.address)}</span>
              {isOwner  && <span style={styles.badge("owner")}>Owner</span>}
              {isIssuer && !isOwner && <span style={styles.badge("issuer")}>Faskes</span>}
            </div>
          )}
        </div>
      </header>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div style={styles.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError("")} style={styles.errorClose}>✕</button>
        </div>
      )}

      {/* ── Warn: wallet belum konek ──────────────────────────────────────── */}
      {!wallet && !connecting && (
        <div style={styles.noWalletHero} className="fade-in">
          <div style={styles.heroIcon}>{Icons.shield}</div>
          <h1 style={styles.heroTitle}>Rekam Vaksin Digital</h1>
          <p style={styles.heroSubtitle}>
            Platform verifikasi sertifikat vaksin berbasis blockchain.<br/>
            Data tersimpan permanen dan tidak dapat dimanipulasi.
          </p>
          <button style={styles.btnConnectLarge} onClick={connect}>
            {Icons.wallet}
            Hubungkan MetaMask untuk Mulai
          </button>
          <div style={styles.contractInfo}>
            <span style={styles.contractLabel}>Contract:</span>
            <span style={styles.contractAddress}>{CONTRACT_ADDRESS}</span>
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      {wallet && (
        <main style={styles.main} className="fade-in">
          {/* Facility info banner */}
          {facilityName && (
            <div style={styles.facilityBanner}>
              🏥 Login sebagai <strong>{facilityName}</strong>
              {isOwner && " · Administrator Sistem"}
            </div>
          )}

          {/* Tab nav */}
          <nav style={styles.tabNav}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                style={{
                  ...styles.tabBtn,
                  ...(activeTab === tab.id ? styles.tabBtnActive : {}),
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div style={styles.tabContent}>
            {activeTab === "verify" && (
              <VerifyRecord provider={wallet.provider} />
            )}
            {activeTab === "add" && isIssuer && (
              <AddRecord signer={wallet.signer} issuerAddress={wallet.address} />
            )}
            {activeTab === "revoke" && isIssuer && (
              <RevokeRecord signer={wallet.signer} />
            )}
            {activeTab === "admin" && isOwner && (
              <AdminPanel signer={wallet.signer} provider={wallet.provider} />
            )}
          </div>
        </main>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={styles.footer}>
        DApps Rekam Vaksin Digital · Tugas Mata Kuliah Blockchain · 2024
      </footer>
    </div>
  );
}

// ── Inline styles ────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "hidden",
  },
  bgGlow1: {
    position: "fixed", top: "-30%", left: "-10%",
    width: "600px", height: "600px", borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  bgGlow2: {
    position: "fixed", bottom: "-20%", right: "-5%",
    width: "500px", height: "500px", borderRadius: "50%",
    background: "radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 32px",
    borderBottom: "1px solid #1e293b",
    background: "rgba(10,15,30,0.8)",
    backdropFilter: "blur(12px)",
    position: "sticky", top: 0, zIndex: 100,
  },
  logo: { display: "flex", alignItems: "center", gap: "12px" },
  logoIcon: {
    width: "40px", height: "40px", borderRadius: "10px",
    background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "white",
  },
  logoTitle: { fontSize: "18px", fontWeight: 700, letterSpacing: "-0.5px" },
  logoSub:   { fontSize: "11px", color: "#64748b" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  chainBadge: {
    display: "flex", alignItems: "center", gap: "6px",
    padding: "6px 12px", borderRadius: "20px",
    background: "#111827", border: "1px solid #1e293b",
    fontSize: "12px", color: "#94a3b8",
  },
  dot: { width: "7px", height: "7px", borderRadius: "50%", display: "inline-block" },
  btnConnect: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "10px 20px", borderRadius: "10px",
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    color: "white", fontSize: "14px", fontWeight: 600,
    transition: "opacity 0.2s",
  },
  spinner: {
    width: "16px", height: "16px", borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "white",
    display: "inline-block",
    animation: "spin 0.8s linear infinite",
  },
  walletInfo: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "8px 16px", borderRadius: "10px",
    background: "#111827", border: "1px solid #1e293b",
  },
  walletAddress: { fontSize: "13px", fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8" },
  badge: (type) => ({
    padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600,
    background: type === "owner" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
    color:      type === "owner" ? "#f59e0b" : "#10b981",
    border:     `1px solid ${type === "owner" ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)"}`,
  }),
  errorBanner: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 32px",
    background: "rgba(239,68,68,0.1)", borderBottom: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5", fontSize: "14px",
  },
  errorClose: { background: "none", color: "#fca5a5", fontSize: "16px", cursor: "pointer" },
  noWalletHero: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "80px 20px", textAlign: "center",
  },
  heroIcon: {
    width: "72px", height: "72px", borderRadius: "20px", marginBottom: "24px",
    background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "white", fontSize: "32px",
    boxShadow: "0 8px 32px rgba(59,130,246,0.3)",
  },
  heroTitle: { fontSize: "36px", fontWeight: 800, marginBottom: "16px", letterSpacing: "-1px" },
  heroSubtitle: { fontSize: "16px", color: "#64748b", marginBottom: "32px", maxWidth: "480px", lineHeight: "1.7" },
  btnConnectLarge: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "14px 28px", borderRadius: "12px",
    background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
    color: "white", fontSize: "16px", fontWeight: 700,
    marginBottom: "32px",
    boxShadow: "0 4px 20px rgba(59,130,246,0.4)",
    transition: "transform 0.2s",
  },
  contractInfo: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "10px 16px", borderRadius: "8px",
    background: "#111827", border: "1px solid #1e293b",
  },
  contractLabel:  { fontSize: "11px", color: "#64748b" },
  contractAddress: { fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8" },
  main: {
    flex: 1,
    maxWidth: "900px",
    width: "100%",
    margin: "0 auto",
    padding: "32px 20px",
  },
  facilityBanner: {
    padding: "10px 16px", borderRadius: "10px", marginBottom: "24px",
    background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)",
    color: "#6ee7b7", fontSize: "14px",
  },
  tabNav: {
    display: "flex", gap: "4px",
    padding: "4px", borderRadius: "12px",
    background: "#111827", border: "1px solid #1e293b",
    marginBottom: "24px", width: "fit-content",
  },
  tabBtn: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "10px 20px", borderRadius: "8px",
    background: "none", color: "#64748b",
    fontSize: "14px", fontWeight: 500,
    transition: "all 0.15s",
  },
  tabBtnActive: {
    background: "#1e293b",
    color: "#f1f5f9",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  },
  tabContent: { animation: "fadeIn 0.3s ease" },
  footer: {
    textAlign: "center", padding: "20px",
    color: "#374151", fontSize: "12px",
    borderTop: "1px solid #111827",
  },
};
