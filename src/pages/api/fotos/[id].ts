import type { APIRoute } from "astro";
import { getDb } from "../../../lib/db";
import { assertCanManage, ColonyError } from "../../../lib/colonies";
import { getPhoto, readPhotoBody } from "../../../lib/photos";

// Fotos privadas: solo las ven las personas que cuidan la colonia y el ayuntamiento.
export const GET: APIRoute = async ({ params, locals }) => {
  const db = getDb();
  const photo = await getPhoto(db, params.id!);
  if (!photo) return new Response("No encontrada", { status: 404 });
  try {
    await assertCanManage(db, photo.colonyId, locals.user!);
  } catch (e) {
    if (e instanceof ColonyError) return new Response("Prohibido", { status: 403 });
    throw e;
  }
  const file = await readPhotoBody(photo);
  if (!file) return new Response("No encontrada", { status: 404 });
  const headers: Record<string, string> = {
    "content-type": file.contentType,
    "x-content-type-options": "nosniff",
    // Privada (nunca en cachés compartidas); el contenido de un id no cambia.
    "cache-control": "private, max-age=31536000, immutable",
  };
  if (file.etag) headers.etag = file.etag;
  return new Response(file.body, { headers });
};
