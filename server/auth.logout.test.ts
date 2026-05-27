import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

/**
 * V11.13 M4 — better-auth migráció után a tRPC auth.logout no-op,
 * a tényleges session-cleanup-ot a /api/auth/sign-out (better-auth) végzi
 * a kliens-oldali fetch-hívásból. Ez a teszt csak azt validálja, hogy az
 * endpoint él, success-t ad és nem szivárogtat user-adatot.
 */
function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    emailVerified: true,
    image: null,
    name: "Sample User",
    loginMethod: "magic-link",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("auth.logout", () => {
  it("returns success — actual session cleanup is delegated to /api/auth/sign-out", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});
