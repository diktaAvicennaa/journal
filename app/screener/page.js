"use client";
import { useEffect, useState } from "react";
import MiniChart from "@/components/MiniChart";

export default function ScreenerPage() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [countdown, setCountdown] = useState(30);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [loadingCountdown, setLoadingCountdown] = useState(0);
  const [selectedCoin, setSelectedCoin] = useState(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    setLoadingCountdown(15);

    const loadingTimer = setInterval(() => {
      setLoadingCountdown((c) => {
        if (c <= 1) {
          clearInterval(loadingTimer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    try {
      const res = await fetch("/api/screener?limit=12");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setCoins(data.results || []);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e.message);
    }

    clearInterval(loadingTimer);
    setLoading(false);
    setLoadingCountdown(0);
    setCountdown(30);
  }

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          fetchData();
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const filtered =
    filter === "ALL" ? coins : coins.filter((c) => c.verdict === filter);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              🐢 Turtle Soup Screener
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Deteksi liquidity sweep + wick rejection di H1 • Top volume USDT
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter */}
            <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-full p-1">
              {["ALL", "SWEEP", "WATCH"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full transition ${
                    filter === f
                      ? "bg-cyan-500 text-black font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Auto refresh */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                autoRefresh
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                  : "bg-slate-800 border-slate-700 text-slate-400"
              }`}
            >
              {autoRefresh ? `🟢 Live • ${countdown}s` : "⏸️ Paused"}
            </button>
          </div>
        </div>

        {/* Status bar */}
        {lastUpdate && (
          <p className="text-xs text-slate-500 mb-4">
            Update terakhir: {lastUpdate.toLocaleTimeString("id-ID")} •{" "}
            {coins.length} pair dianalisis
            {loading && (
              <span className="text-cyan-400 ml-2">
                ⏳ Refresh... {loadingCountdown}s
              </span>
            )}
          </p>
        )}

        {/* Loading awal */}
        {loading && coins.length === 0 && (
          <div className="text-center py-10">
            <div className="text-cyan-400 text-lg mb-2">⏳ Memuat data...</div>
            <div className="text-slate-400 text-sm mb-4">
              Estimasi: {loadingCountdown} detik lagi
            </div>
            <div className="max-w-md mx-auto bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-1000"
                style={{ width: `${((15 - loadingCountdown) / 15) * 100}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-rose-400 text-center py-4">❌ {error}</p>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((coin, i) => {
            const verdictColor =
              coin.verdict === "SWEEP"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                : coin.verdict === "WATCH"
                ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                : "bg-slate-800 text-slate-500 border-slate-700";

            const dirColor =
              coin.sweep?.direction === "BULLISH"
                ? "text-emerald-400"
                : coin.sweep?.direction === "BEARISH"
                ? "text-rose-400"
                : "text-slate-500";

            return (
              <div
                key={`${coin.symbol}-${coin.chain}-${i}`}
                className="bg-slate-900/70 backdrop-blur border border-slate-800 rounded-2xl p-4 hover:border-slate-600 transition flex flex-col"
              >
                {/* Header card */}
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">
                        {coin.symbol.replace("USDT", "")}
                      </span>
                      <span className="text-xs text-slate-500">/USDT</span>
                      {coin.chain && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          {coin.chain}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-400 mt-0.5">
                      ${coin.price.toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                      })}
                      <span
                        className={`ml-2 ${
                          coin.priceChange >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {coin.priceChange >= 0 ? "+" : ""}
                        {coin.priceChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-xs px-2 py-1 rounded-full border font-semibold ${verdictColor}`}
                  >
                    {coin.verdict}
                  </span>
                </div>

                {/* Mini chart */}
                <div className="bg-slate-950/50 rounded-lg mb-3 overflow-hidden">
                  <MiniChart candles={coin.candles} />
                </div>

                {/* Detail */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex flex-col gap-1">
                    <span className={`font-semibold ${dirColor}`}>
                      {coin.sweep?.sweptType || "NO SETUP"}
                    </span>
                    {coin.sweep?.level && (
                      <span className="text-slate-500">
                        Level: $
                        {coin.sweep.level.toLocaleString(undefined, {
                          maximumFractionDigits: 6,
                        })}
                      </span>
                    )}
                  </div>

                  {/* Skor — bisa diklik */}
                  <button
                    onClick={() => setSelectedCoin(coin)}
                    className="text-right cursor-pointer hover:opacity-80 transition group"
                  >
                    <div className="text-xl font-bold text-cyan-400 group-hover:text-cyan-300">
                      {coin.score}
                      <span className="text-xs text-slate-500">/5</span>
                    </div>
                    {coin.sweep?.wickRatio > 0 && (
                      <span className="text-slate-500">
                        Wick {(coin.sweep.wickRatio * 100).toFixed(0)}%
                      </span>
                    )}
                    <div className="text-[10px] text-cyan-500 mt-0.5 opacity-0 group-hover:opacity-100 transition">
                      Klik detail →
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && !loading && (
          <p className="text-slate-500 text-center py-10">
            Gak ada setup {filter !== "ALL" ? filter : ""} saat ini.
          </p>
        )}
      </div>

      {/* Modal Detail Skor */}
      {selectedCoin && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedCoin(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xl font-bold">
                  {selectedCoin.symbol.replace("USDT", "")}
                  <span className="text-xs text-slate-500 ml-1">/USDT</span>
                </div>
                <div className="text-xs text-slate-500">
                  {selectedCoin.chain}
                </div>
              </div>
              <button
                onClick={() => setSelectedCoin(null)}
                className="text-slate-400 hover:text-slate-200 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Skor total */}
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-cyan-400">
                {selectedCoin.score}
                <span className="text-lg text-slate-500">/5</span>
              </div>
              <div className="text-sm text-slate-400 mt-1">
                Verdict:{" "}
                <span
                  className={
                    selectedCoin.verdict === "SWEEP"
                      ? "text-emerald-400"
                      : selectedCoin.verdict === "WATCH"
                      ? "text-amber-400"
                      : "text-slate-500"
                  }
                >
                  {selectedCoin.verdict}
                </span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="space-y-2">
              {selectedCoin.sweep?.breakdown ? (
                Object.entries(selectedCoin.sweep.breakdown).map(
                  ([key, item]) => (
                    <div
                      key={key}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        item.passed
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "bg-slate-800/50 border-slate-700"
                      }`}
                    >
                      <div className="text-lg">{item.passed ? "✅" : "❌"}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">
                            {item.label}
                          </span>
                          <span
                            className={`text-xs font-bold ${
                              item.passed
                                ? "text-emerald-400"
                                : "text-slate-500"
                            }`}
                          >
                            {item.points}/{item.max}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  )
                )
              ) : (
                <p className="text-slate-500 text-sm text-center py-4">
                  Belum ada data sweep untuk coin ini.
                </p>
              )}
            </div>

            {/* Info tambahan */}
            <div className="mt-4 pt-4 border-t border-slate-800 text-xs text-slate-500 space-y-1">
              <div>
                Harga:{" "}
                <span className="text-slate-300">
                  $
                  {selectedCoin.price.toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}
                </span>
              </div>
              {selectedCoin.sweep?.level && (
                <div>
                  Level:{" "}
                  <span className="text-slate-300">
                    $
                    {selectedCoin.sweep.level.toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}
                  </span>
                </div>
              )}
              {selectedCoin.sweep?.wickRatio > 0 && (
                <div>
                  Wick ratio:{" "}
                  <span className="text-slate-300">
                    {(selectedCoin.sweep.wickRatio * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}