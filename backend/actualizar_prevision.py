"""Actualización de Previsión de Surf para Castellón.

Descarga datos meteorológicos y marinos desde Open-Meteo (Marine y Weather API),
aplica el motor de física costera y cálculo de calidad (backend.motor_fisica),
actualiza el histórico de observaciones en historico_olas.csv y envía alertas
gratuitas de WhatsApp a través de CallMeBot API.

Restricciones estrictas:
- Solo librerías estándar de Python (urllib.request, json, csv, math, os, sys, datetime).
- Coste 0 EUR.
- Respeta cabecera exacta de historico_olas.csv:
  fecha,hora,spot,altura_m,periodo_s,dir_swell_deg,viento_kmh,viento_dir_deg,calidad_0_5,feedback_usuario
"""

import csv
import json
import math
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Asegurar codificación UTF-8 en stdout/stderr para entornos Windows (evitar charmap / cp1252)
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Asegurar importación de backend.motor_fisica tanto si se ejecuta como módulo
# (python -m backend.actualizar_prevision) como directamente (python backend/actualizar_prevision.py)
try:
    from backend.motor_fisica import (
        SPOT_CONFIG,
        calcularFisica,
        calcularCalidad,
    )
except ImportError:
    # Añadir directorio raíz del repositorio al path
    _repo_root = str(Path(__file__).resolve().parent.parent)
    if _repo_root not in sys.path:
        sys.path.insert(0, _repo_root)
    from backend.motor_fisica import (
        SPOT_CONFIG,
        calcularFisica,
        calcularCalidad,
    )

# Coordenadas de referencia para el litoral de Castellón (boya / celda marina abierta)
CASTELLON_LAT = 39.98
CASTELLON_LON = 0.03

# Endpoints gratuitos de Open-Meteo (sin API key requerida)
OPEN_METEO_MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
OPEN_METEO_WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

# Endpoint gratuito de CallMeBot WhatsApp
CALLMEBOT_URL = "https://api.callmebot.com/whatsapp.php"

# Cabecera oficial para el CSV de entrenamiento y registro
CSV_HEADER = [
    "fecha",
    "hora",
    "spot",
    "altura_m",
    "periodo_s",
    "dir_swell_deg",
    "viento_kmh",
    "viento_dir_deg",
    "calidad_0_5",
    "feedback_usuario",
]

# Ruta por defecto a historico_olas.csv en la raíz del proyecto
DEFAULT_CSV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "historico_olas.csv",
)


