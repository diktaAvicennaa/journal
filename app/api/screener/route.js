import { NextResponse } from "next/server";

const BASE_URL = "https://api.dexpaprika.com";
const API_KEY = process.env.DEXPAPRIKA_API_KEY || "";
const headers = API_KEY ? { Authorization: API_KEY } : {};

// ============================================================
// KONFIGURASI
// ============================================================
const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 4000; // naikin jadi 4 detik (karena request nambah)
const DEFAULT_LIMIT = 12;    // turunin ke 12 token biar gak kena rate limit

// ============================================================
// 1. AMBIL TOP TOKEN BERDASARKAN VOLUME
// ============================================================
async function getTopVolumeTokens(limit) {
  const url = `${BASE_URL}/tokens/search?volume_usd_24h_min=500000&liquidity_usd_min=100000&order_by=volume_usd_24h&sort=desc&limit=${limit}`;
  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: 120 },
    });
    if (!res.ok) {
      console.log(">>> DexPaprika tokens failed:", res.status);
      return [];
    }
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];

    return data.results.map((t) => ({
      address: t.address,
      symbol: t.symbol || null,
      name: t.name || null,
      chain: t.chain,
      price: t.price_usd || 0,
      volume24h: t.volume_usd_24h || 0,
      liquidity: t.liquidity_usd || 0,
      priceChange24h: t.price_change_percentage_24h || 0,
    }));
  } catch (err) {
    console.log(">>> getTopVolumeTokens error:", err.message);
    return [];
  }
}

// ============================================================
// 2. FETCH TOKEN DETAIL (buat dapetin symbol & name)
// ============================================================
async function fetchTokenDetail(chain, address) {
  const url = `${BASE_URL}/networks/${chain}/tokens/${address}`;
  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      console.log(`>>> token detail ${chain} failed:`, res.status);
      return null;
    }
    const data = await res.json();
    return {
      symbol: data.symbol || null,
      name: data.name || null,
    };
  } catch (err) {
    console.log(`>>> token detail ${chain} error:`, err.message);
    return null;
  }
}

// ============================================================
// 3. FETCH OHLCV
// ============================================================
async function fetchOhlcv(chain, tokenAddress) {
  const poolsUrl = `${BASE_URL}/networks/${chain}/pools/search?token_address=${tokenAddress}&order_by=volume_usd_24h&sort=desc&limit=1`;

  try {
    const poolRes = await fetch(poolsUrl, {
      headers,
      next: { revalidate: 120 },
    });
    if (!poolRes.ok) {
      console.log(`>>> ${chain} pools failed:`, poolRes.status);
      return null;
    }
    const poolData = await poolRes.json();
    const pool = poolData.results?.[0];
    if (!pool || !pool.id) return null;

    const ohlcvUrl = `${BASE_URL}/networks/${chain}/pools/${pool.id}/ohlcv?start=-24h&interval=1h&limit=24`;
    const ohlcvRes = await fetch(ohlcvUrl, {
      headers,
      next: { revalidate: 120 },
    });
    if (!ohlcvRes.ok) {
      console.log(`>>> ${chain} ohlcv failed:`, ohlcvRes.status);
      return null;
    }
    const candles = await ohlcvRes.json();
    if (!Array.isArray(candles)) return null;

    return candles.map((c) => ({
      t: new Date(c.time_open).getTime(),
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
      v: c.volume || 0,
    }));
  } catch (err) {
    console.log(`>>> ${chain} error:`, err.message);
    return null;
  }
}

