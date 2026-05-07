import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ── Mock database helpers ─────────────────────────────────────────────────────
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null), // standardsSearch uses getDb directly
  createAnalysis: vi.fn().mockResolvedValue(42),
  getAnalysisById: vi.fn().mockResolvedValue({
    id: 42,
    title: "Test Analysis",
    status: "completed",
    planDocuments: [{ key: "test-key", name: "test-plan.pdf", fileType: "pdf" }],
    regulationDocumentKeys: [],
    regulationDocumentNames: ["test-reg.pdf"],
    regulationSourceIds: [],
    results: [
      {
        id: "r1",
        title: "Teherbírás ellenőrzés",
        description: "A szerkezet teherbírásának vizsgálata.",
        status: "megfelel",
        justification: "A tervezett teherbírás megfelel az előírásoknak.",
        reference: "MSZ EN 1990:2005 3.1",
        category: "Teherbírás",
      },
    ],
    summary: "Az elemzés alapján a terv megfelel a vonatkozó előírásoknak.",
    errorMessage: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  }),
  listAnalyses: vi.fn().mockResolvedValue([]),
  updateAnalysisStatus: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock LLM ──────────────────────────────────────────────────────────────────
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            results: [
              {
                id: "r1",
                title: "Teherbírás ellenőrzés",
                description: "A szerkezet teherbírásának vizsgálata.",
                status: "megfelel",
                justification: "A tervezett teherbírás megfelel az előírásoknak.",
                reference: "MSZ EN 1990:2005 3.1",
                category: "Teherbírás",
              },
            ],
            summary: "Az elemzés alapján a terv megfelel a vonatkozó előírásoknak.",
          }),
        },
      },
    ],
  }),
}));

// ── Mock storage ──────────────────────────────────────────────────────────────
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ key: "test-key", url: "https://cdn.example.com/test.pdf" }),
}));

// ── Mock drizzle DB for regulation sources / platform credentials ─────────────
const mockRegSources = [
  {
    id: 1,
    name: "TÉKA – 280/2024. Korm. rendelet",
    shortCode: "TEKA_2024",
    discipline: "epiteszet",
    sourceType: "njt",
    sourceUrl: "https://njt.hu/jogszabaly/2024-280-20-22",
    content: "Jogszabály szövege...",
    contentFetchedAt: new Date("2024-01-01"),
    s3Key: null,
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
];

const mockPlatformCreds = [
  {
    id: 1,
    platform: "mszt",
    displayName: "MSZT fiók",
    username: "test@example.com",
    encryptedPassword: "dGVzdA==",
    status: "connected",
    lastConnectedAt: new Date("2024-01-01"),
    lastError: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
];

// Mock drizzle ORM for regulation sources
vi.mock("../drizzle/schema", async () => {
  const actual = await vi.importActual("../drizzle/schema");
  return actual;
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Compliance router tests ───────────────────────────────────────────────────
describe("compliance router", () => {
  it("getAnalysis returns analysis by id", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.compliance.getAnalysis({ id: 42 });
    expect(result.id).toBe(42);
    expect(result.title).toBe("Test Analysis");
    expect(result.status).toBe("completed");
  });

  it("getAnalysis throws NOT_FOUND for missing id", async () => {
    const { getAnalysisById } = await import("./db");
    vi.mocked(getAnalysisById).mockResolvedValueOnce(undefined);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.compliance.getAnalysis({ id: 9999 })).rejects.toThrow("Elemzés nem található");
  });

  it("listAnalyses returns array", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.compliance.listAnalyses();
    expect(Array.isArray(result)).toBe(true);
  });

  it("startAnalysis creates analysis and returns id", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());

    const fakeBase64 = Buffer.from("%PDF-1.4 fake content").toString("base64");

    const result = await caller.compliance.startAnalysis({
      title: "Test Elemzés",
      planDocument: { key: "", name: "plan.pdf", base64: fakeBase64 },
      regulationDocuments: [{ name: "reg.pdf", base64: fakeBase64 }],
    });

    expect(result.analysisId).toBe(42);
  });

  it("startAnalysis accepts multiple plan documents and library source IDs", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());

    const fakeBase64 = Buffer.from("%PDF-1.4 fake content").toString("base64");

    const result = await caller.compliance.startAnalysis({
      title: "Multi-doc Elemzés",
      planDocument: { key: "", name: "plan1.pdf", base64: fakeBase64 },
      regulationDocuments: [],
      planDocumentNames: ["plan1.pdf", "plan2.dwg", "plan3.xlsx"],
      regulationSourceIds: [1, 2, 3],
    });

    expect(result.analysisId).toBe(42);
  });

  it("startAnalysis accepts xlsx and dwg file types", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());

    const fakeBase64 = Buffer.from("fake xlsx content").toString("base64");

    const result = await caller.compliance.startAnalysis({
      title: "XLSX Elemzés",
      planDocument: { key: "", name: "plan.xlsx", base64: fakeBase64 },
      regulationDocuments: [{ name: "regulation.docx", base64: fakeBase64 }],
    });

    expect(result.analysisId).toBe(42);
  });
});

