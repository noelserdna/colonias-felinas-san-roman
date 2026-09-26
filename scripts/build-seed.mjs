// Genera seed/seed.sql a partir de seed/units.json, seed/units/*.md y seed/questions/*.json.
// Es idempotente: actualiza los temas por slug y solo inserta preguntas cuyo enunciado no exista ya en ese tema.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../seed/", import.meta.url).pathname;
const q = (v) => (v == null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

const units = JSON.parse(readFileSync(join(root, "units.json"), "utf8"));
const out = [];

// Sin el temario (no está en el repositorio: ver README), cada tema se crea con un texto de ejemplo para
// redactarlo desde Administración → Temas; en ese caso nunca se sobrescribe lo que ya se haya escrito.
const unitsDir = join(root, "units");
const mdFiles = existsSync(unitsDir) ? readdirSync(unitsDir) : [];
let placeholders = 0;
for (const u of units) {
  const file = mdFiles.find((f) => f.endsWith(`-${u.slug}.md`));
  const contenido = file
    ? readFileSync(join(unitsDir, file), "utf8").trim()
    : `> **Tema pendiente de redactar.** Escribe aquí el contenido desde *Administración → Temas → ${u.titulo}*. ` +
      `Admite Markdown: títulos (\`##\`), listas, negritas, tablas e imágenes.\n\n` +
      `Cada tema necesita también sus preguntas (*Administración → Preguntas*) para que el test funcione.`;
  if (!file) placeholders++;
  out.push(
    `INSERT INTO units (slug, orden, titulo, contenido, peso, activo) VALUES (${q(u.slug)}, ${u.orden}, ${q(u.titulo)}, ${q(contenido)}, ${u.peso}, 1) ` +
      (file ? `ON CONFLICT(slug) DO UPDATE SET orden = excluded.orden, titulo = excluded.titulo, contenido = excluded.contenido;` : `ON CONFLICT(slug) DO NOTHING;`),
  );
}
if (placeholders) console.log(`Aviso: ${placeholders} temas sin texto (seed/units/): se crean con un texto de ejemplo para editarlos en el panel.`);

let count = 0;
const qdir = join(root, "questions");
for (const file of existsSync(qdir) ? readdirSync(qdir).filter((f) => f.endsWith(".json")).sort() : []) {
  const items = JSON.parse(readFileSync(join(qdir, file), "utf8"));
  for (const it of items) {
    if (!units.some((u) => u.slug === it.tema)) throw new Error(`${file}: tema desconocido ${it.tema}`);
    const mc = it.tipo === "mc";
    const multi = it.tipo === "multi";
    const written = it.tipo === "written";
    if (mc && (!Array.isArray(it.opciones) || it.correcta == null || it.correcta >= it.opciones.length))
      throw new Error(`${file}: pregunta tipo test mal formada: ${it.enunciado}`);
    if (multi && (!Array.isArray(it.opciones) || !Array.isArray(it.correctas) || it.correctas.length === 0 ||
        it.correctas.length >= it.opciones.length || it.correctas.some((i) => i < 0 || i >= it.opciones.length)))
      throw new Error(`${file}: pregunta de varias correctas mal formada: ${it.enunciado}`);
    if (written && !it.respuesta_referencia) throw new Error(`${file}: escrita sin referencia: ${it.enunciado}`);
    if (!mc && !multi && !written) throw new Error(`${file}: tipo desconocido ${it.tipo}`);
    const unitId = `(SELECT id FROM units WHERE slug = ${q(it.tema)})`;
    const correctas = multi ? [...new Set(it.correctas)].sort((a, b) => a - b) : null;
    out.push(
      `INSERT INTO questions (unit_id, type, dificultad, enunciado, options, correct_index, correct_indexes, explicacion, reference_answer, key_points, activo, version) ` +
        `SELECT ${unitId}, ${q(it.tipo)}, ${q(it.dificultad ?? "media")}, ${q(it.enunciado)}, ${written ? "NULL" : q(JSON.stringify(it.opciones))}, ` +
        `${mc ? it.correcta : "NULL"}, ${multi ? q(JSON.stringify(correctas)) : "NULL"}, ` +
        `${q(it.explicacion ?? null)}, ${written ? q(it.respuesta_referencia) : "NULL"}, ${written ? q(JSON.stringify(it.puntos_clave ?? [])) : "NULL"}, 1, 1 ` +
        `WHERE NOT EXISTS (SELECT 1 FROM questions WHERE unit_id = ${unitId} AND enunciado = ${q(it.enunciado)});`,
    );
    // Sincroniza la dificultad de las preguntas del seed que nunca se han editado en el panel (version = 1).
    out.push(`UPDATE questions SET dificultad = ${q(it.dificultad ?? "media")} WHERE unit_id = ${unitId} AND enunciado = ${q(it.enunciado)} AND version = 1;`);
    count++;
  }
}

// Documentos iniciales (solo se añaden si no existe ya uno con la misma URL, o con una URL que encaje con
// `si_no_existe`: así no se duplican los formularios que la precarga local da con su nombre oficial).
const docsFile = join(root, "documents.json");
let docs = 0;
if (existsSync(docsFile)) {
  for (const d of JSON.parse(readFileSync(docsFile, "utf8"))) {
    out.push(
      `INSERT INTO documents (titulo, categoria, descripcion, url, fecha, orden, activo, updated_at) ` +
        `SELECT ${q(d.titulo)}, ${q(d.categoria)}, ${q(d.descripcion ?? null)}, ${q(d.url)}, ${q(d.fecha ?? null)}, ${d.orden ?? 0}, 1, ${Date.now()} ` +
        `WHERE NOT EXISTS (SELECT 1 FROM documents WHERE url = ${q(d.url)}${d.si_no_existe ? ` OR url LIKE ${q(d.si_no_existe)}` : ""});`,
    );
    docs++;
  }
}

writeFileSync(join(root, "seed.sql"), out.join("\n") + "\n");
console.log(`seed.sql: ${units.length} temas, ${count} preguntas, ${docs} documentos`);
