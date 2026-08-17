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

**Tools expuestas:** `consultar_modelo`, `consultar_comando_cli`, `consultar_ficha`, `oficialidad`, `listar_entidades`, `verificar_evidencia`.

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
- **Desviación conocida (T8, plan de deuda):** HTTP sin auth ni rate-limit en alpha interna — el `429`/auth del contrato v0 no está disponible todavía; se resuelve en F5 o antes si el servicio se expone fuera de localhost.
