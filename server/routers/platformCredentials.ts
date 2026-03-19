/**
 * tRPC router for managing platform credentials.
 * Handles storing, testing, and managing login credentials for paid platforms.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { platformCredentials } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { encryptPassword, loginToMszt, loginToJogtar, loginToEpitesijog } from "../regulationScraper";

const platformEnum = z.enum(["mszt", "jogtar", "epitesijog", "eurlex"]);

const PLATFORM_INFO = {
  mszt: {
    name: "MSZT Online Szabványtár",
    url: "https://szabvanykonyvtar.mszt.hu",
    description: "Magyar Szabványügyi Testület – MSZ szabványok (Eurocode, stb.)",
    loginUrl: "https://szabvanykonyvtar.mszt.hu/login",
    isFree: false,
  },
  jogtar: {
    name: "Jogtár Premium",
    url: "https://uj.jogtar.hu",
    description: "Wolters Kluwer – Kommentált jogszabályok, indoklások",
    loginUrl: "https://uj.jogtar.hu/login",
    isFree: false,
  },
  epitesijog: {
    name: "Építésijog.hu",
    url: "https://epitesijog.hu",
    description: "Kommentált építési jog, hatósági eljárások",
    loginUrl: "https://epitesijog.hu/belepes",
    isFree: false,
  },
  eurlex: {
    name: "EUR-Lex",
    url: "https://eur-lex.europa.eu",
    description: "Európai Unió jogszabályai – ingyenes hozzáférés",
    loginUrl: "https://eur-lex.europa.eu",
    isFree: true,
  },
} as const;

export const platformCredentialsRouter = router({
  /**
   * Get info about all platforms (without passwords).
   */
  listPlatforms: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

    const storedCreds = await db.select().from(platformCredentials);
    
    return Object.entries(PLATFORM_INFO).map(([key, info]) => {
      const stored = storedCreds.find((c) => c.platform === key);
      return {
        platform: key as keyof typeof PLATFORM_INFO,
        ...info,
        isConfigured: !!(stored?.username),
        username: stored?.username ?? null,
        status: stored?.status ?? "untested",
        lastConnectedAt: stored?.lastConnectedAt ?? null,
        lastError: stored?.lastError ?? null,
        credentialId: stored?.id ?? null,
      };
    });
  }),

  /**
   * Save or update credentials for a platform.
   * Password is encrypted before storage.
   */
  saveCredentials: publicProcedure
    .input(
      z.object({
        platform: platformEnum,
        username: z.string().min(1),
        password: z.string().min(1),
        displayName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const encryptedPassword = encryptPassword(input.password);

      // Check if credentials already exist for this platform
      const existing = await db
        .select()
        .from(platformCredentials)
        .where(eq(platformCredentials.platform, input.platform))
        .limit(1);

      if (existing[0]) {
        // Update existing
        await db.update(platformCredentials).set({
          username: input.username,
          encryptedPassword,
          displayName: input.displayName ?? null,
          status: "untested",
          lastError: null,
        }).where(eq(platformCredentials.platform, input.platform));
      } else {
        // Insert new
        await db.insert(platformCredentials).values({
          platform: input.platform,
          username: input.username,
          encryptedPassword,
          displayName: input.displayName ?? null,
          status: "untested",
        });
      }

      return { success: true };
    }),

  /**
   * Delete credentials for a platform.
   */
  deleteCredentials: publicProcedure
    .input(z.object({ platform: platformEnum }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });
      await db.delete(platformCredentials).where(eq(platformCredentials.platform, input.platform));
      return { success: true };
    }),

  /**
   * Test the connection to a platform using stored credentials.
   */
  testConnection: publicProcedure
    .input(z.object({ platform: platformEnum }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB not available" });

      const rows = await db
        .select()
        .from(platformCredentials)
        .where(eq(platformCredentials.platform, input.platform))
        .limit(1);

      const cred = rows[0];
      if (!cred?.username || !cred?.encryptedPassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nincsenek mentett hitelesítő adatok ehhez a platformhoz." });
      }

      const { decryptPassword } = await import("../regulationScraper");
      const password = decryptPassword(cred.encryptedPassword);

      let loginResult;
      if (input.platform === "mszt") {
        loginResult = await loginToMszt(cred.username, password);
      } else if (input.platform === "jogtar") {
        loginResult = await loginToJogtar(cred.username, password);
      } else if (input.platform === "epitesijog") {
        loginResult = await loginToEpitesijog(cred.username, password);
      } else {
        // EUR-Lex is free, always "connected"
        loginResult = { success: true };
      }

      // Update status in DB
      await db.update(platformCredentials).set({
        status: loginResult.success ? "connected" : "failed",
        lastConnectedAt: loginResult.success ? new Date() : undefined,
        lastError: loginResult.success ? null : (loginResult.error ?? "Ismeretlen hiba"),
      }).where(eq(platformCredentials.platform, input.platform));

      return {
        success: loginResult.success,
        error: loginResult.success ? undefined : loginResult.error,
      };
    }),
});
