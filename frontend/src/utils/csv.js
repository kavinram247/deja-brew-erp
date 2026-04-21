/**
 * Simple CSV + download utilities for dashboard exports.
 */

function escapeCsv(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows, columns) {
  // columns: [{ key, label, format? }]
  const header = columns.map((c) => escapeCsv(c.label)).join(",");
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = c.format ? c.format(r[c.key], r) : r[c.key];
      return escapeCsv(v);
    }).join(",")
  ).join("\n");
  return header + "\n" + body;
}

export function downloadCsv(filename, rows, columns) {
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
