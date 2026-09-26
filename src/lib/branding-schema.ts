// Esquema de los datos del ayuntamiento (clave `branding` de settings). Módulo puro: también lo usa
// scripts/build-local.mjs para validar la precarga de un municipio.
import { z } from "zod";

const optionalText = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().max(max).optional());

export const brandingSchema = z.object({
  municipio: z.string().trim().min(2).max(80),
  provincia: z.string().trim().min(2).max(60),
  // Contacto de la unidad responsable de accesibilidad (declaración de accesibilidad).
  accesibilidad_email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() || undefined : v),
    z.email("El correo de accesibilidad no es válido").max(254).optional(),
  ),
  accesibilidad_telefono: optionalText(40),
  // Autoría del temario, que se cita en el pie de todas las páginas (p. ej. el colegio de veterinarios).
  credito_formativo: optionalText(160),
});

// Valores neutros hasta que el ayuntamiento ponga los suyos en Administración → Ajustes.
export const DEFAULT_BRANDING: z.infer<typeof brandingSchema> = { municipio: "Tu municipio", provincia: "Tu provincia" };
