#!/usr/bin/env python3
"""Arnés del watcher codex-turn (issue #4, clase C3 de H9).

Criterio falsable del issue: con un rollout reescrito en sitio N veces, el
watcher emite exactamente 1 sonido por `task_complete` único y 0 ante las
N-1 réplicas. Este arnés reproduce el bucle contra una réplica fiel de la
lógica vieja (offset por tamaño, reset a 0 ante truncado, sin dedup) y exige
exactitud contra la lógica nueva (`codex_turn_watcher.RolloutScanner`).

Ejecución: python3 scripts/tests/test_codex_turn_watcher.py
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import codex_turn_watcher as watcher  # noqa: E402

# El arnés NUNCA escribe en el log de producción del watcher.
_tmp_log = Path(tempfile.mkdtemp(prefix="escrubery-arnes-")) / "arnes.log"
watcher.LOG_FILE = _tmp_log


def linea_completa(turn_id: str, ts: str, msg: str = "fin del turno") -> bytes:
    return json.dumps(
        {
            "timestamp": ts,
            "ordinal": 1,
            "type": "event_msg",
            "payload": {
                "type": "task_complete",
                "turn_id": turn_id,
                "last_agent_message": msg,
            },
        }
    ).encode()


class OldLogicScanner:
    """Réplica mínima y fiel de la lógica pre-fix (por tamaño, sin dedup)."""

    def __init__(self) -> None:
        self.offsets: dict[Path, int] = {}
        self.remainders: dict[Path, bytes] = {}

    def scan(self, path: Path) -> list[dict]:
        if path not in self.offsets:
            self.offsets[path] = 0
            self.remainders[path] = b""
        try:
            size = path.stat().st_size
            if size < self.offsets[path]:
                self.offsets[path] = 0
                self.remainders[path] = b""
            if size == self.offsets[path]:
                return []
            with path.open("rb") as handle:
                handle.seek(self.offsets[path])
                chunk = handle.read()
            self.offsets[path] += len(chunk)
        except OSError:
            return []
        data = self.remainders[path] + chunk
        lines = data.split(b"\n")
        self.remainders[path] = lines.pop()
        detectados = []
        for raw in lines:
            if not raw:
                continue
            try:
                event = json.loads(raw)
            except (UnicodeDecodeError, json.JSONDecodeError):
                continue
            if watcher.is_turn_complete(event):
                detectados.append(event)
        return detectados


class RolloutFixture:
    """Rollout temporal que se reescribe en sitio, como los rollouts de codex."""

    def __init__(self, directorio: str):
        self.raiz = Path(directorio)
        self.path = self.raiz / "rollout-prueba.jsonl"
        self.reescrituras_con_encogimiento = 0

    def escribir(self, lineas: list[bytes]) -> None:
        previo = self.path.stat().st_size if self.path.exists() else 0
        self.path.write_bytes(b"\n".join(lineas) + b"\n")
        if self.path.exists() and self.path.stat().st_size < previo:
            self.reescrituras_con_encogimiento += 1

    def reemplazo_inode(self, lineas: list[bytes]) -> None:
        temporal = self.path.with_suffix(".tmp")
        temporal.write_bytes(b"\n".join(lineas) + b"\n")
        os.replace(temporal, self.path)


def versiones_reescrituras(turn_id: str, veces: int) -> list[list[bytes]]:
    """N versiones del mismo rollout: mismo turno, timestamp nuevo en cada una,
    longitud variable (codex reescribe en sitio; el incidente mostró
    event_time variando por ms para el MISMO turno)."""
    versiones = []
    for i in range(veces):
        relleno = "x" * (200 - 10 * i)
        versiones.append(
            [
                json.dumps(
                    {"timestamp": f"2026-09-02T16:12:{i:02d}.000Z", "type": "event_msg",
                     "payload": {"type": "task_started", "turn_id": turn_id}}
                ).encode(),
                linea_completa(turn_id, f"2026-09-02T16:12:38.{i:03d}Z", relleno),
            ]
        )
    return versiones


class TestCriterioFalsable(unittest.TestCase):
    N_REESCRITURAS = 5

    def test_logica_vieja_reproduce_el_bucle(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = RolloutFixture(tmp)
            scanner = OldLogicScanner()
            sonados = []
            for version in versiones_reescrituras("turno-A", self.N_REESCRITURAS):
                fixture.escribir(version)
                sonados.extend(scanner.scan(fixture.path))
            self.assertGreaterEqual(
                fixture.reescrituras_con_encogimiento, 1,
                "el fixture dejó de reescribir en sitio con encogimiento: "
                "ya no reproduce la condición C3",
            )
            self.assertGreaterEqual(
                len(sonados), 2,
                "la réplica de la lógica vieja ya no repite el mismo evento: "
                "el fixture dejó de reproducir C3",
            )

    def test_logica_nueva_exactamente_un_sonido(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = RolloutFixture(tmp)
            scanner = watcher.RolloutScanner()
            sonados = []
            for version in versiones_reescrituras("turno-A", self.N_REESCRITURAS):
                fixture.escribir(version)
                sonados.extend(scanner.scan(fixture.path))
            self.assertEqual(len(sonados), 1)

    def test_segundo_turno_tras_reescrituras(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = RolloutFixture(tmp)
            scanner = watcher.RolloutScanner()
            sonados = []
            for version in versiones_reescrituras("turno-A", self.N_REESCRITURAS):
                fixture.escribir(version)
                sonados.extend(scanner.scan(fixture.path))
            fixture.escribir(
                [linea_completa("turno-B", "2026-09-02T16:20:00.000Z")]
            )
            sonados.extend(scanner.scan(fixture.path))
            turnos = [e["payload"]["turn_id"] for e in sonados]
            self.assertEqual(turnos, ["turno-A", "turno-B"])

    def test_reemplazo_por_inode_no_re_sona(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = RolloutFixture(tmp)
            scanner = watcher.RolloutScanner()
            fixture.escribir(versiones_reescrituras("turno-A", 1)[0])
            sonados = scanner.scan(fixture.path)
            fixture.reemplazo_inode(versiones_reescrituras("turno-A", 1)[0])
            sonados.extend(scanner.scan(fixture.path))
            self.assertEqual(len(sonados), 1)

    def test_clasificador_ignora_ruido(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = RolloutFixture(tmp)
            scanner = watcher.RolloutScanner()
            fixture.escribir(
                [
                    b"{linea truncada incompleta",
                    json.dumps(
                        {"timestamp": "t", "type": "event_msg",
                         "payload": {"type": "task_started"}}
                    ).encode(),
                    b"no es json",
                    linea_completa("turno-A", "ts"),
                ]
            )
            sonados = scanner.scan(fixture.path)
            self.assertEqual(len(sonados), 1)
            self.assertEqual(sonados[0]["payload"]["turn_id"], "turno-A")


class TestDedupEIdentidad(unittest.TestCase):
    def test_cota_lru_evicta_la_mas_vieja(self):
        dedup = watcher.EventDedup(max_entries=3)
        for clave in ("a", "b", "c"):
            self.assertTrue(dedup.first_time(clave))
        self.assertFalse(dedup.first_time("a"))
        self.assertTrue(dedup.first_time("d"))
        self.assertLessEqual(len(dedup), 3)
        self.assertTrue(dedup.first_time("b"), "la cota no evictó la clave más vieja")
        self.assertFalse(dedup.first_time("a"), "'a' fue refrescada por el LRU y no debe re-sonar")

    def test_fallback_hash_linea_documenta_r1(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = RolloutFixture(tmp)
            scanner = watcher.RolloutScanner()

            def linea_sin_turn_id(ts: str) -> bytes:
                return json.dumps(
                    {"timestamp": ts, "ordinal": 1, "type": "event_msg",
                     "payload": {"type": "task_complete",
                                 "last_agent_message": "fin"}}
                ).encode()

            vieja = linea_sin_turn_id("ts-1")
            nueva = linea_sin_turn_id("ts-2")
            fixture.escribir([vieja])
            primera = scanner.scan(fixture.path)
            fixture.escribir([vieja])
            replica = scanner.scan(fixture.path)
            fixture.escribir([nueva])
            cambiada = scanner.scan(fixture.path)
            self.assertEqual(len(primera), 1)
            self.assertEqual(len(replica), 0, "bytes idénticos deben deduplicarse")
            self.assertEqual(len(cambiada), 1, "residual R1: sin turn_id, línea "
                "mutada re-sona (comportamiento declarado en la tarjeta)")

    def test_clave_estable_ante_reescritura_con_timestamp_nuevo(self):
        base = {
            "ordinal": 7,
            "type": "event_msg",
            "payload": {"type": "task_complete", "turn_id": "mismo-turno"},
        }
        clave_a = watcher.event_key("r.jsonl", json.dumps(
            {"timestamp": "2026-09-02T16:12:38.708Z", **base}).encode())
        clave_b = watcher.event_key("r.jsonl", json.dumps(
            {"timestamp": "2026-09-02T16:12:38.713Z", **base}).encode())
        self.assertIsNotNone(clave_a)
        self.assertEqual(clave_a, clave_b)


if __name__ == "__main__":
    unittest.main(verbosity=2)
