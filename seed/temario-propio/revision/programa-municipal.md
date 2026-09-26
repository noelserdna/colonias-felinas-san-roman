# Revisión · Unidad 3 «El programa municipal de colonias»

**A** = ayuntamiento / secretaría municipal (o quien valide el temario universal); **V** = veterinario del programa;
**D** = desarrollo de la aplicación. Versión universal del 26/09/2026: la unidad describe un programa municipal tipo
(Ley 7/2023, art. 39, y Directriz DGDA, apdos. 5 y 6). Todo lo propio de la ordenanza de San Román está en
`local/fragmentos/programa-municipal.md` y se marca «(local)». Desaparece el comentario HTML inicial y la guía de
adaptación: lo que cambia de un municipio a otro queda en el recuadro «Pregunta en tu ayuntamiento» y en el suplemento.

## Puntos que validar

| # | Dónde | Afirmación | Quién | Motivo |
|---|---|---|---|---|
| 1 | «Qué es el programa municipal» | «Lo habitual es que una ordenanza recoja la acreditación, las obligaciones de quien cuida y las sanciones» | A | Directriz DGDA, apdo. 5.1: el programa puede aprobarse sin ordenanza, pero se recomienda llevar a ordenanza esos contenidos |
| 2 | Idem, tabla | Papel de «otros servicios» (policía local, limpieza, parques, obras) | A | Directriz, apdos. 5.2 y 6.5 |
| 3 | Idem | Modelos de gestión: cuidadores acreditados directamente o a través de entidades de protección animal, o ambos | A | Ley 7/2023, art. 39.1.a y b; Directriz, apdo. 6.3.1 |
| 4 | «Registro de una colonia» | Autorización expresa en terreno privado, incluidas comunidades de propietarios «por medio de su presidencia o del administrador de fincas» | A | Quién puede autorizar en nombre de una comunidad (presidencia, acuerdo de junta) depende de la Ley de Propiedad Horizontal y de sus estatutos; el texto se limita a indicar el interlocutor |
| 5 | Idem | Datos que anota el registro | A | Directriz, apdo. 6.4.1 (resumido) |
| 6 | Idem | «Muchos programas excluyen las viviendas particulares»; si el propietario se niega, «decide el ayuntamiento» | A | Generalización; la Directriz (protocolo en espacios privados) propone considerar titular de los gatos a quien impide la gestión, pero cada ayuntamiento fija su protocolo (art. 39.1.d) |
| 7 | «Acreditación y carné» | Requisitos habituales: mayoría de edad, solicitud, formación (a menudo con examen), compromiso firmado; vigencia según el programa; voluntariado sin relación laboral | A | Directriz, apdos. 6.3.1 y 6.3.2; comparativa de programas en las notas (Madrid, Zaragoza, Talavera, Montón, protocolo valenciano) |
| 8 | «Derechos y obligaciones habituales» | Lista de derechos («lo que puedes esperar»): esterilizaciones, jaulas, aviso previo de obras o capturas, apoyo ante conflictos | A | La Directriz pide que el compromiso recoja derechos y obligaciones de ambas partes (6.3.2) pero no los enumera; la lista es una propuesta a partir de varios programas |
| 9 | «Coordinarse con otros cuidadores» | Capturas planificadas por zonas; «algunos programas tienen coordinadores de zona»; trato con alimentadores espontáneos | A | Directriz, apdos. 4.3.4 y 6.8; coordinadores de zona en el programa CES de Zaragoza (2019) |
| 10 | Recuadro «Qué hacer si no tienes coche o la zona es conflictiva» | «Muchos programas organizan el traslado de las jaulas a la clínica»; recomendaciones de seguridad personal | A | Consejo práctico nuevo (sección 9 de la guía, punto 4); no hay una fuente que cuantifique «muchos» |
| 11 | «Esterilizaciones» | Prioridades (conflictos, zonas sensibles, camadas); ≥ 80 % antes de pasar a otra colonia; 70-75 % umbral; «muchos programas» 90 %; retorno 24-48 h y máximo p. ej. 72 h; si eliges otra clínica «lo normal es que pagues tú» | A, V | Datos acordados de la versión universal; Directriz, apdo. 4.3.4 |
| 12 | Idem, tabla | Escala de estados de colonia «usada en varios municipios» | A | Procede de la ordenanza de San Román (7.4) **(local)**; se presenta solo como ejemplo. Confirmar que hay otros programas con escalas similares o cambiar a «Un ejemplo de escala» |
| 13 | «Quejas y mediación» | Cauce fijado por el ayuntamiento, normalmente por escrito; mediación con vecinos, alimentadores espontáneos, propietarios y malas prácticas | A | Directriz, apdo. 6.8 |
| 14 | Recuadro «Pregunta en tu ayuntamiento» | Lista de lo que fija cada programa | A | Sección 9 de la guía, punto 3; las respuestas de San Román están en el suplemento **(local)** |
| 15 | «Cómo se hace en la aplicación» | Pantallas: «Mi colonia» (guía del trámite y formularios), «Documentos», «Mi carnet», «Actualizar el censo» (con «Rellenar a partir de las fichas»), «Añadir ficha de un gato», avisos (app, correo y push desde el perfil), «Dejar de colaborar» con explicación y, si eres la única persona, indicar quién se hace cargo; todas las personas de la colonia ven el mismo censo y las mismas fichas | D | Comprobado sobre el código a 26/09/2026 (`src/pages/colonia*`, `src/pages/documentos.astro`, `CarnetView.astro`, `reminders.ts`, `BajaColonia.tsx`). La pantalla de solicitud sigue rotulada con «Anexo I / Anexo II» (propio de San Román): si la app va a otros municipios, conviene que esos rótulos sean configurables |
| 16 | Idem | El carnet digital «caduca» y se renueva repitiendo el examen final | A, D | Vigencia configurable (`carnet_validity_months`, 24 por defecto). Choca con la ordenanza de San Román («mientras colabores») **(local)** |

## Pasado al suplemento local

- Ordenanzas de colonias (BOP 122/2024) y de tenencia (BOP 61/2024); Concejalía con competencias en Bienestar Animal;
  formación de la Policía Local **(local)**.
- Anexos I (registro), II (alta de colaborador), III (pautas), IV (ficha) y V (censo semestral); canal de presentación
  (Instancia General); exclusión de viviendas particulares **(local)**.
- Carné «mientras colabores» (7.1.3), obligaciones 7.1.6 y 9.1, funciones municipales 9.2, acondicionamiento 7.1.5
  **(local)**.
- Partida anual por equidad, eficiencia y urgencia; clínica contratada y coste de otra clínica (7.4.3); retorno
  24-72 h; oreja izquierda machos / derecha hembras; objetivo 90 % (apdo. 4) y tabla de estados (7.4), con su
  incoherencia en el 90 % exacto **(local)**.
- Quejas solo por escrito y libro de registro (8, 9.2, 11) **(local)**.
- Preaviso de 15 días y censo semestral **(local)**.
- Si el censo de la app sustituye al Anexo V en papel **(local)**.
