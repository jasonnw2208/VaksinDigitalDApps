// src/components/MyRecords.jsx
// Tab "Sertifikat Saya" untuk pasien:
// 1. Cek apakah wallet sudah terikat ke NIK
// 2. Jika belum: form input NIK untuk binding
// 3. Jika sudah: tampilkan semua sertifikat + QR code

import { useState, useEffect, useRef } from "react";
import {
  bindNik,
  getRecordsByNik,
  getNikHashByWallet,
  verifyRecord,
  generateNikHash,
  formatTimestamp,
} from "../utils/contract";

export default function MyRecords({ signer, provider, address }) {
  const [step, setStep]             = useState("loading"); // loading | bind | records
  const [nik, setNik]               = useState("");
  const [nikInput, setNikInput]     = useState("");
  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [errorMsg, setErrorMsg]     = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Cek binding saat pertama load
  useEffect(() => {
    checkBinding();
  }, [address]);

  async function checkBinding() {
    setStep("loading");
    try {
      const existingNikHash = await getNikHashByWallet(provider, address);
      if (existingNikHash && existingNikHash !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        // Sudah terikat, tapi kita tidak tahu NIK aslinya (hanya hash)
        // Minta user input NIK untuk verifikasi + ambil records
        setStep("verify-nik");
      } else {
        setStep("bind");
      }
    } catch {
      setStep("bind");
    }
  }

  // Binding NIK ke wallet (pertama kali)
  async function handleBind() {
    if (!nikInput || nikInput.length !== 16 || !/^\d+$/.test(nikInput)) {
      setErrorMsg("NIK harus 16 digit angka.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const nikHash = generateNikHash(nikInput);
      await bindNik(signer, nikHash);
      setNik(nikInput);
      setSuccessMsg("NIK berhasil diikat ke akun ini!");
      await loadRecords(nikInput);
      setStep("records");
    } catch (e) {
      const msg = e.reason || e.message || "";
      if (msg.includes("sudah terikat ke wallet lain")) {
        setErrorMsg("NIK ini sudah terikat ke akun lain. Hubungi faskes untuk reset jika ini milik Anda.");
      } else if (msg.includes("sudah terikat ke NIK")) {
        setErrorMsg("Akun ini sudah terikat ke NIK lain. Hubungi faskes untuk reset.");
      } else {
        setErrorMsg(e.reason || e.message || "Gagal mengikat NIK.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Verifikasi NIK untuk wallet yang sudah terikat
  async function handleVerifyNik() {
    if (!nikInput || nikInput.length !== 16 || !/^\d+$/.test(nikInput)) {
      setErrorMsg("NIK harus 16 digit angka.");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const nikHash         = generateNikHash(nikInput);
      const boundNikHash    = await getNikHashByWallet(provider, address);
      if (nikHash.toLowerCase() !== boundNikHash.toLowerCase()) {
        setErrorMsg("NIK yang dimasukkan tidak sesuai dengan akun ini.");
        setLoading(false);
        return;
      }
      setNik(nikInput);
      await loadRecords(nikInput);
      setStep("records");
    } catch (e) {
      setErrorMsg(e.message || "Gagal memverifikasi NIK.");
    } finally {
      setLoading(false);
    }
  }

  async function loadRecords(nikValue) {
    const nikHash    = generateNikHash(nikValue);
    const hashList   = await getRecordsByNik(provider, nikHash);
    const details    = await Promise.all(
      hashList.map(async (h) => {
        const info = await verifyRecord(provider, h);
        return { hash: h, ...info };
      })
    );
    setRecords(details);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <div style={s.center}>
        <span style={s.spinner} />
        <p style={{ color: "#64748b" }}>Memuat data...</p>
      </div>
    );
  }

  if (step === "bind" || step === "verify-nik") {
    const isBind = step === "bind";
    return (
      <div style={s.container}>
        <h2 style={s.title}>🪪 {isBind ? "Hubungkan NIK ke Akun Ini" : "Masukkan NIK Anda"}</h2>
        <p style={s.subtitle}>
          {isBind
            ? "Akun Anda belum terhubung ke NIK manapun. Masukkan NIK Anda untuk melihat sertifikat vaksin."
            : "Akun Anda sudah terhubung ke sebuah NIK. Masukkan NIK Anda untuk mengakses sertifikat."}
        </p>

        <div style={s.bindCard}>
          <div style={s.bindIcon}>{isBind ? "🔗" : "🔐"}</div>
          <div style={s.bindTitle}>{isBind ? "Hubungkan NIK" : "Verifikasi NIK"}</div>
          <div style={s.bindDesc}>
            {isBind
              ? "NIK hanya disimpan dalam bentuk hash terenkripsi di blockchain. NIK asli tidak bisa dibaca siapapun."
              : "Masukkan NIK yang sama saat pertama kali mendaftar."}
          </div>

          <input
            style={s.input}
            type="text"
            placeholder="Masukkan 16 digit NIK"
            value={nikInput}
            onChange={e => setNikInput(e.target.value.replace(/\D/g, ""))}
            maxLength={16}
          />

          {errorMsg && <div style={s.errorBox}>⚠️ {errorMsg}</div>}
          {successMsg && <div style={s.successMini}>✅ {successMsg}</div>}

          <button
            style={{ ...s.btn, opacity: loading ? 0.7 : 1 }}
            onClick={isBind ? handleBind : handleVerifyNik}
            disabled={loading}
          >
            {loading ? <><span style={s.spinner} />Memproses...</> : isBind ? "🔗 Hubungkan NIK" : "🔓 Akses Sertifikat"}
          </button>

          {isBind && (
            <div style={s.noteBox}>
              💡 <strong>Catatan:</strong> Satu akun Google hanya bisa dihubungkan ke satu NIK.
              Jika lupa akun, hubungi faskes untuk reset dan gunakan akun baru.
            </div>
          )}
        </div>
      </div>
    );
  }

  // step === "records"
  return (
    <div style={s.container}>
      <h2 style={s.title}>📋 Sertifikat Vaksin Saya</h2>
      <div style={s.nikBadge}>
        <span style={s.nikLabel}>NIK</span>
        <span style={s.nikValue}>{nik.replace(/(\d{6})(\d{6})(\d{4})/, "$1 $2 $3")}</span>
      </div>

      {records.length === 0 ? (
        <div style={s.emptyBox}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>💉</div>
          <div style={{ fontWeight: 600, marginBottom: "8px" }}>Belum ada sertifikat vaksin</div>
          <div style={{ color: "#64748b", fontSize: "14px" }}>
            Sertifikat akan muncul di sini setelah faskes mencatat vaksinasi Anda.
          </div>
        </div>
      ) : (
        <div style={s.recordList}>
          {records.map((r, i) => (
            <CertificateCard key={i} record={r} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Certificate Card dengan QR ────────────────────────────────────────────────

function CertificateCard({ record, index }) {
  const canvasRef  = useRef(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded && canvasRef.current) {
      generateQR(canvasRef.current, record.hash);
    }
  }, [expanded, record.hash]);

  async function generateQR(canvas, data) {
    try {
      // Pakai qrcode library
      const QRCode = (await import("qrcode")).default;
      await QRCode.toCanvas(canvas, data, {
        width: 200,
        color: { dark: "#0f172a", light: "#f8fafc" },
        errorCorrectionLevel: "M",
      });
    } catch (e) {
      console.error("QR generation failed:", e);
    }
  }

  const statusColor = record.isValid ? "#10b981" : record.statusCode === 2 ? "#ef4444" : "#64748b";
  const statusLabel = record.isValid ? "✅ Valid" : record.statusCode === 2 ? "❌ Dicabut" : "⚠️ Tidak Ditemukan";

  return (
    <div style={s.card}>
      {/* Header card */}
      <div style={s.cardHeader}>
        <div>
          <div style={s.cardNumber}>Sertifikat #{index + 1}</div>
          <div style={s.cardFacility}>{record.facilityName || "Fasilitas tidak diketahui"}</div>
          <div style={s.cardDate}>{formatTimestamp(record.timestamp)}</div>
        </div>
        <div style={{ ...s.statusBadge, background: `${statusColor}20`, color: statusColor, borderColor: `${statusColor}40` }}>
          {statusLabel}
        </div>
      </div>

      {/* Hash */}
      <div style={s.hashRow}>
        <span style={s.hashLabel}>Hash:</span>
        <span style={s.hashValue}>{record.hash}</span>
      </div>

      {/* Toggle QR */}
      <button style={s.qrBtn} onClick={() => setExpanded(!expanded)}>
        {expanded ? "▲ Sembunyikan QR Code" : "📱 Tampilkan QR Code untuk Verifikasi"}
      </button>

      {expanded && (
        <div style={s.qrSection}>
          <canvas ref={canvasRef} style={s.qrCanvas} />
          <p style={s.qrNote}>
            Tunjukkan QR ini kepada petugas untuk verifikasi sertifikat vaksin Anda.
          </p>
          <p style={s.qrNote} >
            QR berisi hash sertifikat yang bisa diverifikasi di tab <strong>Verifikasi</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  container:   { display: "flex", flexDirection: "column", gap: "20px" },
  center:      { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px", gap: "16px" },
  title:       { fontSize: "20px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" },
  subtitle:    { color: "#64748b", fontSize: "14px", lineHeight: "1.6" },
  spinner:     { width: "20px", height: "20px", borderRadius: "50%", border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#3b82f6", display: "inline-block", animation: "spin 0.8s linear infinite" },

  bindCard:    { padding: "32px", borderRadius: "16px", background: "#111827", border: "1px solid #1e293b", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", maxWidth: "480px", margin: "0 auto" },
  bindIcon:    { fontSize: "48px" },
  bindTitle:   { fontSize: "18px", fontWeight: 700 },
  bindDesc:    { fontSize: "14px", color: "#64748b", textAlign: "center", lineHeight: "1.6" },

  input:       { width: "100%", padding: "12px 16px", borderRadius: "10px", background: "#1a2332", border: "1px solid #1e293b", color: "#f1f5f9", fontSize: "16px", textAlign: "center", letterSpacing: "2px", boxSizing: "border-box" },
  btn:         { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "14px", borderRadius: "10px", background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "white", fontSize: "15px", fontWeight: 700, cursor: "pointer", border: "none" },
  errorBox:    { width: "100%", padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5", fontSize: "13px", textAlign: "center", boxSizing: "border-box" },
  successMini: { width: "100%", padding: "10px 14px", borderRadius: "8px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7", fontSize: "13px", textAlign: "center" },
  noteBox:     { width: "100%", padding: "12px", borderRadius: "8px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#fcd34d", fontSize: "12px", lineHeight: "1.6", boxSizing: "border-box" },

  nikBadge:    { display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "8px", background: "#111827", border: "1px solid #1e293b" },
  nikLabel:    { fontSize: "11px", color: "#64748b", fontWeight: 600, textTransform: "uppercase" },
  nikValue:    { fontSize: "15px", fontFamily: "'JetBrains Mono', monospace", color: "#f1f5f9", letterSpacing: "1px" },

  emptyBox:    { padding: "60px 20px", borderRadius: "12px", background: "#111827", border: "1px solid #1e293b", textAlign: "center" },
  recordList:  { display: "flex", flexDirection: "column", gap: "16px" },

  card:        { padding: "20px", borderRadius: "12px", background: "#111827", border: "1px solid #1e293b", display: "flex", flexDirection: "column", gap: "12px" },
  cardHeader:  { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  cardNumber:  { fontSize: "11px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" },
  cardFacility:{ fontSize: "16px", fontWeight: 600, color: "#f1f5f9", marginTop: "4px" },
  cardDate:    { fontSize: "13px", color: "#64748b", marginTop: "2px" },
  statusBadge: { padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, border: "1px solid", flexShrink: 0 },

  hashRow:     { display: "flex", gap: "8px", alignItems: "flex-start" },
  hashLabel:   { fontSize: "11px", color: "#64748b", flexShrink: 0, marginTop: "1px" },
  hashValue:   { fontSize: "11px", fontFamily: "'JetBrains Mono', monospace", color: "#475569", wordBreak: "break-all" },

  qrBtn:       { padding: "10px 16px", borderRadius: "8px", background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", fontSize: "13px", cursor: "pointer", textAlign: "center" },
  qrSection:   { display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "20px", borderRadius: "10px", background: "#f8fafc" },
  qrCanvas:    { borderRadius: "8px" },
  qrNote:      { fontSize: "12px", color: "#475569", textAlign: "center", margin: 0 },
};
