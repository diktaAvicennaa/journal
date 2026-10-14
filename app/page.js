"use client";
import { useEffect, useState } from "react";
import {
  getTrades,
  addTrade,
  updateTrade,
  deleteTrade,
  uploadImage,
  compressImage,
} from "../lib/supabase";

function formatIDR(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
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
  if (str === "-") return "-";   // ← KUNCI: simpan tanda minus saja
  const isNegative = str.trim().startsWith("-");
  const digits = str.replace(/\D/g, "");
  if (!digits) return "";
  const num = Number(digits);
  return isNegative ? -num : num;
}
const CHECKLIST_ITEMS = [
  { key: "time", label: "Time Alignment — Sweep/Run di Killzone WIB" },
  {
    key: "structure",
    label: "Structure Bias — Bullish Sweep/Run Low / Bearish Sweep/Run High",
  },
  { key: "pdArray", label: "PD Array — Berhimpitan FVG / Order Block" },
  {
    key: "candle",
    label: "Candle Behavior — Wick Rejection / Trap 1-2 Candle",
  },
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

export default function Home() {
  const [trades, setTrades] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [checklist, setChecklist] = useState({});
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);

  async function load() {
    const data = await getTrades();
    setTrades(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    load();
  }, []);

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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      e.target.reset();
      await load();
    } catch (err) {
      alert("Gagal simpan: " + err.message);
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm("Hapus trade ini?")) return;
    await deleteTrade(id);
    load();
  }

  const filtered = trades.filter((t) => {
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

  const totalPnl = filtered.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const wins = filtered.filter((t) => Number(t.pnl) > 0).length;
  const winRate = filtered.length
    ? ((wins / filtered.length) * 100).toFixed(1)
    : 0;

  const checkedCount = Object.values(checklist).filter(Boolean).length;
  const allChecked = checkedCount === CHECKLIST_ITEMS.length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Trading Journal
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Catat, evaluasi, dan tingkatkan performa tradingmu
          </p>
        </header>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard
            label="Total PnL"
            value={formatIDR(totalPnl)}
            accent={totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}
          />
          <StatCard label="Total Trade" value={filtered.length} />
          <StatCard
            label="Win Rate"
            value={`${winRate}%`}
            accent="text-cyan-400"
          />
        </div>

        <form
          onSubmit={handleSubmit}
          className={`bg-slate-900/70 backdrop-blur border rounded-2xl p-6 mb-8 shadow-xl ${
            editingId ? "border-cyan-500/50" : "border-slate-800"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">
              {editingId ? " Edit Trade" : " Tambah Trade"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-400"
              >
                Batal Edit
              </button>
            )}
          </div>

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
                onChange={(e) => setForm({ ...form, session: e.target.value })}
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
                <option>B: Liquidity Sweep </option>
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

            <Field label="Entry">
              <input
                type="number"
                step="any"
                className={inputCls}
                value={form.entry}
                onChange={(e) => setForm({ ...form, entry: e.target.value })}
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

            <Field label="Risk : Reward">
              <input
                placeholder="1:2"
                className={inputCls}
                value={form.rr}
                onChange={(e) => setForm({ ...form, rr: e.target.value })}
              />
            </Field>

            <Field label="Strategy">
              <input
                placeholder="Breakout, OB, dll"
                className={inputCls}
                value={form.strategy}
                onChange={(e) => setForm({ ...form, strategy: e.target.value })}
              />
            </Field>

            <Field label="Emotion">
              <select
                className={inputCls}
                value={form.emotion}
                onChange={(e) => setForm({ ...form, emotion: e.target.value })}
              >
                <option>Neutral</option>
                <option>Confident</option>
                <option>Fear</option>
                <option>Greed</option>
                <option>Revenge</option>
                <option>FOMO</option>
              </select>
            </Field>
          </div>

          <div className="mt-3">
            <Field label="Notes">
              <textarea
                rows="3"
                placeholder="Alasan entry, kondisi market, dll..."
                className={inputCls}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>

          <div className="mt-4 bg-slate-800/40 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-200">
                Checklist SOP — Liquidity Sweep
              </h3>
              <span
                className={`text-xs font-bold ${
                  allChecked ? "text-emerald-400" : "text-slate-400"
                }`}
              >
                {checkedCount}/{CHECKLIST_ITEMS.length}
                {allChecked && " ✓ Setup valid"}
              </span>
            </div>
            <div className="space-y-2">
              {CHECKLIST_ITEMS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-2 cursor-pointer text-sm text-slate-300 hover:text-slate-100 transition"
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
                    className="mt-1 accent-cyan-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs text-slate-400 mb-1">
              Screenshot
            </label>

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
                className="flex-1 bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-cyan-500 transition min-h-[44px] flex items-center"
              >
                {uploadingImg ? (
                  <span className="text-cyan-400 animate-pulse">
                    ⏳ Memproses gambar...
                  </span>
                ) : preview || existingImageUrl ? (
                  <div className="flex items-center gap-2 w-full">
                    <img
                      src={preview || existingImageUrl}
                      className="h-10 rounded border border-slate-600"
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
                      ✕
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-500 italic">paste gambar...</span>
                )}
              </div>

              <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-4 flex items-center text-sm text-slate-200 transition">
                📎 Pilih File
                <input
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <p className="text-xs text-slate-500 mt-1">
              Auto-compress ke JPEG 82% • max 1400px
            </p>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold transition"
              >
                Batal
              </button>
            )}
            <button
              disabled={loading || uploadingImg}
              className={`font-semibold px-6 py-2 rounded-lg shadow-lg transition disabled:opacity-50 text-white ${
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

        {/* FILTER */}
        <div className="bg-slate-900/70 backdrop-blur border border-slate-800 rounded-2xl p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Hasil</label>
              <div className="flex gap-2">
                {["ALL", "WIN", "LOSS"].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1.5 rounded-full text-sm border transition ${
                      filter === f
                        ? "bg-cyan-500 text-white border-cyan-500"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex gap-2">
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
                }}
                className="px-3 py-2 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 transition text-rose-400"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* HISTORY LIST */}
        <div className="space-y-6">
          {filtered.length === 0 && (
            <p className="text-center text-slate-500 py-10">
              Belum ada trade. Yuk mulai catat!
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
            const dayPnl = items.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
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
                      {dayPnl >= 0 ? "+" : ""}
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
                        className={`bg-slate-900/70 backdrop-blur border rounded-2xl p-5 shadow-lg hover:border-slate-700 transition ${
                          editingId === t.id
                            ? "border-cyan-500/50"
                            : "border-slate-800"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-lg">
                                {t.pair}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
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
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                                  {t.session}
                                </span>
                              )}
                              {t.setup_type && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                                  {t.setup_type}
                                </span>
                              )}
                              {t.emotion && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                                  {t.emotion}
                                </span>
                              )}
                              {time && (
                                <span className="text-xs text-slate-500 ml-auto">
                                  🕐 {time}
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
                                          : "bg-slate-700 text-slate-500 line-through"
                                      }`}
                                    >
                                      {item.key}
                                    </span>
                                  ))}
                                </div>
                              )}

                            {t.notes && (
                              <p className="mt-3 text-sm text-slate-300 bg-slate-800/50 p-3 rounded-lg">
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
                                  className="mt-3 rounded-lg max-h-72 border border-slate-700 hover:opacity-90 transition"
                                />
                              </a>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => startEdit(t)}
                              className="text-slate-500 hover:text-cyan-400 text-sm transition"
                              title="Edit trade"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="text-slate-500 hover:text-rose-400 text-sm transition"
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
      </div>
    </main>
  );
}

const inputCls =
  "w-full bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition";

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, accent = "text-slate-100" }) {
  return (
    <div className="bg-slate-900/70 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-lg">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}
