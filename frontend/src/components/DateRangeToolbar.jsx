import React from "react";
import { Calendar } from "lucide-react";
import ThemeDatePicker from "./ThemeDatePicker";

/**
 * Unified date-range selector used across all /dashboard/* analytics pages.
 * preset: "today" | "week" | "month" | "custom"
 * from / to: "YYYY-MM-DD"
 */
export function computeRange(preset, from, to) {
  const today = new Date();
  const fmt = (d) => d.toISOString().split("T")[0];
  if (preset === "today") {
    const s = fmt(today);
    return { from: s, to: s };
  }
  if (preset === "week") {
    const d = new Date(today); d.setDate(d.getDate() - 6);
    return { from: fmt(d), to: fmt(today) };
  }
  if (preset === "month") {
    return { from: fmt(today).slice(0, 8) + "01", to: fmt(today) };
  }
  return { from, to };
}

const TABS = [
  { key: "today", label: "Today" },
  { key: "week",  label: "7 Days" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

export default function DateRangeToolbar({ preset, from, to, onChange }) {
  const set = (p, f = from, t = to) => {
    if (p !== "custom") {
      const r = computeRange(p);
      onChange({ preset: p, from: r.from, to: r.to });
    } else {
      onChange({ preset: "custom", from: f, to: t });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex bg-white rounded-xl border border-amber-900/10 p-1 shadow-[0_2px_8px_rgba(44,36,27,0.04)]">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => set(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              preset === t.key ? "bg-[#8B5A2B] text-white shadow-sm" : "text-[#5C4F43] hover:text-[#8B5A2B]"
            }`}
            data-testid={`range-${t.key}`}>
            {t.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <ThemeDatePicker value={from} onChange={(v) => set("custom", v, to)} testid="range-from" />
          <span className="text-xs text-[#8A7D71]">→</span>
          <ThemeDatePicker value={to} onChange={(v) => set("custom", from, v)} testid="range-to" />
        </div>
      )}
    </div>
  );
}
