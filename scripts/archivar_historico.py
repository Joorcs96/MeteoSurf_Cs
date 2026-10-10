#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/archivar_historico.py - Archivo histórico acumulativo y deduplicado de observaciones reales.

Gestiona el almacenamiento canónico de observaciones de Puertos del Estado:
- Boyas de oleaje (Valencia 2630, Tarragona 2720, Tarragona 1712)
- Mareógrafos de nivel del mar (Sagunto 3655)
- Estaciones meteorológicas de viento (Castellón Mistral REMPOR 4660)

Formatos generados:
- data/historico_observaciones.jsonl (canónico para procesamiento rápido e incremental)
- data/historico_observaciones.csv (tabular para compatibilidad con suites de análisis)

Características:
- Deduplicación idempotente por clave (tipo_sensor, estacion_id, observed_at_utc).
- Preservación estricta de observed_at (hora real del sensor) y retrieved_at (hora de captura),
  así como procedencia de commit git.
- Tratamiento de datos faltantes como faltantes (null / vacío), sin inventar datos ni huecos.
- Integrable en GitHub Actions (coste cero) tras scripts/realtime.py sin llamadas duplicadas a la API.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# Rutas estándar del proyecto
RAIZ = Path(__file__).resolve().parent.parent
DATA_DIR = RAIZ / "data"
SALIDA_JSONL = DATA_DIR / "historico_observaciones.jsonl"
SALIDA_CSV = DATA_DIR / "historico_observaciones.csv"
REALTIME_SNAPSHOT = DATA_DIR / "realtime.json"

URL_API_PORTUS = "https://portus.puertos.es/portussvr/api"

# Columnas canónicas para el CSV
CSV_COLUMNAS = [
    "tiempo_utc",
    "tiempo_recuperado_utc",
    "tipo_sensor",
    "estacion_id",
    "estacion_nombre",
    "lat",
    "lon",
    "distancia_km",
    "fuente",
    "url_fuente",
    "altura_m",
    "altura_max_m",
    "periodo_s",
    "periodo_medio_s",
    "direccion_grados",
    "direccion_pico_grados",
    "temperatura_agua_c",
    "nivel_mar_m",
    "viento_velocidad_ms",
    "viento_velocidad_kmh",
    "viento_racha_ms",
    "viento_racha_kmh",
    "viento_direccion_grados",
    "temperatura_aire_c",
    "calidad_flag",
    "commit_hash",
]


def normalizar_iso_utc(fecha_str: Optional[str]) -> Optional[str]:
    """Normaliza una cadena de fecha a formato ISO-8601 UTC estricto con sufijo Z."""
    if not fecha_str or not isinstance(fecha_str, str):
        return None
    try:
        # Reemplazar Z por +00:00 para parseo en datetime
        limpia = fecha_str.strip()
        if limpia.endswith("Z"):
            limpia = limpia[:-1] + "+00:00"
        dt = datetime.fromisoformat(limpia)
        dt_utc = dt.astimezone(timezone.utc)
        return dt_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return fecha_str.strip()