def _http_get_json(url: str, timeout: int = 15) -> Dict[str, Any]:
    """Realiza una petición GET HTTP y parsea la respuesta JSON usando urllib estándar."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "MeteoSurf_Cs/1.0 (Open-Source Surf Forecast)"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        content = response.read().decode("utf-8")
        return json.loads(content)


def obtener_datos_marinos(
    lat: float = CASTELLON_LAT,
    lon: float = CASTELLON_LON,
    forecast_days: int = 1,
) -> Dict[str, Any]:
    """Obtiene altura de ola, período y dirección del oleaje desde Open-Meteo Marine API."""
    params = {
        "latitude": f"{lat:.2f}",
        "longitude": f"{lon:.2f}",
        "hourly": "wave_height,wave_period,wave_direction,wind_wave_height,wind_wave_period,wind_wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction",
        "timezone": "auto",
        "forecast_days": str(forecast_days),
    }
    query_string = urllib.parse.urlencode(params)
    url = f"{OPEN_METEO_MARINE_URL}?{query_string}"
    return _http_get_json(url)


def obtener_datos_meteorologicos(
    lat: float = CASTELLON_LAT,
    lon: float = CASTELLON_LON,
    forecast_days: int = 1,
) -> Dict[str, Any]:
    """Obtiene velocidad y dirección del viento y presión desde Open-Meteo Weather API."""
    params = {
        "latitude": f"{lat:.2f}",
        "longitude": f"{lon:.2f}",
        "hourly": "wind_speed_10m,wind_direction_10m,surface_pressure",
        "wind_speed_unit": "kmh",
        "timezone": "auto",
        "forecast_days": str(forecast_days),
    }
    query_string = urllib.parse.urlencode(params)
    url = f"{OPEN_METEO_WEATHER_URL}?{query_string}"
    return _http_get_json(url)


def calcular_prevision_spots(
    datos_mar: Dict[str, Any],
    datos_meteo: Dict[str, Any],
    spots: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Calcula la previsión horaria para cada spot de Castellón usando motor_fisica.

    Combina las variables mar adentro de Open-Meteo con las transformaciones
    de difracción, sombra y orientación de costa de cada rompiente.
    """
    if spots is None:
        spots = list(SPOT_CONFIG.keys())

    mar_hourly = datos_mar.get("hourly", {})
    meteo_hourly = datos_meteo.get("hourly", {})

    mar_times = mar_hourly.get("time", [])
    wind_wave_heights = mar_hourly.get("wind_wave_height", [])
    wind_wave_periods = mar_hourly.get("wind_wave_period", [])
    wind_wave_directions = mar_hourly.get("wind_wave_direction", [])
    swell_wave_heights = mar_hourly.get("swell_wave_height", [])
    swell_wave_periods = mar_hourly.get("swell_wave_period", [])
    swell_wave_directions = mar_hourly.get("swell_wave_direction", [])
    wave_heights = mar_hourly.get("wave_height", [])
    wave_periods = mar_hourly.get("wave_period", [])
    wave_directions = mar_hourly.get("wave_direction", [])

    meteo_times = meteo_hourly.get("time", [])
    wind_speeds = meteo_hourly.get("wind_speed_10m", [])
    wind_dirs = meteo_hourly.get("wind_direction_10m", [])
    pressures = meteo_hourly.get("surface_pressure", [])

    # Indexar datos meteorológicos por timestamp ISO para alineación temporal exacta
    meteo_by_time: Dict[str, Dict[str, Any]] = {}
    for i, t_str in enumerate(meteo_times):
        meteo_by_time[t_str] = {
            "wind_speed": wind_speeds[i] if i < len(wind_speeds) else 0.0,
            "wind_dir": wind_dirs[i] if i < len(wind_dirs) else 0.0,
            "pressure": pressures[i] if i < len(pressures) else 1013.0,
        }

    registros: List[Dict[str, Any]] = []

    for i, iso_time in enumerate(mar_times):
        # Separar fecha (YYYY-MM-DD) y hora (HH:MM)
        if "T" in iso_time:
            fecha, hora = iso_time.split("T", 1)
        else:
            fecha = iso_time[:10]
            hora = iso_time[11:16] if len(iso_time) >= 16 else "00:00"

        # Extraer mar de viento y swell
        hw = wind_wave_heights[i] if i < len(wind_wave_heights) and wind_wave_heights[i] is not None else 0.0
        hs = swell_wave_heights[i] if i < len(swell_wave_heights) and swell_wave_heights[i] is not None else 0.0
        pw = wind_wave_periods[i] if i < len(wind_wave_periods) and wind_wave_periods[i] is not None else 0.0
        ps = swell_wave_periods[i] if i < len(swell_wave_periods) and swell_wave_periods[i] is not None else 0.0
        dw = wind_wave_directions[i] if i < len(wind_wave_directions) and wind_wave_directions[i] is not None else 0.0
        ds = swell_wave_directions[i] if i < len(swell_wave_directions) and swell_wave_directions[i] is not None else 0.0

        # Calcular altura efectiva combinada (sqrt) y determinar componente dominante
        raw_h = math.sqrt(hw**2 + hs**2) if (hw > 0 or hs > 0) else (wave_heights[i] if i < len(wave_heights) and wave_heights[i] is not None else 0.0)
        
        # En Castellón predomina el mar de viento, así que lo priorizamos en caso de empate
        if hw >= hs and hw > 0:
            raw_p = pw
            raw_dir = dw
        elif hs > hw:
            raw_p = ps
            raw_dir = ds
        else:
            raw_p = wave_periods[i] if i < len(wave_periods) and wave_periods[i] is not None else 0.0
            raw_dir = wave_directions[i] if i < len(wave_directions) and wave_directions[i] is not None else 0.0

        meteo = meteo_by_time.get(iso_time, {"wind_speed": 0.0, "wind_dir": 0.0, "pressure": 1013.0})
        ws = meteo["wind_speed"] if meteo["wind_speed"] is not None else 0.0
        wd = meteo["wind_dir"] if meteo["wind_dir"] is not None else 0.0
        presion = meteo["pressure"] if meteo["pressure"] is not None else 1013.0

        for spot in spots:
            # 1. Calcular física marina (altura efectiva en rompiente)
            h_efectiva = calcularFisica(spot, raw_h, raw_p, raw_dir)

            # 2. Calcular índice de calidad pre-IA (0 a 5 estrellas)
            calidad = calcularCalidad(
                h=h_efectiva,
                p=raw_p,
                ws=ws,
                wd=wd,
                nombre=spot,
                presion=presion,
            )

            registros.append({
                "fecha": fecha,
                "hora": hora,
                "spot": spot,
                "altura_m": f"{h_efectiva:.2f}",
                "periodo_s": f"{raw_p:.1f}",
                "dir_swell_deg": int(round(raw_dir)),
                "viento_kmh": f"{ws:.1f}",
                "viento_dir_deg": int(round(wd)),
                "calidad_0_5": int(calidad),
                "feedback_usuario": "",
            })

    return registros


