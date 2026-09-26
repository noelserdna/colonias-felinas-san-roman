// Censo de una colonia en PDF (por si el ayuntamiento lo pide en papel). Solo para las personas que
// cuidan la colonia y el ayuntamiento (loadColony); la sesión la exige el middleware.
import type { APIRoute } from "astro";
import { and, desc, eq, lt } from "drizzle-orm";
import escudoDefecto from "../../../../../public/img/escudo@2x.png?inline";
import { schema } from "../../../../lib/db";
import { loadColony } from "../../../../lib/colony-page";
import { loadEscudoBytes } from "../../../../lib/branding";
import { censoPdf } from "../../../../lib/anexos-pdf";
import { censoPdfDatos } from "../../../../lib/colonies";
import { censoPdfNombre, textosAnexos } from "../../../../lib/programa-config";

const dataUrlBytes = (u: string) => Uint8Array.from(atob(u.slice(u.indexOf(",") + 1)), (c) => c.charCodeAt(0));

export const GET: APIRoute = async (ctx) => {
  const { db, colony, error } = await loadColony(ctx);
  if (error) return error;
  const censo = await db.query.colonyCensuses.findFirst({
    where: and(eq(schema.colonyCensuses.id, ctx.params.censoId!), eq(schema.colonyCensuses.colonyId, colony!.id)),
  });
  if (!censo) return new Response("No encontrado", { status: 404 });
  const [anterior, autor, escudo] = await Promise.all([
    db.query.colonyCensuses.findFirst({
      where: and(eq(schema.colonyCensuses.colonyId, colony!.id), lt(schema.colonyCensuses.fecha, censo.fecha)),
      orderBy: desc(schema.colonyCensuses.fecha),
    }),
    censo.userId ? db.query.users.findFirst({ where: eq(schema.users.id, censo.userId) }) : undefined,
    loadEscudoBytes(db, dataUrlBytes(escudoDefecto)),
  ]);
  const { branding, programa } = ctx.locals;
  const persona = autor ? [autor.nombre, autor.apellidos].filter(Boolean).join(" ") || undefined : undefined;
  const bytes = await censoPdf({
    municipio: branding.municipio,
    escudoPng: escudo.bytes,
    textos: textosAnexos(programa, branding),
    data: censoPdfDatos(censo, anterior ?? null, {
      colonia: { numero: colony!.numero, nombre: colony!.nombre, direccion: colony!.direccion },
      persona,
      lugar: branding.municipio,
    }),
  });
  return new Response(bytes as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${censoPdfNombre(programa, colony!.numero, censo.fecha)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
};
