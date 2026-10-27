# Tarjeta: migración Docker→servidor (F3 remota)

**Fecha:** 2026-10-27 · **Clase:** Architectural (multi-tarea; el DoD canónico vivirá en su plan — ver §Proceso)
**Estado:** **APARCADA** por decreto del Mediador (2026-10-27 tarde, opción «a»): la decisión del 09-06 queda revocada en los hechos — Docker local volvió por terceros y la F3 local corre diariamente; no hay consumo marginal ni cola que migrar. La tarjeta y su envoltorio T2 verificado quedan como patrimonio listo para reactivar si el consumo vuelve a molestar. Reactivación = decreto nuevo.
**Origen:** decisión del Mediador 2026-09-06 (Docker local se apaga por consumo; F3 migra a servidor externo, sin autostart). Retomada el 2026-10-27 con la recomendación vigente: 78 alertas acumuladas sin introspección y cola de 2 CLIs.

## Hallazgo 2026-10-27 (tarde) — la premisa es caduca

Investigación por decreto («investiga para qué tenía su propia caja en docker»):

1. **La caja:** la VM Linux dedicada de Docker Desktop en esta Mac (~4.3 GB configurados, AutoStart off) — hogar de las imágenes `escrubery-sandbox-<cli>` (10 Dockerfiles en `docker/sandbox/`), la F3: introspección aislada de CLIs de terceros a versión fijada, con sondas diarias de superficie (`--version`) y procedencia commiteada.
2. **Docker volvió por terceros:** el daemon responde (28.5.1); otros proyectos del ecosistema lo requieren (paca-runner, actions-runner del CI de pacayeliztlahtolli, agentmemory). El consumo que motivó el apagado del 09-06 ya se está pagando de nuevo.
3. **La F3 local nunca dejó de correr:** commits diarios de «capturas de superficie» sin hueco desde el 2026-10-13; esta misma mañana (09:01–09:03) reconstruyó las 4 imágenes diarias. La deuda qwen 0.22.2 se resolvió sola (sandbox en 0.26.2-preview.0 por rebuild semver-mayor; nota: upstream etiquetó latest como `-preview` — comportamiento del poller, no defecto).
4. **Consecuencia:** no hay «78 alertas sin introspección» ni cola pendiente que una migración resuelva. El consumo marginal de escrubery en la caja ya encendida es bajo (sondas de segundos; rebuilds solo en semver-mayor).

Opciones ante el Mediador: **(a) aparcar** esta tarjeta revocando en los hechos la decisión 09-06 (recomendada: cero costo nuevo, cero servidor nuevo); **(b) migrar de todos modos** para descargar el Mac (emd-moodle: podman 4.9.4, 2 cores, producción eduEMD — no recomendado; VPS nuevo dedicado: limpio, a presupuesto del Operador).

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
