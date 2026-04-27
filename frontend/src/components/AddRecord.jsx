// src/components/AddRecord.jsx
// Faskes catat vaksin + otomatis bind NIK ke wallet pasien
// Pasien harus hadir fisik dan tunjukkan KTP untuk verifikasi NIK

import { useState } from "react";
import {
  addVaccineRecord,
  generateVaccineHash,
  generateNikHash,
  generateSalt,
} from "../utils/contract";

const JENIS_VAKSIN = [
  "Sinovac (CoronaVac)",
  "AstraZeneca (Vaxzevria)",
  "Pfizer-BioNTech (Comirnaty)",
  "Moderna (Spikevax)",
  "Janssen (Johnson & Johnson)",
  "Sinopharm",
  "Vaksin Meningitis",
  "Vaksin Influenza",
  "Vaksin Hepatitis B",
  "Lainnya",
];

export default function AddRecord({ signer, provider, issuerAddress }) {
  const [form, setForm] = useState({
    nik:            "",
    patientAddress: "",
    namaVaksin:     "",
    kodeProduksi:   "",
    tanggal:        new Date().toISOString().split("T")[0],
    ktpVerified:    false,
  });
  const [status,   setStatus]   = useState(null);
  const [result,   setResult]   = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async () => {
    if (!form.nik || !form.patientAddress || !form.namaVaksin || !form.kodeProduksi || !form.tanggal) {
      setErrorMsg("Semua field wajib diisi!"); return;
    }
    if (form.nik.length !== 16 || !/^\d+$/.test(form.nik)) {
      setErrorMsg("NIK harus 16 digit angka."); return;
    }
    if (!form.patientAddress.startsWith("0x") || form.patientAddress.length !== 42) {
      setErrorMsg("Wallet address pasien tidak valid. Format: 0x + 40 karakter."); return;
    }
    if (!form.ktpVerified) {
      setErrorMsg("Centang konfirmasi bahwa KTP pasien sudah diverifikasi secara fisik."); return;
    }

    setStatus("loading"); setErrorMsg(""); setResult(null);
    try {
      const salt     = generateSalt();
      const dataHash = generateVaccineHash(form.nik, form.namaVaksin, form.kodeProduksi, form.tanggal, salt);
      const nikHash  = generateNikHash(form.nik);

      const receipt = await addVaccineRecord(
        signer,
        form.patientAddress,
        dataHash,
        form.namaVaksin,
        nikHash
      );

      setResult({
        dataHash,
        salt,
        txHash:         receipt.hash,
        blockNumber:    receipt.blockNumber,
        nik:            form.nik,
        namaVaksin:     form.namaVaksin,
        patientAddress: form.patientAddress,
      });
      setStatus("success");
      setForm({
        nik: "", patientAddress: "", namaVaksin: "", kodeProduksi: "",
        tanggal: new Date().toISOString().split("T")[0], ktpVerified: false,
      });
    } catch (e) {
      setErrorMsg(e.reason || e.message || "Transaksi gagal");
      setStatus("error");
    }
  };

  return (
    <div style={s.container}>
      <h2 style={s.title}><span></span> Catat Rekam Vaksin Baru</h2>
      <p style={s.subtitle}>
        NFT sertifikat akan di-mint ke wallet pasien. NIK otomatis terhubung ke wallet
        pasien setelah pencatatan — <strong>pasien tidak perlu input NIK sendiri</strong>.
      </p>

      {/* ── Alur Verifikasi ──────────────────────────────────────────────── */}
      <div style={s.flowBox}>
        <div style={s.flowStep}>
          <div style={s.flowNum}>1</div>
          <div>
            <div style={s.flowTitle}>Verifikasi KTP Fisik</div>
            <div style={s.flowDesc}>Pasien tunjukkan KTP asli ke petugas</div>
          </div>
        </div>
        <div style={s.flowArrow}>→</div>
        <div style={s.flowStep}>
          <div style={s.flowNum}>2</div>
          <div>
            <div style={s.flowTitle}>Input Data di Bawah</div>
            <div style={s.flowDesc}>NIK dari KTP + wallet dari app pasien</div>
          </div>
        </div>
        <div style={s.flowArrow}>→</div>
        <div style={s.flowStep}>
          <div style={s.flowNum}>3</div>
          <div>
            <div style={s.flowTitle}>NFT + NIK Terhubung</div>
            <div style={s.flowDesc}>Otomatis ter-bind saat submit</div>
          </div>
        </div>
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <div style={s.formCard}>
        {/* Section: Identitas Pasien */}
        <div style={s.sectionHeader}>
          <span style={s.sectionIcon}></span>
          <div>
            <div style={s.sectionTitle}>Identitas Pasien</div>
            <div style={s.sectionDesc}>Diisi berdasarkan KTP fisik pasien yang sudah diverifikasi</div>
          </div>
        </div>

        <div style={s.row}>
          <Field label="NIK Pasien" hint="16 digit sesuai KTP" required>
            <input
              style={s.input}
              name="nik"
              value={form.nik}
              onChange={handleChange}
              placeholder="3201234567890001"
              maxLength={16}
              pattern="\d*"
            />
            {form.nik.length > 0 && (
              <span style={{
                fontSize: "11px",
                color: form.nik.length === 16 ? "#10b981" : "#f59e0b",
                marginTop: "4px",
              }}>
                {form.nik.length}/16 digit {form.nik.length === 16 ? "✓" : ""}
              </span>
            )}
          </Field>

          <Field
            label="Wallet Address Pasien"
            hint="Pasien buka app VaxChain → klik address di header untuk copy"
            required
          >
            <input
              style={s.input}
              name="patientAddress"
              value={form.patientAddress}
              onChange={handleChange}
              placeholder="0xABC123..."
            />
            {form.patientAddress.length > 0 && (
              <span style={{
                fontSize: "11px",
                color: form.patientAddress.startsWith("0x") && form.patientAddress.length === 42
                  ? "#10b981" : "#ef4444",
                marginTop: "4px",
              }}>
                {form.patientAddress.startsWith("0x") && form.patientAddress.length === 42
                  ? "✓ Format valid" : "Format tidak valid (harus 0x + 40 karakter)"}
              </span>
            )}
          </Field>
        </div>

        <div style={s.walletHelp}>
          <div style={s.walletHelpTitle}>Cara pasien dapatkan wallet address:</div>
          <ol style={s.walletHelpList}>
            <li>Pasien buka VaxChain di HP mereka</li>
            <li>Login dengan akun Google/sosial</li>
            <li>Klik address panjang di pojok kanan atas → otomatis ter-copy</li>
            <li>Pasien tunjukkan atau kirim address ke petugas</li>
          </ol>
        </div>

        <div style={s.divider}/>

        {/* Section: Data Vaksin */}
        <div style={s.sectionHeader}>
          <span style={s.sectionIcon}></span>
          <div>
            <div style={s.sectionTitle}>Data Vaksinasi</div>
            <div style={s.sectionDesc}>Detail vaksin yang diberikan</div>
          </div>
        </div>

        <div style={s.row}>
          <Field label="Jenis Vaksin" required>
            <select style={s.input} name="namaVaksin" value={form.namaVaksin} onChange={handleChange}>
              <option value="">-- Pilih Jenis Vaksin --</option>
              {JENIS_VAKSIN.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>

          <Field label="Tanggal Vaksinasi" required>
            <input style={s.input} type="date" name="tanggal" value={form.tanggal} onChange={handleChange} />
          </Field>
        </div>

        <Field label="Kode Produksi / Nomor Batch" hint="Tertera pada kemasan vaksin" required>
          <input
            style={s.input}
            name="kodeProduksi"
            value={form.kodeProduksi}
            onChange={handleChange}
            placeholder="BATCH-001 / LOT-XYZ123"
          />
        </Field>

        <div style={s.divider}/>

        {/* Konfirmasi KTP */}
        <label style={s.checkboxRow}>
          <input
            type="checkbox"
            name="ktpVerified"
            checked={form.ktpVerified}
            onChange={handleChange}
            style={s.checkbox}
          />
          <div>
            <div style={s.checkboxLabel}>
              Saya konfirmasi bahwa KTP fisik pasien sudah diverifikasi secara langsung
            </div>
            <div style={s.checkboxDesc}>
              NIK yang diinput sesuai dengan KTP asli pasien. Binding NIK tidak bisa dibatalkan
              kecuali oleh owner/faskes.
            </div>
          </div>
        </label>
      </div>

      {errorMsg && <div style={s.errorBox}>⚠️ {errorMsg}</div>}

      <button
        style={{
          ...s.btn,
          opacity: (status === "loading" || !form.ktpVerified) ? 0.6 : 1,
          cursor: !form.ktpVerified ? "not-allowed" : "pointer",
        }}
        onClick={handleSubmit}
        disabled={status === "loading" || !form.ktpVerified}
      >
        {status === "loading"
          ? <><span style={s.spinner}/>Minting NFT & Binding NIK...</>
          : "Catat Vaksin + Hubungkan NIK ke Wallet Pasien"}
      </button>

      {/* ── Hasil Sukses ──────────────────────────────────────────────────── */}
      {status === "success" && result && (
        <div style={s.successBox}>
          <div style={s.successHeader}>🎉 Vaksin Berhasil Dicatat!</div>

          <div style={s.successGrid}>
            <div style={s.successItem}>
              <span style={s.successLabel}>Status NIK</span>
              <span style={{...s.successValue, color:"#10b981"}}>
                Terhubung ke wallet pasien
              </span>
            </div>
            <div style={s.successItem}>
              <span style={s.successLabel}>Block</span>
              <span style={s.successValue}>#{result.blockNumber}</span>
            </div>
            <div style={s.successItem}>
              <span style={s.successLabel}>NIK Pasien</span>
              <span style={{...s.successValue, fontFamily:"'JetBrains Mono',monospace"}}>
                {result.nik.replace(/(\d{6})(\d{6})(\d{4})/, "$1 $2 $3")}
              </span>
            </div>
            <div style={s.successItem}>
              <span style={s.successLabel}>Jenis Vaksin</span>
              <span style={s.successValue}>{result.namaVaksin}</span>
            </div>
          </div>

          <div style={s.successNote}>
            <strong>Instruksi untuk pasien:</strong> Buka tab <strong>"Sertifikat Saya"</strong>
            di app VaxChain — NFT sertifikat langsung muncul tanpa perlu input NIK lagi.
          </div>

          <div style={s.hashRow}>
            <span style={s.hashLabel}>Tx Hash:</span>
            <span style={s.hashVal}>{result.txHash}</span>
            <button style={s.copyBtn}
              onClick={() => navigator.clipboard.writeText(result.txHash)}>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>
        {label} {required && <span style={{color:"#ef4444"}}>*</span>}
      </label>
      {hint && <span style={s.hint}>{hint}</span>}
      {children}
    </div>
  );
}

const s = {
  container:    {display:"flex",flexDirection:"column",gap:"20px"},
  title:        {fontSize:"20px",fontWeight:700,display:"flex",alignItems:"center",gap:"10px"},
  subtitle:     {color:"#64748b",fontSize:"14px",lineHeight:"1.6"},

  flowBox:      {display:"flex",alignItems:"center",gap:"8px",padding:"16px",borderRadius:"10px",background:"#111827",border:"1px solid #1e293b",flexWrap:"wrap"},
  flowStep:     {display:"flex",alignItems:"center",gap:"12px",flex:1,minWidth:"140px"},
  flowNum:      {width:"28px",height:"28px",borderRadius:"50%",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"white",fontSize:"13px",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  flowTitle:    {fontSize:"13px",fontWeight:600,color:"#f1f5f9"},
  flowDesc:     {fontSize:"11px",color:"#64748b",marginTop:"2px"},
  flowArrow:    {color:"#334155",fontSize:"20px",fontWeight:700,flexShrink:0},

  formCard:     {display:"flex",flexDirection:"column",gap:"16px",padding:"24px",borderRadius:"12px",background:"#111827",border:"1px solid #1e293b"},
  sectionHeader:{display:"flex",alignItems:"flex-start",gap:"12px",marginBottom:"4px"},
  sectionIcon:  {fontSize:"20px",marginTop:"1px"},
  sectionTitle: {fontSize:"14px",fontWeight:700,color:"#f1f5f9"},
  sectionDesc:  {fontSize:"12px",color:"#64748b",marginTop:"2px"},
  divider:      {height:"1px",background:"#1e293b",margin:"4px 0"},

  row:          {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"},
  field:        {display:"flex",flexDirection:"column",gap:"4px"},
  label:        {fontSize:"13px",fontWeight:600,color:"#94a3b8"},
  hint:         {fontSize:"11px",color:"#475569"},
  input:        {padding:"10px 14px",borderRadius:"8px",background:"#1a2332",border:"1px solid #1e293b",color:"#f1f5f9",fontSize:"14px",fontFamily:"inherit"},

  walletHelp:   {padding:"12px 14px",borderRadius:"8px",background:"rgba(59,130,246,0.06)",border:"1px solid rgba(59,130,246,0.15)"},
  walletHelpTitle:{fontSize:"12px",fontWeight:600,color:"#60a5fa",marginBottom:"6px"},
  walletHelpList:{margin:"0",paddingLeft:"18px",display:"flex",flexDirection:"column",gap:"3px"},

  checkboxRow:  {display:"flex",alignItems:"flex-start",gap:"12px",padding:"14px",borderRadius:"8px",background:"rgba(16,185,129,0.06)",border:"1px solid rgba(16,185,129,0.2)",cursor:"pointer"},
  checkbox:     {width:"18px",height:"18px",marginTop:"1px",flexShrink:0,cursor:"pointer",accentColor:"#10b981"},
  checkboxLabel:{fontSize:"13px",fontWeight:600,color:"#f1f5f9"},
  checkboxDesc: {fontSize:"12px",color:"#64748b",marginTop:"3px",lineHeight:"1.5"},

  errorBox:     {padding:"12px 16px",borderRadius:"8px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#fca5a5",fontSize:"14px"},

  btn:          {display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",padding:"14px",borderRadius:"10px",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",color:"white",fontSize:"15px",fontWeight:700,border:"none",transition:"opacity 0.2s"},
  spinner:      {width:"16px",height:"16px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",animation:"spin 0.8s linear infinite",display:"inline-block"},

  successBox:   {padding:"20px",borderRadius:"12px",background:"rgba(16,185,129,0.06)",border:"1px solid rgba(16,185,129,0.25)",display:"flex",flexDirection:"column",gap:"14px"},
  successHeader:{fontSize:"17px",fontWeight:700,color:"#10b981"},
  successGrid:  {display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"},
  successItem:  {display:"flex",flexDirection:"column",gap:"3px",padding:"10px",borderRadius:"8px",background:"#111827"},
  successLabel: {fontSize:"10px",color:"#64748b",textTransform:"uppercase",letterSpacing:"0.5px"},
  successValue: {fontSize:"13px",color:"#f1f5f9",fontWeight:600},
  successNote:  {padding:"12px",borderRadius:"8px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",color:"#fcd34d",fontSize:"13px",lineHeight:"1.6"},
  hashRow:      {display:"flex",alignItems:"center",gap:"8px",padding:"10px 12px",borderRadius:"6px",background:"#0f172a"},
  hashLabel:    {fontSize:"11px",color:"#64748b",flexShrink:0},
  hashVal:      {fontSize:"11px",fontFamily:"'JetBrains Mono',monospace",color:"#475569",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  copyBtn:      {padding:"4px 8px",borderRadius:"4px",background:"#1e293b",color:"#94a3b8",cursor:"pointer",flexShrink:0,border:"none",fontSize:"14px"},

  code:         {fontFamily:"'JetBrains Mono',monospace",background:"#1e293b",padding:"2px 6px",borderRadius:"4px",fontSize:"12px"},
};
