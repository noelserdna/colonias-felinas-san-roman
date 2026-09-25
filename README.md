# Cuidadores de Colonias Felinas · San Román de los Montes

Plataforma web instalable (PWA) de formación y acreditación de cuidadores de colonias felinas:
temario por temas → test por tema (desbloquea el siguiente) → examen final (test + respuestas escritas corregidas por JEV) → carnet digital.

**Stack:** Astro 7 (SSR) en Cloudflare Workers · D1 + Drizzle · React (islas del test/examen) · JEV (TypeSafe) · Resend (correo del magic link).

## Desarrollo local

```bash
npm install
cp .dev.vars.example .dev.vars        # y rellena TYPESAFE_API_KEY, ADMIN_EMAILS…
npm run db:migrate:local
npm run db:seed:local                 # 8 temas + 248 preguntas (seed/)
npm run dev                           # http://localhost:4321
```

Con `MAIL_MOCK=1`, el enlace de acceso se muestra en la propia página de login (solo en desarrollo).
Con `JEV_MOCK=1`, las respuestas escritas se corrigen con un simulador local, sin llamar a la API.

## Tests

```bash
npm test                                            # unitarios (selección, notas, JEV, CSV)
npx playwright test                                 # E2E: flujo completo + ajustes (usa ADMIN de .dev.vars)
node --env-file=.dev.vars scripts/calibrate-jev.ts  # calibra el umbral de JEV con el banco real
```

## Despliegue en Cloudflare

```bash
npx wrangler login
npx wrangler d1 create colonias        # copia el database_id en wrangler.jsonc
npx wrangler r2 bucket create colonias-fotos   # fotos privadas de las colonias (hay que activar R2 en la cuenta)
npm run db:migrate:remote
npm run db:seed:remote
npx wrangler secret put APP_SECRET        # cadena aleatoria larga: cifra las claves guardadas desde el panel
npx wrangler secret put TYPESAFE_API_KEY  # opcional: también se puede poner en Admin → Ajustes
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ADMIN_EMAILS      # correos de administración, separados por comas
# En wrangler.jsonc: MAIL_FROM (remitente del dominio dado de alta), MAIL_MOCK="0", JEV_MOCK="0"
npm run deploy
```

Las fotos de los gatos se guardan en el bucket R2 `colonias-fotos` (privado: la app las sirve comprobando permisos).
Si hay fotos antiguas guardadas en D1 (versiones anteriores), se pasan a R2 con
`node scripts/migrate-photos-to-r2.mjs --remote` (idempotente; sin `--remote` actúa en local).

El Cron (`*/5 * * * *`) reintenta la corrección de exámenes que quedaron pendientes si JEV no respondió.

## Aplicación instalable (PWA)

- **Instalación**: invitación propia en el inicio (botón del navegador en Chrome/Android; instrucciones en
  iPhone/iPad), que no se repite en 30 días si se descarta. Manifest con `id`, accesos directos (Carnet,
  Colonia, Temario), capturas para el diálogo de instalación (`public/screenshots/`) y categorías.
- **Sin conexión**: el service worker (`public/sw.js`) guarda el carnet, el temario, «Mi colonia» y los
  documentos; el carnet pide almacenamiento persistente (`navigator.storage.persist()`).
- **Carnet**: mantiene la pantalla encendida mientras se enseña (Screen Wake Lock).
- **Fotos de los gatos**: botón «Hacer una foto» que abre la cámara trasera en el móvil (`capture`).
- **Anexos en PDF**: además de descargarlos, se pueden compartir (WhatsApp, correo…) con Web Share.
- **Notificaciones push**: se activan en el perfil (o desde la invitación del inicio). Cada aviso
  (alta de colonia, cambio de rol, baja, censo pendiente, carnet a punto de caducar) llega a la vez en la
  app, por correo y como notificación. Implementación sin dependencias con WebCrypto (`src/lib/webpush.ts`:
  cifrado RFC 8291 y VAPID); solo se envía a servicios de push conocidos. En iPhone requiere iOS 16.4 y la
  app instalada. Al cerrar sesión se cancelan en ese dispositivo.
- **Número en el icono** (Badging API): avisos sin leer.
- **Recordatorios** (cron diario 08:00 UTC, `src/lib/reminders.ts`): censo de más de seis meses a la persona
  responsable (no se repite en 30 días) y carnet que caduca en 30 días (no se repite en 45).

Claves VAPID: `node scripts/vapid-keys.mjs` genera el par; la pública va en `VAPID_PUBLIC_KEY`
(`wrangler.jsonc`) y la privada, como JSON, en el secreto `VAPID_PRIVATE_KEY` (y en `.dev.vars` en local).

## Instancia de pruebas y demostración

`demo.colonia.dev` es una copia para pruebas y presentaciones, con los mismos contenidos de San Román pero con
su propia base de datos (`colonias-demo`) y su propio bucket de fotos (`colonias-fotos-demo`). Con `DEMO=1`:

