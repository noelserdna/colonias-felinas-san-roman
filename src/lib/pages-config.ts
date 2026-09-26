// Páginas de texto editables desde Administración → Textos (Markdown con marcadores {{…}}).
// Se guardan en settings con la clave `page:<slug>`; sin guardar, se usa el texto por defecto, que es
// neutro (sin ningún municipio ni ordenanza concretos). Módulo puro.

export type PageSlug = "mi-colonia" | "pautas-colonia" | "programa-local";

type PageDef = {
  titulo: string;
  descripcion: string;
  /** Dónde se ve la página, para el enlace «Ver como cuidador/a». */
  ver: string;
  defecto: string;
  /** Cada «## » es un paso (la guía «Mi colonia»). */
  pasos?: boolean;
  /** Vacía = no se muestra (en lugar de usar el texto por defecto). */
  opcional?: boolean;
};

/**
 * Guía por defecto para solicitar el alta de una colonia, basada en lo que exige la Ley 7/2023 y en
 * el procedimiento habitual de los ayuntamientos (registro, autorización y acreditación). Cada «## » es un paso.
 */
export const DEFAULT_COLONIA_GUIDE = `Para que una colonia felina entre en el {{plan_nombre}} (y pueda beneficiarse, por ejemplo, del método CER), el Ayuntamiento tiene que **registrarla**.{{#normativa_nombre}} Estos pasos siguen lo que establece {{normativa_corta}}: [{{normativa_nombre}}](/documentos){{#normativa_cita}} ({{normativa_cita}}){{/normativa_cita}}.{{/normativa_nombre}}

## Consigue tu acreditación
Cada colonia registrada tiene una **persona cuidadora responsable**, que es quien trata con el Ayuntamiento, y puede tener otras personas colaboradoras. Todas deben estar acreditadas: haber superado esta formación y tener el carné de cuidador o cuidadora.

Si todavía no lo has hecho, solicita tu alta como persona colaboradora{{#etiqueta_colaborador}} con el **{{etiqueta_colaborador}}**{{/etiqueta_colaborador}}, acompañada de una fotocopia de tu DNI. Se presenta igual que la solicitud de la colonia (paso 4).

<p class="row"><a class="btn small" href="/colonia/solicitud?anexo=ii">Rellenar la solicitud de alta</a> <a class="btn small ghost" href="{{pdf_colaborador}}" download>Descargar en blanco (PDF)</a></p>

## Comprueba que el lugar puede ser una colonia
Las colonias se suelen ubicar en:

- vías y espacios públicos;
- parques y zonas ajardinadas municipales;
- solares y descampados municipales;
- espacios privados, **solo con la autorización expresa de la persona propietaria** del terreno.

> **Importante:** no se registran colonias en viviendas particulares. Los técnicos municipales valorarán si el lugar es adecuado para la salud pública y la protección de los animales.

Si el terreno es privado, pide a la persona propietaria que firme la autorización. Tienes un modelo preparado:

<p class="row"><a class="btn small" href="/colonia/solicitud?anexo=aut">Rellenar la autorización</a> <a class="btn small ghost" href="{{pdf_autorizacion}}" download>Descargar en blanco (PDF)</a></p>

## Reúne los datos de la solicitud
La solicitud de registro{{#etiqueta_registro}} (**{{etiqueta_registro}}**){{/etiqueta_registro}} pide:

- **Tus datos**: NIF, nombre y apellidos, dirección, teléfono y correo electrónico.
- **Las personas que quieren ser cuidadoras de la colonia** (hasta {{max_cuidadores_letra}}): nombre y apellidos, NIF, teléfono y correo.
- **Datos de la colonia**:
  - dirección exacta y coordenadas (puedes obtenerlas con la aplicación de mapas del móvil);
  - si es un solar público o privado;
  - número de gatos: hembras esterilizadas y sin esterilizar, machos castrados y sin castrar;
  - gatos domésticos abandonados o recién nacidos que podrían darse en adopción;
  - gatos enfermos, describiendo sus síntomas.

Cuenta los gatos varios días y a distintas horas para que los datos sean fiables.

Puedes **rellenar la solicitud aquí** y descargar el PDF listo para firmar (tus datos no se guardan en la aplicación), o descargar el formulario en blanco y rellenarlo a mano.

<p class="row"><a class="btn small primary" href="/colonia/solicitud">Rellenar la solicitud de registro</a> <a class="btn small ghost" href="{{pdf_registro}}" download>Descargar en blanco (PDF)</a></p>

## Presenta la solicitud al Ayuntamiento
La solicitud va dirigida a: **{{organo}}**. Puedes presentarla de dos formas:

- **Por internet**, con {{sede_tramite}}. Necesitas Cl@ve, certificado digital o DNI electrónico. Adjunta el PDF de la solicitud; al presentarla la firmas electrónicamente.
- **En persona**, en el registro del Ayuntamiento, con la solicitud impresa y firmada.

Si el terreno es privado, adjunta también la [autorización de la persona propietaria](/colonia/solicitud?anexo=aut), firmada por ella (a mano y escaneada, o con su certificado digital), y una fotocopia de su DNI.
{{#sede_url}}
<p class="row"><a class="btn small primary" href="{{sede_url}}" target="_blank" rel="noopener">Ir a la sede electrónica<span class="sr-only"> (se abre en una ventana nueva)</span></a></p>
{{/sede_url}}
## Visita e informe municipal
El Ayuntamiento estudiará la solicitud, **visitará la ubicación**, hará las consultas necesarias y emitirá un **informe** que justifique si la colonia se registra o no.

## Colonia registrada
La colonia recibe un **número** en el registro municipal y la persona cuidadora responsable queda como contacto con el Ayuntamiento. Desde ese momento:

- alimenta solo con **pienso seco** de calidad y mantén **agua limpia** siempre; nunca pongas comida directamente en el suelo;
- sigue un **horario de alimentación** regular y limpia a diario el punto de alimentación;
- no cambies ni añadas puntos de alimentación o cobijo sin autorización del Ayuntamiento;
- avisa al Ayuntamiento cuanto antes si hay gatos enfermos;
- colabora en el censo de la colonia, que se actualiza cada {{censo_periodo}}, y en las capturas para el método CER según el calendario municipal;
- lleva siempre tu carné cuando atiendas la colonia y comunica al Ayuntamiento si dejas de colaborar, para darte de baja.
`;

