import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getAnalysisById } from "../db";
import { generatePdfReport } from "../pdfReport";

export const pdfExportRouter = router({
  exportPdf: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const analysis = await getAnalysisById(input.id);
      if (!analysis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Elemzés nem található" });
      }
      if (analysis.status !== "completed") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Az elemzés még nem fejeződött be" });
      }

      const pdfBuffer = await generatePdfReport(analysis);
      const base64 = pdfBuffer.toString("base64");
      const filename = `megfelelesi-riport-${analysis.id}-${Date.now()}.pdf`;

      return { base64, filename };
    }),
});
