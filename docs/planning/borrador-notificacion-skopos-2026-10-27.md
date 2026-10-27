# Borrador de notificación a skopos — 2026-10-27 (errata 11: enum `proveedor` += `openai`)

**Estado:** BORRADOR — el envío es acto del Mediador (colocar en `~/www/aria/skopos/docs/evidencia/` como `insumo-escrubery-errata11-openai-2026-10-27.md`, sin commit allá, patrón 08-22/08-28/10-14).
**Disparador:** regla vigente — notificar solo con «cambio que afecte a los parsers ADR-010 de skopos». El enum `proveedor` de `modelos.proveedor` creció aditivamente (escrubery `docs/CONTRATO_API_v0.md` errata 11, mig `017`, commit de este ticket).

## Contenido propuesto

1. **Qué cambió:** 9º proveedor `openai` (API propia; 123 modelos chat/responses). Parsers con enum cerrado deben tolerar `openai` — misma clase de aviso que la errata 10 (`typesafe`, notificada 2026-10-14).
2. **Origen:** primer consumidor real del `resolver_identidad_modelo` (adrc-mini/0.2.0, fb_10/11/12 2026-10-27): decorrelación de revisores por `familia_arquitectura` (claude / glm / gpt).
3. **Capa de identidad:** aliases nuevos `zai-coding-plan/glm-5.3(-flash)`, `opencode/glm-5.3`, bare aliases `glm-5.3(-flash)`, `claude-opus-5-5`, `claude-sonnet-5-5` y `gpt-6*`/`gpt-5.6*`; familia `glm`/`claude`/`gpt` curada para esos modelos. Si skopos consume el resolver, estos identificadores ahora resuelven (antes `sin_datos`, verificado por ejecución).
4. **Drift upstream declarado en la regeneración (10-14 → 10-27):** meta 6→7 (`sam-3.1`, modo `responses`), typesafe 3→4 (`jev-1.14.0`); el resto estable. `jev-1.13.0` (destino de `jev-latest`/`jev-preview`) sigue vigente.
5. **Anclajes:** tarjeta `docs/planning/tarjeta-feedback-adrc-mini-2026-10-27.md`, errata 11 del contrato, bitácora 2026-10-27 (hash del commit de este ticket).
