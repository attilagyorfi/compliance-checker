import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import { auditLogs, users } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const state = vi.hoisted(() => ({
  existing: [] as { id: number }[],
  where: null as unknown,
  inserts: [] as { table: unknown; values: Record<string, unknown> }[],
}));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          state.where = condition;
          return { limit: async () => state.existing };
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        state.inserts.push({ table, values });
        return [{ insertId: 7 }];
      },
    }),
  })),
}));

function callerAs(role: "admin" | "user" | "reviewer" | null) {
  return appRouter.createCaller({
    user: role && {
      id: 1,
      openId: "test",
      email: "admin@example.com",
      emailVerified: true,
      image: null,
      name: "Teszt",
      loginMethod: "magic-link",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}

const INPUT = { email: "uj@example.com", name: "Új Felhasználó", role: "reviewer" as const };
const insertsInto = (table: unknown) =>
  state.inserts.filter((i) => i.table === table).map((i) => i.values);

beforeEach(() => {
  state.existing = [];
  state.where = null;
  state.inserts = [];
});

describe("admin.createUser", () => {
  it("felveszi a felhasználót, és auditbejegyzést ír", async () => {
    expect(await callerAs("admin").admin.createUser(INPUT)).toEqual({ id: 7 });
    expect(insertsInto(users)).toEqual([{ ...INPUT, loginMethod: "magic-link" }]);
    expect(insertsInto(auditLogs)).toMatchObject([
      { userId: 1, eventType: "user_create", resourceType: "user", resourceId: "7" },
    ]);
  });

  it("alapból user szerepkört ad, a címet kisbetűsíti, a szóközöket levágja", async () => {
    await callerAs("admin").admin.createUser({ email: "  Uj@Example.COM ", name: "  Új  " });
    expect(insertsInto(users)).toMatchObject([
      { email: "uj@example.com", name: "Új", role: "user" },
    ]);
  });

  it("létező címre CONFLICT, és nem ír semmit", async () => {
    state.existing = [{ id: 3 }];
    await expect(callerAs("admin").admin.createUser(INPUT)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.inserts).toEqual([]);
  });

  it("a duplikátumot kis- és nagybetűtől függetlenül keresi", async () => {
    await callerAs("admin").admin.createUser({ ...INPUT, email: "UJ@example.com" });
    const query = new MySqlDialect().sqlToQuery(state.where as SQL);
    expect(query.sql).toContain("LOWER(");
    expect(query.params).toEqual(["uj@example.com"]);
  });

  it.each([
    { ...INPUT, email: "nem-email" },
    { ...INPUT, email: `${"a".repeat(320)}@example.com` },
    { ...INPUT, name: "   " },
    { ...INPUT, name: "x".repeat(256) },
    { ...INPUT, role: "owner" as never },
  ])("érvénytelen bemenet: BAD_REQUEST (%#)", async (input) => {
    await expect(callerAs("admin").admin.createUser(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(state.inserts).toEqual([]);
  });

  it.each([
    ["user", "FORBIDDEN"],
    ["reviewer", "FORBIDDEN"],
    [null, "UNAUTHORIZED"],
  ] as const)("%s: %s", async (role, code) => {
    await expect(callerAs(role).admin.createUser(INPUT)).rejects.toMatchObject({ code });
    expect(state.inserts).toEqual([]);
  });
});
