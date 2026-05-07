/**
 * Megosztott formázó utility-k a kliens oldalon.
 * Több oldalon és komponensben is ugyanazt a magyar lokalizációt és
 * formátumot használjuk — egy helyen tartjuk őket, hogy egyszerre
 * lehessen őket finomhangolni.
 */

const DATE_FORMATTER = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("hu-HU", { numeric: "auto" });

/**
 * "2026.05.07" formátumban. Null / undefined / hibás bemenet → "—".
 */
export function formatDate(d: Date | string | null | undefined): string {
  if (d == null) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_FORMATTER.format(date);
}

/**
 * "2026.05.07. 14:32:01" formátumban — pl. audit-naplón.
 */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (d == null) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_TIME_FORMATTER.format(date);
}

/**
 * Hány napja történt — pl. "3 napja", "ma", "tegnap". Null bemenet → null.
 */
export function daysAgo(d: Date | string | null | undefined): number | null {
  if (d == null) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Magyar nyelvű relatív időpont — pl. "3 napja", "1 hete". Null → "—".
 */
export function formatRelative(d: Date | string | null | undefined): string {
  if (d == null) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  if (Math.abs(diffSec) < 60) return RELATIVE_FORMATTER.format(-diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return RELATIVE_FORMATTER.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return RELATIVE_FORMATTER.format(-diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 30) return RELATIVE_FORMATTER.format(-diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return RELATIVE_FORMATTER.format(-diffMonth, "month");
  return RELATIVE_FORMATTER.format(-Math.round(diffDay / 365), "year");
}

/**
 * Bájtméret kiírása "1.2 MB" / "350 KB" / "42 B" formátumban.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
