# Pista paralela de decisiones — escrubery

**Estado:** D2 y D3 cerradas (2026-08-07); D1 y D4 abiertas (D4 inclinada a "producto"). **Origen:** Fase 0 (plan v2 §3.3). **Actualizado:** 2026-08-07.

El costo real de estas decisiones es **calendario**, no ciclos de desarrollo: corren en paralelo a todas las fases. Cada una **bloquea una fase concreta**. El criterio de cierre de la Fase 0 (plan v2 §3) solo exige que estén *iniciadas* —documentadas como abiertas con responsable—, no resueltas.

## Resumen

| ID | Decisión | Bloquea | Estado | Responsable |
|---|---|---|---|---|
| D1 | Revisión de ToS de los CLIs | Fase 3 (criterio de entrada) | Abierta — investigación pendiente | Ejecutor (curaduría) · Mediador (decisión) |
| D2 | Evidentia: llaves Ed25519 (multi-capa) | Fase 2 | **Cerrada 2026-08-07** (modelo aprobado; impl. gradual F2/F4/público) | Mediador |
| D3 | Canonicalización JCS/RFC 8785 | Fase 2 | **Cerrada 2026-08-07** (impl. Node en T0-F2) | Mediador |
| D4 | Naturaleza del servicio (interno vs. producto) | Fase 5 (condición de activación) | Abierta — **inclinada a "producto"** (Evidentia de pago); cerrar al definir F5 | Mediador |

---

## D1 — Revisión de Términos de Servicio de los CLIs

**Bloquea:** Fase 3 (criterio de entrada §6.1: "revisión ToS resuelta al menos para los CLIs de verificación diaria"). **Estado:** abierta.

**Por qué importa:** la Fase 3 ejecuta CLIs en contenedor efímero. automatización, *benchmarking* y extracción pueden estar limitados por los ToS de cada proveedor. Sin revisión, hay riesgo operativo/legal.

**Alcance (contenido mínimo, por CLI):** un documento de revisión por producto que cite la cláusula relevante sobre (a) automatización, (b) *benchmarking*, (c) extracción/retención de salidas. Veredicto: `permitido | restringido | prohibido | no_declara` con cita.

**Productos a revisar (7 fichas, grok se distingue por gobernanza):** claude-code, kimi-code, codex-cli, grok-build (oficial xAI), grok-cli-community (superagent-ai), antigravity-cli, cline. Nota: grok-build y grok-cli-community tienen ToS potencialmente distintos (proveedores distintos); no se mezclan.

**Ya hecho:** nada (F0). **Pendiente:** la curaduría, que es lectura de fuentes públicas (Fases 0–1 solo leen fuentes públicas gratuitas, política §7). **Responsable:** Ejecutor (curaduría) → Mediador (aprueba veredicto). **Entregable:** `docs/investigacion/tos-clis.md`.

---

## D2 — Esquema de llaves Ed25519

**Bloquea:** Fase 2 (firma por evento). **Estado:** **Cerrada 2026-08-07** — modelo multi-capa aprobado (multi-firma, cadena de confianza root→operativas, custodia tiered, anclaje externo en F4, revocación observable); implementación gradual F2 base / F4 robustez / público. La custodia concreta de la raíz (custodios, trigger de compromiso) se define al **activar** F4/público (no se necesita para la base de F2).

**Feature:** *Evidentia* (nombre decretado 2026-08-07 por el Mediador; prevista para uso por **contrato de pago** en el futuro — condiciona D4).