def extraer_registros_de_dict(
    data: Dict[str, Any],
    retrieved_fallback: Optional[str] = None,
    commit_hash: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Extrae observaciones individuales normalizadas a partir de un objeto JSON de realtime.json."""
    registros: List[Dict[str, Any]] = []
    
    retrieved_at = normalizar_iso_utc(data.get("generado")) or retrieved_fallback or ""
    
    # 1. Oleaje (boya principal y cercanas)
    oleaje = data.get("oleaje")
    if isinstance(oleaje, dict):
        boyas = []
        if isinstance(oleaje.get("principal"), dict):
            boyas.append(oleaje["principal"])
        if isinstance(oleaje.get("boyas_cercanas"), list):
            for b in oleaje["boyas_cercanas"]:
                if isinstance(b, dict):
                    boyas.append(b)
                    
        for b in boyas:
            f_sensor = normalizar_iso_utc(b.get("fecha"))
            if not f_sensor:
                continue
            
            est_id = b.get("estacion_id")
            if est_id is None:
                continue
            
            # Validación de calidad frente a rangos físicos
            h = b.get("altura_m")
            tp = b.get("periodo_s")
            flag = "OK"
            if b.get("obsoleto") is True:
                flag = "DUDOSO"
            if h is not None and (h < 0.0 or h > 20.0):
                flag = "AVERIA"
            if tp is not None and (tp < 0.0 or tp > 30.0):
                flag = "AVERIA"

            reg = {
                "tiempo_utc": f_sensor,
                "tiempo_recuperado_utc": retrieved_at,
                "tipo_sensor": "BOYA",
                "estacion_id": int(est_id),
                "estacion_nombre": str(b.get("estacion") or f"Boya {est_id}"),
                "lat": float(b.get("lat")) if b.get("lat") is not None else None,
                "lon": float(b.get("lon")) if b.get("lon") is not None else None,
                "distancia_km": float(b.get("distancia_km")) if b.get("distancia_km") is not None else None,
                "fuente": str(b.get("fuente") or "Puertos del Estado · red de boyas REDEXT"),
                "url_fuente": URL_API_PORTUS,
                "altura_m": float(h) if h is not None else None,
                "altura_max_m": float(b.get("altura_max_m")) if b.get("altura_max_m") is not None else None,
                "periodo_s": float(tp) if tp is not None else None,
                "periodo_medio_s": float(b.get("periodo_medio_s")) if b.get("periodo_medio_s") is not None else None,
                "direccion_grados": int(round(b["direccion_grados"])) if b.get("direccion_grados") is not None else None,
                "direccion_pico_grados": int(round(b["direccion_pico_grados"])) if b.get("direccion_pico_grados") is not None else None,
                "temperatura_agua_c": float(b.get("temperatura_agua_c")) if b.get("temperatura_agua_c") is not None else None,
                "nivel_mar_m": None,
                "viento_velocidad_ms": None,
                "viento_velocidad_kmh": None,
                "viento_racha_ms": None,
                "viento_racha_kmh": None,
                "viento_direccion_grados": None,
                "temperatura_aire_c": None,
                "calidad_flag": flag,
                "commit_hash": commit_hash or "",
            }
            registros.append(reg)

    # 2. Nivel del mar (mareógrafo)
    nm = data.get("nivel_mar")
    if isinstance(nm, dict):
        f_sensor = normalizar_iso_utc(nm.get("fecha"))
        est_id = nm.get("estacion_id")
        if f_sensor and est_id is not None:
            nivel = nm.get("nivel_m")
            flag = "OK"
            if nm.get("obsoleto") is True:
                flag = "DUDOSO"
            reg = {
                "tiempo_utc": f_sensor,
                "tiempo_recuperado_utc": retrieved_at,
                "tipo_sensor": "MAREOGRAFO",
                "estacion_id": int(est_id),
                "estacion_nombre": str(nm.get("estacion") or f"Mareografo {est_id}"),
                "lat": float(nm.get("lat")) if nm.get("lat") is not None else None,
                "lon": float(nm.get("lon")) if nm.get("lon") is not None else None,
                "distancia_km": float(nm.get("distancia_km")) if nm.get("distancia_km") is not None else None,
                "fuente": str(nm.get("fuente") or "Puertos del Estado · mareógrafo"),
                "url_fuente": URL_API_PORTUS,
                "altura_m": None,
                "altura_max_m": None,
                "periodo_s": None,
                "periodo_medio_s": None,
                "direccion_grados": None,
                "direccion_pico_grados": None,
                "temperatura_agua_c": None,
                "nivel_mar_m": float(nivel) if nivel is not None else None,
                "viento_velocidad_ms": None,
                "viento_velocidad_kmh": None,
                "viento_racha_ms": None,
                "viento_racha_kmh": None,
                "viento_direccion_grados": None,
                "temperatura_aire_c": None,
                "calidad_flag": flag,
                "commit_hash": commit_hash or "",
            }
            registros.append(reg)

    # 3. Viento (estación meteorológica REMPOR)
    v = data.get("viento")
    if isinstance(v, dict):
        f_sensor = normalizar_iso_utc(v.get("fecha"))
        est_id = v.get("estacion_id")
        if f_sensor and est_id is not None:
            vel_ms = float(v["velocidad_ms"]) if v.get("velocidad_ms") is not None else None
            racha_ms = float(v["racha_ms"]) if v.get("racha_ms") is not None else None
            vel_kmh = round(vel_ms * 3.6, 1) if vel_ms is not None else None
            racha_kmh = round(racha_ms * 3.6, 1) if racha_ms is not None else None
            flag = "OK"
            if v.get("obsoleto") is True:
                flag = "DUDOSO"
            reg = {
                "tiempo_utc": f_sensor,
                "tiempo_recuperado_utc": retrieved_at,
                "tipo_sensor": "VIENTO",
                "estacion_id": int(est_id),
                "estacion_nombre": str(v.get("estacion") or f"Estación Viento {est_id}"),
                "lat": float(v.get("lat")) if v.get("lat") is not None else None,
                "lon": float(v.get("lon")) if v.get("lon") is not None else None,
                "distancia_km": float(v.get("distancia_km")) if v.get("distancia_km") is not None else None,
                "fuente": str(v.get("fuente") or "Puertos del Estado · REMPOR"),
                "url_fuente": URL_API_PORTUS,
                "altura_m": None,
                "altura_max_m": None,
                "periodo_s": None,
                "periodo_medio_s": None,
                "direccion_grados": None,
                "direccion_pico_grados": None,
                "temperatura_agua_c": None,
                "nivel_mar_m": None,
                "viento_velocidad_ms": vel_ms,
                "viento_velocidad_kmh": vel_kmh,
                "viento_racha_ms": racha_ms,
                "viento_racha_kmh": racha_kmh,
                "viento_direccion_grados": int(round(v["direccion_grados"])) if v.get("direccion_grados") is not None else None,
                "temperatura_aire_c": float(v.get("temperatura_c")) if v.get("temperatura_c") is not None else None,
                "calidad_flag": flag,
                "commit_hash": commit_hash or "",
            }
            registros.append(reg)

    return registros


def clave_dedup(r: Dict[str, Any]) -> Tuple[str, int, str]:
    """Clave de deduplicación canónica: (tipo_sensor, estacion_id, tiempo_utc)."""
    return (str(r.get("tipo_sensor")), int(r.get("estacion_id") or 0), str(r.get("tiempo_utc")))


def cargar_historico_existente(jsonl_path: Path = SALIDA_JSONL) -> Dict[Tuple[str, int, str], Dict[str, Any]]:
    """Carga el histórico existente desde el archivo JSONL si existe."""
    existentes: Dict[Tuple[str, int, str], Dict[str, Any]] = {}
    if not jsonl_path.exists():
        return existentes
    
    with open(jsonl_path, mode="r", encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if not linea:
                continue
            try:
                reg = json.loads(linea)
                k = clave_dedup(reg)
                if k[0] and k[1] and k[2]:
                    existentes[k] = reg
            except Exception:
                continue
    return existentes


def guardar_historico(
    registros_dict: Dict[Tuple[str, int, str], Dict[str, Any]],
    jsonl_path: Path = SALIDA_JSONL,
    csv_path: Path = SALIDA_CSV,
) -> int:
    """Guarda el conjunto completo deduplicado en JSONL y CSV ordenado cronológicamente."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    
    # Orden cronológico por (tiempo_utc, tipo_sensor, estacion_id)
    ordenados = sorted(
        registros_dict.values(),
        key=lambda r: (str(r.get("tiempo_utc")), str(r.get("tipo_sensor")), int(r.get("estacion_id") or 0)),
    )

    # 1. Escribir JSONL canónico
    with open(jsonl_path, mode="w", encoding="utf-8") as f:
        for r in ordenados:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # 2. Escribir CSV canónico
    with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNAS)
        writer.writeheader()
        for r in ordenados:
            fila = {col: ("" if r.get(col) is None else r.get(col)) for col in CSV_COLUMNAS}
            writer.writerow(fila)

    return len(ordenados)