def guardar_en_historico_csv(
    nuevos_registros: List[Dict[str, Any]],
    csv_path: str = DEFAULT_CSV_PATH,
) -> int:
    """Guarda o actualiza registros en historico_olas.csv.

    Preserva estrictamente el feedback humano ('feedback_usuario') previamente
    registrado para cualquier combinación (fecha, hora, spot).
    """
    existentes: Dict[Tuple[str, str, str], Dict[str, Any]] = {}

    if os.path.exists(csv_path):
        try:
            with open(csv_path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    key = (row.get("fecha", ""), row.get("hora", ""), row.get("spot", ""))
                    if key[0] and key[1] and key[2]:
                        existentes[key] = row
        except Exception as e:
            print(f"[WARN] Error al leer CSV existente ({csv_path}): {e}")

    # Combinar registros: si ya existía y tenía feedback_usuario, preservarlo
    for reg in nuevos_registros:
        key = (reg["fecha"], reg["hora"], reg["spot"])
        if key in existentes:
            feed_existente = existentes[key].get("feedback_usuario", "").strip()
            if feed_existente:
                reg["feedback_usuario"] = feed_existente
        existentes[key] = reg

    # Ordenar registros cronológicamente por (fecha, hora, spot)
    todos_ordenados = sorted(
        existentes.values(),
        key=lambda r: (r.get("fecha", ""), r.get("hora", ""), r.get("spot", "")),
    )

    # Asegurar que el directorio padre existe
    parent_dir = os.path.dirname(os.path.abspath(csv_path))
    if parent_dir and not os.path.exists(parent_dir):
        os.makedirs(parent_dir, exist_ok=True)

    # Escribir con formato CSV estándar
    with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADER)
        writer.writeheader()
        for row in todos_ordenados:
            clean_row = {col: row.get(col, "") for col in CSV_HEADER}
            writer.writerow(clean_row)

    print(f"[INFO] historico_olas.csv actualizado con éxito: {len(todos_ordenados)} registros totales.")
    return len(todos_ordenados)


def formatear_alerta_whatsapp(
    registros: List[Dict[str, Any]],
    fecha_filtro: Optional[str] = None,
) -> str:
    """Prepara el mensaje de resumen y alerta para WhatsApp con formato limpio."""
    if not registros:
        return "MeteoSurf_Cs: Sin datos de oleaje disponibles."

    if fecha_filtro is None:
        fecha_filtro = registros[0]["fecha"]

    regs_dia = [r for r in registros if r["fecha"] == fecha_filtro]
    if not regs_dia:
        regs_dia = registros

    # Filtrar horas diurnas de surf (07:00 a 20:00) si están disponibles
    regs_diurnos = [r for r in regs_dia if "07:00" <= r["hora"] <= "20:00"]
    muestras = regs_diurnos if regs_diurnos else regs_dia

    # Identificar el mejor momento para cada spot del día
    mejores_por_spot: Dict[str, Dict[str, Any]] = {}
    for r in muestras:
        spot = r["spot"]
        calidad = int(r["calidad_0_5"])
        altura = float(r["altura_m"])
        if spot not in mejores_por_spot:
            mejores_por_spot[spot] = r
        else:
            prev_cal = int(mejores_por_spot[spot]["calidad_0_5"])
            prev_alt = float(mejores_por_spot[spot]["altura_m"])
            if (calidad, altura) > (prev_cal, prev_alt):
                mejores_por_spot[spot] = r

    # Ordenar spots por calidad y altura
    ranking = sorted(
        mejores_por_spot.values(),
        key=lambda r: (int(r["calidad_0_5"]), float(r["altura_m"])),
        reverse=True,
    )

    max_calidad = int(ranking[0]["calidad_0_5"]) if ranking else 0
    max_altura = float(ranking[0]["altura_m"]) if ranking else 0.0

    lineas = [
        f"*METEOSURF_CS* | Previsión {fecha_filtro}",
        "------------------------------------",
    ]

    if max_calidad >= 3 or max_altura >= 0.6:
        lineas.append("*ALERTA DE SURF: Buenas condiciones hoy en la costa.*")
    elif max_calidad >= 2 or max_altura >= 0.35:
        lineas.append("Condiciones justas / orillero practicable.")
    else:
        lineas.append("Condiciones suaves / mar plato.")

    lineas.append("")
    lineas.append("*Mejores condiciones por spot:*")

    # Mostrar hasta los 5 mejores spots
    for r in ranking[:5]:
        score_txt = f"{r['calidad_0_5']}/5"
        lineas.append(
            f"- *{r['spot']}* ({r['hora']}): {r['altura_m']}m | {r['periodo_s']}s | "
            f"Viento {r['viento_kmh']} km/h | Calidad {score_txt}"
        )

    lineas.append("")
    lineas.append("Valora tu sesion hoy para entrenar el modelo: https://joorcs96.github.io/MeteoSurf_Cs/votar.html")

    return "\n".join(lineas)


