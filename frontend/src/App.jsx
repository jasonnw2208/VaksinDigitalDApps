// src/App.jsx
import { useState, useEffect, useCallback } from "react";
import { loginWithGoogle, restoreSession, logoutWeb3Auth } from "./utils/web3auth";
import { checkIsIssuer, getOwner, getIssuerName, SUPPORTED_CHAINS, CONTRACT_ADDRESS } from "./utils/contract";
import AddRecord          from "./components/AddRecord.jsx";
import VerifyRecord       from "./components/VerifyRecord.jsx";
import RevokeRecord       from "./components/RevokeRecord.jsx";
import AdminPanel         from "./components/AdminPanel.jsx";
import CertificateGallery from "./components/CertificateGallery.jsx";
import BatchUpload        from "./components/BatchUpload.jsx";

const Icons = {
  shield: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  check:  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
  add:    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
  revoke: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  admin:  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  cert:   <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  logout: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

function WalletAddress({ address }) {
  const [copied, setCopied] = useState(false);
  return (
    <span
      style={{fontSize:"11px",fontFamily:"'JetBrains Mono',monospace",color:copied?"#10b981":"#64748b",cursor:"pointer",userSelect:"all",transition:"color 0.2s"}}
      onClick={() => { navigator.clipboard.writeText(address); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
      title="Klik untuk copy address lengkap"
    >
      {copied ? "✓ Tersalin!" : address}
    </span>
  );
}

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

  useEffect(() => {
    restoreSession().then(sess => {
      if (sess) applySession(sess).catch(() => {});
    });
  }, []);

  const handleLogin = useCallback(async () => {
    setConnecting(true); setError("");
    try {
      const sess = await loginWithGoogle();
      await applySession(sess);
    } catch (e) {
      setError(e.message || "Gagal login");
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    await logoutWeb3Auth();
    setSession(null); setIsIssuer(false); setIsOwner(false);
    setFacilityName(""); setActiveTab("verify");
  }, []);

  const tabs = [
    { id:"verify",  label:"Verifikasi",      icon:Icons.check,  show:true },
    { id:"certs",   label:"Sertifikat Saya", icon:Icons.cert,   show:!!session },
    { id:"add",     label:"Catat Vaksin",    icon:Icons.add,    show:isIssuer },
    { id:"batch",   label:"Batch Upload",    icon:Icons.add,    show:isIssuer },
    { id:"revoke",  label:"Revoke",          icon:Icons.revoke, show:isIssuer },
    { id:"admin",   label:"Admin",           icon:Icons.admin,  show:isOwner },
  ].filter(t => t.show);

  const chainInfo = session ? SUPPORTED_CHAINS[session.chainId] : null;
  const userInfo  = session?.userInfo;

  return (
    <div style={st.root}>
      <div style={st.bgGlow1}/><div style={st.bgGlow2}/>

      <header style={st.header}>
        <div style={st.logo}>
          <span style={st.logoIcon}>{Icons.shield}</span>
          <div>
            <div style={st.logoTitle}>VaxChain</div>
            <div style={st.logoSub}>Rekam Vaksin Digital Terverifikasi</div>
          </div>
        </div>
        <div style={st.headerRight}>
          {chainInfo && <div style={st.chainBadge}><span style={{...st.dot,background:"#10b981"}}/>{chainInfo.name}</div>}
          {!session ? (
            <button style={st.btnLogin} onClick={handleLogin} disabled={connecting}>
              {connecting ? <span style={st.spinner}/> : "🔐"}
              {connecting ? "Menghubungkan..." : "Masuk"}
            </button>
          ) : (
            <div style={st.userArea}>
              {userInfo?.profileImage
                ? <img src={userInfo.profileImage} alt="" style={st.avatar} referrerPolicy="no-referrer"/>
                : <div style={st.avatarFallback}>{userInfo?.name?.[0]?.toUpperCase()||"U"}</div>}
              <div style={st.userMeta}>
                <span style={st.userName}>{userInfo?.name||"User"}</span>
                <WalletAddress address={session.address}/>
              </div>
              {isOwner  && <span style={st.badge("owner")}>Owner</span>}
              {isIssuer && !isOwner && <span style={st.badge("issuer")}>Faskes</span>}
              <button style={st.btnLogout} onClick={handleLogout} title="Logout">{Icons.logout}</button>
            </div>
          )}
        </div>
      </header>

      {error && (
        <div style={st.errorBanner}>⚠️ {error}
          <button onClick={()=>setError("")} style={st.errorClose}>✕</button>
        </div>
      )}

      {!session && !connecting && (
        <div style={st.hero} className="fade-in">
          <div style={st.heroIcon}>{Icons.shield}</div>
          <h1 style={st.heroTitle}>Rekam Vaksin Digital</h1>
          <p style={st.heroSubtitle}>
            Platform verifikasi sertifikat vaksin berbasis blockchain.<br/>
            Sertifikat sebagai NFT Soulbound — permanen dan tidak bisa dipindah.
          </p>
          <button style={st.btnLoginLarge} onClick={handleLogin}>🔐 Masuk dengan Akun Sosial</button>
          <p style={st.loginNote}>Login dengan Google, X, Facebook, atau Email.<br/>Wallet blockchain dibuat otomatis — tidak perlu MetaMask.</p>
          <div style={st.contractInfo}>
            <span style={st.contractLabel}>Contract:</span>
            <span style={st.contractAddress}>{CONTRACT_ADDRESS}</span>
          </div>
        </div>
      )}

      {session && (
        <main style={st.main} className="fade-in">
          {facilityName && (
            <div style={st.facilityBanner}>
              🏥 Login sebagai <strong>{facilityName}</strong>{isOwner && " · Administrator Sistem"}
            </div>
          )}
          <nav style={st.tabNav}>
            {tabs.map(tab => (
              <button key={tab.id}
                style={{...st.tabBtn,...(activeTab===tab.id?st.tabBtnActive:{})}}
                onClick={()=>setActiveTab(tab.id)}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </nav>
          <div style={st.tabContent}>
            {activeTab==="verify" && <VerifyRecord provider={session.provider}/>}
            {activeTab==="certs"  && <CertificateGallery session={session}/>}
            {activeTab==="add"    && isIssuer && <AddRecord signer={session.signer} provider={session.provider} issuerAddress={session.address}/>}
            {activeTab==="batch"  && isIssuer && <BatchUpload signer={session.signer}/>}
            {activeTab==="revoke" && isIssuer && <RevokeRecord signer={session.signer}/>}
            {activeTab==="admin"  && isOwner  && <AdminPanel signer={session.signer} provider={session.provider}/>}
          </div>
        </main>
      )}

      <footer style={st.footer}>DApps Rekam Vaksin Digital · Tugas Mata Kuliah Blockchain · 2024</footer>
    </div>
  );
}

const st = {
  root:          {minHeight:"100vh",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"},
  bgGlow1:       {position:"fixed",top:"-30%",left:"-10%",width:"600px",height:"600px",borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,0.06) 0%,transparent 70%)",pointerEvents:"none"},
  bgGlow2:       {position:"fixed",bottom:"-20%",right:"-5%",width:"500px",height:"500px",borderRadius:"50%",background:"radial-gradient(circle,rgba(6,182,212,0.05) 0%,transparent 70%)",pointerEvents:"none"},
  header:        {display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 32px",borderBottom:"1px solid #1e293b",background:"rgba(10,15,30,0.8)",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:100},
  logo:          {display:"flex",alignItems:"center",gap:"12px"},
  logoIcon:      {width:"40px",height:"40px",borderRadius:"10px",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"white"},
  logoTitle:     {fontSize:"18px",fontWeight:700,letterSpacing:"-0.5px"},
  logoSub:       {fontSize:"11px",color:"#64748b"},
  headerRight:   {display:"flex",alignItems:"center",gap:"12px"},
  chainBadge:    {display:"flex",alignItems:"center",gap:"6px",padding:"6px 12px",borderRadius:"20px",background:"#111827",border:"1px solid #1e293b",fontSize:"12px",color:"#94a3b8"},
  dot:           {width:"7px",height:"7px",borderRadius:"50%",display:"inline-block"},
  btnLogin:      {display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",borderRadius:"10px",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"white",fontSize:"14px",fontWeight:600,border:"none",cursor:"pointer"},
  spinner:       {width:"16px",height:"16px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",display:"inline-block",animation:"spin 0.8s linear infinite"},
  userArea:      {display:"flex",alignItems:"center",gap:"10px",padding:"6px 12px",borderRadius:"12px",background:"#111827",border:"1px solid #1e293b"},
  avatar:        {width:"30px",height:"30px",borderRadius:"50%",objectFit:"cover",flexShrink:0},
  avatarFallback:{width:"30px",height:"30px",borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"13px",fontWeight:700,flexShrink:0},
  userMeta:      {display:"flex",flexDirection:"column",gap:"1px"},
  userName:      {fontSize:"13px",fontWeight:600,color:"#f1f5f9",maxWidth:"150px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  badge:         (t)=>({padding:"2px 8px",borderRadius:"4px",fontSize:"11px",fontWeight:600,background:t==="owner"?"rgba(245,158,11,0.15)":"rgba(16,185,129,0.15)",color:t==="owner"?"#f59e0b":"#10b981",border:`1px solid ${t==="owner"?"rgba(245,158,11,0.3)":"rgba(16,185,129,0.3)"}`}),
  btnLogout:     {background:"none",color:"#64748b",cursor:"pointer",display:"flex",alignItems:"center",padding:"4px",borderRadius:"6px",border:"none"},
  errorBanner:   {display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 32px",background:"rgba(239,68,68,0.1)",borderBottom:"1px solid rgba(239,68,68,0.3)",color:"#fca5a5",fontSize:"14px"},
  errorClose:    {background:"none",color:"#fca5a5",fontSize:"16px",cursor:"pointer",border:"none"},
  hero:          {flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px",textAlign:"center"},
  heroIcon:      {width:"72px",height:"72px",borderRadius:"20px",marginBottom:"24px",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:"32px",boxShadow:"0 8px 32px rgba(59,130,246,0.3)"},
  heroTitle:     {fontSize:"36px",fontWeight:800,marginBottom:"16px",letterSpacing:"-1px"},
  heroSubtitle:  {fontSize:"16px",color:"#64748b",marginBottom:"32px",maxWidth:"480px",lineHeight:"1.7"},
  btnLoginLarge: {display:"flex",alignItems:"center",gap:"10px",padding:"14px 32px",borderRadius:"12px",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"white",fontSize:"16px",fontWeight:700,marginBottom:"16px",boxShadow:"0 4px 20px rgba(59,130,246,0.4)",cursor:"pointer",border:"none"},
  loginNote:     {fontSize:"13px",color:"#475569",marginBottom:"32px",lineHeight:"1.6"},
  contractInfo:  {display:"flex",alignItems:"center",gap:"8px",padding:"10px 16px",borderRadius:"8px",background:"#111827",border:"1px solid #1e293b"},
  contractLabel: {fontSize:"11px",color:"#64748b"},
  contractAddress:{fontSize:"11px",fontFamily:"'JetBrains Mono',monospace",color:"#94a3b8"},
  main:          {flex:1,maxWidth:"960px",width:"100%",margin:"0 auto",padding:"32px 20px"},
  facilityBanner:{padding:"10px 16px",borderRadius:"10px",marginBottom:"24px",background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.2)",color:"#6ee7b7",fontSize:"14px"},
  tabNav:        {display:"flex",gap:"4px",padding:"4px",borderRadius:"12px",background:"#111827",border:"1px solid #1e293b",marginBottom:"24px",flexWrap:"wrap"},
  tabBtn:        {display:"flex",alignItems:"center",gap:"8px",padding:"10px 20px",borderRadius:"8px",background:"none",color:"#64748b",fontSize:"14px",fontWeight:500,cursor:"pointer",border:"none"},
  tabBtnActive:  {background:"#1e293b",color:"#f1f5f9",boxShadow:"0 2px 8px rgba(0,0,0,0.3)"},
  tabContent:    {animation:"fadeIn 0.3s ease"},
  footer:        {textAlign:"center",padding:"20px",color:"#374151",fontSize:"12px",borderTop:"1px solid #111827"},
};
