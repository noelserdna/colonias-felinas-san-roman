# Validación · Tema 10 «Identificación, censo y seguimiento»

Fecha: 26/09/2026

## Resueltos con fuente

| N.º | Qué se comprobó | Conclusión | Fuente |
|---|---|---|---|
| 1 | Microchip: 15 cifras, ISO 11784/11785, lado izquierdo del cuello, lectura previa, tamaño | Confirmado: ISO en el Reglamento (UE) 2026/1818 (anexo II); 724 + 12 dígitos y cuello izquierdo en el proyecto de RD. El tamaño es descriptivo | [Reglamento (UE) 2026/1818, anexo II](http://data.europa.eu/eli/reg/2026/1818/oj); [Proyecto de RD de identificación (TIP-N-25-048), art. 4](https://www.dsca.gob.es/sites/default/files/TIP-N-25-048-DCA.pdf) |
| 2 | Registro autonómico conectado a REIAC; chip sin alta no identifica | REIAC agrupa las 17 comunidades y Ceuta y Melilla; leyes como la de CLM dicen que un chip no inscrito no identifica | [REIAC](https://www.reiac.es/); [Ley 7/2020 CLM, art. 14.2](https://www.boe.es/buscar/act.php?id=BOE-A-2020-13916) |
| 3 | Comunitarios con microchip a nombre del ayuntamiento | Literal en el art. 38.2 | [Ley 7/2023, art. 38.2](https://www.boe.es/buscar/act.php?id=BOE-A-2023-7936); [Directriz DGDA, apdo. 6.4.1](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf) |
| 4 | Si se adopta, avisar al ayuntamiento para cambiar la titularidad | Correcto como consigna universal; los plazos son autonómicos | [Ley 7/2023, art. 38.2](https://www.boe.es/buscar/act.php?id=BOE-A-2023-7936); [Ley 7/2020 CLM, art. 15.2](https://www.boe.es/buscar/act.php?id=BOE-A-2020-13916) |
| 5 | «Un gato marcado sin chip se identificará la próxima vez que haya que capturarlo» | El criterio viene del proyecto de RD (no vigente); la ley obliga al chip. **Texto corregido** (se presenta como práctica habitual) | [Proyecto de RD (TIP-N-25-048), disp. trans. 1.ª.2](https://www.dsca.gob.es/sites/default/files/TIP-N-25-048-DCA.pdf); [Ley 7/2023, art. 38.2](https://www.boe.es/buscar/act.php?id=BOE-A-2023-7936) |
| 6 | Lado de la oreja | Confirmado: izquierda machos / derecha hembras en Castilla y León, Toledo y San Román; al revés en la Comunitat Valenciana; izquierda para todos en Alley Cat Allies | [Protocolo marco CV (DOGV 10/10/2025)](https://dogv.gva.es/datos/2025/10/10/pdf/2025_42068_es.pdf); [Protocolo marco CyL (2025)](https://agriculturaganaderia.jcyl.es/web/es/ganaderia/colonias-felinas.html); [Alley Cat Allies, guía CNR (2025)](https://www.alleycat.org/wp-content/uploads/2025/03/tnr_field_guide_spanish_web-1.pdf) |
| 7 | Los gatos de colonia normalmente no necesitan pasaporte | Prudente: el pasaporte es para desplazamientos y el proyecto de RD exime a los comunitarios; alguna ley autonómica lo vincula hoy a la identificación | [Proyecto de RD (TIP-N-25-048), art. 4.2](https://www.dsca.gob.es/sites/default/files/TIP-N-25-048-DCA.pdf); [Reglamento de Ejecución (UE) 2026/705](http://data.europa.eu/eli/reg_impl/2026/705/oj) |
| 8 | Censo cada tres o seis meses; ¿periodicidad configurable? | Trimestral en Toledo, semestral en San Román. En la app ya es configurable por municipio (`censo_meses` 1-24, 6 por defecto, y `censo_alineado`) | [Directriz DGDA, apdo. 6.4.1](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf); código: `src/lib/programa-config.ts` |
| 9 | Nacimientos, muertes y llegadas | La app tiene un bloque de «Movimientos desde el censo anterior» (`censo_movimientos`: no / opcional / obligatorio) y la situación «devuelto a su responsable legal». **Texto corregido** (paso 5 y lista de situaciones) | Código: `src/lib/colonies.ts`, `src/lib/programa-config.ts` |
| 10 | Contar en la ciudad; ¿permite la app gatos compartidos o merodeadores? | Pautas respaldadas por la Directriz. Cada ficha pertenece a una sola colonia: lo compartido va en las observaciones de la ficha, como ya dice el tema; los merodeadores, en las observaciones del censo. **Texto corregido** | [Directriz DGDA, apdo. 6.4.1](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf); código: `src/lib/db/schema.ts` |
| 11 | Árbol «aparece un gato nuevo» | Coherente con los arts. 42.3 y 42.6 y con la Directriz (comprobar el titular en la base de datos) | [Ley 7/2023, art. 42](https://www.boe.es/buscar/act.php?id=BOE-A-2023-7936); [Directriz DGDA](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf) |
| 12 | 18 de 20 = 90 %, «meta de muchos programas»; por debajo del 70-75 % crece | Confirmado: 90 % como umbral de colonia controlada en Zaragoza, Albuixech y San Román; estabilización en torno al 75 % (Alcorcón, Foley et al. 2005) | [Zaragoza, proyecto CES](https://www.zaragoza.es/contenidos/medioambiente/proteccionanimal/colonias-gatos-urbanos.pdf); [Albuixech (2023)](https://albuixech.es/wp-content/uploads/2023/12/MANUAL-DE-GESTION-DE-COLONIAS-FELINAS.pdf); Alcorcón, manual de gestión ética (2024) |
| 13 | Enlace de «Para saber más» | El enlace del BOE lleva al texto consolidado de la Ley 7/2023 | [BOE-A-2023-7936](https://www.boe.es/buscar/act.php?id=BOE-A-2023-7936) |
| 9 (consulta) | Censo de la app en lugar del Anexo V en papel | Sí: si el ayuntamiento usa la app, su censo es el registro oficial y, si lo requiere, la app genera un PDF del censo con esos datos. **Texto corregido** en el tema 10 y en el suplemento (respuesta del responsable del proyecto, 26/09/2026) | Respuesta del responsable del proyecto, 26/09/2026 |

## Pendiente de consulta

Ninguna.

## Local (suplemento de San Román)

- **2** · Ley 7/2020 CLM · Confirmados los arts. 14.1 (alta por el veterinario en 3 días hábiles), 14.2, 15.1 (antes de los 3 meses) y 16.1 (gestión por el Consejo de Colegios de Veterinarios de CLM).
- **3** · Ordenanza de colonias, apdo. 7.2.2 · Solo «recomienda» el microchip; manda la Ley 7/2023 (ver tema 2, n.º 1). **Resuelto** (respuesta del responsable del proyecto, 26/09/2026): en San Román se implanta en cada esterilización, a nombre del Ayuntamiento y con alta en SIIA-CLM.
- **4** · Plazos en CLM · Cambio de titularidad y bajas por muerte: 3 días hábiles (art. 15.2 y 15.3).
- **6** · Oreja · Confirmado el apdo. 7.4.2: «puede estar en la oreja izquierda para los machos, y en la oreja derecha para las hembras».
- **7** · Pasaporte en CLM · **Resuelto** (respuesta del Ayuntamiento, 26/09/2026): cada gato comunitario identificado recibe pasaporte a nombre del Ayuntamiento, igual que el microchip; en él constan el código (Ley 7/2020, art. 14.1) y las vacunas. Recogido en el suplemento local; el tema 10 lo explica en general.
- **8** · Censo · En San Román: `censo_meses` = 6 y alineado con el semestre natural (Anexo V, «Censo semestral»).
- **9** · Movimientos · Configurar `censo_movimientos` como «obligatorio» (el Anexo V pide altas y bajas). Consulta 9 resuelta (respuesta del responsable del proyecto, 26/09/2026).
- **12** · Meta · Meta del 90 % confirmada (ordenanza, apdo. 4).
- **13** · Enlaces locales · Ley 7/2020 (BOE-A-2020-13916) y SIIA-CLM correctos.
