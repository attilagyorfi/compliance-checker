/**
 * Tiszta segédfüggvények az eredményoldal útvonalához és a lekérdezések
 * hibakezeléséhez. Klienskönyvtárat szándékosan nem importál, így DOM nélkül,
 * a server/** alatti vitest-tesztekből is ellenőrizhető.
 */

const MAX_QUERY_RETRIES = 3;

/** Csak pozitív, biztonságos egész számot fogad el; minden másra null. */
export function parseAnalysisId(raw: string | null | undefined): number | null {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export function isNotFoundError(error: unknown): boolean {
  return (error as { data?: { code?: unknown } } | null | undefined)?.data?.code === "NOT_FOUND";
}

/** NOT_FOUND-ra felesleges újra próbálkozni, más hibára korlátozott számban érdemes. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (isNotFoundError(error)) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

/**
 * Igaz, ha a lekérdezésnek nincs adata, és nem is tölt: hibára futott, vagy
 * hálózat hiányában szünetel. Ha már van betöltött adat, egy sikertelen
 * háttérfrissítés nem számít hibának: a meglévő adat marad látható.
 */
export function hasQueryLoadFailed(query: {
  data: unknown;
  isError: boolean;
  fetchStatus: string;
}): boolean {
  return query.data === undefined && (query.isError || query.fetchStatus === "paused");
}
