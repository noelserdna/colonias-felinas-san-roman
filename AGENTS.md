# Instrucciones para asistentes de IA

Este archivo es para el asistente de IA (Claude Code, Codex, Cursor, Gemini CLI…) que ayuda a una persona a
**instalar esta aplicación para su ayuntamiento** o a trabajar en el código. La persona puede no ser técnica:
explícale cada paso en lenguaje sencillo, pídele solo lo que no puedas hacer tú y confirma antes de crear recursos,
pagar o publicar nada.

Documentación: [README.md](README.md) (visión general y costes) · [docs/TECNICO.md](docs/TECNICO.md) (arquitectura).

## Reglas

- **Nunca** escribas claves, correos personales ni códigos en archivos que se suban a git. Los secretos van en
  `wrangler secret put` (producción) o en `.dev.vars` (local, ya ignorado por git).
- No toques `env.demo` ni los recursos de San Román (`sanroman.colonia.dev`, `demo.colonia.dev`, `avisos.colonia.dev`):
  son de la instalación original.
- Antes de cualquier paso que cueste dinero (plan Workers Paid, dominio, saldo de TypeSafe), explica el coste y espera
  a que la persona lo confirme.
- Responde en el idioma de la persona. La aplicación está en español.

## 1. Datos que hay que pedir a la persona

0. **Tamaño**: número de habitantes y de colonias (aproximado). La aplicación, tal como está, se recomienda para
   municipios de **hasta unos 5.000 habitantes y unas 20 colonias**. Si los supera, explícale que necesitará
   mantenimiento profesional y que puede escribir a **andres@colonia.dev**; continúa solo si, sabiéndolo, quiere
   instalarla igualmente (por ejemplo, para probarla).
1. Nombre del **municipio** y **provincia**.
2. **Correo de administración** (quien gestionará el panel). Puede haber varios, separados por comas.
3. **Plan de Cloudflare**: para el uso real hace falta **Workers Paid (5 USD/mes)**. El plan gratuito limita cada
   petición a 10 ms de CPU y las páginas usan 10–30 ms (medido), así que Cloudflare cortaría muchas con el error
   1102. El gratuito solo sirve para probar. Confírmalo con la persona antes de contratar nada.
4. **Correo de envío**: ¿tiene un dominio o puede usar un subdominio del ayuntamiento (p. ej. `avisos.ayto-ejemplo.es`)?
   - **Cloudflare Email Service** (incluido en Workers Paid, 3.000 correos/mes): el dominio debe usar los DNS de
     Cloudflare.
   - **Resend** (gratis, 3.000/mes y 100/día): si el dominio no está en Cloudflare. Añadir en su DNS los registros que
     indique Resend.
