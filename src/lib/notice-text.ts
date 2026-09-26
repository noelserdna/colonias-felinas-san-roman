// Textos de los avisos sobre colonias (en la aplicación y por correo). Módulo puro, sin base de datos.

export type NoticeKind = "colonia_alta" | "colonia_miembro" | "colonia_responsable" | "colonia_baja" | "colonia_censo" | "carnet_caduca" | "prueba";

type Datos = {
  colonia?: { id: string; numero: number | string; nombre: string } | null;
  rol: "responsable" | "colaborador" | null;
  nombre?: string | null;
  motivo?: string | null;
  /** Último censo (colonia_censo) o caducidad del carnet (carnet_caduca). */
  fecha?: Date | null;
  /** Periodicidad del censo, detrás de «cada» (p. ej. «seis meses»); ver periodoTexto. */
  periodo?: string | null;
};

const fmtFecha = (d: Date) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(d);

export type NoticeText = { titulo: string; saludo: string; parrafos: string[]; url: string | null; boton: string };

const ROL = { responsable: "persona cuidadora responsable", colaborador: "persona colaboradora" } as const;

export function noticeFor(kind: NoticeKind, d: Datos): NoticeText {
  const saludo = d.nombre?.trim() ? `Hola, ${d.nombre.trim()}:` : "Hola:";
  // Avisos que no dependen de una colonia.
  if (kind === "carnet_caduca") {
    return {
      titulo: "Tu carnet caduca pronto",
      saludo,
      parrafos: [
        `Tu carnet de cuidador/a de colonias felinas caduca el ${d.fecha ? fmtFecha(d.fecha) : "próximamente"}.`,
        "Para renovarlo, vuelve a hacer el examen final desde la aplicación antes de esa fecha.",
      ],
      url: "/carnet",
      boton: "Ver mi carnet",
    };
  }
  if (kind === "prueba") {
    return {
      titulo: "Avisos activados",
      saludo,
      parrafos: ["Así te llegarán los avisos de tu colonia y de tu carnet en este dispositivo."],
      url: "/perfil",
      boton: "Abrir la aplicación",
    };
  }
  if (!d.colonia) throw new Error(`El aviso ${kind} necesita una colonia`);
  const col = `«${d.colonia.nombre}» (n.º ${d.colonia.numero})`;
  const url = `/colonia/${d.colonia.id}`;
  const rol = d.rol ? ROL[d.rol] : "persona cuidadora";
  const tareas =
    d.rol === "responsable"
      ? "Como persona responsable, eres el contacto con el Ayuntamiento. Desde la aplicación puedes llevar el censo, las fichas de los gatos y las observaciones."
      : "Desde la aplicación puedes consultar la colonia y añadir fichas de los gatos y observaciones.";
  switch (kind as Exclude<NoticeKind, "carnet_caduca" | "prueba">) {
    case "colonia_alta":
      return {
        titulo: "Tu colonia ya está registrada",
        saludo,
        parrafos: [`El Ayuntamiento ha registrado la colonia ${col} y te ha dado de alta como ${rol}.`, tareas, "La colonia ya aparece en tu carnet."],
        url,
        boton: "Ver mi colonia",
      };
    case "colonia_miembro":
      return {
        titulo: "Te han añadido a una colonia",
        saludo,
        parrafos: [`El Ayuntamiento te ha dado de alta como ${rol} de la colonia ${col}.`, tareas],
        url,
        boton: "Ver la colonia",
      };
    case "colonia_responsable":
      return {
        titulo: "Ahora eres la persona responsable de una colonia",
        saludo,
        parrafos: [
          `Pasas a ser la persona cuidadora responsable de la colonia ${col}.`,
          "Serás el contacto con el Ayuntamiento y te encargarás de mantener al día el censo de la colonia.",
        ],
        url,
        boton: "Ver la colonia",
      };
    case "colonia_censo":
      return {
        titulo: "Toca actualizar el censo de tu colonia",
        saludo,
        parrafos: [
          `El censo de la colonia ${col} se actualiza ${d.periodo ? `cada ${d.periodo}` : "periódicamente"}${d.fecha ? ` y el último es del ${fmtFecha(d.fecha)}` : ""}.`,
          "Cuenta los gatos y anótalo en la aplicación: así el Ayuntamiento puede planificar las esterilizaciones.",
        ],
        url: `${url}/censo`,
        boton: "Actualizar el censo",
      };
    case "colonia_baja":
      return {
        titulo: "Ya no figuras en una colonia",
        saludo,
        parrafos: [
          `El Ayuntamiento te ha dado de baja como persona cuidadora de la colonia ${col}.`,
          ...(d.motivo?.trim() ? [`Motivo: ${d.motivo.trim()}`] : []),
          "Si crees que es un error, ponte en contacto con el Ayuntamiento.",
        ],
        url: null,
        boton: "",
      };
  }
}