**Ya acordado (patrones adoptados de CAGF, corrigiendo sus debilidades — ver `docs/investigacion/Referencia_Traza_Firma.md`):**
- **Clave por servicio/agente firmante** (no mono-clave) — corrección del principal hueco de CAGF.
- **`hash_evento_anterior` del mismo producto DENTRO del payload firmado** — cadena y firma se refuerzan mutuamente.
- **Checkpoint firmado del tip** por lote/día, persistido **fuera** de la base de datos — defensa contra reescritura total; **anclaje externo** (RFC 3161 / transparencia) en **F4**.
- **Privada fuera del worktree** (nunca PEM sin cifrar; política §7); **custodia tiered** (raíz offline + operativas en KMS) activada por fases.
- **Formato alineado con CAGF:** firma `"ed25519:" + base64`; clave pública DER/base64 en keyring JSON commiteado (extensión `cagf-keyring/0.2` con multi-clave/validez/revocación).
- **Multi-firma M-of-N** y **cadena de confianza (root→operativas)** desde el schema del EventRecord/keyring — activas como quórum al pasar a público (post-D4).

**Modelo de confianza objetivo (multi-capa):** multi-firma por evento + cadena de confianza jerárquica + custodia tiered + anclaje externo + revocación observable. Detalle y roadmap por fase (qué cubre F2 base, F4 robustez, público) en `docs/investigacion/Referencia_Traza_Firma.md` §4-§6. **F2 implementa la base con schema extensible** (`signatures[]`, `validity_window`, `status`, `successor_kid`, `external_anchor=null`) para que F4/público sean **activación, no reescritura**.

**Pendiente para cerrar D2:** confirmación del Mediador del modelo multi-capa + política concreta de rotación/revocación/custodia (periodicidad, trigger de compromiso, quiénes son los custodios de la raíz).

**Responsable:** Mediador. **Entregable:** confirmación + `docs/investigacion/Referencia_Traza_Firma.md` (redactado) + `cagf-keyring/` commiteado en F2.

---

## D3 — Canonicalización de payloads firmados

**Bloquea:** Fase 2. **Estado:** **Cerrada 2026-08-07** — JCS/RFC 8785 confirmado; la implementación de referencia en Node se elige en T0 de F2 y se declara en el contrato v0 §2.3 para que los verificadores externos sepan qué esperar.

**Ya acordado:** **JCS / RFC 8785** (JSON Canonicalization Scheme). No `sort_keys` casero, para que terceros verifiquen firmas sin replicar una implementación específica (plan v2 §5.2; contrato v0 §2.3).

**Pendiente:** (a) confirmar RFC 8785; (b) elegir librería/implementación de referencia en el stack NestJS (Node), y declararla en el contrato para que los verificadores externos (CAGF, expertoGobernanza) sepan qué esperar.

**Responsable:** Mediador. **Entregable:** sección canónica en `docs/CONTRATO_API_v0.md` §2.3 (ya apunta a JCS/RFC 8785; falta el nombre de la implementación).

---

## D4 — Naturaleza del servicio (interno vs. producto)

**Bloquea:** Fase 5 (condición de activación: si la decisión es "interno", la Fase 5 se reduce a exponer MCP para el ecosistema sin niveles de acceso). **Estado:** abierta — **inclinada a "producto con niveles"** desde 2026-08-07: Evidentia decretada como feature de **pago futuro** implica consumidores externos y tiers. Se cierra formalmente al definir F5.

**Decisión requerida (del Mediador):** ¿escrubery es una herramienta interna del ecosistema (ADRC, expertoGobernanza, CAGF), o un producto con niveles de acceso y consumidores externos?

**Contexto para decidir:** los consumidores declarados (plan v2 §4.4) son hoy todos internos del ecosistema. La decisión determina si la Fase 5 incluye autenticación por niveles de acceso o solo un Agent Card firmado para pares conocidos.

**No urgente:** bloquea Fase 5, la última. Puede discutirse tarde, pero conviene tenerla plantada para no diseñar las fases 1–4 asumiendo un alcance que cambie.

**Responsable:** Mediador. **Entregable:** un párrafo de decisión añadido a este documento (y reflejado en el plan v2 §8 si es "interno").

---

## Cómo se actualiza esto

Al cerrar una decisión: cambiar `Estado` a `Cerrada`, rellenar `Entregable` con la ruta y la fecha, y dejar el historial de la decisión (opciones descartadas, por qué) en el archivo de entregable citado. El cierre de D1 y D2 son hitos (desbloquean fases); disparan ronda adversarial (política §6).