5. ¿Quiere **corrección con IA (JEV)** de las respuestas escritas? Es opcional; sin ella el examen es solo de tipo test.
   Necesita una cuenta en TypeSafe (https://console.typesafe.ai) con unos pocos euros de saldo.
6. ¿Tiene el **temario** (texto de los temas) y las **preguntas**? Si no, la app se instala con temas de ejemplo que se
   redactan desde el panel.

## 2. Preparar el ordenador

```bash
node -v        # necesita Node.js 22 o superior (https://nodejs.org, versión LTS)
git --version
git clone https://github.com/noelserdna/colonias-felinas.git
cd colonias-felinas
npm install
npx wrangler login   # abre el navegador: la persona inicia sesión en Cloudflare y autoriza
```

Si la persona no tiene cuenta de Cloudflare, que la cree en https://dash.cloudflare.com/sign-up y contrate Workers Paid
en *Workers & Pages → Plans* (tras confirmar el coste).

## 3. Crear los recursos en Cloudflare

```bash
npx wrangler d1 create colonias           # base de datos: copia el database_id que devuelve
npx wrangler r2 bucket create colonias-fotos
```

Si R2 da error de «R2 no está activado», la persona debe activarlo en el panel de Cloudflare (R2 Object Storage →
activar). Cloudflare puede pedir una tarjeta aunque el uso quede dentro del nivel gratuito (10 GB).

## 4. Adaptar `wrangler.jsonc`

Edita el archivo (no contiene secretos):

- `"name"`: nombre del Worker, p. ej. `"colonias-felinas-<municipio>"` (minúsculas, sin tildes ni espacios).
- `d1_databases[0].database_id`: el id del paso 3. Deja `preview_database_id` como está (base local).
- **Borra** el bloque `"routes"` (dominio de San Román). Más adelante se puede añadir el dominio propio.
- **Borra** el bloque `"env"` completo (instancia de demostración de San Román).
- `vars.APP_NAME`: `"Cuidadores de Colonias Felinas · <Municipio>"`.
- `vars.MAIL_FROM`: `"Colonias Felinas · <Municipio> <no-reply@<dominio-de-envío>>"`.
- `vars.APP_ORIGIN`: la dirección pública. Tras el primer despliegue será `https://<name>.<subdominio>.workers.dev`
  (wrangler la muestra); actualízala y vuelve a desplegar.
- `vars.VAPID_PUBLIC_KEY`: genera un par propio con `node scripts/vapid-keys.mjs` (ver paso 5).
- `triggers.crons`: el plan gratuito admite 5 crons por cuenta; esta app usa 2.

## 5. Secretos

```bash
node scripts/vapid-keys.mjs          # {"publicKey": "...", "privateJwk": {...}}
# publicKey → wrangler.jsonc (VAPID_PUBLIC_KEY); privateJwk (como JSON en una línea) → secreto:
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put APP_SECRET        # cadena aleatoria larga (p. ej. openssl rand -base64 32)
npx wrangler secret put ADMIN_EMAILS      # correo(s) de administración
```

Las claves de **Resend** y de **JEV** es mejor que las introduzca la persona en *Administración → Ajustes* (secciones
«Correo» y «JEV»): se guardan cifradas con `APP_SECRET`, tienen prioridad sobre la configuración del servidor y la
sección de correo tiene un botón de correo de prueba. Con la clave de Resend en el panel no hace falta tocar el bloque
`send_email`. Por terminal también valen `RESEND_API_KEY` y `TYPESAFE_API_KEY` como secretos.

## 6. Contenido inicial

Antes de cargar la semilla, **revisa `seed/documents.json`**: contiene documentos de San Román (su ordenanza en el BOP
de Toledo, su sede electrónica, su portal de transparencia). Sustitúyelos por los del municipio o deja solo los de
ámbito estatal (Ley 7/2023). Después:

```bash
npm run db:migrate:remote
npm run db:seed:remote     # sin seed/units/*.md, los 8 temas se crean con un texto de ejemplo
```

Si la persona tiene el temario en Markdown, colócalo en `seed/units/NN-<slug>.md` (slugs en `seed/units.json`) y sus
preguntas en `seed/questions/*.json` (formato en `docs/preguntas-ejemplo.json`) **antes** de la semilla. Esos archivos
están ignorados por git: el contenido puede tener derechos de autor.

## 7. Publicar y comprobar

```bash
npm run deploy             # compila y publica; muestra la dirección https://….workers.dev
```

1. Actualiza `APP_ORIGIN` con esa dirección y vuelve a ejecutar `npm run deploy`.
2. La persona abre la dirección y pide el enlace con su correo de administración. Mientras el correo no esté
   configurado (o si el envío falla), el enlace aparece en `npx wrangler tail`: ejecútalo tú y pásale el enlace.
3. En *Administración → Ajustes*: municipio, provincia, escudo (PNG/JPG/WebP ≤ 1 MB), autoría del contenido formativo,
   **Correo** (clave de Resend + remitente → «Enviarme un correo de prueba») y clave de JEV.

## 8. Adaptar al municipio (desde el panel, sin código)

- **Temas**: redactar el temario (Markdown). **Preguntas**: importar un JSON o CSV. Si la persona lo pide, genera
  preguntas a partir de su temario en el formato de `docs/preguntas-ejemplo.json`: tipo test (`mc`), varias correctas
  (`multi`) y escritas (`written`, con `respuesta_referencia` y `puntos_clave`). Recuérdale que **las revise una
  persona experta** antes de abrir la plataforma.
- **Guía «Mi colonia»** y **Documentos**: ajustarlos a la ordenanza del municipio.
- **Anexos en PDF**: siguen la ordenanza de San Román (ver «Piezas ligadas a la ordenanza» en `docs/TECNICO.md`). Si
  la ordenanza del municipio tiene otros formularios, adapta `src/lib/anexos-pdf.ts` y regenera los PDF con
  `node scripts/build-anexos.ts`.

## 9. Opcional

- **Dominio propio**: con el dominio en Cloudflare, añade a `wrangler.jsonc`
  `"routes": [{ "pattern": "colonias.ayto-ejemplo.es", "custom_domain": true }]`, actualiza `APP_ORIGIN` y despliega.
- **Resend**: https://resend.com → Domains → añadir el dominio de envío y los registros DNS → API Keys. La clave se
  pega en *Ajustes → Correo*.

## Desarrollo

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local && npm run db:seed:local
npm run dev                # http://localhost:4321 (con MAIL_MOCK=1 el enlace sale en la propia página)
npm test                   # unitarios (vitest)
npx playwright test        # E2E contra el servidor local
npx astro check            # tipos
```

Detalles útiles:

- Solo puede haber un `astro dev` a la vez (`npx astro dev stop` para liberar).
- Si en desarrollo aparece `_jsxDEV is not a function`, reinicia el servidor: el script `dev` borra `node_modules/.vite`.
- Astro rechaza POST sin cabecera `Origin` (CSRF): con `curl`, añade `-H "Origin: https://<dirección>"`.
- Estilo del código: comentarios y textos en español, sin dependencias innecesarias; accesibilidad WCAG 2.1 AA
  (los E2E pasan axe-core).