def enviar_alerta_callmebot(
    mensaje: str,
    phone: Optional[str] = None,
    apikey: Optional[str] = None,
    timeout: int = 15,
) -> bool:
    """Envía la alerta por WhatsApp mediante CallMeBot API gratuita.

    Si no se configuran las variables de entorno CALLMEBOT_PHONE o CALLMEBOT_APIKEY,
    la función informa limpiamente y omite el envío sin generar excepciones.
    """
    destinatario = phone or os.environ.get("CALLMEBOT_PHONE", "").strip()
    clave = apikey or os.environ.get("CALLMEBOT_APIKEY", "").strip()

    if not destinatario or not clave:
        print("[INFO] CALLMEBOT_PHONE o CALLMEBOT_APIKEY no configurados. Alerta de WhatsApp omitida.")
        return False

    # Limpiar formato de teléfono (retirar espacios, guiones o signos de suma no necesarios)
    destinatario_limpio = destinatario.replace(" ", "").replace("-", "")
    if destinatario_limpio.startswith("+"):
        destinatario_limpio = destinatario_limpio[1:]

    params = {
        "phone": destinatario_limpio,
        "text": mensaje,
        "apikey": clave,
    }
    query_string = urllib.parse.urlencode(params)
    url = f"{CALLMEBOT_URL}?{query_string}"

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "MeteoSurf_Cs/1.0"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status_code = response.getcode()
            respuesta = response.read().decode("utf-8", errors="ignore")
            if status_code == 200:
                print(f"[INFO] Alerta WhatsApp enviada satisfactoriamente a {destinatario_limpio}.")
                return True
            else:
                print(f"[WARN] CallMeBot respondió con código {status_code}: {respuesta}")
                return False
    except Exception as e:
        print(f"[ERROR] Error al contactar con CallMeBot API: {e}")
        return False


def ejecutar_actualizacion(
    csv_path: str = DEFAULT_CSV_PATH,
    enviar_whatsapp: bool = True,
    forecast_days: int = 1,
) -> Dict[str, Any]:
    """Ejecuta el ciclo completo de previsión, persistencia y alerta."""
    print("[1/4] Descargando datos marinos de Open-Meteo...")
    datos_mar = obtener_datos_marinos(forecast_days=forecast_days)

    print("[2/4] Descargando datos meteorológicos de Open-Meteo...")
    datos_meteo = obtener_datos_meteorologicos(forecast_days=forecast_days)

    print("[3/4] Calculando física costera y calidad para los spots...")
    registros = calcular_prevision_spots(datos_mar, datos_meteo)

    print(f"[4/4] Guardando {len(registros)} registros calculados en {csv_path}...")
    total_filas = guardar_en_historico_csv(registros, csv_path=csv_path)

    # Preparar y emitir alerta si procede
    alerta_texto = formatear_alerta_whatsapp(registros)
    alerta_enviada = False
    if enviar_whatsapp:
        alerta_enviada = enviar_alerta_callmebot(alerta_texto)

    return {
        "status": "ok",
        "registros_calculados": len(registros),
        "total_filas_csv": total_filas,
        "alerta_whatsapp_enviada": alerta_enviada,
        "alerta_preview": alerta_texto,
    }


if __name__ == "__main__":
    # Opciones sencillas por línea de comando o ejecución por defecto
    enviar_wa = "--no-whatsapp" not in sys.argv
    dias = 1
    for arg in sys.argv:
        if arg.startswith("--days="):
            try:
                dias = int(arg.split("=")[1])
            except ValueError:
                pass

    resultado = ejecutar_actualizacion(enviar_whatsapp=enviar_wa, forecast_days=dias)
    print("\n--- RESUMEN EJECUCIÓN ---")
    print(f"Registros calculados: {resultado['registros_calculados']}")
    print(f"Total en CSV: {resultado['total_filas_csv']}")
    print(f"WhatsApp: {'Enviado' if resultado['alerta_whatsapp_enviada'] else 'Omitido / No configurado'}")
    print("\n--- TEXTO ALERTA WHATSAPP ---")
    try:
        print(resultado["alerta_preview"])
    except UnicodeEncodeError:
        print(resultado["alerta_preview"].encode("ascii", errors="replace").decode("ascii"))