/** Pautas básicas por defecto para cuidar una colonia (se muestran en la página de cada colonia). */
export const DEFAULT_PAUTAS = `- Informa al Ayuntamiento del número de gatos de la colonia y, si es posible, de su estado.
- Alimenta en los puntos de alimentación que conoce el Ayuntamiento, con un horario estable.
- Usa solo pienso seco y agua limpia y fresca (salvo indicación veterinaria). Si pones comida húmeda, retira los recipientes.
- Limpia a diario el punto de alimentación y retira platos vacíos y latas. No ensucies la vía pública.
- Las capturas para el método CER se programan según el calendario municipal y el gato va al centro veterinario que indique el Ayuntamiento.
- Rellena una ficha por gato con sus características y los resultados de las actuaciones veterinarias.
- Colabora en la esterilización de los gatos de la colonia: captura, traslado, recogida y retorno al mismo lugar.
- Avisa al Ayuntamiento cuanto antes si hay gatos enfermos.
`;

export const PAGE_DEFS: Record<PageSlug, PageDef> = {
  "mi-colonia": {
    titulo: "Guía «Mi colonia»",
    descripcion:
      "Pasos que ven las personas cuidadoras para solicitar el alta de una colonia. El texto antes del primer «## » es la introducción y cada línea que empieza por «## » inicia un paso.",
    ver: "/colonia",
    defecto: DEFAULT_COLONIA_GUIDE,
    pasos: true,
  },
  "pautas-colonia": {
    titulo: "Pautas básicas de la colonia",
    descripcion: "Lista de pautas que ven las personas cuidadoras en la página de cada colonia.",
    ver: "/colonia",
    defecto: DEFAULT_PAUTAS,
  },
  "programa-local": {
    titulo: "Suplemento local del temario",
    descripcion:
      "Lo propio del municipio y de la comunidad autónoma (normativa, ordenanzas, procedimientos) que completa el temario general. Si está vacío, no se muestra.",
    ver: "/temario/local",
    defecto: "",
    opcional: true,
  },
};

export const PAGE_SLUGS = Object.keys(PAGE_DEFS) as PageSlug[];

export function isPageSlug(s: string | undefined): s is PageSlug {
  return typeof s === "string" && Object.prototype.hasOwnProperty.call(PAGE_DEFS, s);
}

export const PAGE_MAX_CHARS = 60_000;

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