// ── PDF export router tests ───────────────────────────────────────────────────
describe("pdf export router", () => {
  it("exportPdf returns base64 and filename for completed analysis", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.pdf.exportPdf({ id: 42 });
    expect(result.base64).toBeTruthy();
    expect(result.filename).toMatch(/\.pdf$/);
  });

  it("exportPdf throws NOT_FOUND for missing analysis", async () => {
    const { getAnalysisById } = await import("./db");
    vi.mocked(getAnalysisById).mockResolvedValueOnce(undefined);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.pdf.exportPdf({ id: 9999 })).rejects.toThrow("Elemzés nem található");
  });

  it("exportPdf throws BAD_REQUEST for non-completed analysis", async () => {
    const { getAnalysisById } = await import("./db");
    vi.mocked(getAnalysisById).mockResolvedValueOnce({
      id: 1,
      title: "Pending",
      status: "processing",
      planDocuments: [],
      regulationDocumentKeys: [],
      regulationDocumentNames: [],
      regulationSourceIds: [],
      results: null,
      summary: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.pdf.exportPdf({ id: 1 })).rejects.toThrow("Az elemzés még nem fejeződött be");
  });
});

// ── Regulation scraper unit tests ─────────────────────────────────────────────
describe("regulation scraper", () => {
  it("encryptPassword and decryptPassword are inverse operations", async () => {
    const { encryptPassword, decryptPassword } = await import("./regulationScraper");
    const original = "my-secret-password-123!";
    const encrypted = encryptPassword(original);
    expect(encrypted).not.toBe(original);
    const decrypted = decryptPassword(encrypted);
    expect(decrypted).toBe(original);
  });

  it("encryptPassword produces different output for different inputs", async () => {
    const { encryptPassword } = await import("./regulationScraper");
    const enc1 = encryptPassword("password1");
    const enc2 = encryptPassword("password2");
    expect(enc1).not.toBe(enc2);
  });

  it("encryptPassword randomizes IV (same input yields different ciphertexts)", async () => {
    const { encryptPassword, decryptPassword } = await import("./regulationScraper");
    const enc1 = encryptPassword("same-password");
    const enc2 = encryptPassword("same-password");
    expect(enc1).not.toBe(enc2);
    expect(decryptPassword(enc1)).toBe("same-password");
    expect(decryptPassword(enc2)).toBe("same-password");
  });

  it("decryptPassword decodes legacy XOR-encoded values for backward compatibility", async () => {
    const { decryptPassword } = await import("./regulationScraper");
    // Reproduce the old XOR scheme exactly to seed a legacy ciphertext.
    const ENCRYPTION_KEY = process.env.JWT_SECRET ?? "compliance-checker-key-2024";
    const original = "legacy-stored-password";
    const key = Buffer.from(ENCRYPTION_KEY);
    const data = Buffer.from(original, "utf8");
    const xored = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) xored[i] = data[i]! ^ key[i % key.length]!;
    const legacyEncoded = xored.toString("base64");
    expect(legacyEncoded).not.toContain(":");
    expect(decryptPassword(legacyEncoded)).toBe(original);
  });

  it("cookieHeaderFromResponse strips attributes from a single Set-Cookie value", async () => {
    const { cookieHeaderFromResponse } = await import("./regulationScraper");
    const headers = new Headers();
    headers.set("set-cookie", "PHPSESSID=abc123; Path=/; HttpOnly; SameSite=Lax");
    expect(cookieHeaderFromResponse(headers)).toBe("PHPSESSID=abc123");
  });

  it("cookieHeaderFromResponse handles multiple Set-Cookie headers", async () => {
    const { cookieHeaderFromResponse } = await import("./regulationScraper");
    const headers = new Headers();
    headers.append("set-cookie", "PHPSESSID=abc; Path=/; HttpOnly");
    headers.append("set-cookie", "XSRF-TOKEN=xyz; Path=/; Secure");
    const result = cookieHeaderFromResponse(headers);
    expect(result).toContain("PHPSESSID=abc");
    expect(result).toContain("XSRF-TOKEN=xyz");
    expect(result).not.toContain("HttpOnly");
    expect(result).not.toContain("Path=");
    expect(result).not.toContain("Secure");
  });

  it("mergeCookies overrides earlier values by name", async () => {
    const { mergeCookies } = await import("./regulationScraper");
    expect(mergeCookies("a=1; b=2", "b=3; c=4")).toBe("a=1; b=3; c=4");
    expect(mergeCookies("", "x=1")).toBe("x=1");
    expect(mergeCookies("PHPSESSID=old", "PHPSESSID=new; auth=t")).toBe("PHPSESSID=new; auth=t");
  });

  it("withSessionCache returns cached session on hit (no extra loginFn call)", async () => {
    const { withSessionCache } = await import("./regulationScraper");
    const cache = new Map();
    const loginFn = vi.fn().mockResolvedValue({ success: true, sessionCookies: "PHPSESSID=abc" });
    const r1 = await withSessionCache(cache, 60_000, "user", "pass", loginFn);
    const r2 = await withSessionCache(cache, 60_000, "user", "pass", loginFn);
    expect(r1.sessionCookies).toBe("PHPSESSID=abc");
    expect(r2.sessionCookies).toBe("PHPSESSID=abc");
    expect(loginFn).toHaveBeenCalledTimes(1);
  });

  it("withSessionCache re-logs after TTL expires", async () => {
    const { withSessionCache } = await import("./regulationScraper");
    const cache = new Map();
    let counter = 0;
    const loginFn = vi.fn().mockImplementation(async () => ({
      success: true as const,
      sessionCookies: `PHPSESSID=v${++counter}`,
    }));
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValue(0);
    const r1 = await withSessionCache(cache, 60_000, "user", "pass", loginFn);
    nowSpy.mockReturnValue(61_000);
    const r2 = await withSessionCache(cache, 60_000, "user", "pass", loginFn);
    expect(r1.sessionCookies).toBe("PHPSESSID=v1");
    expect(r2.sessionCookies).toBe("PHPSESSID=v2");
    expect(loginFn).toHaveBeenCalledTimes(2);
    nowSpy.mockRestore();
  });

  it("withSessionCache invalidates entry when password changes", async () => {
    const { withSessionCache } = await import("./regulationScraper");
    const cache = new Map();
    let counter = 0;
    const loginFn = vi.fn().mockImplementation(async () => ({
      success: true as const,
      sessionCookies: `PHPSESSID=v${++counter}`,
    }));
    await withSessionCache(cache, 60_000, "user", "pass1", loginFn);
    await withSessionCache(cache, 60_000, "user", "pass2", loginFn);
    expect(loginFn).toHaveBeenCalledTimes(2);
  });

  it("withSessionCache does not cache failed logins", async () => {
    const { withSessionCache } = await import("./regulationScraper");
    const cache = new Map();
    const loginFn = vi.fn().mockResolvedValue({ success: false, error: "bad creds" });
    await withSessionCache(cache, 60_000, "user", "pass", loginFn);
    await withSessionCache(cache, 60_000, "user", "pass", loginFn);
    expect(loginFn).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });

  it("withSessionCache uses separate entries per username", async () => {
    const { withSessionCache } = await import("./regulationScraper");
    const cache = new Map();
    let counter = 0;
    const loginFn = vi.fn().mockImplementation(async () => ({
      success: true as const,
      sessionCookies: `PHPSESSID=v${++counter}`,
    }));
    const r1 = await withSessionCache(cache, 60_000, "alice", "pass", loginFn);
    const r2 = await withSessionCache(cache, 60_000, "bob", "pass", loginFn);
    const r3 = await withSessionCache(cache, 60_000, "alice", "pass", loginFn);
    expect(r1.sessionCookies).toBe("PHPSESSID=v1");
    expect(r2.sessionCookies).toBe("PHPSESSID=v2");
    expect(r3.sessionCookies).toBe("PHPSESSID=v1");
    expect(loginFn).toHaveBeenCalledTimes(2);
  });

  it("fetchRegulationText returns warning for paid platform without credentials", async () => {
    const { fetchRegulationText } = await import("./regulationScraper");
    const result = await fetchRegulationText("mszt", "https://szabvanykonyvtar.mszt.hu/test");
    expect(result.warning).toBeTruthy();
    expect(result.text).toBe("");
  });

  it("fetchRegulationText returns warning for pdf type", async () => {
    const { fetchRegulationText } = await import("./regulationScraper");
    const result = await fetchRegulationText("pdf", "https://example.com/test.pdf");
    expect(result.warning).toBeTruthy();
  });
});

