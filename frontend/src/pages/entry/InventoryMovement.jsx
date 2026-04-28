import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import api from "../../utils/api";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Download, BarChart3, Search, X, Grid3x3, Coffee } from "lucide-react";
import * as XLSX from "xlsx";
import { todayYMD, shiftYMD } from "../../utils/date";

// ───────── helpers ─────────
function fmtLongDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
}
function monthOf(ymd) { return ymd.slice(0, 7); }
function monthLabel(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
function shiftMonth(ym, delta) {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}
function fmtNum(v) {
  if (v === null || v === undefined || v === "") return "";
  return Number(v).toFixed(3).replace(/\.?0+$/, "");
}

// ───────── main page ─────────
export default function InventoryMovement() {
  const [date, setDate] = useState(todayYMD());
  const [data, setData] = useState({ rows: [] }); // month grid for current month
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("All");
  const [showMonthModal, setShowMonthModal] = useState(false);
  const saveTimers = useRef({});

  const month = monthOf(date);
  const today = todayYMD();

  const load = useCallback(async (m) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/inventory-movements?month=${m}`);
      setData(data);
    } catch {
      toast.error("Failed to load inventory movements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(month); }, [load, month]);

  const sections = useMemo(() => {
    const s = new Set(["All"]);
    data.rows?.forEach((r) => s.add(r.item.section || "Other"));
    return Array.from(s);
  }, [data.rows]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data.rows || [])
      .map((r) => {
        const day = r.days?.find((d) => d.date === date);
        return { item: r.item, day: day || { date, opening: null, new_received: null, used: null, closing: null, has_seed: false } };
      })
      .filter((r) => {
        if (section !== "All" && (r.item.section || "Other") !== section) return false;
        if (q && !r.item.name.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [data.rows, date, search, section]);

  // Apply edit to local state + cascade carry-forward + persist (debounced)
  const updateCell = (itemId, field, rawValue) => {
    const value = rawValue === "" ? null : Number(rawValue);
    if (rawValue !== "" && Number.isNaN(value)) return;

    setData((prev) => {
      const rows = prev.rows.map((r) => {
        if (r.item.id !== itemId) return r;
        const days = r.days.map((d) => {
          if (d.date !== date) return d;
          const u = { ...d };
          if (field === "opening") u.opening = value;
          else if (field === "new_received") u.new_received = value;
          else if (field === "closing") u.closing = value;
          if (u.opening != null && u.closing != null) {
            u.used = Number((u.opening + (u.new_received || 0) - u.closing).toFixed(4));
          } else { u.used = null; }
          if (field === "opening") u.has_seed = value != null;
          return u;
        });
        // Cascade carry-forward to subsequent days
        for (let i = 1; i < days.length; i++) {
          if (days[i].has_seed) continue;
          const prevD = days[i - 1];
          const carry = prevD.closing != null ? prevD.closing : prevD.opening;
          days[i] = { ...days[i], opening: carry };
          if (days[i].opening != null && days[i].closing != null) {
            days[i].used = Number((days[i].opening + (days[i].new_received || 0) - days[i].closing).toFixed(4));
          } else {
            days[i].used = null;
          }
        }
        return { ...r, days };
      });
      return { ...prev, rows };
    });

    const key = `${itemId}|${date}|${field}`;
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      try {
        await api.put("/inventory-movements/cell", {
          inventory_item_id: itemId, date, field, value,
        });
      } catch (err) {
        toast.error(`Save failed: ${err.response?.data?.detail || "network"}`);
      }
    }, 400);
  };

  const isToday = date === today;
  const isFuture = date > today;

  return (
    <div style={{ fontFamily: "Figtree, sans-serif" }}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-3xl font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
            Inventory Movement
          </h1>
          <p className="text-[#8A7D71] text-sm mt-1">
            {fmtLongDate(date)} {isToday && <span className="text-[#3E5C46] font-medium">· Today</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setDate(shiftYMD(date, -1))}
            className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"
            data-testid="im-prev-day"><ChevronLeft size={16} /></button>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-xl border border-amber-900/20 px-3 py-2 text-sm text-[#2C241B] focus:outline-none focus:border-[#8B5A2B]"
            data-testid="im-date-picker" />
          <button onClick={() => setDate(shiftYMD(date, 1))}
            disabled={date >= today}
            className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10 disabled:opacity-40"
            data-testid="im-next-day"><ChevronRight size={16} /></button>
          <button onClick={() => setShowMonthModal(true)}
            className="flex items-center gap-2 ml-1 bg-[#8B5A2B] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#704822]"
            data-testid="im-view-month-btn">
            <Grid3x3 size={14} /> View Full Month
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A7D71]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item..."
            className="w-full pl-9 pr-3 py-1.5 rounded-full bg-white border border-amber-900/20 text-sm focus:outline-none focus:border-[#8B5A2B]"
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
          {visibleRows.length} item{visibleRows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Daily entry list */}
      <div className="bg-white rounded-2xl border border-amber-900/10 shadow-[0_4px_24px_rgba(44,36,27,0.04)]">
        {/* Column header */}
        <div className="grid grid-cols-[1fr_120px_120px_120px_120px] gap-2 px-5 py-3 border-b border-amber-900/10 bg-[#F6F3EC]/50 text-[10px] uppercase tracking-widest text-[#8A7D71] font-medium">
          <span>Item</span>
          <span className="text-center">Open</span>
          <span className="text-center">New</span>
          <span className="text-center">Used</span>
          <span className="text-center">Close</span>
        </div>

        {loading ? (
          <div className="text-center text-[#8A7D71] py-16">Loading...</div>
        ) : visibleRows.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 size={36} className="text-[#C9B99A] mx-auto mb-2" />
            <p className="text-[#8A7D71] text-sm">No items match your filter</p>
          </div>
        ) : (
          <div className="divide-y divide-amber-900/5">
            {visibleRows.map(({ item, day }) => (
              <DailyRow
                key={item.id}
                item={item}
                day={day}
                disabled={isFuture}
                onChange={(field, val) => updateCell(item.id, field, val)}
              />
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-[#8A7D71] mt-2 px-1">
        USED is auto-calculated (OPEN + NEW − CLOSE). OPEN auto-carries from the previous day's CLOSE — type a value to override (seed). Empty NEW counts as 0.
      </p>

      {showMonthModal && (
        <MonthMatrixModal
          initialMonth={month}
          onClose={() => setShowMonthModal(false)}
          onJumpToDay={(ymd) => { setDate(ymd); setShowMonthModal(false); }}
        />
      )}
    </div>
  );
}

// ───────── single item row in the daily view ─────────
function DailyRow({ item, day, onChange, disabled }) {
  return (
    <div className="grid grid-cols-[1fr_120px_120px_120px_120px] gap-2 px-5 py-2.5 items-center hover:bg-[#F6F3EC]/30" data-testid={`im-day-row-${item.id}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Coffee size={14} className="text-[#8B5A2B] shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#2C241B] truncate">{item.name}</p>
          <p className="text-[10px] text-[#8A7D71]">{item.section || "Other"} · {item.unit}</p>
        </div>
      </div>

      <CellInput value={day.opening} muted={!day.has_seed} disabled={disabled}
        onChange={(v) => onChange("opening", v)}
        testid={`im-${item.id}-open`} />
      <CellInput value={day.new_received} disabled={disabled}
        onChange={(v) => onChange("new_received", v)}
        testid={`im-${item.id}-new`} />
      <div className="text-center text-sm font-semibold text-[#B84B4B]" data-testid={`im-${item.id}-used`}>
        {day.used != null ? fmtNum(day.used) : <span className="text-[#C9B99A]">—</span>}
      </div>
      <CellInput value={day.closing} disabled={disabled}
        onChange={(v) => onChange("closing", v)}
        testid={`im-${item.id}-close`} />
    </div>
  );
}

function CellInput({ value, onChange, muted, disabled, testid }) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => { setLocal(value ?? ""); }, [value]);

  const commit = () => {
    const cur = local === "" ? null : Number(local);
    if (cur !== (value ?? null)) onChange(local);
  };

  return (
    <input
      type="number"
      step="any"
      inputMode="decimal"
      value={local}
      disabled={disabled}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      placeholder="—"
      className={`w-full text-center px-2 py-1.5 rounded-lg border text-sm focus:outline-none focus:border-[#8B5A2B] focus:bg-[#FFF6E5] disabled:opacity-50 ${
        muted ? "text-[#8A7D71] border-amber-900/10 bg-[#F6F3EC]/50" : "text-[#2C241B] border-amber-900/20 bg-white"
      }`}
      data-testid={testid}
    />
  );
}

