import { afterEach, describe, expect, it, vi } from "vitest";
import { onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import {
  hasQueryLoadFailed,
  isNotFoundError,
  parseAnalysisId,
  shouldRetryQuery,
} from "@shared/analysisRoute";

describe("parseAnalysisId", () => {
  it.each([
    ["1", 1],
    ["12", 12],
    ["9007199254740991", Number.MAX_SAFE_INTEGER],
  ])("elfogadja: %s", (raw, expected) => {
    expect(parseAnalysisId(raw)).toBe(expected);
  });

  it.each([
    "abc",
    "0",
    "-1",
    "+1",
    "012",
    "12abc",
    "abc12",
    "1.5",
    "1e3",
    "0x10",
    " 12 ",
    "12\n",
    "9007199254740992",
    "99999999999999999999",
    "",
    undefined,
    null,
  ])("elutasítja: %j", (raw) => {
    expect(parseAnalysisId(raw)).toBeNull();
  });
});

describe("isNotFoundError", () => {
  it("a tRPC NOT_FOUND kódot ismeri fel", () => {
    expect(isNotFoundError({ data: { code: "NOT_FOUND" } })).toBe(true);
  });

  it.each([
    [{ data: { code: "INTERNAL_SERVER_ERROR" } }],
    [{ data: null }],
    [new Error("NOT_FOUND")],
    ["NOT_FOUND"],
    [null],
    [undefined],
  ])("más hibára hamis: %j", (error) => {
    expect(isNotFoundError(error)).toBe(false);
  });
});

describe("shouldRetryQuery", () => {
  it("NOT_FOUND-ra egyszer sem próbálkozik újra", () => {
    expect(shouldRetryQuery(0, { data: { code: "NOT_FOUND" } })).toBe(false);
  });

  it("szerverhibára korlátozott számban próbálkozik újra", () => {
    const error = { data: { code: "INTERNAL_SERVER_ERROR" } };
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(true);
    expect(shouldRetryQuery(3, error)).toBe(false);
  });

  it("hálózati hibára (nincs tRPC-kód) is korlátozottan próbálkozik újra", () => {
    const error = new TypeError("Failed to fetch");
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(3, error)).toBe(false);
  });
});

describe("hasQueryLoadFailed", () => {
  it("hibára futott kezdeti betöltésnél igaz", () => {
    expect(hasQueryLoadFailed({ data: undefined, isError: true, fetchStatus: "idle" })).toBe(true);
  });

  it("hálózat hiányában szünetelő kezdeti betöltésnél igaz", () => {
    expect(hasQueryLoadFailed({ data: undefined, isError: false, fetchStatus: "paused" })).toBe(true);
  });

  it("tényleges betöltés alatt hamis", () => {
    expect(hasQueryLoadFailed({ data: undefined, isError: false, fetchStatus: "fetching" })).toBe(false);
  });

  it("kikapcsolt lekérdezésnél hamis", () => {
    expect(hasQueryLoadFailed({ data: undefined, isError: false, fetchStatus: "idle" })).toBe(false);
  });

  it("sikertelen háttérfrissítésnél hamis, mert van meglévő adat", () => {
    expect(hasQueryLoadFailed({ data: { id: 1 }, isError: true, fetchStatus: "idle" })).toBe(false);
    expect(hasQueryLoadFailed({ data: [], isError: true, fetchStatus: "idle" })).toBe(false);
  });
});

// A segédfüggvények a react-query valódi állapotátmeneteire támaszkodnak (pl. a
// sikertelen háttérfrissítés megtartja az adatot), ezért azokkal is ellenőrizzük.
describe("a valódi react-query állapotokkal", () => {
  const cleanups: Array<() => void> = [];

  function observe(queryFn: () => Promise<unknown>) {
    const client = new QueryClient();
    const observer = new QueryObserver(client, {
      queryKey: ["analysis"],
      queryFn,
      retry: shouldRetryQuery,
      retryDelay: 0,
    });
    const unsubscribe = observer.subscribe(() => {});
    cleanups.push(() => {
      unsubscribe();
      client.clear();
    });
    return observer;
  }

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    onlineManager.setOnline(true);
  });

  it("NOT_FOUND után azonnal hibát ad, újrapróbálás nélkül", async () => {
    const queryFn = vi.fn().mockRejectedValue({ data: { code: "NOT_FOUND" } });
    const observer = observe(queryFn);

    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(isNotFoundError(observer.getCurrentResult().error)).toBe(true);
  });

  it("más hibánál korlátozottan próbálkozik, utána betöltési hiba lesz", async () => {
    const queryFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const observer = observe(queryFn);

    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));

    expect(queryFn).toHaveBeenCalledTimes(4);
    expect(hasQueryLoadFailed(observer.getCurrentResult())).toBe(true);
  });

  it("az Újrapróbálom újra betöltési állapotba visz, és sikerrel zárulhat", async () => {
    const queryFn = vi.fn().mockRejectedValue({ data: { code: "NOT_FOUND" } });
    const observer = observe(queryFn);
    await vi.waitFor(() => expect(observer.getCurrentResult().isError).toBe(true));

    queryFn.mockResolvedValue({ id: 1 });
    const refetching = observer.refetch();

    expect(observer.getCurrentResult().isLoading).toBe(true);
    expect(hasQueryLoadFailed(observer.getCurrentResult())).toBe(false);

    await refetching;
    expect(observer.getCurrentResult().data).toEqual({ id: 1 });
    expect(hasQueryLoadFailed(observer.getCurrentResult())).toBe(false);
  });

  it("a sikertelen háttérfrissítés megtartja a betöltött adatot", async () => {
    const queryFn = vi.fn().mockResolvedValue({ id: 1, status: "processing" });
    const observer = observe(queryFn);
    await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true));

    queryFn.mockRejectedValue({ data: { code: "NOT_FOUND" } });
    await observer.refetch();

    const result = observer.getCurrentResult();
    expect(result.isError).toBe(true);
    expect(result.data).toEqual({ id: 1, status: "processing" });
    expect(hasQueryLoadFailed(result)).toBe(false);
  });

  it("hálózat nélkül a szünetelő első betöltés hibának számít", () => {
    onlineManager.setOnline(false);
    const observer = observe(vi.fn().mockResolvedValue({ id: 1 }));

    const result = observer.getCurrentResult();
    expect(result.fetchStatus).toBe("paused");
    expect(result.isLoading).toBe(false);
    expect(hasQueryLoadFailed(result)).toBe(true);
  });
});
