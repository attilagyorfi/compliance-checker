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