def extraer_desde_git(repo_dir: Path = RAIZ) -> Dict[Tuple[str, int, str], Dict[str, Any]]:
    """Recupera todas las observaciones históricas guardadas en los commits de git de data/realtime.json."""
    cmd = ["git", "log", "--format=%H %cI", "--", "data/realtime.json"]
    res = subprocess.run(cmd, cwd=repo_dir, capture_output=True, text=True, encoding="utf-8", errors="replace", check=True)
    lineas = [l.strip().split() for l in res.stdout.strip().splitlines() if l.strip()]
    
    # Invertir para procesar del commit más antiguo al más reciente
    lineas_cron = list(reversed(lineas))
    
    recuperados: Dict[Tuple[str, int, str], Dict[str, Any]] = {}
    
    for ch, c_time in lineas_cron:
        cmd_show = ["git", "show", f"{ch}:data/realtime.json"]
        show_res = subprocess.run(cmd_show, cwd=repo_dir, capture_output=True, text=True, encoding="utf-8", errors="replace")
        if show_res.returncode != 0:
            continue
        try:
            d = json.loads(show_res.stdout)
            regs = extraer_registros_de_dict(d, retrieved_fallback=c_time, commit_hash=ch)
            for r in regs:
                k = clave_dedup(r)
                # Si no existe, lo añade; si ya existe, se preserva el primero o más fiable
                if k not in recuperados:
                    recuperados[k] = r
                else:
                    # Si ya existía pero no tenía commit_hash y este sí, asociarlo
                    if not recuperados[k].get("commit_hash") and ch:
                        recuperados[k]["commit_hash"] = ch
        except Exception:
            continue
            
    return recuperados


