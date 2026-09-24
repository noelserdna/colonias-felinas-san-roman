import { ExamError } from "./exam";
import { json } from "./util";
import { ZodError } from "zod";

export async function handleErrors(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ExamError) return json({ error: e.message }, e.status);
    if (e instanceof ZodError) return json({ error: "Datos no válidos", issues: e.issues }, 400);
    console.error(e);
    return json({ error: "Error interno" }, 500);
  }
}
