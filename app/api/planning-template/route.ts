/**
 * Serves the downloadable planning template workbook.
 *
 * ExcelJS is Node-only, so this route (not a client component) is the only
 * place it runs — `lib/excel/template.ts` must never be imported from
 * client-side code.
 */

import { buildPlanningTemplate, TEMPLATE_FILENAME } from "@/lib/excel/template";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const buffer = await buildPlanningTemplate();

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${TEMPLATE_FILENAME}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
