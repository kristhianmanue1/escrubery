# Tarjeta: migración Docker→servidor (F3 remota)

**Fecha:** 2026-10-27 · **Clase:** Architectural (multi-tarea; el DoD canónico vivirá en su plan — ver §Proceso)
**Estado:** PROPUESTO. Redactada por decreto «adelante con recomendaciones»; la ejecución arranca en sesión propia.
**Origen:** decisión del Mediador 2026-09-06 (Docker local se apaga por consumo; F3 migra a servidor externo, sin autostart). Retomada el 2026-10-27 con la recomendación vigente: 78 alertas acumuladas sin introspección y cola de 2 CLIs.

## Disparadores observables (por qué ahora)

1. **Cola F3 de 2 CLIs:** rebuild `qwen-code` (pendiente desde 0.22.2; upstream va por 0.26.1 con breaking changes acumulados) + `muse-code` ejecutable (D1 curado 2026-10-14 con condiciones ToS declaradas en ficha).
2. **Backlog de vigilancia:** 78 alertas conocidas (11 en las últimas 24 h) — los pollers cantan pero nadie introspecciona.
3. **Consumidor real:** adrc-mini consume el resolver (19 consultas el día de alta); la F3 fresca mantiene vigencias y capturas que alimentan ese resolver.

## Alcance (desglose inicial — el plan lo refina)

- **T1 — Acceso:** ssh al servidor, usuario dedicado, claves sin passphrase en agente local; inventario de Docker Engine remoto (versión, recursos).
- **T2 — Envoltorio remoto:** script wrapper que serializa `docker build/run/exec` por ssh y lo expone como binario; seam existente `ESCRUBERY_DOCKER_BIN` (H2/T5) apuntando a él — **cero cambios en probes**.
- **T3 — Procedencia desde host externo:** las capturas remotas entran por el mismo camino canónico (script de ingesta que calcula hash y fecha en el host local al recibir el artefacto; nunca pegado manual). Regla: la captura lleva hash del contenido y host de origen declarado.
- **T4 — Primera F3 remota (cola):** rebuild qwen-code (0.26.1, no 0.22.2: la cola se procesa a versión corriente — decidir explícitamente en el plan) + primera introspección muse-code con condiciones ToS (§10.1(x)/(xi), sin contenido sensible).
- **T5 — Archivo/red de hallazgos HRA:** los hallazgos remotos vuelven a `datos/fuentes/` + fichas `assurance-verificacion/` con el mismo contrato de procedencia; verificación activa 4/4 celdas se re-ejecuta solo si el plan lo incluye.

## Proceso

Primer plan multi-tarea real desde la adopción skevi (ADR-0001, 2026-09-06): gatillo declarado para adoptar el gate E1–E5 y la regla de fuente única de DoD. El plan de esta tarjeta es dueño del DoD; las tarjetas de tarea lo referencian.

## Verificación (mínima, por ejecución — el plan la amplía)

- `ESCRUBERY_DOCKER_BIN=/ruta/wrapper bash scripts/ci_local.sh` verde con Docker local apagado.
- Una captura remota con hash verificable en `datos/fuentes/` (procedencia completa).
- qwen-code y muse-code con ficha actualizada desde introspección remota real.

## Límites declarados

- Sin credenciales ni secretos en el servidor más allá de lo imprescindible; el repo y la BD siguen locales — el servidor solo ejecuta sandboxes.
- El wrapper ssh serializa; no paraleliza (v0). Paralelismo = mejora posterior con su propio ticket.
- Coste del servidor: a presupuesto del Operador; si no hay servidor, la tarjeta muere sin drama y la F3 queda suspendida (estado actual).
- muse-code solo con las condiciones D1 vigentes; cualquier condición nueva del ToS exige re-curaduría antes de ejecutar.
