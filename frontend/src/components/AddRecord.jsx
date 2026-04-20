// src/components/AddRecord.jsx
import { useState } from "react";
import { addVaccineRecord, generateVaccineHash, generateNikHash, generateSalt, bindNikForPatient } from "../utils/contract";

const JENIS_VAKSIN = [
  "Sinovac (CoronaVac)", "AstraZeneca (Vaxzevria)", "Pfizer-BioNTech (Comirnaty)",
  "Moderna (Spikevax)", "Janssen (Johnson & Johnson)", "Sinopharm",
  "Vaksin Meningitis", "Vaksin Influenza", "Vaksin Hepatitis B", "Lainnya",
];

export default function AddRecord({ signer, provider, issuerAddress }) {
  const [form, setForm] = useState({
    nik: "", namaVaksin: "", kodeProduksi: "",
    tanggal: new Date().toISOString().split("T")[0],
    patientAddress: "",
  });
  const [status,   setStatus]   = useState(null);
  const [result,   setResult]   = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // Auto-lookup wallet pasien dari NIK binding
  const handleNikLookup = async () => {
    if (!form.nik || form.nik.length !== 16) return;
    setLookingUp(true);
    try {
      const nikHash = generateNikHash(form.nik);
      const contract = (await import("../utils/contract")).getContract(provider);
      const bound = await contract.nikHashWallet(nikHash);
      if (bound && bound !== "0x0000000000000000000000000000000000000000") {
        setForm(prev => ({ ...prev, patientAddress: bound }));
      }
    } catch {}
    setLookingUp(false);
  };

  const handleSubmit = async () => {
    if (!form.nik || !form.namaVaksin || !form.kodeProduksi || !form.tanggal || !form.patientAddress) {
      setErrorMsg("Semua field wajib diisi!"); return;
    }
    if (form.nik.length !== 16 || !/^\d+$/.test(form.nik)) {
      setErrorMsg("NIK harus 16 digit angka."); return;
    }

    setStatus("loading"); setErrorMsg(""); setResult(null);
    try {
      const salt      = generateSalt();
      const dataHash  = generateVaccineHash(form.nik, form.namaVaksin, form.kodeProduksi, form.tanggal, salt);
      const nikHash   = generateNikHash(form.nik);
      const receipt   = await addVaccineRecord(signer, form.patientAddress, dataHash, form.namaVaksin, nikHash);

      setResult({ dataHash, salt, txHash: receipt.hash, blockNumber: receipt.blockNumber,
        nik: form.nik, namaVaksin: form.namaVaksin, patientAddress: form.patientAddress });
      setStatus("success");
      setForm({ nik: "", namaVaksin: "", kodeProduksi: "", tanggal: new Date().toISOString().split("T")[0], patientAddress: "" });
    } catch (e) {
      setErrorMsg(e.reason || e.message || "Transaksi gagal"); setStatus("error");
    }
  };

  return (
    <div style={s.container}>
      <h2 style={s.title}><span>💉</span> Catat Rekam Vaksin Baru</h2>
      <p style={s.subtitle}>
        NFT sertifikat akan di-mint ke wallet pasien. Data di-hash sebelum disimpan.
      </p>

      <div style={s.form}>
        <Field label="NIK Pasien" hint="16 digit — tekan Tab untuk auto-cari wallet" required>
          <input style={s.input} name="nik" value={form.nik} onChange={handleChange}
            onBlur={handleNikLookup} placeholder="3201234567890001" maxLength={16} />
        </Field>

        <Field label="Wallet Address Pasien" hint={lookingUp ? "🔍 Mencari wallet..." : "Dari social login / input manual"} required>
          <input style={s.input} name="patientAddress" value={form.patientAddress}
            onChange={handleChange} placeholder="0x..." />
        </Field>

        <Field label="Jenis Vaksin" required>
          <select style={s.input} name="namaVaksin" value={form.namaVaksin} onChange={handleChange}>
            <option value="">-- Pilih --</option>
            {JENIS_VAKSIN.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>

        <Field label="Kode Produksi / Nomor Batch" required>
          <input style={s.input} name="kodeProduksi" value={form.kodeProduksi}
            onChange={handleChange} placeholder="BATCH-001" />
        </Field>

        <Field label="Tanggal Vaksinasi" required>
          <input style={s.input} type="date" name="tanggal" value={form.tanggal} onChange={handleChange} />
        </Field>
      </div>

      <div style={s.infoBox}>
        💡 <strong>Cara dapatkan wallet pasien:</strong> Pasien login di VaxChain → copy address di header (klik untuk copy)
      </div>

      {errorMsg && <div style={s.errorBox}>⚠️ {errorMsg}</div>}

      <button style={{ ...s.btn, opacity: status === "loading" ? 0.7 : 1 }}
        onClick={handleSubmit} disabled={status === "loading"}>
        {status === "loading" ? <><span style={s.spinner}/>Minting NFT...</> : "✅ Mint Sertifikat NFT"}
      </button>

      {status === "success" && result && (
        <div style={s.successBox}>
          <div style={s.successHeader}>🎉 NFT Sertifikat Berhasil Di-mint!</div>
          <div style={s.infoCard}>
            <div style={s.infoCardTitle}>✅ NIK Otomatis Terhubung ke Wallet Pasien</div>
            <p style={s.infoCardText}>
              NIK pasien sudah otomatis terhubung ke wallet mereka saat vaksin dicatat.
              Minta pasien buka tab <strong>"Sertifikat Saya"</strong> — NFT langsung muncul.
            </p>
            <p style={s.infoCardText}><strong>NIK:</strong> <code style={s.code}>{result.nik}</code></p>
            <p style={s.infoCardText}><strong>Wallet:</strong> <code style={s.code}>{result.patientAddress}</code></p>
            <div style={{marginTop:"8px",padding:"8px 10px",borderRadius:"6px",background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",fontSize:"12px",color:"#6ee7b7"}}>
              🔒 Binding NIK dilakukan oleh faskes setelah verifikasi KTP — tidak bisa dilakukan sendiri oleh pasien.
            </div>
          </div>
          <InfoRow label="Data Hash" value={result.dataHash} mono copy />
          <InfoRow label="Transaction Hash" value={result.txHash} mono />
          <InfoRow label="Block" value={result.blockNumber?.toString()} />
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label} {required && <span style={{color:"#ef4444"}}>*</span>}</label>
      {hint && <span style={s.hint}>{hint}</span>}
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, copy }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={s.infoRow}>
      <div style={s.infoLabel}>{label}</div>
      <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
        <div style={{...s.infoValue, fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit"}}>{value}</div>
        {copy && <button style={s.copyBtn} onClick={()=>{navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),2000)}}>{copied?"✓":"⎘"}</button>}
      </div>
    </div>
  );
}

const s = {
  container:{display:"flex",flexDirection:"column",gap:"20px"},
  title:{fontSize:"20px",fontWeight:700,display:"flex",alignItems:"center",gap:"10px"},
  subtitle:{color:"#64748b",fontSize:"14px",lineHeight:"1.6"},
  form:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",padding:"24px",borderRadius:"12px",background:"#111827",border:"1px solid #1e293b"},
  field:{display:"flex",flexDirection:"column",gap:"4px"},
  label:{fontSize:"13px",fontWeight:600,color:"#94a3b8"},
  hint:{fontSize:"11px",color:"#4b5563"},
  input:{padding:"10px 14px",borderRadius:"8px",background:"#1a2332",border:"1px solid #1e293b",color:"#f1f5f9",fontSize:"14px"},
  infoBox:{padding:"12px 16px",borderRadius:"8px",background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",color:"#93c5fd",fontSize:"13px"},
  btn:{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",padding:"14px",borderRadius:"10px",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"white",fontSize:"15px",fontWeight:700,cursor:"pointer",border:"none"},
  spinner:{width:"16px",height:"16px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",animation:"spin 0.8s linear infinite",display:"inline-block"},
  errorBox:{padding:"12px 16px",borderRadius:"8px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#fca5a5",fontSize:"14px"},
  successBox:{padding:"20px",borderRadius:"12px",background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.25)",display:"flex",flexDirection:"column",gap:"12px"},
  successHeader:{fontSize:"16px",fontWeight:700,color:"#10b981"},
  infoCard:{padding:"14px 16px",borderRadius:"8px",background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)"},
  infoCardTitle:{fontSize:"13px",fontWeight:700,color:"#60a5fa",marginBottom:"8px"},
  infoCardText:{fontSize:"13px",color:"#94a3b8",lineHeight:"1.6",margin:"0 0 6px 0"},
  code:{fontFamily:"'JetBrains Mono',monospace",background:"#1e293b",padding:"2px 6px",borderRadius:"4px"},
  infoRow:{padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",flexDirection:"column",gap:"4px"},
  infoLabel:{fontSize:"11px",color:"#64748b",textTransform:"uppercase",letterSpacing:"0.5px"},
  infoValue:{fontSize:"13px",color:"#94a3b8",wordBreak:"break-all"},
  copyBtn:{padding:"4px 8px",borderRadius:"4px",fontSize:"14px",background:"#1e293b",color:"#94a3b8",cursor:"pointer",flexShrink:0,border:"none"},
};