// ───────── month-matrix modal ─────────
function MonthMatrixModal({ initialMonth, onClose, onJumpToDay }) {
  const [month, setMonth] = useState(initialMonth);
  const [grid, setGrid] = useState({ dates: [], rows: [] });
  const [loading, setLoading] = useState(true);
  const todayMonth = todayYMD().slice(0, 7);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get(`/inventory-movements?month=${month}`)
      .then(({ data }) => { if (alive) setGrid(data); })
      .catch(() => toast.error("Failed to load month"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [month]);

  const downloadExcel = () => {
    if (!grid.rows || grid.rows.length === 0) { toast.error("Nothing to export"); return; }
    const dates = grid.dates;
    const titleRow = [`${monthLabel(month).toUpperCase()} STOCK MANAGEMENT SYSTEM — BARISTA ITEMS`];
    const dateHeader = ["S.NO.", "ITEMS", "DETAILS"];
    const subHeader = ["", "", ""];
    dates.forEach((d) => {
      const [y, mm, dd] = d.split("-");
      dateHeader.push(`${dd}.${mm}.${y}`, "", "", "", "");
      subHeader.push("OPEN", "NEW", "Used", "Rate", "CLOSE");
    });

    const dataRows = grid.rows.map((r, idx) => {
      const row = [idx + 1, r.item.name, r.item.unit];
      r.days.forEach((d) => {
        row.push(d.opening ?? "", d.new_received ?? "", d.used ?? "", "", d.closing ?? "");
      });
      return row;
    });

    const aoa = [titleRow, dateHeader, subHeader, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const totalCols = 3 + dates.length * 5;
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
      ...dates.map((_, i) => ({ s: { r: 1, c: 3 + i * 5 }, e: { r: 1, c: 3 + i * 5 + 4 } })),
    ];
    ws["!cols"] = [
      { wch: 6 }, { wch: 22 }, { wch: 10 },
      ...dates.flatMap(() => [{ wch: 7 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 7 }]),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, monthLabel(month));
    XLSX.writeFile(wb, `dejabrew-inventory-movement-${month}.xlsx`);
    toast.success("Excel downloaded");
  };

  return (
    <div className="fixed inset-0 bg-[#2C241B]/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-[1400px] h-[90vh] flex flex-col shadow-2xl slide-up overflow-hidden">
        {/* Modal header */}
        <div className="px-5 py-4 border-b border-amber-900/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#2C241B]" style={{ fontFamily: "Outfit, sans-serif" }}>
              Full Month View
            </h2>
            <p className="text-xs text-[#8A7D71]">{monthLabel(month)} · click any date header to jump to that day</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setMonth(shiftMonth(month, -1))}
              className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10"
              data-testid="im-modal-prev-month"><ChevronLeft size={16} /></button>
            <input type="month" value={month} max={todayMonth} onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="rounded-xl border border-amber-900/20 px-3 py-2 text-sm text-[#2C241B] focus:outline-none focus:border-[#8B5A2B]"
              data-testid="im-modal-month-picker" />
            <button onClick={() => setMonth(shiftMonth(month, 1))}
              disabled={month >= todayMonth}
              className="p-2 rounded-xl border border-amber-900/20 text-[#5C4F43] hover:bg-[#8B5A2B]/10 disabled:opacity-40"
              data-testid="im-modal-next-month"><ChevronRight size={16} /></button>
            <button onClick={downloadExcel}
              className="flex items-center gap-2 ml-1 bg-[#3E5C46] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#2F4735]"
              data-testid="im-modal-download-btn">
              <Download size={14} /> Download Excel
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-[#8A7D71] hover:bg-amber-900/10" data-testid="im-modal-close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Matrix scrollable inside modal */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-center text-[#8A7D71] py-20">Loading...</div>
          ) : grid.rows.length === 0 ? (
            <div className="text-center py-20">
              <BarChart3 size={36} className="text-[#C9B99A] mx-auto mb-2" />
              <p className="text-[#8A7D71] text-sm">No inventory items yet</p>
            </div>
          ) : (
            <table className="text-xs border-collapse" data-testid="im-modal-grid">
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-[#F6F3EC] border-b border-r border-amber-900/15 px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[#8A7D71]" style={{ minWidth: 60 }}>S.NO.</th>
                  <th className="sticky left-[60px] z-30 bg-[#F6F3EC] border-b border-r border-amber-900/15 px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[#8A7D71]" style={{ minWidth: 180 }}>Item</th>
                  <th className="sticky left-[240px] z-30 bg-[#F6F3EC] border-b border-r border-amber-900/15 px-3 py-2 text-left text-[10px] uppercase tracking-wider text-[#8A7D71]" style={{ minWidth: 70 }}>Unit</th>
                  {grid.dates.map((d) => {
                    const [y, mm, dd] = d.split("-");
                    return (
                      <th key={d} colSpan={4}
                        onClick={() => onJumpToDay(d)}
                        title="Jump to this day"
                        className="bg-[#F6F3EC] border-b border-r border-amber-900/15 px-2 py-2 text-center text-[10px] font-semibold text-[#2C241B] cursor-pointer hover:bg-[#8B5A2B]/15">
                        {dd}.{mm}.{y}
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  <th className="sticky left-0 z-30 bg-white border-b border-r border-amber-900/15" />
                  <th className="sticky left-[60px] z-30 bg-white border-b border-r border-amber-900/15" />
                  <th className="sticky left-[240px] z-30 bg-white border-b border-r border-amber-900/15" />
                  {grid.dates.map((d) => (
                    <React.Fragment key={d}>
                      <th className="bg-white border-b border-amber-900/10 px-1.5 py-1 text-[9px] font-medium uppercase tracking-wider text-[#5C4F43]">OPEN</th>
                      <th className="bg-white border-b border-amber-900/10 px-1.5 py-1 text-[9px] font-medium uppercase tracking-wider text-[#5C4F43]">NEW</th>
                      <th className="bg-white border-b border-amber-900/10 px-1.5 py-1 text-[9px] font-medium uppercase tracking-wider text-[#8A7D71]">USED</th>
                      <th className="bg-white border-b border-r border-amber-900/15 px-1.5 py-1 text-[9px] font-medium uppercase tracking-wider text-[#5C4F43]">CLOSE</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row, idx) => (
                  <tr key={row.item.id} className="hover:bg-[#F6F3EC]/40">
                    <td className="sticky left-0 z-10 bg-white border-b border-r border-amber-900/10 px-3 py-1.5 text-[#8A7D71] text-center">{idx + 1}</td>
                    <td className="sticky left-[60px] z-10 bg-white border-b border-r border-amber-900/10 px-3 py-1.5 font-medium text-[#2C241B]">{row.item.name}</td>
                    <td className="sticky left-[240px] z-10 bg-white border-b border-r border-amber-900/10 px-3 py-1.5 text-[#8A7D71]">{row.item.unit}</td>
                    {row.days.map((d) => (
                      <React.Fragment key={d.date}>
                        <td className="border-b border-amber-900/5 px-2 py-1 text-center text-[11px] text-[#5C4F43]">{fmtNum(d.opening)}</td>
                        <td className="border-b border-amber-900/5 px-2 py-1 text-center text-[11px] text-[#5C4F43]">{fmtNum(d.new_received)}</td>
                        <td className="border-b border-amber-900/5 px-2 py-1 text-center text-[11px] text-[#B84B4B] bg-red-50/40">{fmtNum(d.used)}</td>
                        <td className="border-b border-r border-amber-900/15 px-2 py-1 text-center text-[11px] font-semibold text-[#2C241B]">{fmtNum(d.closing)}</td>
                      </React.Fragment>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-amber-900/10 bg-[#F6F3EC]/40 text-[11px] text-[#8A7D71]">
          Read-only overview. To edit, close this and use the daily view (or click a date header above to jump).
        </div>
      </div>
    </div>
  );
}
