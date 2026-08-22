import type { Plugin } from "@opencode-ai/plugin"

// ankla_gate.ts — H8 memoria enforcada (piloto escrubery).
// Pieza 2 (L3): ninguna sesión de opencode escribe sin que AN-KLA haya corrido
// en ella. Pieza 1 parcial: session.created ejecuta AN-KLA y sella; la inyección
// al CONTEXTO no tiene vía documentada en opencode (limitación declarada vs
// SessionStart de claude-code). Comparte log/sellos con scripts/hooks-spike/*.
// Fail-open: AN-KLA caído → sello degraded, no bloquea (degradación visible).

const GATE_DIR = `${process.cwd()}/var/ankla-gate`
const LOG = `${GATE_DIR}/log.jsonl`

async function anklaOk(): Promise<boolean> {
  try {
    const proc = Bun.spawnSync(
      [
        `${process.cwd()}/.venv/bin/python`,
        "-m",
        "an_kla",
        "--project-root",
        process.cwd(),
        "resume",
        "--query",
        "estado del proyecto",
        "--budget",
        "4096",
      ],
      { stdout: "ignore", stderr: "ignore" },
    )
    return proc.exitCode === 0
  } catch {
    return false
  }
}

function logEvento(tipo: string, sid: string, extra = ""): void {
  const ts = new Date().toISOString()
  const linea = `{"ts":"${ts}","tipo":"${tipo}","session_id":"${sid}"${extra ? "," + extra : ""}}\n`
  Bun.file(LOG).text().then((t) => Bun.write(LOG, t + linea)).catch(() => Bun.write(LOG, linea))
}

async function sellar(sid: string, estado: string): Promise<void> {
  await Bun.write(
    `${GATE_DIR}/${sid}.seal`,
    JSON.stringify({ estado, ts: new Date().toISOString() }) + "\n",
  )
}

async function estadoSello(sid: string): Promise<string | null> {
  const f = Bun.file(`${GATE_DIR}/${sid}.seal`)
  if (!(await f.exists())) return null
  try {
    return (JSON.parse(await f.text()) as { estado: string }).estado
  } catch {
    return "?"
  }
}

export const AnklaGatePlugin: Plugin = async () => {
  return {
    "session.created": async (input: unknown) => {
      const sid =
        (input as { info?: { sessionID?: string } })?.info?.sessionID ??
        (input as { sessionID?: string })?.sessionID ??
        "sin-session-id"
      const ok = await anklaOk()
      await sellar(sid, ok ? "ok" : "degraded")
      logEvento(ok ? "session_created_exec" : "degraded", sid)
    },
    "tool.execute.before": async (input: unknown, output: unknown) => {
      const inp = input as { tool?: string; sessionID?: string }
      if (inp?.tool !== "edit") return // edit cubre edit/write/patch (docs permissions)
      const sid = inp.sessionID ?? "sin-session-id"
      const estado = await estadoSello(sid)
      if (estado === "ok" || estado === "degraded" || estado === "lazy_inject") {
        if (estado === "degraded") logEvento("gate_pass_degraded", sid)
        return
      }
      // Sin sello: AN-KLA corre AHORA en la sesión (lazy), se sella y se bloquea
      // ESTA llamada con mensaje; el reintento pasa.
      const ok = await anklaOk()
      await sellar(sid, ok ? "lazy_inject" : "degraded")
      logEvento(ok ? "lazy_inject" : "degraded", sid, `"tool":"${inp.tool}"`)
      throw new Error(
        "ankla-gate: esta sesión de opencode nació sin memoria AN-KLA. AN-KLA acaba de correr (sello lazy). REINTENTA la edición: pasará.",
      )
    },
  }
}
