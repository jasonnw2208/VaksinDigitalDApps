// src/App.jsx
import { useState, useEffect, useCallback } from "react";
import {
  loginWithGoogle,
  restoreSession,
  logoutWeb3Auth,
} from "./utils/web3auth";
import {
  checkIsIssuer,
  getOwner,
  getIssuerName,
  shortAddress,
  SUPPORTED_CHAINS,
  CONTRACT_ADDRESS,
} from "./utils/contract";

import AddRecord    from "./components/AddRecord.jsx";
import VerifyRecord from "./components/VerifyRecord.jsx";
import RevokeRecord from "./components/RevokeRecord.jsx";
import AdminPanel   from "./components/AdminPanel.jsx";

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
  logout: (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  google: (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  ),
};

export default function App() {
  const [activeTab, setActiveTab]       = useState("verify");
  const [session, setSession]           = useState(null);
  const [isIssuer, setIsIssuer]         = useState(false);
  const [isOwner, setIsOwner]           = useState(false);
  const [facilityName, setFacilityName] = useState("");
  const [connecting, setConnecting]     = useState(false);
  const [error, setError]               = useState("");

  async function applySession(sess) {
    const { provider, address } = sess;
    const [issuer, owner, name] = await Promise.all([
      checkIsIssuer(provider, address),
      getOwner(provider),
      getIssuerName(provider, address),
    ]);
    setSession(sess);
    setIsIssuer(issuer);
    setIsOwner(owner.toLowerCase() === address.toLowerCase());
    setFacilityName(name || "");
  }

  // Auto-restore sesi kalau sudah pernah login
  useEffect(() => {
    restoreSession().then(sess => {
      if (sess) applySession(sess).catch(() => {});
    });
  }, []);

  const handleLogin = useCallback(async () => {
    setConnecting(true);
    setError("");
    try {
      const sess = await loginWithGoogle();
      await applySession(sess);
    } catch (e) {
      setError(e.message || "Gagal login dengan Google");
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutWeb3Auth();
    setSession(null);
    setIsIssuer(false);
    setIsOwner(false);
    setFacilityName("");
    setActiveTab("verify");
  }, []);

  const tabs = [
    { id: "verify",  label: "Verifikasi",   icon: Icons.check,  show: true },
    { id: "add",     label: "Catat Vaksin", icon: Icons.add,     show: isIssuer },
    { id: "revoke",  label: "Revoke",       icon: Icons.revoke,  show: isIssuer },
    { id: "admin",   label: "Admin",        icon: Icons.admin,   show: isOwner  },
  ].filter(t => t.show);

  const chainInfo = session ? SUPPORTED_CHAINS[session.chainId] : null;
  const userInfo  = session?.userInfo;

  return (
    <div style={styles.root}>
      <div style={styles.bgGlow1} />
      <div style={styles.bgGlow2} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>{Icons.shield}</span>
          <div>
            <div style={styles.logoTitle}>VaxChain</div>
            <div style={styles.logoSub}>Rekam Vaksin Digital Terverifikasi</div>
          </div>
        </div>

        <div style={styles.headerRight}>
          {chainInfo && (
            <div style={styles.chainBadge}>
              <span style={{...styles.dot, background: "#10b981"}} />
              {chainInfo.name}
            </div>
          )}

          {!session ? (
            <button style={styles.btnGoogle} onClick={handleLogin} disabled={connecting}>
              {connecting ? <span style={styles.spinner} /> : Icons.google}
              {connecting ? "Menghubungkan..." : "Masuk"}
            </button>
          ) : (
            <div style={styles.userArea}>
              {userInfo?.profileImage ? (
                <img src={userInfo.profileImage} alt={userInfo.name} style={styles.avatar} referrerPolicy="no-referrer" />
              ) : (
                <div style={styles.avatarFallback}>{userInfo?.name?.[0]?.toUpperCase() || "U"}</div>
              )}
              <div style={styles.userMeta}>
                <span style={styles.userName}>{userInfo?.name || "User"}</span>
                <span style={styles.walletAddress}>{shortAddress(session.address)}</span>
              </div>
              {isOwner  && <span style={styles.badge("owner")}>Owner</span>}
              {isIssuer && !isOwner && <span style={styles.badge("issuer")}>Faskes</span>}
              <button style={styles.btnLogout} onClick={handleLogout} title="Logout">
                {Icons.logout}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Error */}
      {error && (
        <div style={styles.errorBanner}>
          ⚠️ {error}
          <button onClick={() => setError("")} style={styles.errorClose}>✕</button>
        </div>
      )}

      {/* Hero (belum login) */}
      {!session && !connecting && (
        <div style={styles.noWalletHero} className="fade-in">
          <div style={styles.heroIcon}>{Icons.shield}</div>
          <h1 style={styles.heroTitle}>Rekam Vaksin Digital</h1>
          <p style={styles.heroSubtitle}>
            Platform verifikasi sertifikat vaksin berbasis blockchain.<br/>
            Data tersimpan permanen dan tidak dapat dimanipulasi.
          </p>

          <button style={styles.btnGoogleLarge} onClick={handleLogin}>
            Masuk dengan Akun Sosial
          </button>

          <p style={styles.loginNote}>
            Login dengan Google, X, Facebook, atau Email.<br/>
            Wallet blockchain dibuat otomatis — tidak perlu MetaMask. 
          </p>

          <div style={styles.contractInfo}>
            <span style={styles.contractLabel}>Contract:</span>
            <span style={styles.contractAddress}>{CONTRACT_ADDRESS}</span>
          </div>
        </div>
      )}

      {/* Main content */}
      {session && (
        <main style={styles.main} className="fade-in">
          {facilityName && (
            <div style={styles.facilityBanner}>
              🏥 Login sebagai <strong>{facilityName}</strong>
              {isOwner && " · Administrator Sistem"}
            </div>
          )}

          <nav style={styles.tabNav}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                style={{ ...styles.tabBtn, ...(activeTab === tab.id ? styles.tabBtnActive : {}) }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          <div style={styles.tabContent}>
            {activeTab === "verify" && <VerifyRecord provider={session.provider} />}
            {activeTab === "add"    && isIssuer && <AddRecord signer={session.signer} issuerAddress={session.address} />}
            {activeTab === "revoke" && isIssuer && <RevokeRecord signer={session.signer} />}
            {activeTab === "admin"  && isOwner  && <AdminPanel signer={session.signer} provider={session.provider} />}
          </div>
        </main>
      )}

      <footer style={styles.footer}>
        DApps Rekam Vaksin Digital · Tugas Mata Kuliah Blockchain · 2024
      </footer>
    </div>
  );
}

const styles = {
  root:     { minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" },
  bgGlow1:  { position: "fixed", top: "-30%", left: "-10%", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)", pointerEvents: "none" },
  bgGlow2:  { position: "fixed", bottom: "-20%", right: "-5%", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)", pointerEvents: "none" },
  header:   { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 32px", borderBottom: "1px solid #1e293b", background: "rgba(10,15,30,0.8)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 },
  logo:     { display: "flex", alignItems: "center", gap: "12px" },
  logoIcon: { width: "40px", height: "40px", borderRadius: "10px", background: "linear-gradient(135deg, #3b82f6, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" },
  logoTitle:{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.5px" },
  logoSub:  { fontSize: "11px", color: "#64748b" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  chainBadge:  { display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "20px", background: "#111827", border: "1px solid #1e293b", fontSize: "12px", color: "#94a3b8" },
  dot:      { width: "7px", height: "7px", borderRadius: "50%", display: "inline-block" },
  btnGoogle:{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderRadius: "10px", background: "white", color: "#1f2937", fontSize: "14px", fontWeight: 600, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", cursor: "pointer" },
  spinner:  { width: "16px", height: "16px", borderRadius: "50%", border: "2px solid rgba(0,0,0,0.15)", borderTopColor: "#3b82f6", display: "inline-block", animation: "spin 0.8s linear infinite" },
  userArea: { display: "flex", alignItems: "center", gap: "10px", padding: "6px 12px", borderRadius: "12px", background: "#111827", border: "1px solid #1e293b" },
  avatar:   { width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 },
  avatarFallback: { width: "30px", height: "30px", borderRadius: "50%", background: "linear-gradient(135deg, #3b82f6, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "13px", fontWeight: 700, flexShrink: 0 },
  userMeta: { display: "flex", flexDirection: "column", gap: "1px" },
  userName: { fontSize: "13px", fontWeight: 600, color: "#f1f5f9", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  walletAddress: { fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#64748b" },
  badge: (type) => ({ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: type === "owner" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)", color: type === "owner" ? "#f59e0b" : "#10b981", border: `1px solid ${type === "owner" ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)"}` }),
  btnLogout:{ background: "none", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", padding: "4px", borderRadius: "6px", border: "none" },
  errorBanner: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 32px", background: "rgba(239,68,68,0.1)", borderBottom: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: "14px" },
  errorClose:  { background: "none", color: "#fca5a5", fontSize: "16px", cursor: "pointer", border: "none" },
  noWalletHero:{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", textAlign: "center" },
  heroIcon: { width: "72px", height: "72px", borderRadius: "20px", marginBottom: "24px", background: "linear-gradient(135deg, #3b82f6, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "32px", boxShadow: "0 8px 32px rgba(59,130,246,0.3)" },
  heroTitle:{ fontSize: "36px", fontWeight: 800, marginBottom: "16px", letterSpacing: "-1px" },
  heroSubtitle: { fontSize: "16px", color: "#64748b", marginBottom: "32px", maxWidth: "480px", lineHeight: "1.7" },
  btnGoogleLarge: { display: "flex", alignItems: "center", gap: "12px", padding: "14px 32px", borderRadius: "12px", background: "white", color: "#1f2937", fontSize: "16px", fontWeight: 700, marginBottom: "16px", boxShadow: "0 4px 20px rgba(0,0,0,0.25)", cursor: "pointer", border: "none" },
  loginNote:{ fontSize: "13px", color: "#475569", marginBottom: "32px", lineHeight: "1.6" },
  contractInfo: { display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "8px", background: "#111827", border: "1px solid #1e293b" },
  contractLabel:  { fontSize: "11px", color: "#64748b" },
  contractAddress:{ fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8" },
  main:     { flex: 1, maxWidth: "900px", width: "100%", margin: "0 auto", padding: "32px 20px" },
  facilityBanner: { padding: "10px 16px", borderRadius: "10px", marginBottom: "24px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#6ee7b7", fontSize: "14px" },
  tabNav:   { display: "flex", gap: "4px", padding: "4px", borderRadius: "12px", background: "#111827", border: "1px solid #1e293b", marginBottom: "24px", width: "fit-content" },
  tabBtn:   { display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderRadius: "8px", background: "none", color: "#64748b", fontSize: "14px", fontWeight: 500, transition: "all 0.15s", cursor: "pointer", border: "none" },
  tabBtnActive: { background: "#1e293b", color: "#f1f5f9", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" },
  tabContent: { animation: "fadeIn 0.3s ease" },
  footer:   { textAlign: "center", padding: "20px", color: "#374151", fontSize: "12px", borderTop: "1px solid #111827" },
};
