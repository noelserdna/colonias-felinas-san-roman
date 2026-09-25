// Sube las ilustraciones de gatos al bucket R2 de la demo (demo-base/gatos/*.jpg).
// Uso: node scripts/upload-demo-gatos.mjs [--local]   (--local: al R2 simulado de `CLOUDFLARE_ENV=demo astro dev`)
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";

const local = process.argv.includes("--local");
const dir = new URL("../demo/gatos/", import.meta.url).pathname;
for (const f of readdirSync(dir).filter((f) => f.endsWith(".jpg"))) {
  const args = ["wrangler", "r2", "object", "put", `colonias-fotos-demo/demo-base/gatos/${f}`, "--file", dir + f, "--content-type", "image/jpeg"];
  execFileSync("npx", [...args, local ? "--local" : "--remote", "--env", "demo"], { stdio: "inherit" });
}
