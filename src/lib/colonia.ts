import { eq } from "drizzle-orm";
import type { DB } from "./db";
import * as schema from "./db/schema";

const KEY = "page:mi-colonia";

/**
 * Guía por defecto para solicitar el alta de una colonia, basada en el apartado 7 del manual
 * (registro, autorización y acreditación). Cada «## » es un paso. El ayuntamiento puede editarla.
 */
export const DEFAULT_COLONIA_GUIDE = `Para que una colonia felina entre en el Plan de Control y Gestión Ética de Colonias Felinas del municipio (y pueda beneficiarse, por ejemplo, del método CER), el Ayuntamiento tiene que **registrarla**. Estos pasos siguen la [Ordenanza municipal reguladora del plan de control y gestión ética de las colonias felinas urbanas](/documentos#ordenanza) (BOP de Toledo n.º 122, de 28 de junio de 2024).

## Consigue tu acreditación
Cada colonia registrada tiene una **persona cuidadora responsable**, que es quien trata con el Ayuntamiento, y puede tener otras personas colaboradoras. Todas deben estar acreditadas: haber superado esta formación y tener el carné de cuidador o cuidadora.

Si todavía no lo has hecho, solicita tu alta como persona colaboradora con el **Anexo II** de la ordenanza («Solicitud de alta como colaborador o colaboradora del proyecto CER»), acompañado de una fotocopia de tu DNI.

<p class="row"><a class="btn small" href="/colonia/solicitud?anexo=ii">Rellenar el Anexo II</a> <a class="btn small ghost" href="/docs/anexo-ii-solicitud-alta-colaborador.pdf" download>Descargar en blanco (PDF)</a></p>

## Comprueba que el lugar puede ser una colonia
Las colonias se pueden ubicar en:

- vías y espacios públicos;
- parques y zonas ajardinadas municipales;
- solares y descampados municipales;
- espacios privados, **solo con la autorización expresa de la persona propietaria** del terreno.

> **Importante:** no se registran colonias en viviendas particulares. Los técnicos municipales valorarán si el lugar es adecuado para la salud pública y la protección de los animales.

## Reúne los datos de la solicitud
La solicitud (**Anexo I** de la ordenanza) pide:

- **Tus datos**: NIF, nombre y apellidos, dirección, teléfono y correo electrónico.
- **Las personas que quieren ser cuidadoras de la colonia** (hasta cuatro): nombre y apellidos, NIF, teléfono y correo.
- **Datos de la colonia**:
  - dirección exacta y coordenadas (puedes obtenerlas con la aplicación de mapas del móvil);
  - si es un solar público o privado;
  - número de gatos: hembras esterilizadas y sin esterilizar, machos castrados y sin castrar;
  - gatos domésticos abandonados o recién nacidos que podrían darse en adopción;
  - gatos enfermos, describiendo sus síntomas.

Cuenta los gatos varios días y a distintas horas para que los datos sean fiables.

Puedes **rellenar la solicitud aquí** y descargar el PDF listo para firmar (tus datos no se guardan en la aplicación), o descargar el formulario en blanco y rellenarlo a mano.

<p class="row"><a class="btn small primary" href="/colonia/solicitud">Rellenar el Anexo I</a> <a class="btn small ghost" href="/docs/anexo-i-solicitud-registro-colonia.pdf" download>Descargar en blanco (PDF)</a></p>

## Presenta la solicitud al Ayuntamiento
Entrega el Anexo I cumplimentado y firmado a la **Concejalía con competencias en Bienestar Animal**, en el registro del Ayuntamiento o a través de la [sede electrónica](/documentos#otro). Si el terreno es privado, adjunta la autorización de la persona propietaria.

## Visita e informe municipal
El Ayuntamiento estudiará la solicitud, **visitará la ubicación**, hará las consultas necesarias y emitirá un **informe** que justifique si la colonia se registra o no.

## Colonia registrada
La colonia recibe un **número** en el registro municipal y la persona cuidadora responsable queda como contacto con el Ayuntamiento. Desde ese momento:

- alimenta solo con **pienso seco** de calidad y mantén **agua limpia** siempre; nunca pongas comida directamente en el suelo;
- sigue un **horario de alimentación** regular y limpia a diario el punto de alimentación;
- no cambies ni añadas puntos de alimentación o cobijo sin autorización del Ayuntamiento;
- avisa al Ayuntamiento cuanto antes si hay gatos enfermos;
- colabora en el censo de la colonia, que se actualiza cada seis meses, y en las capturas para el método CER según el calendario municipal;
- lleva siempre tu carné cuando atiendas la colonia y comunica al Ayuntamiento si dejas de colaborar, para darte de baja.
`;

export async function getColoniaGuide(db: DB): Promise<{ markdown: string; custom: boolean }> {
  const row = await db.query.settings.findFirst({ where: eq(schema.settings.key, KEY) });
  const md = typeof row?.value === "string" && row.value.trim() ? row.value : null;
  return { markdown: md ?? DEFAULT_COLONIA_GUIDE, custom: Boolean(md) };
}

export async function saveColoniaGuide(db: DB, markdown: string | null) {
  if (!markdown || !markdown.trim()) {
    await db.delete(schema.settings).where(eq(schema.settings.key, KEY));
    return;
  }
  const value = markdown.slice(0, 50_000);
  await db.insert(schema.settings).values({ key: KEY, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

/** Separa la guía en introducción y pasos (cada encabezado «## » inicia un paso). */
export function splitSteps(md: string): { intro: string; steps: { title: string; body: string }[] } {
  const parts = md.split(/^## +/m);
  const intro = parts.shift()?.trim() ?? "";
  const steps = parts.map((p) => {
    const nl = p.indexOf("\n");
    return { title: (nl === -1 ? p : p.slice(0, nl)).trim(), body: nl === -1 ? "" : p.slice(nl + 1).trim() };
  });
  return { intro, steps };
}
