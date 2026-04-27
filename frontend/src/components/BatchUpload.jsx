// src/components/BatchUpload.jsx
// Faskes upload banyak data vaksin sekaligus via Merkle Tree
// Lebih hemat gas dibanding addVaccineRecord satu per satu

import { useState } from "react";
import { ethers } from "ethers";
import { addBatchRoot, generateVaccineHash, generateSalt } from "../utils/contract";
import { buildMerkleTree, getRoot, getProof } from "../utils/merkleHelper";

const JENIS_VAKSIN = [
  "Sinovac (CoronaVac)", "AstraZeneca (Vaxzevria)", "Pfizer-BioNTech (Comirnaty)",
  "Moderna (Spikevax)", "Janssen (Johnson & Johnson)", "Sinopharm",
  "Vaksin Meningitis", "Vaksin Influenza", "Vaksin Hepatitis B", "Lainnya",
];

const EMPTY_ROW = () => ({
  id:             crypto.randomUUID(),
  nik:            "",
  patientAddress: "",
  namaVaksin:     "",
  kodeProduksi:   "",
  tanggal:        new Date().toISOString().split("T")[0],
});

export default function BatchUpload({ signer }) {
  const [rows,     setRows]     = useState([EMPTY_ROW()]);
  const [status,   setStatus]   = useState(null); // null | building | uploading | success | error
  const [result,   setResult]   = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const updateRow = (id, field, value) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const addRow    = () => setRows(prev => [...prev, EMPTY_ROW()]);
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));

  const handleBatchUpload = async () => {
    // Validasi semua baris
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.nik || !r.patientAddress || !r.namaVaksin || !r.kodeProduksi || !r.tanggal) {
        setErrorMsg(`Baris ${i + 1}: semua field wajib diisi.`); return;
      }
      if (r.nik.length !== 16 || !/^\d+$/.test(r.nik)) {
        setErrorMsg(`Baris ${i + 1}: NIK harus 16 digit angka.`); return;
      }
      try { ethers.getAddress(r.patientAddress); }
      catch { setErrorMsg(`Baris ${i + 1}: wallet address tidak valid.`); return; }
    }

    setStatus("building"); setErrorMsg(""); setResult(null);

    try {
      // 1. Generate hash + salt untuk setiap baris
      const processed = rows.map(r => {
        const salt     = generateSalt();
        const dataHash = generateVaccineHash(r.nik, r.namaVaksin, r.kodeProduksi, r.tanggal, salt);
        return { ...r, salt, dataHash };
      });

      // 2. Build Merkle Tree
      const tree = buildMerkleTree(
        processed.map(p => ({
          patientAddress: p.patientAddress,
          dataHash:       p.dataHash,
          vaccineType:    p.namaVaksin,
        }))
      );
      const root = getRoot(tree);

      // 3. Upload root ke blockchain
      setStatus("uploading");
      const receipt = await addBatchRoot(signer, root);

      // 4. Generate proof untuk setiap pasien + simpan ke sessionStorage
      const claims = processed.map(p => {
        const proof = getProof(tree, {
          patientAddress: p.patientAddress,
          dataHash:       p.dataHash,
          vaccineType:    p.namaVaksin,
        });
        return {
          patientAddress: p.patientAddress,
          dataHash:       p.dataHash,
          vaccineType:    p.namaVaksin,
          proof,
          root,
          salt:           p.salt,
          nik:            p.nik,
        };
      });

      // Simpan ke sessionStorage — pasien bisa klaim saat buka "Sertifikat Saya"
      const existing = JSON.parse(sessionStorage.getItem("vax_claims") || "[]");
      sessionStorage.setItem("vax_claims", JSON.stringify([...existing, ...claims]));

      setResult({ root, txHash: receipt.hash, blockNumber: receipt.blockNumber, count: rows.length, claims });
      setStatus("success");
      setRows([EMPTY_ROW()]);
    } catch (e) {
      setErrorMsg(e.reason || e.message || "Batch upload gagal");
      setStatus("error");
    }
  };

  return (
    <div style={s.container}>
      <h2 style={s.title}><span></span> Batch Upload Vaksin (Merkle Tree)</h2>
      <p style={s.subtitle}>
        Upload banyak data vaksin sekaligus. Lebih hemat gas — hanya 1 transaksi untuk semua data.
        Pasien klaim NFT mereka via tab <strong>"Sertifikat Saya"</strong>.
      </p>

      <div style={s.infoBox}>
        <strong>Cara kerja:</strong> Data di-hash → Merkle Tree dibuat → Root di-upload ke blockchain (1 tx).
        Proof disimpan lokal → pasien buka app → klaim NFT otomatis muncul.
      </div>

      {/* ── Tabel input ──────────────────────────────────────────────────── */}
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {["#", "NIK Pasien (16 digit)", "Wallet Address Pasien", "Jenis Vaksin", "Kode Batch", "Tanggal", ""].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id}>
                <td style={s.td}><span style={s.rowNum}>{i + 1}</span></td>
                <td style={s.td}>
                  <input style={s.cell} value={row.nik}
                    onChange={e => updateRow(row.id, "nik", e.target.value.replace(/\D/g,""))}
                    placeholder="3201..." maxLength={16} />
                </td>
                <td style={s.td}>
                  <input style={s.cell} value={row.patientAddress}
                    onChange={e => updateRow(row.id, "patientAddress", e.target.value)}
                    placeholder="0x..." />
                </td>
                <td style={s.td}>
                  <select style={s.cell} value={row.namaVaksin}
                    onChange={e => updateRow(row.id, "namaVaksin", e.target.value)}>
                    <option value="">-- Pilih --</option>
                    {JENIS_VAKSIN.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </td>
                <td style={s.td}>
                  <input style={s.cell} value={row.kodeProduksi}
                    onChange={e => updateRow(row.id, "kodeProduksi", e.target.value)}
                    placeholder="BATCH-001" />
                </td>
                <td style={s.td}>
                  <input style={{...s.cell, width:"130px"}} type="date" value={row.tanggal}
                    onChange={e => updateRow(row.id, "tanggal", e.target.value)} />
                </td>
                <td style={s.td}>
                  {rows.length > 1 && (
                    <button style={s.removeBtn} onClick={() => removeRow(row.id)}>✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button style={s.addRowBtn} onClick={addRow}>+ Tambah Baris</button>

      {errorMsg && <div style={s.errorBox}>{errorMsg}</div>}

      <button
        style={{...s.uploadBtn, opacity: (status==="building"||status==="uploading") ? 0.7 : 1}}
        onClick={handleBatchUpload}
        disabled={status==="building"||status==="uploading"}>
        {status === "building"  && <><span style={s.spinner}/>Membangun Merkle Tree...</>}
        {status === "uploading" && <><span style={s.spinner}/>Upload Root ke Blockchain...</>}
        {(status === null || status === "error" || status === "success") && "🌳 Upload Batch ke Blockchain"}
      </button>

      {/* ── Hasil ────────────────────────────────────────────────────────── */}
      {status === "success" && result && (
        <div style={s.successBox}>
          <div style={s.successHeader}>Batch Berhasil Di-upload!</div>
          <div style={s.statRow}>
            <div style={s.stat}><div style={s.statNum}>{result.count}</div><div style={s.statLabel}>Pasien</div></div>
            <div style={s.stat}><div style={s.statNum}>1</div><div style={s.statLabel}>Transaksi</div></div>
            <div style={s.stat}><div style={s.statNum}>#{result.blockNumber}</div><div style={s.statLabel}>Block</div></div>
          </div>

          <InfoRow label="Merkle Root" value={result.root} mono copy />
          <InfoRow label="Transaction Hash" value={result.txHash} mono />

          <div style={s.claimNote}>
            <strong>Instruksi untuk pasien:</strong> Minta setiap pasien buka aplikasi VaxChain,
            login dengan akun sosial mereka, lalu buka tab <strong>"Sertifikat Saya"</strong>.
            Klaim NFT akan muncul otomatis — klik <em>"Klaim NFT"</em> untuk mendapatkan sertifikat.
          </div>

          <div style={s.proofSection}>
            <div style={s.proofTitle}>Proof per Pasien (untuk referensi)</div>
            {result.claims.map((c, i) => (
              <div key={i} style={s.proofItem}>
                <div style={s.proofNik}>Pasien {i+1} — NIK: {c.nik} — {c.vaccineType}</div>
                <div style={s.proofAddr}>Wallet: {c.patientAddress}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono, copy }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={s.infoRow}>
      <div style={s.infoLabel}>{label}</div>
      <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
        <div style={{...s.infoValue, fontFamily: mono?"'JetBrains Mono',monospace":"inherit"}}>{value}</div>
        {copy && (
          <button style={s.copyBtn} onClick={()=>{navigator.clipboard.writeText(value);setCopied(true);setTimeout(()=>setCopied(false),2000)}}>
            {copied?"✓":" "}
          </button>
        )}
      </div>
    </div>
  );
}

const s = {
  container:    {display:"flex",flexDirection:"column",gap:"20px"},
  title:        {fontSize:"20px",fontWeight:700,display:"flex",alignItems:"center",gap:"10px"},
  subtitle:     {color:"#64748b",fontSize:"14px",lineHeight:"1.6"},
  infoBox:      {padding:"12px 16px",borderRadius:"8px",background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",color:"#93c5fd",fontSize:"13px",lineHeight:"1.6"},
  tableWrap:    {overflowX:"auto",borderRadius:"12px",border:"1px solid #1e293b"},
  table:        {width:"100%",borderCollapse:"collapse",background:"#111827"},
  th:           {padding:"12px 10px",textAlign:"left",fontSize:"11px",fontWeight:600,color:"#64748b",textTransform:"uppercase",borderBottom:"1px solid #1e293b",whiteSpace:"nowrap"},
  td:           {padding:"8px 10px",borderBottom:"1px solid #0f172a"},
  rowNum:       {fontSize:"12px",color:"#475569",fontWeight:600},
  cell:         {padding:"8px 10px",borderRadius:"6px",background:"#1a2332",border:"1px solid #1e293b",color:"#f1f5f9",fontSize:"13px",width:"100%",minWidth:"100px"},
  removeBtn:    {padding:"4px 8px",borderRadius:"4px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#ef4444",cursor:"pointer",fontSize:"12px"},
  addRowBtn:    {padding:"10px 20px",borderRadius:"8px",background:"#1e293b",border:"1px solid #334155",color:"#94a3b8",cursor:"pointer",fontSize:"13px",fontWeight:600,alignSelf:"flex-start"},
  errorBox:     {padding:"12px 16px",borderRadius:"8px",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.3)",color:"#fca5a5",fontSize:"14px"},
  uploadBtn:    {display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",padding:"14px",borderRadius:"10px",background:"linear-gradient(135deg,#10b981,#059669)",color:"white",fontSize:"15px",fontWeight:700,cursor:"pointer",border:"none"},
  spinner:      {width:"16px",height:"16px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",animation:"spin 0.8s linear infinite",display:"inline-block"},
  successBox:   {padding:"24px",borderRadius:"12px",background:"rgba(16,185,129,0.06)",border:"1px solid rgba(16,185,129,0.25)",display:"flex",flexDirection:"column",gap:"16px"},
  successHeader:{fontSize:"17px",fontWeight:700,color:"#10b981"},
  statRow:      {display:"flex",gap:"16px"},
  stat:         {flex:1,padding:"16px",borderRadius:"8px",background:"#111827",border:"1px solid #1e293b",textAlign:"center"},
  statNum:      {fontSize:"24px",fontWeight:800,color:"#f1f5f9"},
  statLabel:    {fontSize:"11px",color:"#64748b",marginTop:"4px"},
  infoRow:      {padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",flexDirection:"column",gap:"4px"},
  infoLabel:    {fontSize:"11px",color:"#64748b",textTransform:"uppercase",letterSpacing:"0.5px"},
  infoValue:    {fontSize:"12px",color:"#94a3b8",wordBreak:"break-all"},
  copyBtn:      {padding:"4px 8px",borderRadius:"4px",fontSize:"14px",background:"#1e293b",color:"#94a3b8",cursor:"pointer",flexShrink:0,border:"none"},
  claimNote:    {padding:"12px 16px",borderRadius:"8px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",color:"#fcd34d",fontSize:"13px",lineHeight:"1.6"},
  proofSection: {display:"flex",flexDirection:"column",gap:"8px"},
  proofTitle:   {fontSize:"13px",fontWeight:600,color:"#94a3b8"},
  proofItem:    {padding:"10px 12px",borderRadius:"6px",background:"#111827",border:"1px solid #1e293b"},
  proofNik:     {fontSize:"12px",fontWeight:600,color:"#f1f5f9"},
  proofAddr:    {fontSize:"11px",color:"#64748b",fontFamily:"'JetBrains Mono',monospace",marginTop:"2px"},
};