def archivar_snapshot_actual(
    snapshot_path: Path = REALTIME_SNAPSHOT,
    jsonl_path: Path = SALIDA_JSONL,
    csv_path: Path = SALIDA_CSV,
) -> Tuple[int, int]:
    """Lee el snapshot actual de data/realtime.json y lo agrega deduplicado al archivo histórico."""
    if not snapshot_path.exists():
        print(f"[WARN] Snapshot {snapshot_path} no encontrado.")
        return 0, 0

    with open(snapshot_path, mode="r", encoding="utf-8") as f:
        data = json.load(f)

    nuevos_candidatos = extraer_registros_de_dict(data)
    existentes = cargar_historico_existente(jsonl_path)
    total_previo = len(existentes)

    anadidos = 0
    for r in nuevos_candidatos:
        k = clave_dedup(r)
        if k not in existentes:
            existentes[k] = r
            anadidos += 1

    total_final = guardar_historico(existentes, jsonl_path, csv_path)
    return anadidos, total_final


def bootstrap_completo(
    repo_dir: Path = RAIZ,
    snapshot_path: Path = REALTIME_SNAPSHOT,
    jsonl_path: Path = SALIDA_JSONL,
    csv_path: Path = SALIDA_CSV,
) -> int:
    """Ejecuta el bootstrap recuperando todo git y sumando el snapshot local actual."""
    print("[INFO] Iniciando extracción histórica desde commits de Git...")
    historico = extraer_desde_git(repo_dir)
    print(f"[INFO] Observaciones únicas extraídas de Git: {len(historico)}")

    if snapshot_path.exists():
        try:
            with open(snapshot_path, mode="r", encoding="utf-8") as f:
                data = json.load(f)
            regs = extraer_registros_de_dict(data)
            for r in regs:
                k = clave_dedup(r)
                if k not in historico:
                    historico[k] = r
        except Exception as e:
            print(f"[WARN] Error leyendo snapshot actual: {e}")

    total = guardar_historico(historico, jsonl_path, csv_path)
    print(f"[INFO] Histórico canónico guardado con éxito: {total} registros únicos.")
    return total


