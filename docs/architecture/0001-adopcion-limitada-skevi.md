# ADR-0001 — Adopción limitada de skevi como cuerpo normativo de proceso

**Estado:** Aceptada — decreto del Mediador «adopta lo que creas conveniente»
(2026-09-06). **Fecha:** 2026-09-06. **Fuente adoptada:** [skevi](https://github.com/kristhianmanue1/skevi)
v1.0.0 estable (2026-09-01, piloto infosalud F0→F3).

## Contexto

Skevi es el cuerpo normativo del ecosistema para diseñar software y operar
agentes: un estándar transversal y una guía por fases escrita para ejecutores
automatizados. Su relación con escrubery es genealógica: sus reglas se
destilaron de la experiencia de estos proyectos (su `docs/history/` registra
casos de escrubery/skopos) y su manifiesto declara la frontera — «inteligencia
sobre modelos y CLIs; ese plano es de escrubery».

Los proyectos hermanos ya formalizaron la adopción: epistates (ADR-0002,
limitada) y an-kla-memory (ADR-0045, más el estándar en sus docs). Escrubery
practicaba gran parte del estándar sin nombrarlo (CI local sin CI remoto,
contención de tamaño con exenciones, DoD por ejecución, rondas adversariales,
bitácora est/real) pero sin referenciar skevi y con tres brechas concretas:

1. las tarjetas estiman ciclos pero **no clasifican el rigor** de la tarea;
2. no hay regla de **fuente única de DoD** cuando el trabajo cruza tareas;
3. no existe gate estructural de planes.

## Decisión

Adopción **limitada**, en la línea de la ADR-0002 de epistates: skevi norma el
proceso; no reemplaza el contrato operativo propio (ADRC, `política-agentes`)
ni crea contratos paralelos.

### Adoptado

1. **Clasificación de tarea por disparadores observables** (skevi,
   ai-agent-guide `01` §2, v1). Toda tarjeta nueva de `docs/planning/` declara
   `**Clase:**` con los disparadores aplicados:
   - **Spike** — declaración firmada en la tarjeta: pregunta escrita y
     criterio de respuesta; salida = respuesta con evidencia; sin SPEC, sin
     merge a `main`.
   - **Bounded** — todos sus disparadores cumplidos: sólo archivos de
     producción existentes, sin dependencias nuevas, sin interfaz pública ni
     contrato nuevos, sin disparadores de escala.
   - **Architectural** — cualquier disparador de Bounded incumplido, o crear/
     extender un plan multi-tarea.
   - Orden de evaluación Spike → Architectural → Bounded; **ratchet
     ascendente** (la complejidad descubierta sube la clase, nunca la baja;
     reclasificar es parte del reporte); ante duda, la clase superior.
   - Los disparadores son observables en disco, no calificativos: «chico» o
     «crítico» no clasifican nada.
2. **Fuente única de DoD en planes multi-tarea.** Si el trabajo cruza varias
   tareas o sesiones, el plan posee los criterios y cada tarjeta los
   referencia sin duplicarlos (skevi, plantilla de plan + ADR-013).
3. **Fronteras de confianza** (adoptadas como ya practicadas y ahora
   explícitas): la salida de un agente es evidencia a corroborar, no
   autoridad; un gate comprueba forma, no verdad; una ronda adversarial sin
   contexto declarado no acredita independencia.

### No adoptado (explícito y con causa)

1. **Gate estructural de planes E1–E5:** aplazado. Las tarjetas existentes no
   siguen el formato PLAN de skevi; adoptarlo hoy rompería CI o exigiría
   reescribir evidencia histórica (la misma razón que la ADR-0002 de
   epistates documentó). Se reevalúa cuando emerja un plan multi-tarea real —
   candidata natural: la tarjeta de migración Docker→servidor externo.
2. **Contrato de tarea paralelo:** las tarjetas de escrubery siguen siendo
   canónicas; `task-card/v1` es plano de epistates. Una guía puede explicar
   cómo prepararlas, no crear una representación paralela.
3. **Reescritura de documentación histórica** para ajustarla a la taxonomía
   skevi: la historia registra, no se normaliza.

## Consecuencias

- Las tarjetas posteriores a esta ADR declaran `Clase` con disparadores; las
  anteriores quedan como registro histórico (no se retraen).
- La primera tarjeta que nazca Architectural deberá ir acompañada de plan con
  fuente única de DoD — y en ese punto se reevalúa el gate E1–E5.
- skevi se cita por versión (v1); un cambio de sus contratos no muta esta ADR
  sin revisión propia.
