export const fmt = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : n.toFixed(d);

export const fmtInt = (n: number | null | undefined) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : Math.round(n).toLocaleString();

export const fmtDate = (s: string | Date | null | undefined) => {
  if (!s) return "—";
  const d = typeof s === "string" ? new Date(s) : s;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};
