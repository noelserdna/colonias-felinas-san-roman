// Calibración del umbral de JEV: node --env-file=.dev.vars scripts/calibrate-jev.ts
// Para cada pregunta escrita del seed prueba: respuesta de referencia, respuesta parcial y respuesta de otra pregunta.
import { readFileSync, readdirSync } from "node:fs";
import { gradeWritten } from "../src/lib/jev.ts";

const dir = new URL("../seed/questions/", import.meta.url).pathname;
const written = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => JSON.parse(readFileSync(dir + f, "utf8")))
  .filter((q: any) => q.tipo === "written");

type Row = { kind: string; score: number; flag: number };
const rows: Row[] = [];
const apiKey = process.env.TYPESAFE_API_KEY;

await Promise.all(
  written.map(async (q: any, i: number) => {
    const other = written[(i + 7) % written.length];
    const cases = {
      completa: q.respuesta_referencia,
      parcial: q.puntos_clave[0],
      otra_pregunta: other.respuesta_referencia,
    };
    const base = { pregunta: q.enunciado, respuesta_referencia: q.respuesta_referencia, puntos_clave: q.puntos_clave };
    for (const [kind, ans] of Object.entries(cases)) {
      const r = await gradeWritten({ ...base, respuesta_alumno: ans }, { apiKey });
      rows.push({ kind, score: r.score, flag: r.flag });
    }
  }),
);

for (const kind of ["completa", "parcial", "otra_pregunta"]) {
  const rs = rows.filter((r) => r.kind === kind).map((r) => r.score).sort((a, b) => a - b);
  const pct = (t: number) => Math.round((rs.filter((s) => s >= t).length / rs.length) * 100);
  console.log(
    `${kind.padEnd(14)} n=${rs.length} min=${rs[0].toFixed(2)} mediana=${rs[rs.length >> 1].toFixed(2)} max=${rs.at(-1)!.toFixed(2)} | ≥1.5: ${pct(1.5)}%  ≥2: ${pct(2)}%  ≥2.5: ${pct(2.5)}%`,
  );
}
