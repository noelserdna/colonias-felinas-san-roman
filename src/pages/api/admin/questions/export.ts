import type { APIRoute } from "astro";
import { getDb } from "../../../../lib/db";
import { exportQuestions } from "../../../../lib/admin";
import { inputsToCsv } from "../../../../lib/questions-io";

export const GET: APIRoute = async ({ url }) => {
  const items = await exportQuestions(getDb());
  const date = new Date().toISOString().slice(0, 10);
  if (url.searchParams.get("format") === "json") {
    return new Response(JSON.stringify(items, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="preguntas-${date}.json"` },
    });
  }
  return new Response(inputsToCsv(items), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="preguntas-${date}.csv"` },
  });
};
