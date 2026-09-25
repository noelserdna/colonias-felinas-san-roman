// Genera las ilustraciones de gatos de la instancia demo (demo/gatos/*.jpg). Son dibujos propios,
// claramente ilustrativos, para no usar fotos reales ni imágenes del manual.
// Uso: node scripts/build-demo-gatos.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const GATOS = [
  { file: "misi", fondo: "#dfeee6", pelo: "#e08a3c", raya: "#b8621d", ojos: "#3f7d3a", manchas: false, oreja: true },
  { file: "tizon", fondo: "#e6e3f1", pelo: "#2b2b2e", raya: null, ojos: "#d6b43a", manchas: false, oreja: true },
  { file: "nube", fondo: "#f3e9dc", pelo: "#f4f1ea", raya: null, ojos: "#4a86c5", manchas: false, oreja: false },
  { file: "tigre", fondo: "#e4efe0", pelo: "#9a8a72", raya: "#5d5143", ojos: "#6c8f2f", manchas: false, oreja: true },
  { file: "canela", fondo: "#f4e4e0", pelo: "#f4f1ea", raya: null, ojos: "#c27d1d", manchas: "#d2823a", oreja: false },
  { file: "sombra", fondo: "#dde9f0", pelo: "#7b8088", raya: null, ojos: "#d9a520", manchas: false, oreja: true },
];

function svg(g) {
  const rayas = g.raya
    ? `<g stroke="${g.raya}" stroke-width="14" stroke-linecap="round" fill="none">
        <path d="M300 150 v38"/><path d="M270 156 l8 30"/><path d="M330 156 l-8 30"/>
        <path d="M205 330 q30 -10 40 10"/><path d="M200 370 q30 -10 45 10"/><path d="M395 330 q-30 -10 -40 10"/><path d="M400 370 q-30 -10 -45 10"/>
      </g>`
    : "";
  const manchas = g.manchas
    ? `<ellipse cx="240" cy="190" rx="55" ry="45" fill="${g.manchas}"/><ellipse cx="370" cy="390" rx="60" ry="40" fill="${g.manchas}"/><ellipse cx="400" cy="120" rx="30" ry="45" fill="${g.manchas}" transform="rotate(20 400 120)"/>`
    : "";
  // Oreja recortada (marca de gato esterilizado en el método CER).
  const orejaIzq = g.oreja ? "M190 170 L210 60 L262 140 Z" : "M190 170 L205 45 L270 130 Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450" width="600" height="450">
  <rect width="600" height="450" fill="${g.fondo}"/>
  <circle cx="90" cy="380" r="120" fill="#ffffff" opacity=".35"/><circle cx="540" cy="70" r="90" fill="#ffffff" opacity=".35"/>
  <ellipse cx="300" cy="380" rx="150" ry="95" fill="${g.pelo}"/>
  <path d="M430 400 q90 -20 60 -120" stroke="${g.pelo}" stroke-width="34" fill="none" stroke-linecap="round"/>
  <path d="${orejaIzq}" fill="${g.pelo}"/><path d="M410 170 L395 45 L330 130 Z" fill="${g.pelo}"/>
  <path d="M205 150 L215 90 L245 135 Z" fill="#f2b8b0" opacity=".8"/><path d="M395 150 L388 80 L355 130 Z" fill="#f2b8b0" opacity=".8"/>
  <circle cx="300" cy="215" r="120" fill="${g.pelo}"/>
  ${manchas}${rayas}
  <ellipse cx="255" cy="210" rx="22" ry="26" fill="#fff"/><ellipse cx="345" cy="210" rx="22" ry="26" fill="#fff"/>
  <ellipse cx="255" cy="212" rx="15" ry="22" fill="${g.ojos}"/><ellipse cx="345" cy="212" rx="15" ry="22" fill="${g.ojos}"/>
  <ellipse cx="255" cy="214" rx="5" ry="16" fill="#111"/><ellipse cx="345" cy="214" rx="5" ry="16" fill="#111"/>
  <circle cx="260" cy="203" r="4" fill="#fff"/><circle cx="350" cy="203" r="4" fill="#fff"/>
  <path d="M288 250 h24 l-12 13 Z" fill="#e58f8f"/>
  <path d="M300 263 q-12 16 -26 8 M300 263 q12 16 26 8" stroke="#3a3a3a" stroke-width="4" fill="none" stroke-linecap="round"/>
  <g stroke="#3a3a3a" stroke-width="3" stroke-linecap="round" opacity=".7"><path d="M240 258 h-70"/><path d="M240 268 l-66 14"/><path d="M360 258 h70"/><path d="M360 268 l66 14"/></g>
  <text x="580" y="435" text-anchor="end" font-family="Arial, sans-serif" font-size="16" fill="#000" opacity=".45">Ilustración · demo</text>
</svg>`;
}

mkdirSync(new URL("../demo/gatos/", import.meta.url), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 600, height: 450 } });
for (const g of GATOS) {
  await page.setContent(`<body style="margin:0">${svg(g)}</body>`);
  await page.screenshot({ path: new URL(`../demo/gatos/${g.file}.jpg`, import.meta.url).pathname, type: "jpeg", quality: 82 });
}
await browser.close();
console.log(`${GATOS.length} ilustraciones en demo/gatos/`);
