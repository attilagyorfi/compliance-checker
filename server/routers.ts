import { complianceRouter } from "./routers/compliance";
import { pdfExportRouter } from "./routers/pdfExport";
import { regulationSourcesRouter } from "./routers/regulationSources";
import { platformCredentialsRouter } from "./routers/platformCredentials";
import { standardsSearchRouter } from "./routers/standardsSearch";
import { knowledgeBaseRouter } from "./routers/knowledgeBase";
import { projectsRouter } from "./routers/projects";
import { projectMembersRouter } from "./routers/projectMembers";
import { auditRouter } from "./routers/audit";
import { searchSettingsRouter } from "./routers/searchSettings";
import { adminRouter } from "./routers/admin";
import { notificationsRouter } from "./routers/notifications";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    // Profil-lekérés: a context.ts most a better-auth session-ből tölti be a
    // user-t (LOCAL_DEV_USER_ID bypass-szal dev-ben).
    me: publicProcedure.query(opts => opts.ctx.user),
    // Logout: a better-auth /api/auth/sign-out endpointja kezeli — ezt a
    // logout-route kliensoldalon közvetlenül hívjuk. A meglévő tRPC endpoint
    // backward-compat: szimplán signalozza a kliensnek, hogy a kliens-oldali
    // logout-call megtörtént. A session-cleanup a better-auth dolga.
    logout: publicProcedure.mutation(() => {
      return { success: true } as const;
    }),
  }),

  compliance: complianceRouter,
  pdf: pdfExportRouter,
  regulationSources: regulationSourcesRouter,
  platformCredentials: platformCredentialsRouter,
  standardsSearch: standardsSearchRouter,
  knowledgeBase: knowledgeBaseRouter,
  projects: projectsRouter,
  projectMembers: projectMembersRouter,
  audit: auditRouter,
  searchSettings: searchSettingsRouter,
  admin: adminRouter,
  notifications: notificationsRouter,

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
