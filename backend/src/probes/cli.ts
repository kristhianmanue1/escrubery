import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { probeOpencode } from './opencode';
import { probeCodex } from './codex';
import { probeCline } from './cline';
import { probeKimi } from './kimi';
import { probeClaudeCode } from './claude';

// Entrada: npm run probe:conversacion -- --cli <opencode|codex-cli|cline|kimi-code|claude-code>
// Read-only: solo lee artefactos locales; escribe exclusivamente bajo var/probes/.
const RAIZ = join(__dirname, '../../..');

function main(): void {
  const i = process.argv.indexOf('--cli');
  const cli = i >= 0 ? process.argv[i + 1] : '';
  if (
    !['opencode', 'codex-cli', 'cline', 'kimi-code', 'claude-code'].includes(
      cli,
    )
  ) {
    console.error(
      'uso: npm run probe:conversacion -- --cli <opencode|codex-cli|cline|kimi-code|claude-code>',
    );
    process.exit(2);
  }
  const dirSalida = join(
    RAIZ,
    'var/probes',
    cli,
    new Date().toISOString().slice(0, 10),
  );
  mkdirSync(dirSalida, { recursive: true });
  if (cli === 'opencode') {
    const r = probeOpencode(dirSalida);
    // stdout: SOLO el reporte saneado (conteos/veredictos/hashes).
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  if (cli === 'codex-cli') {
    const r = probeCodex(dirSalida);
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  if (cli === 'cline') {
    const r = probeCline(dirSalida);
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  if (cli === 'kimi-code') {
    const r = probeKimi(dirSalida);
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  if (cli === 'claude-code') {
    const r = probeClaudeCode(dirSalida);
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  console.error(`probe ${cli}: no registrado`);
  process.exit(2);
}

main();
