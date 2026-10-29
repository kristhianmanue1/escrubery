# ADR-0002 — Actualización de la adopción de skevi: v1.0.0 → v1.6.0 (corpus/v8)

**Estado:** Aceptada — decreto del Mediador «Addendum completo» sobre el
análisis solo-lectura del 2026-10-29 (decisión capturada 2026-10-29T17:53Z),
ampliada el mismo día por decreto «adopta tambien cilco autonomo» (sic;
capturado 2026-10-29T17:57Z). **Fecha:** 2026-10-29. **Fuente:** [skevi](https://github.com/kristhianmanue1/skevi)
v1.6.0 (corpus/v8, gate/v13, plantillas/v18; tag `v1.6.0`, HEAD `74a4714`).
Addendum de ADR-0001: reposiciona la cita de versión y amplía lo adoptado;
el resto de ADR-0001 queda vigente.

## Contexto

La cláusula de vigencia de ADR-0001 («skevi se cita por versión v1; un cambio
de sus contratos no muta esta ADR sin revisión propia») se activó: el upstream
publicó seis releases en ocho semanas (v1.1.0 → v1.6.0). El análisis del
2026-10-29 (solo-lectura, ambos árboles limpios, nada mutado) verificó:

1. **Lo adoptado no rompió.** La taxonomía de `01` §2
   (Spike/Bounded/Architectural, orden Spike→Architectural→Bounded, ratchet
   ascendente, disparadores observables) es la misma, refinada: los archivos
   de test nuevos no escalan la clase (ADR-012 skevi), «producción» definida
   por cerradura, y crear/extender un plan escala a Architectural por sí solo
   (ADR-013 skevi — ya recogido en ADR-0001). La fuente única de DoD y las
   fronteras de confianza quedaron intactas (reforzadas por ADR-037 skevi).
2. **Cumplimiento interno de ADR-0001:** 5/5 tarjetas posteriores al
   2026-09-06 declaran `Clase` (typesafe, puerto-plugin-ankla-v2,
   integración-meta-muse, feedback-adrc-mini, migracion-docker-servidor); las
   tarjetas sin `Clase` son registro histórico pre-ADR, que no se retrae.
3. **Lo genuinamente nuevo se parte en dos:** piezas estables que llenan
   huecos que escrubery ya padece (árboles congelados, catálogo de defectos
   para rondas), y la familia de ciclo autónomo (ADR-043/044/045/046 skevi:
   continuación autónoma acotada, push/merge condicional, regla E6/lote,
   OPERACION_RE), que choca con regla dura local y es además la zona de mayor
   churn del upstream (gate/v12 y v13 de esta misma semana; corpus/v7 perdió
   líneas que v8 recuperó; gate/v11 fue breaking). El análisis recomendaba
   no adoptarla por ese churn; el Mediador decretó su adopción el mismo día
   — se adopta fijada a corpus/v8, con revisión obligatoria al siguiente
   cambio de contratos del upstream que la toque.

## Decisión

Addendum de ADR-0001 (no reescritura): reposicionar la cita de versión y
adoptar piezas nuevas — tres como **prácticas ya practicadas, ahora
explícitas** (el mismo patrón que ADR-0001 usó con las fronteras de
confianza) y la familia de ciclo autónomo por decreto expreso del Mediador.
skevi sigue normando el proceso; no reemplaza el contrato operativo propio (ADRC,
`política-agentes`) ni crea contratos paralelos. Las plantillas skevi se
citan por versión, sin copia local (evita el drift de copias).

### Adoptado (nuevo)

1. **Árboles congelados** (skevi ADR-033, `templates/skevi/frozen-trees.md`).
   `datos/fichas/proveedores/` (generado por
   `scripts/generar_fichas_modelos.py`, prohibida la edición manual) y
   `datos/fuentes/` (descargas crudas selladas por `hash_sha256`) quedan
   declarados formalmente árboles congelados/sellados: la regla correcta es
   la opuesta a la del árbol editable — no se «corrige» el archivo, se
   corrige el generador o la capa de curaduría, y la integridad se verifica
   por derivación (regeneración/hash), no por revisión línea a línea.
2. **Catálogo de clases de defecto para rondas adversariales** (skevi ADR-035,
   `templates/skevi/review-defect-catalog.md`). Las rondas adversariales
   posteriores a esta ADR declaran las clases de defecto atacadas desde el
   catálogo agnóstico (entrada no confiable e inyección, autorización,
   secretos, concurrencia, recursos no liberados, trabajo no acotado, errores
   silenciados, contrato roto, test que no prueba el requisito) en vez de
   improvisarlas por ronda. El diagnóstico escrito tras intentos fallidos
   sigue su forma: reproducción, aislamiento, hipótesis con su prueba, causa
   raíz separada del síntoma.
3. **Disposición de rondas en su registro** (skevi ADR-037; ya practicado):
   la disposición de cada ronda adversarial vive en su registro (tarjeta /
   bitácora), no en la propuesta que la originó.
4. **Continuación autónoma dentro de la TAREA** (skevi ADR-043): dentro de
   un ticket vigente, el Ejecutor agota de forma autónoma la investigación,
   descomposición, implementación, diagnóstico, corrección y verificación
   antes de consultar; escala de inmediato lo que cambie diseño, objetivo,
   autoridad, superficie o riesgo; y justifica con evidencia dónde y por qué
   se detiene. No sustituye a ADRC: los decretos del Mediador siguen
   cerrando tickets y fases.
5. **Push/merge propuestos por avance con autoridad condicional** (skevi
   ADR-044): al llegar a un hito verificable, el Ejecutor prepara y propone
   el dossier — folio, destino, commit, evidencia, riesgos, recomendación.
   La ejecución requiere aceptación humana previa, explícita, vigente y
   registrada contra el folio del dossier (vía (a) de skevi: aceptación
   humana). La vía (b) —configuración con gate independiente verificado— no
   existe en escrubery y esta ADR no la instala: mientras tanto, el
   Mediador es el gate. La restricción local más fuerte prevalece: commit y
   toda mutación de git siguen exigiendo autorización explícita del Mediador
   con staging por ruta explícita; force-push, rebase de historia compartida,
   reset destructivo, borrado remoto, tags, releases y despliegue exigen
   autorización por operación. El Ejecutor no puede activar ni ampliar su
   propia autoridad editando configuración, ADR, manifest, memoria, skill o
   plugin: esta adopción nace del decreto del Mediador, no de
   auto-otorgamiento.
6. **Convención `Lote:` (regla E6, skevi ADR-045/046):** toda TAREA de plan
   cuyo campo `Permitido:` nombre `push` o `merge` declara `Lote:` con su
   folio al mismo nivel; el folio nombra el lote que se propondrá al
   Mediador, no acredita su aceptación. Adoptada como convención textual
   desde hoy; su enforcement estructural sigue aplazado (ver No adoptado).

### No adoptado (explícito y con causa)

1. **Gate estructural E1–E6:** sigue aplazado como en ADR-0001; su gatillo
   (primer plan multi-tarea real que se ejecute) sigue sin dispararse — la
   tarjeta migración Docker→servidor quedó aparcada por decreto (2026-10-27).
   La regla E6 ya rige como convención textual (§Adoptado 6); lo aplazado es
   su enforcement estructural.
2. **Vía (b) de autoridad** (configuración delegada con gate independiente
   verificado): no existe, no se instala y no puede ser activada por el
   Ejecutor (skevi ADR-044).
3. **task-card/v1 paralelo y reescritura de documentación histórica:** sin
   cambios respecto de ADR-0001.

## Consecuencias

- La cita canónica pasa de «skevi v1» a «skevi v1.6.0 (corpus/v8)»; ADR-0001
  queda vigente en todo lo demás.
- Las rondas adversariales posteriores citan clases de defecto del catálogo;
  los árboles congelados citan esta ADR en vez de justificar su régimen caso
  por caso.
- El modo de operación del Ejecutor cambia desde hoy: agota el trabajo dentro
  del ticket vigente antes de consultar (skevi ADR-043) y propone push/merge
  con dossier al llegar a hitos verificables (skevi ADR-044); el Mediador
  sigue siendo el gate de toda mutación de git.
- La familia de ciclo autónomo queda fijada a corpus/v8: el upstream la
  modificó dos veces esta semana (gate/v12 y v13), así que el siguiente
  cambio de contratos que la toque activa revisión obligatoria de esta ADR.
- Próxima revisión de esta ADR solo por: cambio de contratos del upstream que
  toque lo adoptado aquí (obligatorio si toca la familia de ciclo autónomo),
  instalación de una vía (b) de autoridad con gate verificado, o nuevo
  decreto del Mediador.
