// Genera los PDF en blanco de los Anexos I y II y de la autorización de la persona propietaria en public/docs/.
// Uso: node scripts/build-anexos.ts
import { readFileSync, writeFileSync } from "node:fs";
import { anexoI, anexoII, autorizacionPropietario } from "../src/lib/anexos-pdf.ts";

const municipio = "San Román de los Montes";
const escudoPng = new Uint8Array(readFileSync(new URL("../public/img/escudo@2x.png", import.meta.url)));
writeFileSync(new URL("../public/docs/anexo-i-solicitud-registro-colonia.pdf", import.meta.url), await anexoI({ municipio, escudoPng }));
writeFileSync(new URL("../public/docs/anexo-ii-solicitud-alta-colaborador.pdf", import.meta.url), await anexoII({ municipio, escudoPng }));
writeFileSync(new URL("../public/docs/autorizacion-propietario-terreno.pdf", import.meta.url), await autorizacionPropietario({ municipio, escudoPng }));
console.log("Anexos generados en public/docs/");
