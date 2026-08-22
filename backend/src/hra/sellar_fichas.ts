import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  validarFichaAssurance,
  selfHashAssurance,
  calcularDistribucion,
  type FichaAssurance,
} from './assurance';

// hra:sellar — verifica las fichas de curaduría assurance_*: (1) schema válido,
// (2) self-hash del procedencia coincide con el contenido (fail-closed: si difiere,
// lo reporta y sale 1; --fijar lo re-sella), (3) distribución cuadra con las normas.
// Uso: npm run hra:sellar [-- --fijar]

const DIR = join(__dirname, '../../../datos/fichas/curaduria');
const fijar = process.argv.includes('--fijar');

function main(): void {
  const archivos = readdirSync(DIR).filter(
    (f) => f.startsWith('assurance_') && f.endsWith('.json'),
  );
  if (archivos.length === 0) {
    console.error('hra:sellar: no hay fichas assurance_* en ' + DIR);
    process.exit(1);
  }
  let fallos = 0;
  for (const nombre of archivos) {
    const ruta = join(DIR, nombre);
    const ficha = JSON.parse(readFileSync(ruta, 'utf-8')) as FichaAssurance;

    // En modo --fijar se re-sella primero (el hash placeholder no pasaría la
    // validación de pattern); en modo verificación, el hash debe ya estar bien.
    // OJO: excluir procedencia de verdad (destructuring), no solo el tipo —
    // incluir el hash previo en el cálculo haría el hash inestable.
    if (fijar) {
      const { procedencia: _ignorada, ...contenido } = ficha;
      void _ignorada;
      ficha.procedencia.hash_sha256 = selfHashAssurance(contenido);
      writeFileSync(ruta, JSON.stringify(ficha, null, 2) + '\n');
    }

    const r = validarFichaAssurance(ficha);
    if (!r.valido) {
      console.error(
        `✗ ${nombre}: schema inválido — ${JSON.stringify(r.errores?.slice(0, 3))}`,
      );
      fallos++;
      continue;
    }
    const { procedencia, ...contenido } = ficha;
    const esperado = selfHashAssurance(contenido);
    if (procedencia.hash_sha256 !== esperado) {
      console.error(
        `✗ ${nombre}: self-hash difiere (ficha ${procedencia.hash_sha256.slice(7, 19)}… ≠ recalculado ${esperado.slice(7, 19)}…) — corrige el contenido o re-sella con --fijar`,
      );
      fallos++;
      continue;
    }
    // La distribución debe cuadrar con las normas RE-CALCULADA (MED-2 adversarial:
    // la suma sola no detecta distribución mentirosa re-sellada). Se recalcula con
    // la misma regla del módulo, incluida la capa N9 si el gate está abierto.
    const gateAbierto = ficha.n9_gate.estado === 'gate_abierto_verificado';
    const d = ficha.distribucion_garantia;
    const dReal = calcularDistribucion(ficha.normas, gateAbierto);
    const misma =
      d.L1 === dReal.L1 &&
      d.L2 === dReal.L2 &&
      d.L3 === dReal.L3 &&
      d.L4 === dReal.L4 &&
      d.pendiente === dReal.pendiente;
    if (!misma) {
      console.error(
        `✗ ${nombre}: distribución declarada {L1:${d.L1},L2:${d.L2},L3:${d.L3},L4:${d.L4},pend:${d.pendiente}} ≠ recalculada {L1:${dReal.L1},L2:${dReal.L2},L3:${dReal.L3},L4:${dReal.L4},pend:${dReal.pendiente}}`,
      );
      fallos++;
      continue;
    }
    console.log(
      `✓ ${nombre}: válido · n9=${ficha.n9_gate.estado} · L1:${d.L1} L2:${d.L2} L3:${d.L3} L4:${d.L4} pend:${d.pendiente}${gateAbierto && d.L4 === dReal.L4 && d.L4 > 0 ? ' (L4 reportadas ya capadas por N9)' : gateAbierto ? ' (gate N9 abierto)' : ''}`,
    );
  }
  process.exit(fallos > 0 ? 1 : 0);
}

main();
