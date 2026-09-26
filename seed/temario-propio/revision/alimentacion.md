# Validación · Tema 6 «Alimentación y puntos de comida»

Fecha de validación: 26/09/2026.

## Resueltos con fuente

| N.º | Qué se comprobó | Conclusión | Fuente |
|---|---|---|---|
| 2 | Despojos sin control sanitario («muchas ordenanzas sancionan…») | Lo prohíbe la propia ley estatal y es infracción grave. **Texto corregido** («La Ley 7/2023 prohíbe…») | [Ley 7/2023, arts. 25.i y 74.n](https://www.boe.es/buscar/act.php?id=BOE-A-2023-7936) |
| 3 | «En la app queda registrada su ubicación» (del punto de comida) | La app guarda la dirección y las coordenadas de la colonia, no del punto. **Texto corregido** («la ubicación de la colonia»). Lo del croquis sigue como consulta local | `src/lib/db/schema.ts` (tabla `colonies`); [Directriz DGDA, apdo. 6](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf) |
| 4 | Fauna en el punto de comida: «anótalo y avisa, no intentes ahuyentarlos» | Vale con carácter general: mover o cambiar el punto se acuerda con el programa, y no hay que acercarse a jabalíes o perros sueltos | [Directriz DGDA, apdo. 6.10.4](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf); [Alley Cat Allies, Colony Care Guide](https://www.alleycat.org/resources/colony-care-guide/) |
| 5 | Alimentadores espontáneos: acreditarse, turnos, mediación | Respaldado: la Directriz prevé la mediación a través de la coordinación municipal | [Directriz DGDA, apdo. 4.3.4](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf) |
| 6 | Refugios: autorización municipal o del propietario | Respaldado: los elementos autorizados los respetan los servicios de limpieza; en privado, acuerdo con el propietario | [Directriz DGDA, anexo III y apdo. 6.10.9](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf) |
| 7 | Punto de comida en la ciudad (parques, limpieza, zonas sensibles, solares) | El circuito coincide con la Directriz | [Directriz DGDA, apdos. 5.2.1, 6.10.4, 6.10.9 y anexo III](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf) |
| 8 | Cebos raticidas e intoxicación secundaria | Riesgo real, sobre todo con los anticoagulantes de segunda generación | [US EPA, restricciones de rodenticidas](https://www.epa.gov/rodenticides/restrictions-rodenticide-products) |
| 9 | Cantidad: 50-70 g de pienso al día | Algo alto para un gato castrado y tranquilo (35-45 kcal/kg). **Texto corregido**: 40-70 g para un gato de unos 4 kg, según pienso y actividad | [FEDIAF 2024, tabla VII-9](https://europeanpetfood.org/self-regulation/nutrition/) |
| 10 | Regla de la ración: 30 minutos frente a GEMFE (15 min / 1 h) | El texto ya combina las dos: ración de unos 30 min y ajustar si sobra o si desaparece enseguida | [Alley Cat Allies](https://www.alleycat.org/resources/colony-care-guide/); [GEMFE-AVEPA 2020](https://web.archive.org/web/20241205005204/https://gemfe.es/wp-content/uploads/2024/09/2020GUIA-DE-RECOMENDACIONES-colonias.pdf) |
| 11 | Comida húmeda «cuando lo indique el veterinario» | Concreción prudente de la Directriz (capturas, medicación con prescripción «u otros») | [Directriz DGDA, anexo V.2](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf) |
| 12 | Taurina: ceguera y enfermedad del corazón | Simplificación correcta (degeneración de retina y miocardiopatía dilatada) | [FEDIAF 2024, anexo 7.3](https://europeanpetfood.org/self-regulation/nutrition/) |
| 13 | Agua: 200-250 ml/día (45-55 ml/kg) | La referencia del NRC es 50-60 ml/kg. **Texto corregido**: 200-300 ml para 4-5 kg | [Revisión de alcance, *J Anim Sci* 2025 (PMC12893781)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12893781/); [Cornell Feline Health Center](https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/feeding-your-cat) |
| 14 | Tabla «lo que no se les da» y fila de cebolla, ajo, chocolate y uvas | Filas actuales respaldadas (leche, H5N1 y carne cruda, pienso de perro). Se añade solo cebolla y ajo (anemia con cuerpos de Heinz documentada en gatos); chocolate y uvas no tienen fuente felina. **Texto corregido** | [FEDIAF 2024, anexo 7.7.3](https://europeanpetfood.org/self-regulation/nutrition/); [Cornell](https://www.vet.cornell.edu/departments-centers-and-institutes/cornell-feline-health-center/health-information/feline-health-topics/feeding-your-cat); [ABCD, gripe en gatos](https://www.abcdcatsvets.org/guideline-for-influenza-virus-infections-in-cats/) |
| 15 | Paja como relleno en climas húmedos y fríos | Sirve: la paja (no el heno) resiste la humedad; se precisa cambiarla si se moja. **Texto corregido** | [Alley Cat Allies, Colony Care Guide](https://www.alleycat.org/resources/colony-care-guide/) |
| 16 | «Un gato bien alimentado sigue cazando» frente a la unidad 11 | Respaldado y coherente con la unidad 11 | [AAFP/ISFM 2013, pilar 3](https://journals.sagepub.com/doi/10.1177/1098612X13477537) |
| 17 | `alt` del esquema `si-no-alimentacion.svg` | Se quedaba corto frente a lo dibujado. **Texto corregido** (el `alt` describe todos los elementos) | Elemento `<desc>` del propio SVG |
| 18 | URL de la Directriz DGDA | La usada responde (200, PDF) y es la Rev. 01 | [Directriz DGDA 2024](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf) |
| 19 | Enlace a la guía GEMFE-AVEPA 2020 | gemfe.es da error 522; la copia de archive.org funciona. **Texto corregido** (enlace a la copia archivada) | [GEMFE-AVEPA 2020 (copia archivada)](https://web.archive.org/web/20241205005204/https://gemfe.es/wp-content/uploads/2024/09/2020GUIA-DE-RECOMENDACIONES-colonias.pdf) |
| 3 (local) | Croquis del punto de comida (anexo III.II) | El croquis es anacrónico: lo que se busca es identificar el lugar, y eso lo cubren la dirección y las coordenadas de la colonia en la app. **Texto corregido** en el tema 6 y en el suplemento (respuesta del responsable del proyecto, 26/09/2026) | Respuesta del responsable del proyecto, 26/09/2026 |
| 5 (local) | Vía para presentar las quejas por escrito | En cualquier ayuntamiento, por escrito con una **Instancia General** en el registro municipal o la sede electrónica. **Texto corregido** en el tema 6 y en el suplemento, con el enlace a la sede de San Román (respuesta del responsable del proyecto, 26/09/2026) | Respuesta del responsable del proyecto, 26/09/2026; [Sede electrónica](https://sanromandelosmontes.sedelectronica.es) |
| 1 (local) | «Acceso constante» (7.1.5.a) frente a hora fija y retirada | El texto sigue la documentación oficial: ración a hora fija y retirada de platos y sobras; las ordenanzas pueden contradecirlo. El suplemento da esa buena práctica y menciona brevemente el «acceso constante» del 7.1.5.a (contradicción recogida en el informe de incongruencias). Tema 6: nota breve sobre ordenanzas que dicen otra cosa (respuesta del responsable del proyecto, 26/09/2026) | Respuesta del responsable del proyecto, 26/09/2026; [Directriz DGDA](https://www.dsca.gob.es/sites/default/files/publicaciones/directriz-tecnica-colonias-felinas.pdf) |

## Pendiente de consulta

Ninguna.

## Local (suplemento de San Román)

- **1** · «Acceso constante» (7.1.5.a) frente a horario regular y retirada (7.1.6, anexo III.II y III.V). La
  contradicción es real. La Directriz no fija «30 minutos» (eso es de Alley Cat Allies): admite tolvas autorizadas o
  ración puntual con retirada. **Resuelto** (respuesta del responsable del proyecto, 26/09/2026): se sigue la
  Directriz (hora fija y retirada) y se menciona la contradicción del 7.1.5.a.
- **2** · Infracciones de la ordenanza de tenencia (BOP 61/2024, arts. 7.b, 21.2.b leve y 22.n grave). **Resuelto**: la
  redacción del suplemento es fiel; añadir que el 22.n repite la Ley 7/2023 (arts. 25.i y 74.n).
- **3** · Croquis del punto de comida (anexo III.II). **Resuelto** (respuesta del responsable del proyecto,
  26/09/2026): lo sustituyen la dirección y las coordenadas de la colonia en la app. Recogido en el suplemento.
- **5** · Quejas por escrito (ordenanza 9.2, no se admiten verbales). **Resuelto** (respuesta del responsable del
  proyecto, 26/09/2026): Instancia General en el registro o en la sede electrónica. Recogido en el suplemento.
- **6** · Refugios. **Resuelto**: en espacio público los autoriza el Ayuntamiento, que puede instalar casetas cerradas
  con llave (7.1.5, párrafo final); los puntos no se aumentan ni se mueven sin su autorización.
- **11** · Comida húmeda: 7.1.6 frente a anexo III.III. **Resuelto**: unificar en el suplemento como «solo para
  capturar o medicar y, para gatos enfermos o cachorros, cuando haya razones veterinarias (7.1.6 y anexo III.III);
  retira el recipiente al terminar».
