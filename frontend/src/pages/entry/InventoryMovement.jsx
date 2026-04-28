import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, BarChart3, Search } from "lucide-react";
import * as XLSX from "xlsx";

function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtCell(v) {
  if (v === null || v === undefined || v === "") return "";
  // Keep up to 3 decimals, strip trailing zeros
  return Number(v).toFixed(3).replace(/\.?0+$/, "");
}

const FIELD_LABELS = { opening: "OPEN", new_received: "NEW", used: "USED", closing: "CLOSE" };

export default function InventoryMovement() {
  const [month, setMonth] = useState(todayMonth());
  const [grid, setGrid] = useState({ dates: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("All");
  const saveTimers = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/inventory-movements?month=${month}`);
      setGrid(data);
    } catch {
      toast.error("Failed to load inventory movements");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const sections = useMemo(() => {
    const s = new Set(["All"]);
    grid.rows?.forEach((r) => s.add(r.item.section || "Other"));
    return Array.from(s);
  }, [grid.rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (grid.rows || []).filter((r) => {
      if (section !== "All" && (r.item.section || "Other") !== section) return false;
      if (q && !r.item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [grid.rows, search, section]);

  const updateCell = (itemId, dateStr, field, rawValue) => {
    const value = rawValue === "" ? null : Number(rawValue);
    if (rawValue !== "" && Number.isNaN(value)) return;

    // Optimistic local update
    setGrid((prev) => {
      const next = { ...prev, rows: prev.rows.map((r) => {
        if (r.item.id !== itemId) return r;
        const days = r.days.map((d, idx, arr) => {
          if (d.date !== dateStr) return d;
          const updated = { ...d };
          if (field === "opening") updated.opening = value;
          else if (field === "new_received") updated.new_received = value;
          else if (field === "closing") updated.closing = value;
          // Recompute USED for this row
          if (updated.opening != null && updated.closing != null) {
            updated.used = Number((updated.opening + (updated.new_received || 0) - updated.closing).toFixed(4));
          } else {
            updated.used = null;
          }
          return updated;
        });
        // Cascade carry-forward: subsequent days' opening = previous day's closing (unless seeded)
        for (let i = 0; i < days.length; i++) {
          if (i === 0) continue;
          const prev = days[i - 1];
          if (!days[i].has_seed) {
            const carry = prev.closing != null ? prev.closing : prev.opening;
            days[i] = { ...days[i], opening: carry };
            if (days[i].opening != null && days[i].closing != null) {
              days[i].used = Number((days[i].opening + (days[i].new_received || 0) - days[i].closing).toFixed(4));
            } else {
              days[i].used = null;
            }
          }
        }
        return { ...r, days };
      }) };
      return next;
    });

    // Debounced save
    const key = `${itemId}|${dateStr}|${field}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      try {
        await api.put("/inventory-movements/cell", {
          inventory_item_id: itemId,
          date: dateStr,
          field,
          value,
        });
      } catch (err) {
        toast.error(`Save failed: ${err.response?.data?.detail || "network"}`);
      }
    }, 400);
  };

  const downloadExcel = () => {
    if (!grid.rows || grid.rows.length === 0) { toast.error("Nothing to export"); return; }
    const dates = grid.dates;

    // Header row 1: blank S.NO., ITEMS, DETAILS + dates spanning 5 cols (OPEN/NEW/USED/RATE/CLOSE)
    const titleRow = [`${monthLabel(month).toUpperCase()} STOCK MANAGEMENT SYSTEM — BARISTA ITEMS`];
    const dateHeader = ["S.NO.", "ITEMS", "DETAILS"];
    const subHeader = ["", "", ""];
    dates.forEach((d) => {
      const [, mm, dd] = d.split("-");
      dateHeader.push(`${dd}.${mm}`, "", "", "", "");
      subHeader.push("OPEN", "NEW", "Used", "Rate", "CLOSE");
    });

    const dataRows = filteredRows.map((r, idx) => {
      const row = [idx + 1, r.item.name, r.item.unit];
      r.days.forEach((d) => {
        row.push(
          d.opening ?? "",
          d.new_received ?? "",
          d.used ?? "",
          "", // Rate column (blank, ignored)
          d.closing ?? "",
        );
      });
      return row;
    });

    const aoa = [titleRow, dateHeader, subHeader, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Merge title across all cols
    const totalCols = 3 + dates.length * 5;
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
      // Merge each date header across its 5 sub-columns
      ...dates.map((_, i) => ({
        s: { r: 1, c: 3 + i * 5 },
        e: { r: 1, c: 3 + i * 5 + 4 },
      })),
    ];

    // Reasonable column widths
    ws["!cols"] = [
      { wch: 6 }, { wch: 22 }, { wch: 10 },
      ...dates.flatMap(() => [{ wch: 7 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 7 }]),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, monthLabel(month));
    XLSX.writeFile(wb, `dejabrew-inventory-movement-${month}.xlsx`);
    toast.success("Excel downloaded");
  };

  const dates = grid.dates || [];

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
            Inventory Movement
          </h1>
          <p className="text-[#8A7D71] text-sm mt-1">
            Daily OPEN · NEW · USED · CLOSE per item · {monthLabel(month)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setMonth(shiftMonth(month, -1))}
            className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"
            data-testid="im-prev-month"><ChevronLeft size={16} /></button>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border border-amber-900/20 px-3 py-2 text-sm text-[#2C241B] focus:outline-none focus:border-[#8B5A2B]"
            data-testid="im-month-picker" />
          <button onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= todayMonth()}
            className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10 disabled:opacity-40"
            data-testid="im-next-month"><ChevronRight size={16} /></button>
          <button onClick={downloadExcel}
            className="flex items-center gap-2 ml-1 bg-[#3E5C46] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#2F4735]"
            data-testid="im-download-btn">
            <Download size={14} /> Download Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A7D71]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item..."
            className="w-full pl-9 pr-3 py-1.5 rounded-full bg-white border border-amber-900/20 text-xs focus:outline-none focus:border-[#8B5A2B]"
            data-testid="im-search" />
        </div>
        {sections.map((s) => (
          <button key={s} onClick={() => setSection(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              section === s ? "bg-[#8B5A2B] text-white" : "bg-white border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"
            }`}
            data-testid={`im-section-${s.toLowerCase()}`}>{s}</button>
        ))}
        <span className="text-[10px] text-[#8A7D71] ml-2">
          {filteredRows.length} item{filteredRows.length !== 1 ? "s" : ""} · {dates.length} day{dates.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)] overflow-hidden">
        {loading ? (
          <div className="text-center text-[#8A7D71] py-16">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 size={36} className="text-[#C9B99A] mx-auto mb-2" />
            <p className="text-[#8A7D71] text-sm">No items match your filter</p>
          </div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
            <table className="text-xs border-collapse" data-testid="im-grid">
              <thead className="sticky top-0 z-20">
                {/* Date header */}
                <tr>
                  <th className="sticky left-0 z-30 bg-[#F6F3EC] border-b border-r border-amber-900/15 px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[#8A7D71]" style={{ minWidth: 60 }}>S.NO.</th>
                  <th className="sticky left-[60px] z-30 bg-[#F6F3EC] border-b border-r border-amber-900/15 px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[#8A7D71]" style={{ minWidth: 180 }}>Item</th>
                  <th className="sticky left-[240px] z-30 bg-[#F6F3EC] border-b border-r border-amber-900/15 px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[#8A7D71]" style={{ minWidth: 70 }}>Unit</th>
                  {dates.map((d) => {
                    const [, mm, dd] = d.split("-");
                    return (
                      <th key={d} colSpan={4} className="bg-[#F6F3EC] border-b border-r border-amber-900/15 px-2 py-2 text-center text-[10px] font-semibold text-[#2C241B]">
                        {dd}.{mm}
                      </th>
                    );
                  })}
                </tr>
                {/* Sub-header OPEN/NEW/USED/CLOSE */}
                <tr>
                  <th className="sticky left-0 z-30 bg-white border-b border-r border-amber-900/15" />
                  <th className="sticky left-[60px] z-30 bg-white border-b border-r border-amber-900/15" />
                  <th className="sticky left-[240px] z-30 bg-white border-b border-r border-amber-900/15" />
                  {dates.map((d) => (
                    <React.Fragment key={d}>
                      {["opening", "new_received", "used", "closing"].map((f) => (
                        <th key={f} className={`bg-white border-b border-amber-900/10 px-1.5 py-1 text-[9px] font-medium uppercase tracking-wider ${
                          f === "closing" ? "border-r border-amber-900/15" : ""
                        } ${f === "used" ? "text-[#8A7D71]" : "text-[#5C4F43]"}`}>
                          {FIELD_LABELS[f]}
                        </th>
                      ))}
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr key={row.item.id} className="hover:bg-[#F6F3EC]/40" data-testid={`im-row-${row.item.id}`}>
                    <td className="sticky left-0 z-10 bg-white border-b border-r border-amber-900/10 px-3 py-1.5 text-[#8A7D71] text-center">{idx + 1}</td>
                    <td className="sticky left-[60px] z-10 bg-white border-b border-r border-amber-900/10 px-3 py-1.5 font-medium text-[#2C241B]">{row.item.name}</td>
                    <td className="sticky left-[240px] z-10 bg-white border-b border-r border-amber-900/10 px-3 py-1.5 text-[#8A7D71]">{row.item.unit}</td>
                    {row.days.map((d) => (
                      <React.Fragment key={d.date}>
                        {/* OPEN — read-only display of carry, but allow seed override */}
                        <CellInput
                          value={d.opening}
                          editable
                          muted={!d.has_seed}
                          onChange={(v) => updateCell(row.item.id, d.date, "opening", v)}
                          testid={`im-${row.item.id}-${d.date}-open`}
                        />
                        <CellInput
                          value={d.new_received}
                          editable
                          onChange={(v) => updateCell(row.item.id, d.date, "new_received", v)}
                          testid={`im-${row.item.id}-${d.date}-new`}
                        />
                        {/* USED — derived */}
                        <td className="border-b border-amber-900/5 px-1 py-1 text-center text-[11px] text-[#B84B4B] bg-red-50/30">
                          {fmtCell(d.used)}
                        </td>
                        <CellInput
                          value={d.closing}
                          editable
                          rightBorder
                          onChange={(v) => updateCell(row.item.id, d.date, "closing", v)}
                          testid={`im-${row.item.id}-${d.date}-close`}
                        />
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[10px] text-[#8A7D71] mt-2 px-1">
        Tip: USED is auto-calculated (OPEN + NEW − CLOSE). OPEN auto-carries from the previous day's CLOSE; type a value to override (seed). Empty cells are saved as blank.
      </p>
    </div>
  );
}

function CellInput({ value, onChange, muted, rightBorder, testid }) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);

  return (
    <td className={`border-b border-amber-900/5 ${rightBorder ? "border-r border-amber-900/15" : ""} p-0`}>
      <input
        type="number"
        step="any"
        inputMode="decimal"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { if ((local === "" ? null : Number(local)) !== (value ?? null)) onChange(local); }}
        className={`w-full px-1 py-1 text-[11px] text-center bg-transparent border-0 outline-none focus:bg-[#FFF6E5] focus:ring-1 focus:ring-[#8B5A2B] ${
          muted ? "text-[#8A7D71]" : "text-[#2C241B]"
        }`}
        style={{ minWidth: 56 }}
        data-testid={testid}
      />
    </td>
  );
}
