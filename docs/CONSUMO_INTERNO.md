# Consumo interno de escrubery

**Para:** agentes de proyectos internos del ecosistema (CAGF, expertoGobernanza, ADRC). **Decisión D4:** escrubery es herramienta **interna**. **Repo:** privado, misma máquina. **Contrato:** `docs/CONTRATO_API_v0.md`.

## Cómo consumir (CLI local, sin red)

El CLI lee PostgreSQL directamente (no requiere servidor HTTP corriendo). Desde cualquier proyecto:

```bash
~/www/aria/escrubery/scripts/consultar <operacion> [args]
```

**Requisitos (ya satisfechos en el host):** PostgreSQL local activo (peer auth), BD `escrubery` migrada y poblada (188 modelos, 9 CLIs).

### Operaciones (exit codes `0` ok / `1` sin_datos / `2` params)

```bash
# Listar entidades disponibles
consultar listar                                   # → {clis:[...], proveedores:[...]}

# Modelo: capacidades, precios, contexto, procedencia
consultar modelo moonshot kimi-k2-0905-preview     # → JSON con precios, ventana, soporta_*

# Comandos/flags de un CLI (con filtro opcional)
consultar comando claude-code                      # → {cli_producto:{...tipo...}, comandos:[...]}
consultar comando claude-code mcp                  # filtrado

# Ficha (resumida) de una entidad
consultar ficha cli grok-build                     # oficial
consultar ficha proveedor zhipu                    # modelos del proveedor

# Oficial vs. comunitario (gobernanza)
consultar oficialidad                              # → tipo por CLI (grok-build≠grok-cli-community)

# Reportar feedback (contrato de uso §3.6)
consultar feedback '{"tipo":"error","descripcion":"...","agente_reportante":{"id":"<tu-agente>"}}'
```

Toda respuesta de dato trae bloque `procedencia` (`fuente_url`, `fecha_obtencion`, `hash_sha256_contenido_original`, `estado_verificacion`, `firma_ed25519`) — salvo los índices `listar`/`oficialidad`, que no lo llevan (errata 6 del contrato).

### Evidentia (verificar hechos firmados)

Los eventos de changelog (F2) están firmados Ed25519 y encadenados. Para verificar desde otro proyecto:

```bash
cd ~/www/aria/escrubery/backend
npm run evidentia:verificar -- --keyring ../datos/keys/evidentia-keyring.json
# → read-only, fail-closed; usa solo el keyring público (commiteado)
```

Cualquier proyecto puede auditar la cadena de escrubery con su keyring público, sin credenciales del sistema.

## Symlink en PATH (opcional, para invocación corta)

```bash
ln -s ~/www/aria/escrubery/scripts/consultar /usr/local/bin/escrubery
# luego: escrubery modelo moonshot kimi-k2-0905-preview
```

## MCP (operativo desde F2.5)

Servidor MCP **local stdio** que expone las operaciones como *tools* nativas para agentes MCP (Claude Code, Cline, etc.). **Reusa** el módulo de consultas (F1) y Evidentia (F2); sin red ni puerto.

**Tools expuestas (9):** `consultar_modelo`, `consultar_comando_cli`, `consultar_ficha`, `oficialidad`, `listar_entidades`, `verificar_evidencia`, `obtener_agent_card`, `reportar_feedback`, `resolver_identidad_modelo` (T4b, 2026-08-18). La fuente canónica de nombres y descripciones es `backend/src/mcp/tools.ts` (la consumen el servidor MCP y el generador de la Agent Card; el spec `src/mcp/tools.spec.ts` bloquea el drift contra la card firmada).

### Configurar un agente cliente (ej. Claude Code)

Crea/añade un `.mcp.json` (en el proyecto consumidor o global):

```json
{
  "mcpServers": {
    "escrubery": {
      "command": "node",
      "args": ["--env-file=.env", "--import", "tsx", "src/mcp/server.ts"],
      "cwd": "/Users/krisnova/www/aria/escrubery/backend"
    }
  }
}
```

Tras recargar, el agente ve `escrubery` con sus tools y puede invocarlas directamente (p. ej. "consulta el precio de kimi-k2"). El servidor lee PostgreSQL local y responde con JSON + procedencia.

### Verificación rápida del servidor MCP

```bash
cd ~/www/aria/escrubery/backend
npm run mcp:probar    # lanza el servidor (stdio), lista tools y llama consultar_modelo + verificar_evidencia
npm run mcp:server    # arranca el servidor en modo escucha (lo que usa el agente cliente)
```

> F5 queda como **formalización** (Agent Card firmado cuando F4 dé robustez criptográfica); el MCP utilitario ya está aquí.

## Notas

- **Procedencia:** todo dato servido lleva fuente+fecha+hash; `null` = la fuente no lo declara (nunca se infiere).
- **Gobernanza:** grok-build (oficial xAI) ≠ grok-cli-community (comunitario superagent-ai); nunca se mezclan.
- **Sin IA en el path:** las consultas se responden desde BD, sin invocar modelos (Fases 0–2).
- **HTTP con auth + rate-limit (F5, 2026-08-17):** toda llamada a `POST /v0/*` requiere header `X-API-Key`. Las claves se configuran en `backend/.env` (`ESCRUBERY_API_KEYS`, hashes SHA-256). Para generar una clave para tu agente: `CLAVE=$(openssl rand -hex 24)` y `HASH=$(printf %s "$CLAVE" | shasum -a 256 | cut -d' ' -f1)`; el HASH se añade a `.env` del servicio, la clave en claro va al consumidor. Límite: 60 req/min por clave (configurable). Respuestas 401/429 con el formato de error del contrato §4. **Agent Card:** `datos/agent-card/agent-card.json` (firmada Ed25519, verificable con el keyring público) — tool MCP `obtener_agent_card`.
- **Hardening (H4, 2026-08-18):** (a) la comparación de claves es timing-safe (`timingSafeEqual` sobre SHA-256, sin early-exit por clave); (b) los intentos de auth FALLIDOS se limitan por IP — default 20 req/min, configurable con `ESCRUBERY_AUTH_LIMIT_RPM`; las peticiones con clave válida no consumen de este bucket. Ambos límites son token-bucket **en memoria (single-instance)**: si el servicio escala a múltiples procesos/instancias hay que migrarlos a almacenamiento compartido (se documenta aquí para no reclamar protección distribuida).