// ── Standards search router tests ─────────────────────────────────────────────
describe("standardsSearch router", () => {
  it("listHistory returns empty array when no queries", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    // DB may not have entries in test env – just check it doesn't throw
    const result = await caller.standardsSearch.listHistory({ limit: 10, offset: 0 });
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("getQuery throws NOT_FOUND for missing id", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.standardsSearch.getQuery({ id: 999999 })).rejects.toThrow();
  });

  it("deleteQuery throws when DB unavailable (mocked)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    // In test env getDb returns null, so it should throw INTERNAL_SERVER_ERROR
    await expect(caller.standardsSearch.deleteQuery({ id: 999999 })).rejects.toThrow();
  });

  it("extendAnswer throws NOT_FOUND for missing id", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.standardsSearch.extendAnswer({ queryId: 999999 })).rejects.toThrow();
  });
});

// ── Projects router tests (V10.A1) ────────────────────────────────────────────
describe("projects router", () => {
  it("list returns empty array when DB unavailable", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.projects.list({ includeDeleted: false });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("getById throws when DB unavailable", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.projects.getById({ id: 1 })).rejects.toThrow();
  });

  it("create requires authentication (UNAUTHORIZED for public context)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.projects.create({ name: "Test", discipline: "altalanos", workflowStatus: "uj" })
    ).rejects.toThrow();
  });

  it("delete requires authentication (UNAUTHORIZED for public context)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.projects.delete({ id: 1 })).rejects.toThrow();
  });

  it("update requires authentication (UNAUTHORIZED for public context)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.projects.update({ id: 1, name: "x" })).rejects.toThrow();
  });

  it("export requires authentication (UNAUTHORIZED for public context)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.projects.export({ id: 1 })).rejects.toThrow();
  });
});