// ============================================================
// 4. DETEKSI SWEEP
// ============================================================
function detectSweep(candles) {
  if (!candles || candles.length < 10) return null;

  const lookback = candles.slice(0, -1);
  const prevHigh = Math.max(...lookback.map((c) => c.h));
  const prevLow = Math.min(...lookback.map((c) => c.l));

  const last = candles[candles.length - 1];

  const sweptHigh = last.h > prevHigh && last.c < prevHigh;
  const sweptLow = last.l < prevLow && last.c > prevLow;

  const body = Math.abs(last.c - last.o);
  const range = last.h - last.l;
  const wickRatio = range > 0 ? 1 - body / range : 0;
  const wick50 = wickRatio > 0.5;
  const wick70 = wickRatio > 0.7;

  const breakdown = {
    sweep: {
      label: "Liquidity Sweep",
      desc: sweptHigh
        ? "High ditembus, candle tutup balik ke range"
        : sweptLow
        ? "Low ditembus, candle tutup balik ke range"
        : "Belum ada sweep di level likuiditas",
      points: sweptHigh || sweptLow ? 3 : 0,
      max: 3,
      passed: sweptHigh || sweptLow,
    },
    wick50: {
      label: "Wick Rejection > 50%",
      desc: "Ekor candle lebih dari 50% dari total range",
      points: wick50 ? 1 : 0,
      max: 1,
      passed: wick50,
    },
    wick70: {
      label: "Wick Rejection > 70%",
      desc: "Ekor candle sangat dominan (sinyal reversal kuat)",
      points: wick70 ? 1 : 0,
      max: 1,
      passed: wick70,
    },
  };

  let totalScore = 0;
  for (const k in breakdown) totalScore += breakdown[k].points;

  // Kalau gak ada sweep beneran, return null (gak muncul di list)
  if (!sweptHigh && !sweptLow) return null;

  return {
    direction: sweptHigh ? "BEARISH" : "BULLISH",
    sweptType: sweptHigh ? "SWEEP HIGH" : "SWEEP LOW",
    level: sweptHigh ? prevHigh : prevLow,
    wickRatio,
    score: totalScore,
    breakdown,
  };
}
// ============================================================
// 5. SLEEP HELPER
// ============================================================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// 6. PROSES 1 TOKEN (detail + ohlcv)
// ============================================================
async function processToken(token) {
  // Fetch detail token buat dapetin symbol & name
  let symbol = token.symbol;
  let name = token.name;

  if (!symbol || !name) {
    const detail = await fetchTokenDetail(token.chain, token.address);
    if (detail) {
      symbol = detail.symbol || token.address.slice(0, 6);
      name = detail.name || "Unknown";
    } else {
      // Fallback kalau detail gagal
      symbol = token.address.slice(0, 6);
      name = "Unknown";
    }
  }

  // Fetch OHLCV
  const candles = await fetchOhlcv(token.chain, token.address);
  if (!candles || candles.length <= 5) return null;

  const sweep = detectSweep(candles);
  const lastCandle = candles[candles.length - 1];

  return {
    symbol,
    name,
    chain: token.chain,
    price: lastCandle.c,
    priceChange: token.priceChange24h,
    volume24h: token.volume24h,
    liquidity: token.liquidity,
    candles: candles.slice(-50),
    sweep,
    score: sweep?.score || 0,
    verdict:
      sweep?.score >= 4 ? "SWEEP" : sweep?.score >= 2 ? "WATCH" : "SKIP",
  };
}

// ============================================================
// 7. GET HANDLER
// ============================================================
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Number(searchParams.get("limit") || DEFAULT_LIMIT),
      20
    );

    console.log(">>> API KEY:", API_KEY ? "YES" : "NO (keyless)");
    console.log(">>> limit:", limit);

    const tokens = await getTopVolumeTokens(limit);
    console.log(">>> tokens fetched:", tokens.length);

    if (tokens.length === 0) {
      return NextResponse.json(
        { results: [], error: "Gagal ambil data dari DexPaprika." },
        { status: 200 }
      );
    }

    const results = [];

    // Batch paralel
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      console.log(
        `>>> batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch
          .map((t) => t.symbol || t.address.slice(0, 6))
          .join(", ")}`
      );

      const batchResults = await Promise.all(
        batch.map((token) => processToken(token))
      );

      results.push(...batchResults.filter(Boolean));

      if (i + BATCH_SIZE < tokens.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    results.sort((a, b) => b.score - a.score);
    console.log(">>> results:", results.length);

    return NextResponse.json({ results });
  } catch (err) {
    console.log(">>> GET error:", err.message);
    return NextResponse.json(
      { results: [], error: err.message },
      { status: 500 }
    );
  }
}