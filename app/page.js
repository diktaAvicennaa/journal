"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getTrades,
  addTrade,
  updateTrade,
  deleteTrade,
  uploadImage,
  compressImage,
} from "../lib/supabase";

/* ============================== helpers ============================== */

function formatIDR(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function fmtShort(value) {
  const v = Number(value) || 0;
  const abs = Math.abs(v);
  if (abs >= 1e9) return (v / 1e9).toFixed(1) + "M";
  if (abs >= 1e6) return (v / 1e6).toFixed(1) + "jt";
  if (abs >= 1e3) return (v / 1e3).toFixed(0) + "rb";
  return String(Math.round(v));
}

function formatNumberInput(value) {
  const str = String(value ?? "");
  if (str === "-") return "-";
  const isNegative = str.trim().startsWith("-");
  const digits = str.replace(/\D/g, "");
  if (!digits) return isNegative ? "-" : "";
  const formatted = Number(digits).toLocaleString("id-ID");
  return isNegative ? "-" + formatted : formatted;
}

function parseNumberInput(value) {
  const str = String(value ?? "");
  if (str === "-") return "-";
  const isNegative = str.trim().startsWith("-");
  const digits = str.replace(/\D/g, "");
  if (!digits) return "";
  const num = Number(digits);
  return isNegative ? -num : num;
}

/* ============================== konstanta ============================== */

const CHECKLIST_ITEMS = [
  { key: "time", label: "Time Alignment — Sweep/Run di Killzone WIB" },
  { key: "structure", label: "Structure Bias — Bullish Sweep/Run Low / Bearish Sweep/Run High" },
  { key: "pdArray", label: "PD Array — Berhimpitan FVG / Order Block" },
  { key: "candle", label: "Candle Behavior — Wick Rejection / Trap 1-2 Candle" },
  { key: "ltf", label: "LTF Confirmation — MSS/CHoCH + FVG/Fibo (1m-5m)" },
];

const EMPTY = {
  pair: "",
  direction: "BUY",
  entry: "",
  sl: "",
  tp: "",
  lot: "",
  pnl: "",
  rr: "",
  session: "London",
  strategy: "",
  emotion: "Neutral",
  notes: "",
  setup_type: "",
  bias: "",
};

const TABS = [
  { id: "overview", label: "Dashboard" },
  { id: "journal", label: "Jurnal" },
  { id: "history", label: "Histori" },
];

/* ============================== komponen utama ============================== */

export default function Home() {
  const [trades, setTrades] = useState([]);
  const [tab, setTab] = useState("overview");
  const [form, setForm] = useState(EMPTY);
  const [checklist, setChecklist] = useState({});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    const data = await getTrades();
    setTrades(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!modalOpen && !deleteTarget) return;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") {
        setDeleteTarget(null);
        resetForm();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [modalOpen, deleteTarget]);

  async function processFile(rawFile) {
    if (!rawFile || !rawFile.type.startsWith("image/")) {
      alert("File harus gambar!");
      return;
    }
    setUploadingImg(true);
    try {
      const compressed = await compressImage(rawFile);
      setFile(compressed);
      setPreview(URL.createObjectURL(compressed));
    } catch (e) {
      alert("Gagal proses gambar: " + e.message);
    }
    setUploadingImg(false);
  }

  function onFileChange(e) {
    const f = e.target.files[0];
    if (f) processFile(f);
  }

  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) {
          e.preventDefault();
          processFile(f);
          return;
        }
      }
    }
  }

  function resetForm() {
    setForm(EMPTY);
    setChecklist({});
    setFile(null);
    setPreview(null);
    setExistingImageUrl(null);
    setEditingId(null);
    setModalOpen(false);
  }

  function startEdit(t) {
    setEditingId(t.id);
    setForm({
      pair: t.pair || "",
      direction: t.direction || "BUY",
      entry: t.entry ?? "",
      sl: t.sl ?? "",
      tp: t.tp ?? "",
      lot: t.lot ?? "",
      pnl: t.pnl ?? "",
      rr: t.rr || "",
      session: t.session || "London",
      strategy: t.strategy || "",
      emotion: t.emotion || "Neutral",
      notes: t.notes || "",
      setup_type: t.setup_type || "",
      bias: t.bias || "",
    });
    setChecklist(t.checklist || {});
    setFile(null);
    setPreview(null);
    setExistingImageUrl(t.image_url || null);
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      let image_url = existingImageUrl;
      if (file) image_url = await uploadImage(file);

      const cleaned = {
        pair: form.pair,
        direction: form.direction,
        entry: form.entry === "" ? null : Number(form.entry),
        sl: form.sl === "" ? null : Number(form.sl),
        tp: form.tp === "" ? null : Number(form.tp),
        lot: form.lot === "" ? null : Number(form.lot),
        pnl: form.pnl === "" || form.pnl === "-" ? null : Number(form.pnl),
        rr: form.rr || null,
        session: form.session,
        strategy: form.strategy || null,
        emotion: form.emotion,
        notes: form.notes || null,
        setup_type: form.setup_type || null,
        bias: form.bias || null,
        image_url,
        checklist,
        killzone: checklist.time || false,
      };

      if (editingId) {
        await updateTrade(editingId, cleaned);
      } else {
        await addTrade(cleaned);
      }

      resetForm();
      await load();
      setTab("history");
    } catch (err) {
      alert("Gagal simpan: " + err.message);
    }
    setLoading(false);
  }

  function handleDelete(id) {
    setDeleteTarget(id);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteTrade(deleteTarget);
    setDeleteTarget(null);
    load();
  }

  function exportCSV() {
    const header = ["Tanggal", "Pair", "Arah", "Sesi", "Setup", "Bias", "Entry", "SL", "TP", "Lot", "PnL", "RR", "Strategi", "Emosi", "Catatan"];
    const rows = filtered.map((t) => [
      t.created_at ? new Date(t.created_at).toLocaleString("id-ID") : "",
      t.pair, t.direction, t.session, t.setup_type, t.bias,
      t.entry ?? "", t.sl ?? "", t.tp ?? "", t.lot ?? "", t.pnl ?? "", t.rr ?? "",
      t.strategy, t.emotion, t.notes,
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trading-journal.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ------------------------------ filtering ------------------------------ */

  const filtered = trades.filter((t) => {
    if (search && !(t.pair || "").toLowerCase().includes(search.toLowerCase()))
      return false;
    if (filter === "WIN" && Number(t.pnl) <= 0) return false;
    if (filter === "LOSS" && Number(t.pnl) >= 0) return false;
    if (dateFrom || dateTo) {
      const tgl = t.created_at
        ? new Date(t.created_at).toISOString().slice(0, 10)
        : "";
      if (dateFrom && tgl < dateFrom) return false;
      if (dateTo && tgl > dateTo) return false;
    }
    return true;
  });

  /* ------------------------------ statistik ------------------------------ */

  const stats = useMemo(() => {
    const list = filtered;
    const pnls = list.map((t) => Number(t.pnl) || 0);
    const total = pnls.reduce((a, b) => a + b, 0);
    const winPnls = pnls.filter((p) => p > 0);
    const lossPnls = pnls.filter((p) => p < 0);
    const be = list.length - winPnls.length - lossPnls.length;
    const winRate = list.length ? (winPnls.length / list.length) * 100 : 0;
    const grossWin = winPnls.reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(lossPnls.reduce((a, b) => a + b, 0));
    const profitFactor =
      grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
    const avgWin = winPnls.length ? grossWin / winPnls.length : 0;
    const avgLoss = lossPnls.length ? grossLoss / lossPnls.length : 0;
    const expectancy = list.length ? total / list.length : 0;

    let cum = 0, peak = 0, maxDD = 0;
    for (const p of pnls) {
      cum += p;
      peak = Math.max(peak, cum);
      maxDD = Math.max(maxDD, peak - cum);
    }

    const series = [...list]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map((t) => ({ date: t.created_at, pnl: Number(t.pnl) || 0 }));
    let c = 0;
    series.forEach((s) => {
      c += s.pnl;
      s.cum = c;
    });

    const byKey = (key) => {
      const m = {};
      for (const t of list) {
        const k = t[key] || "-";
        m[k] = (m[k] || 0) + (Number(t.pnl) || 0);
      }
      return Object.entries(m)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    };

    const sop = { ok: 0, okPnl: 0, nok: 0, nokPnl: 0 };
    for (const t of list) {
      const cl = t.checklist || {};
      const ok = CHECKLIST_ITEMS.every((i) => cl[i.key]);
      const p = Number(t.pnl) || 0;
      if (ok) { sop.ok++; sop.okPnl += p; } else { sop.nok++; sop.nokPnl += p; }
    }

    return {
      total,
      count: list.length,
      winRate,
      wins: winPnls.length,
      losses: lossPnls.length,
      be,
      profitFactor,
      avgWin,
      avgLoss,
      expectancy,
      maxDD,
      series,
      bySession: byKey("session"),
      byPair: byKey("pair").slice(0, 8),
      compliance: list.length ? (sop.ok / list.length) * 100 : 0,
      sopOk: sop.ok,
      avgOk: sop.ok ? sop.okPnl / sop.ok : 0,
      avgNok: sop.nok ? sop.nokPnl / sop.nok : 0,
    };
  }, [filtered]);

  const checkedCount = Object.values(checklist).filter(Boolean).length;
  const allChecked = checkedCount === CHECKLIST_ITEMS.length;

  const formContent = (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6">
            <Card
              className={editingId ? "border-cyan-500/40" : ""}
              title={editingId ? "Edit Trade" : "Tambah Trade"}
              subtitle={
                editingId
                  ? "Perbarui detail trade yang sudah tercatat"
                  : "Isi detail trade sesuai SOP trading plan-mu"
              }
              action={
                editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-400 transition"
                  >
                    Batal Edit
                  </button>
                ) : null
              }
            >
              <SectionTitle>Informasi Trade</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Pair">
                  <input
                    required
                    placeholder="EURUSD"
                    className={inputCls}
                    value={form.pair}
                    onChange={(e) =>
                      setForm({ ...form, pair: e.target.value.toUpperCase() })
                    }
                  />
                </Field>
                <Field label="Direction">
                  <select
                    className={inputCls}
                    value={form.direction}
                    onChange={(e) =>
                      setForm({ ...form, direction: e.target.value })
                    }
                  >
                    <option>BUY</option>
                    <option>SELL</option>
                  </select>
                </Field>
                <Field label="Session">
                  <select
                    className={inputCls}
                    value={form.session}
                    onChange={(e) =>
                      setForm({ ...form, session: e.target.value })
                    }
                  >
                    <option>Asia</option>
                    <option>London</option>
                    <option>New York</option>
                    <option>Overlap</option>
                  </select>
                </Field>
                <Field label="Setup Type">
                  <select
                    className={inputCls}
                    value={form.setup_type}
                    onChange={(e) =>
                      setForm({ ...form, setup_type: e.target.value })
                    }
                  >
                    <option value="">-</option>
                    <option>A: Liquidity Run</option>
                    <option>B: Liquidity Sweep</option>
                  </select>
                </Field>
                <Field label="Bias">
                  <select
                    className={inputCls}
                    value={form.bias}
                    onChange={(e) => setForm({ ...form, bias: e.target.value })}
                  >
                    <option value="">-</option>
                    <option>Bullish (Buy-Side)</option>
                    <option>Bearish (Sell-Side)</option>
                  </select>
                </Field>
                <Field label="Strategy">
                  <input
                    placeholder="Breakout, OB, dll"
                    className={inputCls}
                    value={form.strategy}
                    onChange={(e) =>
                      setForm({ ...form, strategy: e.target.value })
                    }
                  />
                </Field>
              </div>

              <SectionTitle>Level &amp; Risk</SectionTitle>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Field label="Entry">
                  <input
                    type="number"
                    step="any"
                    className={inputCls}
                    value={form.entry}
                    onChange={(e) =>
                      setForm({ ...form, entry: e.target.value })
                    }
                  />
                </Field>
                <Field label="Stop Loss">
                  <input
                    type="number"
                    step="any"
                    className={inputCls}
                    value={form.sl}
                    onChange={(e) => setForm({ ...form, sl: e.target.value })}
                  />
                </Field>
                <Field label="Take Profit">
                  <input
                    type="number"
                    step="any"
                    className={inputCls}
                    value={form.tp}
                    onChange={(e) => setForm({ ...form, tp: e.target.value })}
                  />
                </Field>
                <Field label="Lot Size">
                  <input
                    type="number"
                    step="any"
                    className={inputCls}
                    value={form.lot}
                    onChange={(e) => setForm({ ...form, lot: e.target.value })}
                  />
                </Field>
                <Field label="Risk : Reward">
                  <input
                    placeholder="1:2"
                    className={inputCls}
                    value={form.rr}
                    onChange={(e) => setForm({ ...form, rr: e.target.value })}
                  />
                </Field>
                <Field label="PnL (Rp)">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    className={inputCls}
                    value={formatNumberInput(form.pnl)}
                    onChange={(e) =>
                      setForm({ ...form, pnl: parseNumberInput(e.target.value) })
                    }
                  />
                </Field>
              </div>

              <SectionTitle>Analisis &amp; Psikologi</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Emotion">
                  <select
                    className={inputCls}
                    value={form.emotion}
                    onChange={(e) =>
                      setForm({ ...form, emotion: e.target.value })
                    }
                  >
                    <option>Neutral</option>
                    <option>Confident</option>
                    <option>Fear</option>
                    <option>Greed</option>
                    <option>Revenge</option>
                    <option>FOMO</option>
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <Field label="Notes">
                    <textarea
                      rows="3"
                      placeholder="Alasan entry, kondisi market, dll..."
                      className={inputCls}
                      value={form.notes}
                      onChange={(e) =>
                        setForm({ ...form, notes: e.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
            </Card>

            {/* CHECKLIST */}
            <Card
              title="Checklist SOP — Liquidity Sweep"
              subtitle="Lengkapi seluruh kriteria sebelum entry"
              action={
                <span
                  className={`text-xs font-bold ${
                    allChecked ? "text-emerald-400" : "text-slate-400"
                  }`}
                >
                  {checkedCount}/{CHECKLIST_ITEMS.length}
                  {allChecked && " ✓ Setup valid"}
                </span>
              }
            >
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    allChecked
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                      : "bg-gradient-to-r from-cyan-500 to-blue-500"
                  }`}
                  style={{
                    width: `${(checkedCount / CHECKLIST_ITEMS.length) * 100}%`,
                  }}
                />
              </div>
              <div className="space-y-2">
                {CHECKLIST_ITEMS.map((item) => (
                  <label
                    key={item.key}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                      checklist[item.key]
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!checklist[item.key]}
                      onChange={(e) =>
                        setChecklist({
                          ...checklist,
                          [item.key]: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-4 h-4 accent-emerald-500"
                    />
                    <span
                      className={`text-sm ${
                        checklist[item.key]
                          ? "text-emerald-300"
                          : "text-slate-300"
                      }`}
                    >
                      {item.label}
                    </span>
                    {checklist[item.key] && (
                      <span className="ml-auto text-emerald-400 text-xs font-bold">
                        ✓
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </Card>

            {/* SCREENSHOT */}
            <Card title="Screenshot" subtitle="Paste, drag & drop, atau pilih file">
              <div className="flex gap-2 items-stretch">
                <div
                  tabIndex={0}
                  onPaste={handlePaste}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files[0];
                    if (f) processFile(f);
                  }}
                  className="flex-1 bg-slate-800/70 border border-dashed border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-300 focus:outline-none focus:border-cyan-500 transition min-h-[52px] flex items-center"
                >
                  {uploadingImg ? (
                    <span className="text-cyan-400 animate-pulse">
                      ⏳ Memproses gambar...
                    </span>
                  ) : preview || existingImageUrl ? (
                    <div className="flex items-center gap-3 w-full">
                      <img
                        src={preview || existingImageUrl}
                        className="h-12 rounded-lg border border-slate-600"
                      />
                      <span className="text-xs text-slate-400 flex-1">
                        {preview ? "Siap dikirim" : "Gambar lama"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setPreview(null);
                          setExistingImageUrl(null);
                        }}
                        className="text-rose-400 hover:text-rose-300 text-xs"
                      >
                        ✕ Hapus
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-500 italic">
                      paste gambar di sini (Ctrl+V)...
                    </span>
                  )}
                </div>
                <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-4 flex items-center text-sm text-slate-200 transition">
                  📎 Pilih File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onFileChange}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Auto-compress ke JPEG 82% • max 1400px
              </p>
            </Card>

            <div className="flex justify-end gap-2 pb-10">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-semibold transition"
                >
                  Batal
                </button>
              )}
              <button
                disabled={loading || uploadingImg}
                className={`text-sm font-semibold px-8 py-2.5 rounded-xl shadow-lg transition disabled:opacity-50 text-white ${
                  editingId
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500"
                    : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500"
                }`}
              >
                {loading
                  ? "Menyimpan..."
                  : editingId
                    ? "Update Trade"
                    : "Simpan Trade"}
              </button>
            </div>
          </form>
  );

  /* ============================== render ============================== */

  return (
    <main className="min-h-screen bg-[#070b14] text-slate-200 [background-image:radial-gradient(ellipse_at_top,rgba(34,211,238,0.05),transparent_55%)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
           
            <div>
              <h1 className="text-xl font-bold text-white leading-tight tracking-tight">
                Trading Journal
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Catat, evaluasi, dan tingkatkan performa tradingmu
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex items-center gap-1 bg-slate-900/70 border border-slate-800 rounded-xl p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    tab === t.id
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => {
                setTab("journal");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20 transition"
            >
              ＋ Catat Trade
            </button>
          </div>
        </header>

        {/* FILTER BAR */}
        {tab !== "journal" && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 mb-6 shadow-lg">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[150px]">
                <label className={labelCls}>Cari Pair</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="EURUSD..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Hasil</label>
                <div className="flex gap-1.5">
                  {["ALL", "WIN", "LOSS"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
                        filter === f
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Dari Tanggal</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Sampai Tanggal</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    setDateFrom(today);
                    setDateTo(today);
                  }}
                  className="px-3 py-2 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                >
                  Hari ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    setDateFrom(d.toISOString().slice(0, 10));
                    setDateTo(new Date().toISOString().slice(0, 10));
                  }}
                  className="px-3 py-2 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(1);
                    setDateFrom(d.toISOString().slice(0, 10));
                    setDateTo(new Date().toISOString().slice(0, 10));
                  }}
                  className="px-3 py-2 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                >
                  Bulan ini
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setSearch("");
                    setFilter("ALL");
                  }}
                  className="px-3 py-2 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 transition text-rose-400"
                >
                  Reset
                </button>
              </div>
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={exportCSV}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                >
                  ⬇ Export CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================== DASHBOARD ============================== */}
        {tab === "overview" && (
          <div className="space-y-6">
            {filtered.length === 0 && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-500">
                Tidak ada trade yang cocok dengan filter.{" "}
                <button onClick={() => setTab("journal")} className="text-cyan-400 hover:underline">
                  Catat trade pertama →
                </button>
              </div>
            )}

            {/* KPI utama */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total PnL"
                value={formatIDR(stats.total)}
                sub={`${stats.wins}W • ${stats.losses}L `}
                tone={stats.total >= 0 ? "up" : "down"}
              />
              <StatCard
                label="Win Rate"
                value={`${stats.winRate.toFixed(1)}%`}
                sub={`dari ${stats.count} trade`}
                tone="neutral"
              />
              <StatCard
                label="Profit Factor"
                value={
                  !stats.count
                    ? "—"
                    : stats.profitFactor === Infinity
                      ? "∞"
                      : stats.profitFactor.toFixed(2)
                }
                sub="Gross Win ÷ Gross Loss"
                tone={stats.profitFactor >= 1 ? "up" : "down"}
              />
              <StatCard
                label="Expectancy"
                value={formatIDR(stats.expectancy)}
                sub="rata-rata per trade"
                tone={stats.expectancy >= 0 ? "up" : "down"}
              />
            </div>

            {/* KPI sekunder */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Trade" value={stats.count} tone="neutral" small />
              <StatCard
                label="Rata-rata Win"
                value={formatIDR(stats.avgWin)}
                tone="up"
                small
              />
              <StatCard
                label="Rata-rata Loss"
                value={formatIDR(-stats.avgLoss)}
                tone="down"
                small
              />
              <StatCard
                label="Max Drawdown"
                value={formatIDR(-stats.maxDD)}
                tone="down"
                small
              />
            </div>

            {/* Grafik utama */}
            <div className="grid lg:grid-cols-3 gap-6">
              <Card
                className="lg:col-span-2"
                title="Kurva Ekuitas"
                subtitle="Akumulasi PnL seiring waktu "
              >
                <EquityChart data={stats.series} />
              </Card>
              <Card title="Distribusi Hasil" subtitle="Win / Loss ">
                <DonutChart
                  segments={[
                    { label: "Win", value: stats.wins, color: "#34d399" },
                    { label: "Loss", value: stats.losses, color: "#fb7185" },
                
                  ]}
                  centerValue={`${stats.winRate.toFixed(0)}%`}
                  centerLabel="Win Rate"
                />
              </Card>
            </div>

            {/* Grafik sekunder */}
            <div className="grid lg:grid-cols-3 gap-6">
              <Card title="PnL per Sesi" subtitle="performa tiap sesi market">
                <HBarChart data={stats.bySession} emptyText="Belum ada data sesi" />
              </Card>
              <Card title="PnL per Pair" subtitle="top pair berdasarkan PnL">
                <HBarChart data={stats.byPair} emptyText="Belum ada data pair" />
              </Card>
              <Card title="Kepatuhan SOP" subtitle="checklist Liquidity Sweep lengkap">
                <div className="flex items-center gap-5">
                  <ProgressRing value={stats.compliance} />
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {stats.compliance.toFixed(0)}
                      <span className="text-sm text-slate-500">%</span>
                    </p>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                      {stats.sopOk} dari {stats.count} trade lolos
                      <br />
                      semua checklist SOP
                    </p>
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  <MiniCompare
                    label="Avg PnL patuh SOP"
                    value={stats.avgOk}
                    maxAbs={Math.max(Math.abs(stats.avgOk), Math.abs(stats.avgNok), 1)}
                  />
                  <MiniCompare
                    label="Avg PnL langgar SOP"
                    value={stats.avgNok}
                    maxAbs={Math.max(Math.abs(stats.avgOk), Math.abs(stats.avgNok), 1)}
                  />
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ============================== JURNAL (FORM) ============================== */}
        {tab === "journal" && formContent}

        {/* ============================== HISTORI ============================== */}
        {tab === "history" && (
          <div className="space-y-6">
            {filtered.length === 0 && (
              <p className="text-center text-slate-500 py-10">
                Belum ada trade yang cocok. Yuk mulai catat!
              </p>
            )}

            {Object.entries(
              filtered.reduce((groups, t) => {
                const day = t.created_at
                  ? new Date(t.created_at).toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "Tanpa Tanggal";
                if (!groups[day]) groups[day] = [];
                groups[day].push(t);
                return groups;
              }, {}),
            ).map(([day, items]) => {
              const dayPnl = items.reduce(
                (s, t) => s + (Number(t.pnl) || 0),
                0,
              );
              const dayWins = items.filter((t) => Number(t.pnl) > 0).length;
              return (
                <div key={day}>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-sm font-semibold text-slate-300">
                      {day}
                    </h3>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-500">
                        {items.length} trade • WR{" "}
                        {((dayWins / items.length) * 100).toFixed(0)}%
                      </span>
                      <span
                        className={`font-bold ${
                          dayPnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {dayPnl >= 0 ? "+" : "-"}
                        {formatIDR(Math.abs(dayPnl))}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {items.map((t) => {
                      const pnl = Number(t.pnl) || 0;
                      const isWin = pnl > 0;
                      const time = t.created_at
                        ? new Date(t.created_at).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "";
                      return (
                        <div
                          key={t.id}
                          className={`bg-slate-900/60 backdrop-blur border rounded-2xl p-5 shadow-lg transition ${
                            editingId === t.id
                              ? "border-cyan-500/50"
                              : "border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-lg text-white">
                                  {t.pair}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                    t.direction === "BUY"
                                      ? "bg-emerald-500/20 text-emerald-400"
                                      : "bg-rose-500/20 text-rose-400"
                                  }`}
                                >
                                  {t.direction}
                                </span>
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                    pnl > 0
                                      ? "bg-emerald-500 text-white"
                                      : pnl < 0
                                        ? "bg-rose-500 text-white"
                                        : "bg-slate-600 text-slate-300"
                                  }`}
                                >
                                  {pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "BE"}
                                </span>
                                {t.session && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                    {t.session}
                                  </span>
                                )}
                                {t.setup_type && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                                    {t.setup_type}
                                  </span>
                                )}
                                {t.bias && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
                                    {t.bias}
                                  </span>
                                )}
                                {t.emotion && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                                    {t.emotion}
                                  </span>
                                )}
                                {time && (
                                  <span className="text-xs text-slate-500 ml-auto">
                                    {time}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 mt-3 text-sm text-slate-400">
                                <span>
                                  Entry:{" "}
                                  <b className="text-slate-200">
                                    {t.entry || "-"}
                                  </b>
                                </span>
                                <span>
                                  SL:{" "}
                                  <b className="text-slate-200">{t.sl || "-"}</b>
                                </span>
                                <span>
                                  TP:{" "}
                                  <b className="text-slate-200">{t.tp || "-"}</b>
                                </span>
                                <span>
                                  Lot:{" "}
                                  <b className="text-slate-200">{t.lot || "-"}</b>
                                </span>
                                <span>
                                  RR:{" "}
                                  <b className="text-slate-200">{t.rr || "-"}</b>
                                </span>
                                <span>
                                  Strategy:{" "}
                                  <b className="text-slate-200">
                                    {t.strategy || "-"}
                                  </b>
                                </span>
                                <span>
                                  PnL:{" "}
                                  <b
                                    className={
                                      isWin
                                        ? "text-emerald-400"
                                        : pnl < 0
                                          ? "text-rose-400"
                                          : "text-slate-200"
                                    }
                                  >
                                    {formatIDR(pnl)}
                                  </b>
                                </span>
                              </div>

                              {t.checklist &&
                                Object.keys(t.checklist).length > 0 && (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {CHECKLIST_ITEMS.map((item) => (
                                      <span
                                        key={item.key}
                                        title={item.label}
                                        className={`text-xs px-2 py-0.5 rounded-full ${
                                          t.checklist[item.key]
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : "bg-slate-800 text-slate-500 line-through"
                                        }`}
                                      >
                                        {item.key}
                                      </span>
                                    ))}
                                  </div>
                                )}

                              {t.notes && (
                                <p className="mt-3 text-sm text-slate-300 bg-slate-800/50 p-3 rounded-lg border border-slate-800">
                                  {t.notes}
                                </p>
                              )}
                              {t.image_url && (
                                <a
                                  href={t.image_url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <img
                                    src={t.image_url}
                                    className="mt-3 rounded-xl max-h-72 border border-slate-700 hover:opacity-90 transition"
                                  />
                                </a>
                              )}
                            </div>

                            <div className="flex flex-col gap-1.5">
                              <button
                                onClick={() => startEdit(t)}
                                className="w-8 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 transition flex items-center justify-center"
                                title="Edit trade"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(t.id)}
                                className="w-8 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 transition flex items-center justify-center"
                                title="Hapus trade"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL EDIT — langsung dari histori */}
        {modalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) resetForm();
            }}
          >
            <div className="relative w-full max-w-3xl bg-[#0b1220] border border-slate-800 rounded-2xl shadow-2xl my-6 flex flex-col max-h-[calc(100vh-3rem)]">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-800 shrink-0">
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">Edit Trade</h2>
                  <p className="text-xs text-slate-500">
                    Perbarui detail trade langsung dari histori
                  </p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="w-8 h-8 rounded-lg border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 transition flex items-center justify-center"
                  title="Tutup (Esc)"
                >
                  ✕
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-5">{formContent}</div>
            </div>
          </div>
        )}

        {/* MODAL KONFIRMASI HAPUS */}
        {deleteTarget && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setDeleteTarget(null);
            }}
          >
            <div className="w-full max-w-sm bg-[#0b1220] border border-slate-800 rounded-2xl shadow-2xl p-6 text-center">
            
              <h3 className="font-semibold text-white">Hapus trade ini?</h3>
              <p className="text-xs text-slate-500 mt-1 mb-5">
                Data yang dihapus tidak bisa dikembalikan.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-rose-500 hover:bg-rose-400 text-white shadow-lg shadow-rose-500/20 transition"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="mt-10 text-center text-xs text-slate-600">
          Trading Journal — disiplin adalah edge sejati
        </footer>
      </div>
    </main>
  );
}

/* ============================== sub-komponen UI ============================== */

const inputCls =
  "w-full bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition";
const labelCls =
  "block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5 font-medium";

function Field({ label, children }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mt-6 mb-3 first:mt-0">
      {children}
    </h3>
  );
}

function Card({ title, subtitle, action, children, className = "" }) {
  return (
    <section
      className={`bg-slate-900/60 backdrop-blur border border-slate-800 rounded-2xl p-5 shadow-lg ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function StatCard({ label, value, sub, tone = "neutral", small = false }) {
  const tones = {
    up: "text-emerald-400",
    down: "text-rose-400",
    neutral: "text-white",
  };
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg">
      <p className="text-[11px] uppercase tracking-wider text-slate-500 font-medium">
        {label}
      </p>
      <p
        className={`font-bold mt-1.5 ${small ? "text-lg" : "text-2xl"} ${
          tones[tone]
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function EmptyNote({ text }) {
  return (
    <div className="py-10 text-center text-slate-600 text-sm">{text}</div>
  );
}

/* ============================== grafik (SVG murni) ============================== */

function EquityChart({ data }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const W = 1000, H = 300, PL = 64, PR = 20, PT = 20, PB = 32;

  if (!data || data.length === 0) {
    return <EmptyNote text="Belum ada data untuk ditampilkan" />;
  }

  const values = data.map((d) => d.cum);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (min === max) max = min + 1;
  const range = max - min;
  const n = data.length;

  const ix = (i) =>
    PL + (n === 1 ? (W - PL - PR) / 2 : (i / (n - 1)) * (W - PL - PR));
  const y = (v) => PT + (1 - (v - min) / range) * (H - PT - PB);

  const line = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${ix(i).toFixed(1)},${y(d.cum).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${ix(n - 1).toFixed(1)},${y(0).toFixed(1)} L${ix(0).toFixed(1)},${y(0).toFixed(1)} Z`;
  const ticks = [0, 1, 2, 3, 4].map((i) => min + (range * i) / 4);

  const onMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    let idx = Math.round(((mx - PL) / (W - PL - PR)) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));
    setHover(idx);
  };

  const hd = hover != null ? data[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="eqArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PL}
              x2={W - PR}
              y1={y(t)}
              y2={y(t)}
              stroke="#1e293b"
              strokeWidth="1"
            />
            <text x={PL - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="#64748b">
              {fmtShort(t)}
            </text>
          </g>
        ))}

        <line
          x1={PL}
          x2={W - PR}
          y1={y(0)}
          y2={y(0)}
          stroke="#334155"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />

        <path d={area} fill="url(#eqArea)" />
        <path
          d={line}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {n > 1 &&
          data.map((d, i) =>
            i === 0 || i === n - 1 ? (
              <circle
                key={i}
                cx={ix(i)}
                cy={y(d.cum)}
                r="4"
                fill="#22d3ee"
                stroke="#070b14"
                strokeWidth="2"
              />
            ) : null,
          )}

        {hd && (
          <g>
            <line
              x1={ix(hover)}
              x2={ix(hover)}
              y1={PT}
              y2={H - PB}
              stroke="#475569"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={ix(hover)}
              cy={y(hd.cum)}
              r="5"
              fill={hd.cum >= 0 ? "#34d399" : "#fb7185"}
              stroke="#070b14"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {hd && (
        <div className="absolute top-2 right-2 bg-slate-800/90 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl pointer-events-none">
          <p className="text-slate-400">
            {new Date(hd.date).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            • trade #{hover + 1}
          </p>
          <p
            className={`font-bold text-sm ${
              hd.cum >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatIDR(hd.cum)}
          </p>
        </div>
      )}
    </div>
  );
}

function DonutChart({ segments, size = 190, thickness = 24, centerValue, centerLabel }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#1e293b"
            strokeWidth={thickness}
          />
          {total > 0 &&
            segments.map((s, i) => {
              const len = (s.value / total) * C;
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${C - len}`}
                  strokeDashoffset={-acc}
                />
              );
              acc += len;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{centerValue}</span>
          <span className="text-xs text-slate-500">{centerLabel}</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: s.color }}
            />
            <span className="text-slate-400">{s.label}</span>
            <span className="font-semibold text-slate-200">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HBarChart({ data, emptyText = "Tidak ada data" }) {
  if (!data || data.length === 0) return <EmptyNote text={emptyText} />;
  const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  return (
    <div className="space-y-3 py-1">
      {data.map((d) => {
        const pct = (Math.abs(d.value) / maxAbs) * 50;
        const pos = d.value >= 0;
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-xs text-slate-400 truncate text-right">
              {d.label}
            </span>
            <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className={`absolute top-0 h-full rounded-full ${
                  pos ? "left-1/2" : "right-1/2"
                }`}
                style={{
                  width: `${pct}%`,
                  background: pos
                    ? "linear-gradient(90deg,#0ea5e9,#22d3ee)"
                    : "linear-gradient(90deg,#fb7185,#f43f5e)",
                }}
              />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600" />
            </div>
            <span
              className={`w-24 shrink-0 text-xs font-semibold ${
                pos ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {formatIDR(d.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ProgressRing({ value, size = 96, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#1e293b"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#22d3ee"
          strokeWidth={stroke}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - pct / 100)}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-white">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

function MiniCompare({ label, value, maxAbs }) {
  const pos = value >= 0;
  const pct = Math.min((Math.abs(value) / maxAbs) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-400">{label}</span>
        <span
          className={`text-xs font-bold ${
            pos ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {formatIDR(value)}
        </span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            pos ? "bg-emerald-500" : "bg-rose-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}