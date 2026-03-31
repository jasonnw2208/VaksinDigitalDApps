// src/components/AddRecord.jsx
import { useState, useEffect } from "react";
import { 
  addVaccineRecord, 
  addBatchRoot,
  generateVaccineHash, 
  generateSalt 
} from "../utils/contract";
import { buildMerkleTree, getRoot, getProof } from "../utils/merkleHelper";

const JENIS_VAKSIN = [
  "Sinovac (CoronaVac)", "AstraZeneca", "Pfizer", "Moderna", "Sinopharm", "Meningitis", "Influenza"
];

export default function AddRecord({ signer, issuerAddress }) {
  const [mode, setMode] = useState("single"); // "single" | "bulk"
  const [form, setForm] = useState({
    patientAddress: "", nik: "", namaVaksin: "", kodeProduksi: "",
    tanggal: new Date().toISOString().split("T")[0],
  });
  
  const [bulkData, setBulkData] = useState("");
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Single Mint ──────────────────────────────────────────────────────────
  const handleSingleSubmit = async () => {
    if (!form.patientAddress || !form.nik || !form.namaVaksin) return setErrorMsg("Sediakan data lengkap!");
    
    setStatus("loading");
    setErrorMsg("");
    try {
      const salt = generateSalt();
      const hashData = generateVaccineHash(form.nik, form.namaVaksin, form.kodeProduksi, form.tanggal, salt);
      
      const receipt = await addVaccineRecord(signer, form.patientAddress, hashData, form.namaVaksin);
      
      setResult({ type: "single", hash: hashData, txHash: receipt.hash, patient: form.patientAddress });
      setStatus("success");
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  };

  // ── Bulk Upload (Merkle) ────────────────────────────────────────────────
  const handleBulkSubmit = async () => {
    try {
      const lines = bulkData.trim().split("\n");
      if (lines.length < 1) return setErrorMsg("Data bulk kosong!");
      
      setStatus("loading");
      // Format: address,nik,vaksin,batch,tanggal
      const records = lines.map(line => {
        const [addr, nik, vax, batch, date] = line.split(",").map(s => s?.trim());
        const salt = generateSalt();
        const hash = generateVaccineHash(nik, vax, batch, date, salt);
        return { patientAddress: addr, dataHash: hash, vaccineType: vax, nik, batch, date, salt };
      });

      const tree = buildMerkleTree(records);
      const root = getRoot(tree);

      const receipt = await addBatchRoot(signer, root);

      // Simpan proof ke localStorage (Simulasi database klaim)
      const existingClaims = JSON.parse(localStorage.getItem("vax_claims") || "[]");
      const newClaims = records.map(rec => ({
        ...rec,
        root,
        proof: getProof(tree, rec)
      }));
      localStorage.setItem("vax_claims", JSON.stringify([...existingClaims, ...newClaims]));

      setResult({ type: "bulk", root, txHash: receipt.hash, count: records.length });
      setStatus("success");
      setBulkData("");
    } catch (e) {
      setErrorMsg(e.message);
      setStatus("error");
    }
  };

  return (
    <div style={s.container}>
      <div style={s.tabHeader}>
        <button style={{...s.tab, ...(mode === "single" ? s.tabActive : {})}} onClick={() => setMode("single")}>Single Mint (Instant NFT)</button>
        <button style={{...s.tab, ...(mode === "bulk" ? s.tabActive : {})}} onClick={() => setMode("bulk")}>Batch Upload (Merkle Scaling)</button>
      </div>

      {mode === "single" ? (
        <div style={s.formGrid}>
          <Field label="Alamat Wallet Pasien (Privy Address)">
            <input style={s.input} name="patientAddress" value={form.patientAddress} onChange={handleChange} placeholder="0x..." />
          </Field>
          <Field label="NIK Pasien (16 digit)">
            <input style={s.input} name="nik" value={form.nik} onChange={handleChange} placeholder="320..." maxLength={16} />
          </Field>
          <Field label="Jenis Vaksin">
            <select style={s.input} name="namaVaksin" value={form.namaVaksin} onChange={handleChange}>
              <option value="">-- Pilih --</option>
              {JENIS_VAKSIN.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="Batch Number">
            <input style={s.input} name="kodeProduksi" value={form.kodeProduksi} onChange={handleChange} placeholder="B-001" />
          </Field>
          <button style={s.btn} onClick={handleSingleSubmit} disabled={status === "loading"}>Kirim Sertifikat NFT</button>
        </div>
      ) : (
        <div style={s.bulkCont}>
          <p style={s.hint}>Format CSV: <code>address,nik,vaksin,batch,tanggal</code> (satu per baris)</p>
          <textarea 
            style={s.textarea} 
            value={bulkData} 
            onChange={(e) => setBulkData(e.target.value)}
            placeholder="0x123...,320123...,Sinovac,B-01,2024-03-31"
          />
          <button style={s.btn} onClick={handleBulkSubmit} disabled={status === "loading"}>Submit Batch & Simpan Merkle Root</button>
        </div>
      )}

      {errorMsg && <div style={s.err}>{errorMsg}</div>}
      {status === "success" && result && (
        <div style={s.success}>
          {result.type === "single" ? (
            <>NFT Berhasil Dikirim ke {shortAddress(result.patient)}! (Tx: {shortAddress(result.txHash)})</>
          ) : (
            <div style={s.merkleSummary}>
              <h4 style={s.summaryTitle}>🌳 Merkle Tree Generated</h4>
              <div style={s.summaryRoot}>Root: <code>{result.root}</code></div>
              <p style={s.summaryText}>Berhasil memadatkan {result.count} data menjadi 1 Root Hash!</p>
              
              <div style={s.treeVisual}>
                <div style={s.treeNode}>Root</div>
                <div style={s.treeLine}>/ \</div>
                <div style={s.treeLeaves}>
                  {result.count > 4 ? (
                    <>
                      <div style={s.leaf}>Leaf 1</div>
                      <div style={s.leaf}>Leaf 2</div>
                      <div style={s.leaf}>...</div>
                      <div style={s.leaf}>Leaf {result.count}</div>
                    </>
                  ) : (
                    Array.from({length: result.count}).map((_, i) => (
                      <div key={i} style={s.leaf}>Leaf {i+1}</div>
                    ))
                  )}
                </div>
              </div>
              <div style={s.txInfo}>Transaction: {shortAddress(result.txHash)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <div style={s.field}><label style={s.label}>{label}</label>{children}</div>;
}

function shortAddress(a) { return a ? `${a.slice(0,6)}...${a.slice(-4)}` : ""; }

const s = {
  container: { display: "flex", flexDirection: "column", gap: "20px" },
  tabHeader: { display: "flex", gap: "10px", borderBottom: "1px solid #1e293b", paddingBottom: "10px" },
  tab: { padding: "8px 16px", background: "none", color: "#64748b", cursor: "pointer", border: "none" },
  tabActive: { color: "#10b981", fontWeight: 700, borderBottom: "2px solid #10b981" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", background: "#111827", padding: "20px", borderRadius: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "12px", color: "#94a3b8" },
  input: { padding: "10px", background: "#1a2332", border: "1px solid #1e293b", color: "white", borderRadius: "8px" },
  btn: { gridColumn: "span 2", padding: "12px", background: "#10b981", color: "white", fontWeight: 700, borderRadius: "8px", marginTop: "10px" },
  err: { color: "#ef4444", fontSize: "14px" },
  success: { padding: "16px", background: "rgba(16,185,129,0.1)", color: "#10b981", borderRadius: "8px", border: "1px solid #10b981" },
  bulkCont: { display: "flex", flexDirection: "column", gap: "12px" },
  textarea: { height: "150px", background: "#111827", color: "white", padding: "12px", border: "1px solid #1e293b", borderRadius: "8px", fontFamily: "monospace" },
  hint: { fontSize: "12px", color: "#64748b" },

  // Merkle summary styles
  merkleSummary: { display: "flex", flexDirection: "column", gap: "10px", textAlign: "center" },
  summaryTitle: { fontSize: "16px", fontWeight: 700, color: "#10b981", margin: 0 },
  summaryRoot: { fontSize: "11px", background: "#1a2332", padding: "8px", borderRadius: "6px", wordBreak: "break-all" },
  treeVisual: { background: "rgba(0,0,0,0.1)", padding: "16px", borderRadius: "10px", margin: "10px 0" },
  treeNode: { fontSize: "12px", fontWeight: 700, color: "#3b82f6" },
  treeLeaves: { display: "flex", justifyContent: "center", gap: "10px", marginTop: "4px" },
  leaf: { fontSize: "10px", padding: "4px 8px", background: "#334155", borderRadius: "4px" },
  summaryText: { fontSize: "13px", color: "#94a3b8" },
};