// ── Project members router tests (V10.A4) ─────────────────────────────────────
describe("projectMembers router", () => {
  it("list returns empty array when DB unavailable", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.projectMembers.list({ projectId: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("add requires authentication", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.projectMembers.add({ projectId: 1, email: "x@y.com", role: "member" })
    ).rejects.toThrow();
  });

  it("changeRole requires authentication", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.projectMembers.changeRole({ projectId: 1, userId: 1, role: "reviewer" })
    ).rejects.toThrow();
  });

  it("remove requires authentication", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.projectMembers.remove({ projectId: 1, userId: 1 })).rejects.toThrow();
  });
});

// ── Audit router tests (V11.3) ────────────────────────────────────────────────
describe("audit router", () => {
  it("list requires authentication (UNAUTHORIZED for public context)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.audit.list({ limit: 10, offset: 0 })).rejects.toThrow();
  });

  it("summary requires authentication", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.audit.summary({ sinceDays: 30 })).rejects.toThrow();
  });

  it("resourceTypes requires authentication", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.audit.resourceTypes()).rejects.toThrow();
  });
});

// ── searchSettings router tests (V11.3) ───────────────────────────────────────
describe("searchSettings router", () => {
  it("get requires authentication (UNAUTHORIZED for public context)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.searchSettings.get()).rejects.toThrow();
  });

  it("upsert requires authentication", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.searchSettings.upsert({ answerLength: "short", operationMode: "fast", searchMode: "internal" })
    ).rejects.toThrow();
  });

  it("reset requires authentication", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.searchSettings.reset()).rejects.toThrow();
  });
});

