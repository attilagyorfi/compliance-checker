import { COOKIE_NAME } from "@shared/const";
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
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
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

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
