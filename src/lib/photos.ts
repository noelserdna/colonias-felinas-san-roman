// Fotos de las colonias guardadas en Cloudflare R2 (bucket privado PHOTOS).
// La tabla `photos` solo guarda los metadatos y la clave del fichero.
import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import type { DB } from "./db";
import { schema } from "./db";
import { ColonyError } from "./colonies";
import { sniffImageType, uuid } from "./util";

/** Tamaño máximo por foto (ya reducida en el móvil; el original suele pesar varios MB). */
export const PHOTO_MAX_BYTES = 1_500_000;
export const MAX_NOTE_PHOTOS = 4;

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

async function readPhoto(file: File) {
  if (file.size > PHOTO_MAX_BYTES) throw new ColonyError("La foto es demasiado grande (máximo 1,5 MB). Prueba con otra o recórtala.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImageType(bytes);
  if (!contentType) throw new ColonyError("La foto debe ser una imagen JPG, PNG o WebP.");
  return { bytes, contentType };
}

async function insertPhoto(db: DB, file: File, ref: { colonyId: string; catId: string; noteId?: string | null; userId: string }) {
  const { bytes, contentType } = await readPhoto(file);
  const id = uuid();
  const storageKey = `colonias/${ref.colonyId}/${id}.${EXT[contentType]}`;
  // Primero el fichero y después la fila: si falla R2 no queda una foto rota en la base de datos.
  await env.PHOTOS.put(storageKey, bytes, { httpMetadata: { contentType } });
  try {
    await db.insert(schema.photos).values({
      id,
      colonyId: ref.colonyId,
      catId: ref.catId,
      noteId: ref.noteId ?? null,
      contentType,
      storageKey,
      bytes: bytes.length,
      userId: ref.userId,
      createdAt: new Date(),
    });
  } catch (e) {
    await env.PHOTOS.delete(storageKey);
    throw e;
  }
  return id;
}

/** Borra filas de fotos y sus ficheros en R2. */
async function deletePhotos(db: DB, rows: { id: string; storageKey: string | null }[]) {
  if (rows.length === 0) return;
  const keys = rows.map((r) => r.storageKey).filter((k): k is string => Boolean(k));
  if (keys.length) await env.PHOTOS.delete(keys);
  for (const r of rows) await db.delete(schema.photos).where(eq(schema.photos.id, r.id));
}

async function findCat(db: DB, colonyId: string, catId: string) {
  const cat = await db.query.colonyCats.findFirst({ where: and(eq(schema.colonyCats.id, catId), eq(schema.colonyCats.colonyId, colonyId)) });
  if (!cat) throw new ColonyError("Ese gato no pertenece a esta colonia.", 404);
  return cat;
}

/** Foto principal de la ficha: sustituye a la anterior. */
export async function setCatPhoto(db: DB, colonyId: string, catId: string, file: File, userId: string) {
  const cat = await findCat(db, colonyId, catId);
  const id = await insertPhoto(db, file, { colonyId, catId, userId });
  await db.update(schema.colonyCats).set({ photoId: id, updatedAt: new Date() }).where(eq(schema.colonyCats.id, catId));
  if (cat.photoId) {
    const old = await db.query.photos.findFirst({ where: eq(schema.photos.id, cat.photoId) });
    if (old) await deletePhotos(db, [old]);
  }
}

export async function removeCatPhoto(db: DB, colonyId: string, catId: string) {
  const cat = await findCat(db, colonyId, catId);
  if (!cat.photoId) return;
  await db.update(schema.colonyCats).set({ photoId: null, updatedAt: new Date() }).where(eq(schema.colonyCats.id, catId));
  const old = await db.query.photos.findFirst({ where: eq(schema.photos.id, cat.photoId) });
  if (old) await deletePhotos(db, [old]);
}

export async function addCatNote(db: DB, colonyId: string, catId: string, userId: string, texto: string, files: File[]) {
  await findCat(db, colonyId, catId);
  const t = texto.trim();
  const fotos = files.filter((f) => f.size > 0);
  if (!t && fotos.length === 0) throw new ColonyError("Escribe una observación o añade al menos una foto.");
  if (t.length > 4000) throw new ColonyError("La observación es demasiado larga (máximo 4000 caracteres).");
  if (fotos.length > MAX_NOTE_PHOTOS) throw new ColonyError(`Puedes añadir como máximo ${MAX_NOTE_PHOTOS} fotos por observación.`);
  for (const f of fotos) await readPhoto(f); // valida todas antes de guardar nada
  const noteId = uuid();
  await db.insert(schema.catNotes).values({ id: noteId, catId, userId, texto: t, createdAt: new Date() });
  for (const f of fotos) await insertPhoto(db, f, { colonyId, catId, noteId, userId });
}

export async function deleteCatNote(db: DB, colonyId: string, noteId: string, user: { id: string; role: string }) {
  const note = await db.query.catNotes.findFirst({ where: eq(schema.catNotes.id, noteId) });
  if (!note) return;
  await findCat(db, colonyId, note.catId);
  if (note.userId !== user.id && user.role !== "admin") throw new ColonyError("Solo quien la escribió puede borrar una observación.", 403);
  const fotos = await db.select({ id: schema.photos.id, storageKey: schema.photos.storageKey }).from(schema.photos).where(eq(schema.photos.noteId, noteId));
  await deletePhotos(db, fotos);
  await db.delete(schema.catNotes).where(eq(schema.catNotes.id, noteId));
}

/** Metadatos de una foto (para comprobar permisos antes de servirla). */
export async function getPhoto(db: DB, id: string) {
  return db.query.photos.findFirst({ where: eq(schema.photos.id, id) });
}

/** Contenido de la foto: desde R2 o, si es una foto antigua aún sin migrar, desde D1. */
export async function readPhotoBody(photo: { storageKey: string | null; dataB64: string | null; contentType: string }) {
  if (photo.storageKey) {
    const obj = await env.PHOTOS.get(photo.storageKey);
    if (!obj) return null;
    return { body: obj.body as ReadableStream, contentType: obj.httpMetadata?.contentType ?? photo.contentType, etag: obj.httpEtag };
  }
  if (photo.dataB64) {
    return { body: Uint8Array.from(atob(photo.dataB64), (c) => c.charCodeAt(0)), contentType: photo.contentType, etag: null };
  }
  return null;
}
