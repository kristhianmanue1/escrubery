# Pista paralela de decisiones — escrubery

**Estado:** iniciadas (abiertas). **Origen:** Fase 0 (plan v2 §3.3). **Actualizado:** 2026-08-07.

El costo real de estas decisiones es **calendario**, no ciclos de desarrollo: corren en paralelo a todas las fases. Cada una **bloquea una fase concreta**. El criterio de cierre de la Fase 0 (plan v2 §3) solo exige que estén *iniciadas* —documentadas como abiertas con responsable—, no resueltas.

## Resumen

| ID | Decisión | Bloquea | Estado | Responsable |
|---|---|---|---|---|
| D1 | Revisión de ToS de los CLIs | Fase 3 (criterio de entrada) | Abierta — investigación pendiente | Ejecutor (curaduría) · Mediador (decisión) |
| D2 | Esquema de llaves Ed25519 | Fase 2 | Abierta — diseño preliminar acordado; falta formalizar | Mediador |
| D3 | Canonicalización de payloads firmados | Fase 2 | Casi cerrada — pendiente confirmar | Mediador |
| D4 | Naturaleza del servicio (interno vs. producto) | Fase 5 (condición de activación) | Abierta — sin discutir | Mediador |

---

## D1 — Revisión de Términos de Servicio de los CLIs

**Bloquea:** Fase 3 (criterio de entrada §6.1: "revisión ToS resuelta al menos para los CLIs de verificación diaria"). **Estado:** abierta.

**Por qué importa:** la Fase 3 ejecuta CLIs en contenedor efímero. automatización, *benchmarking* y extracción pueden estar limitados por los ToS de cada proveedor. Sin revisión, hay riesgo operativo/legal.

**Alcance (contenido mínimo, por CLI):** un documento de revisión por producto que cite la cláusula relevante sobre (a) automatización, (b) *benchmarking*, (c) extracción/retención de salidas. Veredicto: `permitido | restringido | prohibido | no_declara` con cita.

**Productos a revisar (7 fichas, grok se distingue por gobernanza):** claude-code, kimi-code, codex-cli, grok-build (oficial xAI), grok-cli-community (superagent-ai), antigravity-cli, cline. Nota: grok-build y grok-cli-community tienen ToS potencialmente distintos (proveedores distintos); no se mezclan.

**Ya hecho:** nada (F0). **Pendiente:** la curaduría, que es lectura de fuentes públicas (Fases 0–1 solo leen fuentes públicas gratuitas, política §7). **Responsable:** Ejecutor (curaduría) → Mediador (aprueba veredicto). **Entregable:** `docs/investigacion/tos-clis.md`.

---

## D2 — Esquema de llaves Ed25519

**Bloquea:** Fase 2 (firma por evento). **Estado:** abierta — el **diseño preliminar está acordado** (mapa de decisiones v1 + plan v2 §5.2); falta formalizar rotación, revocación y el keyring concreto.

**Ya acordado (patrones adoptados de CAGF, corrigiendo sus debilidades):**
- **Clave por servicio/agente firmante** (no mono-clave) — corrección del principal hueco de CAGF.
- **`hash_evento_anterior` del mismo producto DENTRO del payload firmado** — cadena y firma se refuerzan mutuamente.
- **Checkpoint firmado del tip** por lote/día, persistido **fuera** de la base de datos — defensa contra reescritura total.
- **Privada fuera del worktree** (nunca PEM sin cifrar en disco dentro del repo; política §7).
- **Formato alineado con CAGF:** firma `"ed25519:" + base64`; clave pública DER/base64 en keyring JSON commiteado, compatible con `cagf-keyring/0.1`.

**Pendiente (contenido mínimo requerido para cerrar D2):**
- Rotación documentada (periodicidad, trigger de compromiso).
- Revocación documentada (cómo se publica una clave revocada, efecto sobre verificación pasada).
- Keyring concreto: esquema del archivo JSON, ubicación en el repo, política de append.

**Responsable:** Mediador. **Entregable:** `docs/investigacion/esquema-firma-ed25519.md` + `cagf-keyring/` (o equivalente) commiteado.

---

## D3 — Canonicalización de payloads firmados

**Bloquea:** Fase 2. **Estado:** casi cerrada — la opción técnica está decidida; falta confirmación explícita del Mediador y elegir implementación.

**Ya acordado:** **JCS / RFC 8785** (JSON Canonicalization Scheme). No `sort_keys` casero, para que terceros verifiquen firmas sin replicar una implementación específica (plan v2 §5.2; contrato v0 §2.3).

**Pendiente:** (a) confirmar RFC 8785; (b) elegir librería/implementación de referencia en el stack NestJS (Node), y declararla en el contrato para que los verificadores externos (CAGF, expertoGobernanza) sepan qué esperar.

**Responsable:** Mediador. **Entregable:** sección canónica en `docs/CONTRATO_API_v0.md` §2.3 (ya apunta a JCS/RFC 8785; falta el nombre de la implementación).

---

## D4 — Naturaleza del servicio (interno vs. producto)

**Bloquea:** Fase 5 (condición de activación: si la decisión es "interno", la Fase 5 se reduce a exponer MCP para el ecosistema sin niveles de acceso). **Estado:** abierta — sin discutir.

**Decisión requerida (del Mediador):** ¿escrubery es una herramienta interna del ecosistema (ADRC, expertoGobernanza, CAGF), o un producto con niveles de acceso y consumidores externos?

**Contexto para decidir:** los consumidores declarados (plan v2 §4.4) son hoy todos internos del ecosistema. La decisión determina si la Fase 5 incluye autenticación por niveles de acceso o solo un Agent Card firmado para pares conocidos.

**No urgente:** bloquea Fase 5, la última. Puede discutirse tarde, pero conviene tenerla plantada para no diseñar las fases 1–4 asumiendo un alcance que cambie.

**Responsable:** Mediador. **Entregable:** un párrafo de decisión añadido a este documento (y reflejado en el plan v2 §8 si es "interno").

---

## Cómo se actualiza esto

Al cerrar una decisión: cambiar `Estado` a `Cerrada`, rellenar `Entregable` con la ruta y la fecha, y dejar el historial de la decisión (opciones descartadas, por qué) en el archivo de entregable citado. El cierre de D1 y D2 son hitos (desbloquean fases); disparan ronda adversarial (política §6).
