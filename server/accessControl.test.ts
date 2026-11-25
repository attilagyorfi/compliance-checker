/**
 * Jogosultsági tesztek: minden tRPC végpont be van sorolva (nyilvános / belépés /
 * admin), és a besorolást végpontonként ellenőrizzük. Új végpont besorolás nélkül
 * megbuktatja a tesztet, így nem maradhat véletlenül nyilvános.
 */

import { describe, expect, it, vi } from "vitest";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TRPCError } from "@trpc/server";
import { isForbiddenError, isUnauthorizedError } from "@shared/analysisRoute";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue(null),
  createAnalysis: vi.fn().mockResolvedValue(1),
  getAnalysisById: vi.fn().mockResolvedValue(undefined),
  listAnalyses: vi.fn().mockResolvedValue([]),
  updateAnalysisStatus: vi.fn().mockResolvedValue(undefined),
}));

const PUBLIC = ["auth.me", "auth.logout", "system.health"];

const LOGIN = [
  "audit.list",
  "audit.resourceTypes",
  "audit.summary",
  "compliance.getAnalysis",
  "compliance.listAnalyses",
  "compliance.startAnalysis",
  "compliance.updateFindingStatus",
  "compliance.updateWorkflowStatus",
  "compliance.uploadDocument",
  "knowledgeBase.getEmbeddingCounts",
  "knowledgeBase.getTextsForSearch",
  "knowledgeBase.list",
  "notifications.delete",
  "notifications.list",
  "notifications.markAllRead",
  "notifications.markRead",
  "notifications.unreadCount",
  "pdf.exportPdf",
  "projectMembers.add",
  "projectMembers.changeRole",
  "projectMembers.list",
  "projectMembers.remove",
  "projects.create",
  "projects.delete",
  "projects.export",
  "projects.getById",
  "projects.import",
  "projects.list",
  "projects.update",
  "regulationSources.getById",
  "regulationSources.getEmbeddingCounts",
  "regulationSources.list",
  "searchSettings.get",
  "searchSettings.reset",
  "searchSettings.upsert",
  "standardsSearch.documentHighlights",
  "standardsSearch.extendAnswer",
  "standardsSearch.search",
  "standardsSearch.searchV2",
];

const ADMIN = [
  "admin.changeUserRole",
  "admin.emptyTrash",
  "admin.listAllProjects",
  "admin.listUsers",
  "admin.stats",
  "knowledgeBase.delete",
  "knowledgeBase.deleteMany",
  "knowledgeBase.permanentDelete",
  "knowledgeBase.regenerateEmbeddings",
  "knowledgeBase.restore",
  "knowledgeBase.upload",
  "platformCredentials.deleteCredentials",
  "platformCredentials.listPlatforms",
  "platformCredentials.saveCredentials",
  "platformCredentials.testConnection",
  "regulationSources.create",
  "regulationSources.createFromPdf",
  "regulationSources.delete",
  "regulationSources.deleteMany",
  "regulationSources.fetchContent",
  "regulationSources.permanentDelete",
  "regulationSources.refreshAllStale",
  "regulationSources.regenerateEmbeddings",
  "regulationSources.restore",
  "regulationSources.restoreMany",
  "regulationSources.update",
  "standardsSearch.deleteQuery",
  "standardsSearch.getQuery",
  "standardsSearch.listHistory",
];

type Role = NonNullable<TrpcContext["user"]>["role"];

function createContext(role: Role | null): TrpcContext {
  return {
    user: role && {
      id: 1,
      openId: "test-user",
      email: "user@example.com",
      emailVerified: true,
      image: null,
      name: "Teszt Felhasználó",
      loginMethod: "magic-link",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

/**
 * Bemenet nélkül hívja a végpontot, és a hibakódot adja vissza (siker: null). A
 * jogosultsági kapu a bemenet ellenőrzése előtt fut, ezért az elutasításhoz nem
 * kell érvényes bemenet, és az átengedett hívás sem végez valódi munkát.
 */
async function callCode(path: string, role: Role | null): Promise<string | null> {
  const [routerName, procedureName] = path.split(".");
  const caller = appRouter.createCaller(createContext(role)) as unknown as Record<
    string,
    Record<string, (input?: unknown) => Promise<unknown>>
  >;
  try {
    await caller[routerName][procedureName]();
    return null;
  } catch (err) {
    return err instanceof TRPCError ? err.code : "INTERNAL_SERVER_ERROR";
  }
}

const REJECTED = ["UNAUTHORIZED", "FORBIDDEN"];

describe("végpontok besorolása", () => {
  it("minden végpont pontosan egy csoportban szerepel", () => {
    const all = Object.keys(appRouter._def.procedures).sort();
    expect([...PUBLIC, ...LOGIN, ...ADMIN].sort()).toEqual(all);
  });
});

describe("belépés nélkül", () => {
  it.each([...LOGIN, ...ADMIN])("%s elutasít (UNAUTHORIZED)", async (path) => {
    expect(await callCode(path, null)).toBe("UNAUTHORIZED");
  });

  it.each(PUBLIC)("%s nyilvános", async (path) => {
    expect(REJECTED).not.toContain(await callCode(path, null));
  });
});

describe("belépett, nem admin felhasználó", () => {
  it.each(ADMIN)("%s elutasít (FORBIDDEN)", async (path) => {
    expect(await callCode(path, "user")).toBe("FORBIDDEN");
    expect(await callCode(path, "reviewer")).toBe("FORBIDDEN");
  });

  it.each(LOGIN)("%s átenged", async (path) => {
    expect(REJECTED).not.toContain(await callCode(path, "user"));
  });
});

describe("admin", () => {
  it.each(ADMIN)("%s átenged", async (path) => {
    expect(REJECTED).not.toContain(await callCode(path, "admin"));
  });
});

describe("HTTP-válasz, amelyet a kliens kap", () => {
  const request = (path: string, role: Role | null, method = "GET") =>
    fetchRequestHandler({
      endpoint: "/api/trpc",
      req: new Request(`http://localhost/api/trpc/${path}`, {
        method,
        ...(method === "POST"
          ? { headers: { "content-type": "application/json" }, body: "{}" }
          : {}),
      }),
      router: appRouter,
      createContext: () => createContext(role),
    });

  it("lekérdezés belépés nélkül: 401, a kliens felismeri", async () => {
    const res = await request("compliance.listAnalyses", null);
    expect(res.status).toBe(401);
    const { error } = await res.json();
    expect(isUnauthorizedError({ data: error.json.data })).toBe(true);
  });

  it("módosítás belépés nélkül: 401", async () => {
    const res = await request("regulationSources.permanentDelete", null, "POST");
    expect(res.status).toBe(401);
  });

  it("admin végpont nem adminnak: 403, magyar üzenettel", async () => {
    const res = await request("platformCredentials.listPlatforms", "user");
    expect(res.status).toBe(403);
    const { error } = await res.json();
    expect(isForbiddenError({ data: error.json.data })).toBe(true);
    expect(error.json.message).toBe("Ehhez a művelethez admin jogosultság szükséges.");
  });

  it("auth.me belépés nélkül is válaszol", async () => {
    const res = await request("auth.me", null);
    expect(res.status).toBe(200);
  });
});
