/**
 * Project members router — V10.A4
 *
 * RBAC szerepek a `project_members` táblán:
 *   - owner    : minden műveletet végezhet (átnevezés, törlés, tagok kezelése)
 *   - member   : olvas és új child-erőforrást hozhat létre (analízis, KB, keresés)
 *   - reviewer : csak olvasás
 *
 * V10.A4 a tagság-kezelés alapját adja. A projects router mutáció-szigorítás
 * itt van (`requireOwnerForProject`), és a child-router-ek tovább szigoríthatók
 * a `requireMembership` helperrel későbbi körökben.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { projectMembers, projects, users } from "../../drizzle/schema";
import { createNotification } from "../notifications";

const roleEnum = z.enum(["owner", "member", "reviewer"]);

type Role = z.infer<typeof roleEnum>;

type DbType = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/**
 * Look up the membership row for `userId` in `projectId`. Returns null if not a member.
 */
export async function getProjectMembership(
  db: DbType,
  projectId: number,
  userId: number
): Promise<{ role: Role } | null> {
  const rows = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Throw FORBIDDEN if the user is not a member of the project at all.
 */
export async function requireMembership(
  db: DbType,
  projectId: number,
  userId: number
): Promise<{ role: Role }> {
  const m = await getProjectMembership(db, projectId, userId);
  if (!m) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Nincs hozzáférésed ehhez a projekthez." });
  }
  return m;
}

/**
 * Throw FORBIDDEN if the user is not an owner of the project.
 */
export async function requireOwnerForProject(
  db: DbType,
  projectId: number,
  userId: number
): Promise<void> {
  const m = await getProjectMembership(db, projectId, userId);
  if (!m || m.role !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Csak a projekt tulajdonosa végezheti el ezt a műveletet." });
  }
}

/**
 * Count active owners of a project. Used to prevent removing/demoting the last owner.
 */
async function countOwners(db: DbType, projectId: number): Promise<number> {
  const rows = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, "owner")));
  return rows.length;
}

export const projectMembersRouter = router({
  /**
   * List members of a project (with user info joined).
   */
  list: publicProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db
        .select({
          id: projectMembers.id,
          projectId: projectMembers.projectId,
          userId: projectMembers.userId,
          role: projectMembers.role,
          createdAt: projectMembers.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(projectMembers)
        .leftJoin(users, eq(projectMembers.userId, users.id))
        .where(eq(projectMembers.projectId, input.projectId));
      return rows;
    }),

  /**
   * Add a user to a project by email. Owner-only.
   */
  add: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      email: z.string().email(),
      role: roleEnum.default("member"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });

      const projectExists = await db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.id, input.projectId)).limit(1);
      if (!projectExists[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Projekt nem található." });
      }

      await requireOwnerForProject(db, input.projectId, ctx.user.id);

      const targetUserRows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      const targetUser = targetUserRows[0];
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: `Nincs ilyen e-mail című felhasználó: ${input.email}` });
      }

      const existing = await getProjectMembership(db, input.projectId, targetUser.id);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Ez a felhasználó már tagja a projektnek." });
      }

      await db.insert(projectMembers).values({
        projectId: input.projectId,
        userId: targetUser.id,
        role: input.role,
      });

      // Notify the newly added user (fire-and-forget).
      await createNotification({
        userId: targetUser.id,
        eventType: "project_member_add",
        title: `Hozzáadva új projekthez: ${projectExists[0].name ?? "Projekt"}`,
        body: `${ctx.user.email ?? "Egy felhasználó"} ${input.role === "owner" ? "tulajdonosi" : input.role === "reviewer" ? "lektori" : "tag"} szerepkörrel adott hozzá a projekthez.`,
        link: `/projects/${input.projectId}`,
        email: input.email,
      });

      return { success: true };
    }),

  /**
   * Change a member's role. Owner-only. Cannot demote the last remaining owner.
   */
  changeRole: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      userId: z.number().int().positive(),
      role: roleEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });

      await requireOwnerForProject(db, input.projectId, ctx.user.id);

      const target = await getProjectMembership(db, input.projectId, input.userId);
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "A felhasználó nem tagja a projektnek." });
      }

      if (target.role === "owner" && input.role !== "owner") {
        const owners = await countOwners(db, input.projectId);
        if (owners <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Az utolsó tulajdonos szerepköre nem módosítható. Előbb adj hozzá egy másik tulajdonost.",
          });
        }
      }

      await db
        .update(projectMembers)
        .set({ role: input.role })
        .where(and(eq(projectMembers.projectId, input.projectId), eq(projectMembers.userId, input.userId)));

      return { success: true };
    }),

  /**
   * Remove a member. Owner-only. Cannot remove the last remaining owner.
   */
  remove: protectedProcedure
    .input(z.object({
      projectId: z.number().int().positive(),
      userId: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Adatbázis nem elérhető." });

      await requireOwnerForProject(db, input.projectId, ctx.user.id);

      const target = await getProjectMembership(db, input.projectId, input.userId);
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "A felhasználó nem tagja a projektnek." });
      }

      if (target.role === "owner") {
        const owners = await countOwners(db, input.projectId);
        if (owners <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Az utolsó tulajdonos nem távolítható el. Előbb adj hozzá egy másik tulajdonost.",
          });
        }
      }

      await db
        .delete(projectMembers)
        .where(and(eq(projectMembers.projectId, input.projectId), eq(projectMembers.userId, input.userId)));

      return { success: true };
    }),
});
