/**
 * Belépési link és fiók-létrehozás: a valódi better-auth beállítás memória-adapterrel,
 * adatbázis és levélküldés nélkül.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuthOptions } from "./_core/auth";

const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const BASE = "http://localhost:3000";
const KNOWN = "ismert@example.com";

function setup(minMagicLinkMs = 0) {
  const db: Record<string, Record<string, unknown>[]> = {
    user: [
      {
        id: 1,
        email: KNOWN,
        name: "Ismert Felhasználó",
        emailVerified: false,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    session: [],
    account: [],
    verification: [],
  };
  const options = createAuthOptions({
    database: memoryAdapter(db),
    secret: "teszt-titok-teszt-titok-teszt-titok",
    baseURL: BASE,
    minMagicLinkMs,
  });
  // A memória-adapter nem ad magától azonosítót, ezért itt sorszámoz.
  const auth = betterAuth({ ...options, advanced: { database: { generateId: "serial" } } });
  const post = (path: string, body: unknown) =>
    auth.handler(
      new Request(`${BASE}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE },
        body: JSON.stringify(body),
      }),
    );
  return { db, auth, post };
}

const requestLink = (post: ReturnType<typeof setup>["post"], email: string) =>
  post("/sign-in/magic-link", { email, name: "Valaki", callbackURL: "/search" });

const linkFromMail = () => /href="([^"]+)"/.exec(send.mock.calls[0]![0].html)![1]!;

beforeEach(() => {
  send.mockReset().mockResolvedValue({ error: null });
  vi.stubEnv("RESEND_API_KEY", "teszt");
});
afterEach(() => vi.unstubAllEnvs());

describe("belépési link kérése", () => {
  it("ismeretlen címre nincs levél, felhasználó és munkamenet sem", async () => {
    const { db, post } = setup();
    const res = await requestLink(post, "idegen@example.com");
    expect(res.status).toBe(200);
    expect(send).not.toHaveBeenCalled();
    expect(db.user).toHaveLength(1);
    expect(db.session).toHaveLength(0);
  });

  it("ismeretlen címre a link a naplóba sem kerül, ha nincs levélküldő", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { post } = setup();
    await requestLink(post, "idegen@example.com");
    expect(info).not.toHaveBeenCalled();
    await requestLink(post, KNOWN);
    expect(info).toHaveBeenCalledTimes(1);
    info.mockRestore();
  });

  it("a válasz azonos ismert és ismeretlen címre", async () => {
    const { post } = setup();
    const describeResponse = async (res: Response) => ({
      status: res.status,
      headers: [...res.headers.keys()].sort(),
      cookies: res.headers.getSetCookie(),
      body: await res.text(),
    });
    const known = await describeResponse(await requestLink(post, KNOWN));
    const unknown = await describeResponse(await requestLink(post, "idegen@example.com"));
    expect(unknown).toEqual(known);
  });

  it("levélküldési hiba sem árulja el, hogy a cím létezik", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    send.mockRejectedValue(new Error("levélküldő hiba"));
    const { post } = setup();
    const known = await requestLink(post, KNOWN);
    const unknown = await requestLink(post, "idegen@example.com");
    expect(known.status).toBe(unknown.status);
    expect(await known.text()).toBe(await unknown.text());
    error.mockRestore();
  });

  it.each([KNOWN, "idegen@example.com"])("%s: a kérés legalább a megadott ideig tart", async (email) => {
    const { post } = setup(200);
    const start = performance.now();
    await requestLink(post, email);
    expect(performance.now() - start).toBeGreaterThanOrEqual(190);
  });
});

describe("meglévő felhasználó", () => {
  it.each([KNOWN, "Ismert@Example.COM"])("%s: a link belépteti, új fiók nélkül", async (email) => {
    const { db, auth, post } = setup();
    await requestLink(post, email);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![0].to).toBe(KNOWN);

    const res = await auth.handler(new Request(linkFromMail()));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${BASE}/search`);
    expect(res.headers.get("set-cookie")).toContain("session_token");
    expect(db.user).toHaveLength(1);
    expect(db.session).toHaveLength(1);
    expect(String(db.session![0]!.userId)).toBe("1");
  });

  it("meglévő munkamenete érvényes marad", async () => {
    const { auth, post } = setup();
    await requestLink(post, KNOWN);
    const res = await auth.handler(new Request(linkFromMail()));
    const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
    expect(session?.user.email).toBe(KNOWN);
  });

  it("időközben törölt felhasználó linkje sem hoz létre fiókot vagy munkamenetet", async () => {
    const { db, auth, post } = setup();
    await requestLink(post, KNOWN);
    db.user!.length = 0;
    const res = await auth.handler(new Request(linkFromMail()));
    expect(res.headers.get("set-cookie") ?? "").not.toContain("session_token");
    expect(db.user).toHaveLength(0);
    expect(db.session).toHaveLength(0);
  });
});

describe("más útvonalak", () => {
  it.each([
    ["/sign-up/email", { email: "idegen@example.com", password: "valami-jelszo-123", name: "X" }],
    ["/sign-in/email", { email: KNOWN, password: "valami-jelszo-123" }],
    ["/sign-in/social", { provider: "google", idToken: { token: "x" } }],
  ])("%s nem hoz létre felhasználót vagy munkamenetet", async (path, body) => {
    const { db, post } = setup();
    const res = await post(path, body);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(db.user).toHaveLength(1);
    expect(db.session).toHaveLength(0);
  });

  it("a belső fiók-létrehozás is tiltott", async () => {
    const { db, auth } = setup();
    const ctx = await auth.$context;
    const created = await ctx.internalAdapter.createUser({
      email: "idegen@example.com",
      name: "X",
      emailVerified: true,
    });
    expect(created).toBeNull();
    expect(db.user).toHaveLength(1);
  });
});