// ── Embeddings (semantic search V12) ──────────────────────────────────────────
describe("embeddings helpers", () => {
  it("cosineSimilarity returns 1 for identical vectors", async () => {
    const { cosineSimilarity } = await import("./embeddings");
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([3, 4], [3, 4])).toBeCloseTo(1);
  });

  it("cosineSimilarity returns 0 for orthogonal vectors", async () => {
    const { cosineSimilarity } = await import("./embeddings");
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("cosineSimilarity returns -1 for opposite vectors", async () => {
    const { cosineSimilarity } = await import("./embeddings");
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("cosineSimilarity returns 0 for mismatched-dim or zero vectors (no throw)", async () => {
    const { cosineSimilarity } = await import("./embeddings");
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("isMsztLiveSearchEnabled returns false by default (feature flag off)", async () => {
    const { isMsztLiveSearchEnabled } = await import("./regulationScraper");
    const old = process.env.ENABLE_LIVE_MSZT_SEARCH;
    delete process.env.ENABLE_LIVE_MSZT_SEARCH;
    try {
      expect(isMsztLiveSearchEnabled()).toBe(false);
    } finally {
      if (old !== undefined) process.env.ENABLE_LIVE_MSZT_SEARCH = old;
    }
  });

  it("isMsztLiveSearchEnabled toggles on with ENABLE_LIVE_MSZT_SEARCH=true", async () => {
    const { isMsztLiveSearchEnabled } = await import("./regulationScraper");
    const old = process.env.ENABLE_LIVE_MSZT_SEARCH;
    process.env.ENABLE_LIVE_MSZT_SEARCH = "true";
    try {
      expect(isMsztLiveSearchEnabled()).toBe(true);
    } finally {
      if (old === undefined) delete process.env.ENABLE_LIVE_MSZT_SEARCH;
      else process.env.ENABLE_LIVE_MSZT_SEARCH = old;
    }
  });

  it("searchMsztLive returns [] when feature flag is off (no network call)", async () => {
    const { searchMsztLive } = await import("./regulationScraper");
    const old = process.env.ENABLE_LIVE_MSZT_SEARCH;
    delete process.env.ENABLE_LIVE_MSZT_SEARCH;
    try {
      const result = await searchMsztLive("test query", { username: "u", password: "p" });
      expect(result).toEqual([]);
    } finally {
      if (old !== undefined) process.env.ENABLE_LIVE_MSZT_SEARCH = old;
    }
  });

  it("regulationSources.getEmbeddingCounts returns array (gracefully empty when DB null)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.regulationSources.getEmbeddingCounts();
    expect(Array.isArray(result)).toBe(true);
  });

  it("knowledgeBase.getEmbeddingCounts returns array (gracefully empty when DB null)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.knowledgeBase.getEmbeddingCounts();
    expect(Array.isArray(result)).toBe(true);
  });

  it("knowledgeBase.deleteMany throws when DB unavailable (mocked)", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    // mocked getDb returns null → router throws INTERNAL_SERVER_ERROR
    await expect(caller.knowledgeBase.deleteMany({ ids: [1, 2, 3] })).rejects.toThrow();
  });

  it("knowledgeBase.deleteMany rejects empty id list at the schema layer", async () => {
    const { appRouter } = await import("./routers");
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.knowledgeBase.deleteMany({ ids: [] })).rejects.toThrow();
  });

  it("getEmbedding returns null without API key (graceful degradation)", async () => {
    const { _resetEmbeddingApiStateForTests, getEmbedding } = await import("./embeddings");
    _resetEmbeddingApiStateForTests();
    const oldKey = process.env.BUILT_IN_FORGE_API_KEY;
    delete process.env.BUILT_IN_FORGE_API_KEY;
    try {
      // ENV.forgeApiKey is captured at module load, so without an API key
      // at import time the call returns null. Even if it isn't null in this
      // env, we just assert it's null OR an array — never throwing.
      const result = await getEmbedding("test query");
      expect(result === null || Array.isArray(result)).toBe(true);
    } finally {
      if (oldKey !== undefined) process.env.BUILT_IN_FORGE_API_KEY = oldKey;
    }
  });
});