- **Acceso con enlace**: `https://demo.colonia.dev/?codigo=<DEMO_CODE>` (se recuerda 60 días). Sin él solo se ve la portada.
- **Sin correo**: en `/demo` se elige un perfil (empieza el curso, a mitad, lista para el examen, con carnet,
  responsable de colonia o Ayuntamiento). Cada «Entrar como…» crea **una copia nueva** para ese visitante.
- **Atajos**: «Aprobar este tema» y «Rellenar con respuestas de ejemplo» (JEV corrige de verdad).
- **Botón «Demo»**: recorrido de lo que se puede probar con cada perfil, bandeja de correos y cambio de perfil.
- **Bandeja**: los correos no se envían; se guardan en `demo_outbox` y se ven en `/demo/correos`.
- **Solo lectura** en temario, preguntas, documentos, guía y ajustes.
- **Reinicio** cada noche (cron `0 3 * * *`): se borran las copias y se crean los datos de base (colonias en
  distintos estados, carnets vigentes, caducado y revocado, un examen final corregido por JEV…).
- Aviso en todas las páginas, carnets «DEMO · SIN VALIDEZ» (prefijo `DEMO-SRM`), `[Demo]` en los asuntos y `noindex`.

```sh
npm run db:migrate:demo   # migraciones
npm run db:seed:demo      # temario, preguntas y documentos
npm run demo:gatos        # ilustraciones de los gatos (R2 demo-base/)
npm run deploy:demo       # compila con CLOUDFLARE_ENV=demo y despliega
# Reinicio manual:
curl -X POST -H "Origin: https://demo.colonia.dev" -H "Authorization: Bearer $DEMO_RESET_TOKEN" https://demo.colonia.dev/api/demo/reset
```

Secretos (`wrangler secret put … --env demo`): `ADMIN_EMAILS`, `TYPESAFE_API_KEY`, `APP_SECRET`, `DEMO_CODE` y
`DEMO_RESET_TOKEN`. En local: `CLOUDFLARE_ENV=demo npx astro dev` con `.dev.vars.demo`.

## Administración (`/admin`)

Los correos de `ADMIN_EMAILS` obtienen rol de administrador al entrar. Desde el panel se gestionan:
temas (contenido Markdown, orden, peso en el examen final), banco de preguntas (alta/edición/desactivación,
importación y exportación CSV/JSON), ajustes (nº de preguntas, % de aprobado, umbrales JEV, validez del carnet…),
usuarios e intentos (con la puntuación de JEV de cada respuesta escrita) y carnets (revocar/renovar).
En **Ajustes** también se configuran el nombre del municipio, la provincia, el escudo (PNG/JPG/WebP ≤ 1 MB)
y la clave de la API de JEV, que se guarda cifrada con `APP_SECRET` y tiene prioridad sobre `TYPESAFE_API_KEY`.
Si se cambia `APP_SECRET`, la clave guardada deja de poder descifrarse y hay que volver a introducirla.

## Contenido

- `seed/units/*.md`: temario extraído del *Manual de buenas prácticas en la gestión de colonias felinas* (Colegio Oficial de Veterinarios de Toledo, uso autorizado).
- `seed/questions/*.json`: banco inicial (25 test + 6 escritas por tema). **Debe revisarlo el ayuntamiento** antes de abrir la plataforma.
- `npm run db:seed:*` es idempotente: actualiza los temas y solo añade preguntas nuevas.

## Correo del enlace de acceso

La aplicación usa, por este orden, el primer proveedor disponible:

1. **Cloudflare Email Service** (configurado: `avisos.colonia.dev`, alta con `npx wrangler email sending enable <dominio>`):
   binding `"send_email": [{ "name": "EMAIL", "remote": true }]` en `wrangler.jsonc`,
   dar de alta el dominio del remitente en *Compute → Email Service → Email Sending* (el dominio debe usar los DNS de
   Cloudflare; el envío a cualquier destinatario requiere el plan Workers Paid mientras esté en beta) y poner `MAIL_FROM`.
2. **Resend**: secreto `RESEND_API_KEY` y `MAIL_FROM` con un dominio verificado en Resend.
3. Si no hay ninguno, el enlace se escribe en el log del Worker (`npx wrangler tail`): sirve para entrar como
   administración mientras se configura el correo.

## Contenido formativo

El temario, sus imágenes y el banco de preguntas proceden del *Manual de buenas prácticas en la gestión de colonias
felinas* del **Colegio Oficial de Veterinarios de Toledo**, cuyo uso está autorizado solo para esta aplicación. Por eso
**no se incluyen en este repositorio**. Para desplegar una instancia hacen falta:

- `seed/units/NN-<slug>.md`: un Markdown por tema (los slugs y títulos están en `seed/units.json`).
- `seed/questions/*.json`: el banco de preguntas (formato en `src/lib/questions-io.ts`; también se pueden cargar desde
  Admin → Preguntas → Importar).
- `public/img/temario/`: las imágenes que referencian los temas, y `public/img/hero.jpg` / `hero-640.jpg` (portada).

Los temas y las preguntas también se pueden crear y editar desde el panel de administración.
