// Genera el SQL de la precarga de un municipio (seed/local/<slug>/) para la tabla settings y los documentos.
// Uso: node scripts/build-local.mjs <slug> [--sobrescribir]   →   seed/local/<slug>.sql
//
// Ficheros de seed/local/<slug>/ (todos opcionales):
//   programa.json          → clave `programa` (Administración → Programa local); se valida con programaSchema
//   branding.json          → clave `branding` (Administración → Ajustes → Ayuntamiento)
//   settings.json          → una fila por clave (p. ej. carnet_prefix)
//   mi-colonia.md, pautas-colonia.md, programa-local.md → claves `page:<nombre>` (Administración → Textos);
//                            sin programa-local.md se usa seed/temario-propio/local/<slug>.md si existe
//   documents.json         → tabla documents (solo si no existe ya la URL; `reemplaza` renombra el genérico)
// Es idempotente: sin --sobrescribir solo inserta lo que falta (ON CONFLICT DO NOTHING) y nunca pisa lo editado
// en el panel. Con --sobrescribir, sustituye los valores de settings por los de la precarga.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { programaSchema } from "../src/lib/programa-config.ts";
import { brandingSchema } from "../src/lib/branding-schema.ts";

const [slug, ...flags] = process.argv.slice(2);
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error("Uso: node scripts/build-local.mjs <slug> [--sobrescribir]");
  process.exit(1);
}
const sobrescribir = flags.includes("--sobrescribir");
const root = new URL("../seed/", import.meta.url).pathname;
const dir = join(root, "local", slug);
if (!existsSync(dir)) {
  console.error(`No existe ${dir}`);
  process.exit(1);
}
const q = (v) => (v == null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : null);
const readJson = (f) => {
  const t = read(f);
  return t == null ? null : JSON.parse(t);
};

const out = [];
const resumen = [];
const setting = (key, value) => {
  const v = q(JSON.stringify(value));
  out.push(
    `INSERT INTO settings (key, value) VALUES (${q(key)}, ${v}) ` +
      (sobrescribir ? `ON CONFLICT(key) DO UPDATE SET value = excluded.value;` : `ON CONFLICT(key) DO NOTHING;`),
  );
  resumen.push(key);
};

const programa = readJson("programa.json");
if (programa) {
  const r = programaSchema.safeParse(programa);
  if (!r.success) {
    console.error("programa.json no es válido:");
    for (const i of r.error.issues) console.error(`  ${i.path.join(".")}: ${i.message}`);
    process.exit(1);
  }
  setting("programa", r.data);
}

const branding = readJson("branding.json");
if (branding) setting("branding", brandingSchema.parse(branding));

const settings = readJson("settings.json");
if (settings) for (const [k, v] of Object.entries(settings)) setting(k, v);

const pagina = (nombre, texto) => {
  if (texto?.trim()) setting(`page:${nombre}`, texto);
};
pagina("mi-colonia", read("mi-colonia.md"));
pagina("pautas-colonia", read("pautas-colonia.md"));
const suplementoPropio = join(root, "temario-propio", "local", `${slug}.md`);
pagina("programa-local", read("programa-local.md") ?? (existsSync(suplementoPropio) ? readFileSync(suplementoPropio, "utf8") : null));

let docs = 0;
for (const d of readJson("documents.json") ?? []) {
  // El formulario genérico (p. ej. /docs/solicitud-registro-colonia.pdf) pasa a ser el del municipio.
  if (d.reemplaza) {
    out.push(
      `UPDATE documents SET titulo = ${q(d.titulo)}, descripcion = ${q(d.descripcion ?? null)}, url = ${q(d.url)}, fecha = ${q(d.fecha ?? null)}, updated_at = ${Date.now()} ` +
        `WHERE url = ${q(d.reemplaza)} AND NOT EXISTS (SELECT 1 FROM documents WHERE url = ${q(d.url)});`,
    );
  }
  out.push(
    `INSERT INTO documents (titulo, categoria, descripcion, url, fecha, orden, activo, updated_at) ` +
      `SELECT ${q(d.titulo)}, ${q(d.categoria)}, ${q(d.descripcion ?? null)}, ${q(d.url)}, ${q(d.fecha ?? null)}, ${d.orden ?? 0}, 1, ${Date.now()} ` +
      `WHERE NOT EXISTS (SELECT 1 FROM documents WHERE url = ${q(d.url)});`,
  );
  docs++;
}

const file = join(root, "local", `${slug}.sql`);
writeFileSync(file, out.join("\n") + "\n");
console.log(`${file}: ${resumen.join(", ")}; ${docs} documentos${sobrescribir ? " (sobrescribe)" : ""}`);
