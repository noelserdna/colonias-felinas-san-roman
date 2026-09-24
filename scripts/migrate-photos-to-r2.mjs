// Pasa a R2 las fotos antiguas guardadas en D1 (columna data_b64).
// Uso: node scripts/migrate-photos-to-r2.mjs [--remote]   (por defecto, base y bucket locales)
// Es idempotente: solo migra las fotos que aún no tienen storage_key.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv.includes("--remote") ? "--remote" : "--local";
const BUCKET = "colonias-fotos";
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const wrangler = (...args) => execFileSync("npx", ["wrangler", ...args], { encoding: "utf8", maxBuffer: 1 << 30 });
const d1 = (sql) => JSON.parse(wrangler("d1", "execute", "colonias", target, "--json", "--command", sql))[0].results;

const ids = d1("SELECT id FROM photos WHERE storage_key IS NULL AND data_b64 IS NOT NULL").map((r) => r.id);
console.log(`Fotos por migrar (${target.slice(2)}): ${ids.length}`);
const dir = mkdtempSync(join(tmpdir(), "fotos-"));
let ok = 0;
try {
  for (const id of ids) {
    // De una en una para no cargar en memoria todas las fotos a la vez.
    const [p] = d1(`SELECT id, colony_id, content_type, data_b64 FROM photos WHERE id = '${id.replace(/'/g, "")}'`);
    const key = `colonias/${p.colony_id}/${p.id}.${EXT[p.content_type] ?? "jpg"}`;
    const file = join(dir, `${p.id}`);
    writeFileSync(file, Buffer.from(p.data_b64, "base64"));
    wrangler("r2", "object", "put", `${BUCKET}/${key}`, "--file", file, "--content-type", p.content_type, target);
    d1(`UPDATE photos SET storage_key = '${key}', data_b64 = NULL WHERE id = '${p.id}'`);
    ok++;
    process.stdout.write(`\r  migradas ${ok}/${ids.length}`);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(ids.length ? "\nListo." : "Nada que migrar.");
