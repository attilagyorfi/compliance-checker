import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

// ── Mock database helpers ─────────────────────────────────────────────────────
vi.mock("./db", () => ({
  createAnalysis: vi.fn().mockResolvedValue(42),
  getAnalysisById: vi.fn().mockResolvedValue({
    id: 42,
    title: "Test Analysis",
    status: "completed",
    planDocumentKey: "test-key",
    planDocumentName: "test-plan.pdf",
    regulationDocumentKeys: [],
    regulationDocumentNames: ["test-reg.pdf"],
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
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

    // Minimal valid base64 for a tiny "PDF"
    const fakeBase64 = Buffer.from("%PDF-1.4 fake content").toString("base64");

    const result = await caller.compliance.startAnalysis({
      title: "Test Elemzés",
      planDocument: { key: "", name: "plan.pdf", base64: fakeBase64 },
      regulationDocuments: [{ name: "reg.pdf", base64: fakeBase64 }],
    });

    expect(result.analysisId).toBe(42);
  });
});

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
      planDocumentKey: null,
      planDocumentName: null,
      regulationDocumentKeys: [],
      regulationDocumentNames: [],
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