def verificar_estadisticas(jsonl_path: Path = SALIDA_JSONL) -> None:
    """Calcula y muestra estadísticas de cobertura, conteos por sensor y huecos temporales."""
    existentes = cargar_historico_existente(jsonl_path)
    if not existentes:
        print("[INFO] Histórico vacío.")
        return

    por_tipo: Dict[str, List[Dict[str, Any]]] = {}
    for r in existentes.values():
        t = str(r.get("tipo_sensor"))
        por_tipo.setdefault(t, []).append(r)

    print("\n=== RESUMEN DEL ARCHIVO HISTÓRICO CANÓNICO ===")
    print(f"Total registros únicos deduplicados: {len(existentes)}")
    
    for t, lista in sorted(por_tipo.items()):
        fechas = sorted(r["tiempo_utc"] for r in lista if r.get("tiempo_utc"))
        estaciones = sorted(set(f"{r.get('estacion_id')}: {r.get('estacion_nombre')}" for r in lista))
        print(f"\nTipo: {t} ({len(lista)} registros)")
        print(f"  Rango fechas UTC: {fechas[0]} a {fechas[-1]}")
        print(f"  Estaciones ({len(estaciones)}):")
        for est in estaciones:
            n_est = sum(1 for r in lista if f"{r.get('estacion_id')}: {r.get('estacion_nombre')}" == est)
            print(f"    - {est} -> {n_est} mediciones")

    # Análisis de boya principal de Valencia (2630)
    boyas_valencia = [r for r in por_tipo.get("BOYA", []) if r.get("estacion_id") == 2630]
    fechas_val = sorted(r["tiempo_utc"] for r in boyas_valencia if r.get("tiempo_utc"))
    if len(fechas_val) > 1:
        dts = [datetime.fromisoformat(f.replace("Z", "+00:00")) for f in fechas_val]
        huecos = []
        for i in range(len(dts) - 1):
            horas = (dts[i+1] - dts[i]).total_seconds() / 3600.0
            if horas > 1.5:
                huecos.append((fechas_val[i], fechas_val[i+1], horas))
        print(f"\nBoya de Valencia (2630): {len(boyas_valencia)} registros, {len(huecos)} huecos detectados (>1.5 h)")


def main() -> None:
    parser = argparse.ArgumentParser(description="Gestor del histórico de observaciones reales de MeteoSurf_Cs.")
    parser.add_argument("--bootstrap", action="store_true", help="Reconstruir histórico completo desde commits de Git.")
    parser.add_argument("--agregar-snapshot", action="store_true", help="Agregar observaciones del snapshot realtime.json actual.")
    parser.add_argument("--verificar", action="store_true", help="Mostrar estadísticas y verificación del histórico.")
    args = parser.parse_args()

    if args.bootstrap:
        bootstrap_completo()
        verificar_estadisticas()
    elif args.agregar-snapshot:
        anadidos, total = archivar_snapshot_actual()
        print(f"[INFO] Snapshot procesado: {anadidos} nuevos registros añadidos. Total acumulado: {total}.")
    elif args.verificar:
        verificar_estadisticas()
    else:
        # Por defecto: si no existe histórico, ejecutar bootstrap; si existe, agregar snapshot actual
        if not SALIDA_JSONL.exists() or SALIDA_JSONL.stat().st_size == 0:
            print("[INFO] No se encontró histórico previo. Ejecutando bootstrap completo...")
            bootstrap_completo()
        else:
            anadidos, total = archivar_snapshot_actual()
            print(f"[INFO] Snapshot agregado. Nuevos: {anadidos}. Total: {total}.")
        verificar_estadisticas()


if __name__ == "__main__":
    main()
