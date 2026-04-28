// Local-timezone YYYY-MM-DD formatter. Avoids the `toISOString()` UTC-shift bug
// that causes IST users to see "back = -2 days" and "forward = no change".
export function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayYMD() {
  return toYMD(new Date());
}

export function shiftYMD(ymd, deltaDays) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return toYMD(dt);
}
