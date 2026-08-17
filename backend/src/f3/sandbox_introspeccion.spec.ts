import { extraerComandos } from './sandbox_introspeccion';

// H2 (adversarial F3 r1): specs del parser — antes tenía CERO cobertura y
// RE_OPEN perdía el 38% de los comandos de opencode (placeholders). Spec pura.

describe('extraerComandos — opencode (RE_OPEN con placeholders)', () => {
  const help = `Usage: opencode [options] [command]

Options:
  -h, --help     Show help

Commands:
  opencode run [message..]       Run opencode in non-interactive mode
  opencode auth login            Login
  opencode attach <url>          Attach to a shared session
  opencode upgrade [target]      Upgrade opencode
  opencode models [provider]     List models
  opencode export [sessionID]    Export session
  opencode import <file>         Import session
  opencode pr <number>           Create a pull request
  opencode serve                 Start server
  opencode agent                 Manage agents
`;

  it('extrae comandos con placeholders [..] y <..> (no los descarta)', () => {
    const r = extraerComandos('opencode', help);
    const cmds = r.map((c) => c.cmd);
    expect(cmds).toContain('run');
    expect(cmds).toContain('attach');
    expect(cmds).toContain('upgrade');
    expect(cmds).toContain('models');
    expect(cmds).toContain('export');
    expect(cmds).toContain('import');
    expect(cmds).toContain('pr');
    expect(cmds).toContain('serve');
    expect(cmds).toContain('agent');
    expect(cmds).toHaveLength(9);
  });

  it('descripción se captura completa', () => {
    const r = extraerComandos('opencode', help);
    expect(r.find((c) => c.cmd === 'run')?.desc).toBe(
      'Run opencode in non-interactive mode',
    );
  });

  it('sección Commands: no presente (formato plano) → parsea igual (comportamiento histórico)', () => {
    const plano = `  opencode run [message..]   Run
  opencode serve             Serve`;
    const r = extraerComandos('opencode', plano);
    expect(r.map((c) => c.cmd)).toEqual(['run', 'serve']);
  });
});

describe('extraerComandos — qwen-code (RE_QWEN)', () => {
  const help = `Usage: qwen [options] [command]

Commands:
  qwen [query..]             Launch Qwen Code CLI  [default]
  qwen mcp                   Manage MCP servers
  qwen extensions <command>  Manage Qwen Code extensions.
  qwen auth                  Configure auth

Positionals:
  query  Positional prompt.
`;

  it('extrae sub-comandos multi-palabra con placeholder, excluye default [query..]', () => {
    const r = extraerComandos('qwen-code', help);
    expect(r.map((c) => c.cmd).sort()).toEqual(['auth', 'extensions', 'mcp']);
  });

  it('sección termina en línea vacía (no captura Positionals)', () => {
    const r = extraerComandos('qwen-code', help);
    expect(r.find((c) => c.cmd === 'query')).toBeUndefined();
  });
});

describe('extraerComandos — genérico (RE_GEN)', () => {
  it('sección Commands: con descripciones alineadas', () => {
    const help = `Commands:
  build    Compila
  deploy   Despliega

Options:
  -h  help
`;
    const r = extraerComandos('claude-code', help);
    expect(r.map((c) => c.cmd)).toEqual(['build', 'deploy']);
  });
});
