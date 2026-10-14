"use client";
import { createChart, CandlestickSeries } from "lightweight-charts";
import { useEffect, useRef } from "react";

export default function MiniChart({ candles }) {
  const ref = useRef();
  const chartRef = useRef();

  useEffect(() => {
    if (!ref.current || !candles?.length) return;

    const chart = createChart(ref.current, {
      width: ref.current.clientWidth,
      height: 90,
      layout: {
        background: { color: "transparent" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: { mode: 0 },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
      borderVisible: false,
    });

    series.setData(
      candles.map((c) => ({
        time: Math.floor(c.t / 1000),
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
      }))
    );

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const handleResize = () => {
      if (ref.current) {
        chart.applyOptions({ width: ref.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [candles]);

  return <div ref={ref} className="w-full h-[90px]" />;
}