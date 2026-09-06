#!/usr/bin/env python3
"""Watcher de rollouts de codex: suena cuando un turno completa.

Fix de la clase C3 (issue #4, incidente 2026-09-02): la deduplicación es por
IDENTIDAD de evento — `turn_id` del payload, con fallback al hash de la línea
para rollouts que no lo traigan — nunca por posición de archivo. La
relectura total ante reescritura in situ (truncado, inode nuevo, mtime con
tamaño igual) es segura: una clave ya sonada jamás se re-replica.

Patrón de referencia: Epistates `signal_receipts` (consumo único por
identidad de ejecución). La posición (`st_size`/offset) queda como optimización
de lectura incremental, no como ancla de unicidad.

Config por entorno: ESCRUBERY_CODEX_SESSIONS, ESCRUBERY_TURN_SOUND,
ESCRUBERY_TURN_SOUND_VOLUME, ESCRUBERY_WATCH_INTERVAL, ESCRUBERY_WATCH_LOG,
ESCRUBERY_MAX_SEEN (cota del LRU, default 4096).
"""

from __future__ import annotations

import hashlib
import json
import os
import signal
import subprocess
import sys
import time
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable

SESSIONS_DIR = Path(
    os.environ.get("ESCRUBERY_CODEX_SESSIONS", "~/.codex/sessions")
).expanduser()
SOUND_FILE = Path(
    os.environ.get("ESCRUBERY_TURN_SOUND", "/System/Library/Sounds/Glass.aiff")
).expanduser()
SOUND_VOLUME = os.environ.get("ESCRUBERY_TURN_SOUND_VOLUME", "2")
POLL_SECONDS = float(os.environ.get("ESCRUBERY_WATCH_INTERVAL", "0.5"))
LOG_FILE = Path(
    os.environ.get(
        "ESCRUBERY_WATCH_LOG",
        "~/Library/Logs/escrubery-codex-turn-watcher.log",
    )
).expanduser()
MAX_SEEN = int(os.environ.get("ESCRUBERY_MAX_SEEN", "4096"))

running = True


def log(message: str) -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(f"{timestamp} {message}\n")


def stop(_signum: int, _frame: object) -> None:
    global running
    running = False


def is_turn_complete(event: object) -> bool:
    if not isinstance(event, dict) or event.get("type") != "event_msg":
        return False
    payload = event.get("payload")
    return isinstance(payload, dict) and payload.get("type") == "task_complete"


def event_key(rollout_name: str, raw_line: bytes) -> str | None:
    """Clave de identidad estable del evento, o None si no es turn_complete.

    Primaria: `turn_id` del payload (UUID estable por turno; sobrevive a que
    codex reescriba la línea con timestamp nuevo). Fallback: hash SHA-256 de
    la línea cruda (rollouts sin `turn_id`; residual R1 de la tarjeta).
    """
    try:
        event = json.loads(raw_line)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not is_turn_complete(event):
        return None
    payload = event["payload"]
    turn_id = payload.get("turn_id")
    if isinstance(turn_id, str) and turn_id:
        identity = f"turn_id:{turn_id}"
    else:
        identity = f"line:{hashlib.sha256(raw_line).hexdigest()}"
    return f"{rollout_name}|{identity}"


class EventDedup:
    """Conjunto LRU acotado de claves ya vistas (consumo único)."""

    def __init__(self, max_entries: int = MAX_SEEN):
        if max_entries < 1:
            raise ValueError("max_entries debe ser >= 1")
        self._max = max_entries
        self._seen: OrderedDict[str, None] = OrderedDict()

    @property
    def max_entries(self) -> int:
        return self._max

    def first_time(self, key: str) -> bool:
        """True sólo la primera vez que se ve la clave; acotada por evicción LRU."""
        if key in self._seen:
            self._seen.move_to_end(key)
            return False
        self._seen[key] = None
        while len(self._seen) > self._max:
            self._seen.popitem(last=False)
        return True

    def __len__(self) -> int:
        return len(self._seen)


class _FileState:
    __slots__ = ("offset", "mtime_ns", "inode", "remainder")

    def __init__(self) -> None:
        self.offset = 0
        self.mtime_ns = 0
        self.inode = 0
        self.remainder = b""


