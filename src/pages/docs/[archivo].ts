// PDF en blanco de las solicitudes, generados con el escudo, el municipio y los textos del programa local.
// Admite los nombres con el prefijo del nombre oficial («anexo-i-solicitud-registro-colonia.pdf»), los
// genéricos («solicitud-registro-colonia.pdf») y los antiguos de public/docs/, para no romper enlaces.
import type { APIRoute } from "astro";
import escudoDefecto from "../../../public/img/escudo@2x.png?inline";
import { getDb } from "../../lib/db";
import { loadEscudoBytes } from "../../lib/branding";
import { anexoI, anexoII, autorizacionPropietario } from "../../lib/anexos-pdf";
import { textosAnexos } from "../../lib/programa-config";
import { sha256 } from "../../lib/util";

// Sube este número si cambia el diseño de los PDF (invalida las copias en caché).
const VERSION_PDF = "2";

function tipo(archivo: string): "registro" | "colaborador" | "autorizacion" | null {
  if (!/^[a-z0-9-]{1,80}\.pdf$/.test(archivo)) return null;
  if (archivo.endsWith("solicitud-registro-colonia.pdf")) return "registro";
  if (archivo.endsWith("solicitud-alta-colaborador.pdf")) return "colaborador";
  if (archivo === "autorizacion-propietario-terreno.pdf") return "autorizacion";
  return null;
}

const dataUrlBytes = (u: string) => Uint8Array.from(atob(u.slice(u.indexOf(",") + 1)), (c) => c.charCodeAt(0));

export const GET: APIRoute = async ({ params, locals, request }) => {
  const t = tipo(params.archivo ?? "");
  if (!t) return new Response("No encontrado", { status: 404 });
  const db = getDb();
  const escudo = await loadEscudoBytes(db, dataUrlBytes(escudoDefecto));
  const { branding, programa } = locals;
  const etag = `"${(await sha256(JSON.stringify([VERSION_PDF, t, branding.municipio, branding.provincia, programa, escudo.version]))).slice(0, 32)}"`;
  const headers = { etag, "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const opts = { municipio: branding.municipio, escudoPng: escudo.bytes, textos: textosAnexos(programa, branding) };
  const bytes = t === "registro" ? await anexoI(opts) : t === "colaborador" ? await anexoII(opts) : await autorizacionPropietario(opts);
  return new Response(bytes as BodyInit, {
    headers: { ...headers, "content-type": "application/pdf", "content-disposition": `inline; filename="${params.archivo}"` },
  });
};
