# Consumo interno de escrubery

**Para:** agentes de proyectos internos del ecosistema (CAGF, expertoGobernanza, ADRC). **Decisión D4:** escrubery es herramienta **interna**. **Repo:** privado, misma máquina. **Contrato:** `docs/CONTRATO_API_v0.md`.

## Cómo consumir (CLI local, sin red)

El CLI lee PostgreSQL directamente (no requiere servidor HTTP corriendo). Desde cualquier proyecto:

```bash
~/www/aria/escrubery/scripts/consultar <operacion> [args]
```

**Requisitos (ya satisfechos en el host):** PostgreSQL local activo (peer auth), BD `escrubery` migrada y poblada (139 modelos, 7 CLIs).

### Operaciones (exit codes `0` ok / `1` sin_datos / `2` params)

```bash
# Listar entidades disponibles
consultar listar                                   # → {clis:[...], proveedores:[...]}

# Modelo: capacidades, precios, contexto, procedencia
consultar modelo moonshot kimi-k2-0905-preview     # → JSON con precios, ventana, soporta_*

# Comandos/flags de un CLI (con filtro opcional)
consultar comando claude-code                      # → {cli_producto:{...tipo...}, comandos:[...]}
consultar comando claude-code mcp                  # filtrado

# Ficha completa de una entidad
consultar ficha cli grok-build                     # oficial
consultar ficha proveedor zhipu                    # modelos del proveedor

# Oficial vs. comunitario (gobernanza)
consultar oficialidad                              # → tipo por CLI (grok-build≠grok-cli-community)

# Reportar feedback (contrato de uso §3.6)
consultar feedback '{"tipo":"error","descripcion":"...","agente_reportante":{"id":"<tu-agente>"}}'
```

Toda respuesta trae bloque `procedencia` (`fuente_url`, `fecha_obtencion`, `hash_sha256_contenido_original`, `estado_verificacion`, `firma_ed25519`).

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

## MCP (próximo)

El consumo nativo para agentes MCP (Claude Code, Cline, etc.) será un **servidor MCP local** que envuelve estas mismas operaciones como *tools*. Ver análisis de integración en `docs/investigacion/Plan_Iterativo_Incremental_Servicio_CLI_Modelos_v2.md` §8 (F5) y la recomendación de adelantarlo como F2.5.

## Notas

- **Procedencia:** todo dato servido lleva fuente+fecha+hash; `null` = la fuente no lo declara (nunca se infiere).
- **Gobernanza:** grok-build (oficial xAI) ≠ grok-cli-community (comunitario superagent-ai); nunca se mezclan.
- **Sin IA en el path:** las consultas se responden desde BD, sin invocar modelos (Fases 0–2).