class RolloutScanner:
    """Lectura incremental tolerante a reescritura in situ, con dedup por identidad.

    La decisión de relectura usa size + mtime_ns + inode; NINGUNA rama puede
    re-replicar una clave ya vista porque la dedup es anterior al sonido.
    """

    def __init__(self, dedup: EventDedup | None = None):
        self.dedup = dedup if dedup is not None else EventDedup()
        self._state: dict[Path, _FileState] = {}

    def forget(self, gone: Iterable[Path]) -> None:
        for path in gone:
            self._state.pop(path, None)

    def start_at_eof(self, path: Path) -> None:
        state = self._state.setdefault(path, _FileState())
        try:
            info = path.stat()
        except OSError:
            return
        state.offset = info.st_size
        state.mtime_ns = info.st_mtime_ns
        state.inode = info.st_ino
        state.remainder = b""

    def scan(self, path: Path) -> list[dict]:
        """Devuelve los turn_complete NUEVOS (primera vez) detectados en path."""
        state = self._state.setdefault(path, _FileState())
        try:
            info = path.stat()
            size, mtime_ns, inode = info.st_size, info.st_mtime_ns, info.st_ino
            rewrite = (
                inode != state.inode
                or size < state.offset
                or (size == state.offset and mtime_ns != state.mtime_ns)
            )
            if rewrite:
                state.offset = 0
                state.remainder = b""
            if size == state.offset and not rewrite:
                state.mtime_ns = mtime_ns
                state.inode = inode
                return []
            with path.open("rb") as handle:
                handle.seek(state.offset)
                chunk = handle.read()
            state.offset += len(chunk)
            state.mtime_ns = mtime_ns
            state.inode = inode
        except OSError as error:
            log(f"read_error path={path} error={error!r}")
            return []

        data = state.remainder + chunk
        lines = data.split(b"\n")
        state.remainder = lines.pop()

        detected: list[dict] = []
        for raw_line in lines:
            if not raw_line:
                continue
            key = event_key(path.name, raw_line)
            if key is None:
                continue
            if not self.dedup.first_time(key):
                log(f"duplicate_suppressed key={key}")
                continue
            try:
                event = json.loads(raw_line)
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            detected.append(event)
        return detected


def play_sound() -> None:
    subprocess.Popen(
        ["/usr/bin/afplay", "-v", SOUND_VOLUME, str(SOUND_FILE)],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )


def rollout_files() -> list[Path]:
    if not SESSIONS_DIR.is_dir():
        return []
    return list(SESSIONS_DIR.rglob("*.jsonl"))


def self_test() -> int:
    complete = {"type": "event_msg", "payload": {"type": "task_complete", "turn_id": "t1"}}
    incomplete = {"type": "event_msg", "payload": {"type": "task_started"}}
    if not is_turn_complete(complete) or is_turn_complete(incomplete):
        print("event classifier failed", file=sys.stderr)
        return 1
    line_a = json.dumps(
        {"timestamp": "2026-09-02T16:12:38.708Z", **complete}
    ).encode()
    line_b = json.dumps(
        {"timestamp": "2026-09-02T16:12:38.713Z", **complete}
    ).encode()
    key_a, key_b = event_key("r.jsonl", line_a), event_key("r.jsonl", line_b)
    if key_a is None or key_a != key_b:
        print("event key not stable across rewrites", file=sys.stderr)
        return 1
    if not SOUND_FILE.is_file():
        print(f"sound file missing: {SOUND_FILE}", file=sys.stderr)
        return 1
    print("ok")
    return 0


def main(
    notifier: Callable[[], None] = play_sound,
    poll_seconds: float | None = None,
) -> int:
    if "--self-test" in sys.argv:
        return self_test()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    interval = POLL_SECONDS if poll_seconds is None else poll_seconds

    scanner = RolloutScanner()
    for path in rollout_files():
        scanner.start_at_eof(path)

    log(
        f"started pid={os.getpid()} tracked={len(scanner._state)} "
        f"sessions={SESSIONS_DIR} dedup=identity(max={scanner.dedup.max_entries})"
    )

    while running:
        current_files = set(rollout_files())
        for path in current_files:
            for event in scanner.scan(path):
                notifier()
                payload = event.get("payload", {})
                log(
                    f"turn_complete path={path} "
                    f"turn_id={payload.get('turn_id', 'sin_turn_id')} "
                    f"event_time={event.get('timestamp', 'unknown')}"
                )
        scanner.forget(set(scanner._state) - current_files)
        time.sleep(interval)

    log("stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
