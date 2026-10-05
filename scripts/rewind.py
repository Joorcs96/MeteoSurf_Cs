"""Rewinds: clips cortos de las cámaras para repasar el mar de cada momento.

Graba 20 s de las cámaras HLS de Turisme Comunitat Valenciana que cubren
Planetario/Pirámides (Grao), Voramar/Heliópolis (Benicàssim) y Morro de Gos/La
Renegà (Oropesa del Mar), los baja a 480p con desenfoque para que no se
reconozcan caras, guarda junto a cada clip la previsión Open-Meteo de ese
momento (punto de mar de cada spot) y mantiene el índice `data/rewinds.json`.
Los clips se pueden subir como assets de la GitHub Release `rewinds-AAAA-MM`
(gratis, sin engordar el historial del repositorio).

Solo librerías estándar de Python más los binarios `ffmpeg` y `ffprobe` en el
PATH (en Linux se pueden indicar con las variables FFMPEG y FFPROBE).

Uso:
  python scripts/rewind.py                          # todas las cámaras diurnas, sin subir
  python scripts/rewind.py --cameras cv_grao_castellon
  python scripts/rewind.py --subir --repo Joorcs96/MeteoSurf_Cs   # lo usa el workflow
  python scripts/rewind.py --forzar --dry-run       # prueba sin escribir nada
  python -m unittest scripts.test_rewind            # pruebas sin red
"""

import argparse
import json
import math
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
import time
from datetime import date, datetime, timedelta, timezone, tzinfo
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

# ------------------------------------------------------------------ rutas y ajustes

ROOT_DIR = Path(__file__).resolve().parent.parent
SPOTS_JS_PATH = ROOT_DIR / "js" / "spots.js"
WEBCAMS_PATH = ROOT_DIR / "webcams.json"
INDICE_PATH = ROOT_DIR / "data" / "rewinds.json"
CLIPS_DIR = ROOT_DIR / "rewinds"

REPO_POR_DEFECTO = "Joorcs96/MeteoSurf_Cs"
ZONA_HORARIA = "Europe/Madrid"

# Solo las cámaras HLS de Turisme CV son grabables: MJPEG/JPG no dan segments y
# los iframes de terceros no se pueden descargar de forma estable.
HOST_CV = "streaming.comunitatvalenciana.com"

# Spots con cámara, por área. Es lo que el enunciado pide: Grao, Benicàssim y Oropesa.
SPOTS_CON_CAMARA: Tuple[str, ...] = (
    "Planetario", "Piramides", "Voramar", "Heliopolis", "MorroGos", "Renega",
)
# Orden para nombrar el clip cuando una cámara cubre más de un spot.
PREFERENCIA_SPOT: Tuple[str, ...] = SPOTS_CON_CAMARA

DURACION_S = 20             # segundos de clip
ALTO_MAXIMO = 480           # alto del clip; el requisito es 720p o menos
DESENFOQUE = 2              # desenfoque de caja (luma) para anonimizar; 0 lo desactiva
MAX_MB = 3.0                # objetivo de tamaño por clip
MAX_INTENTOS = 4            # reintentos bajando resolución/calidad si se pasa del objetivo
MIN_ALTURA_M = 0.5          # umbral de oleaje para grabar (saltable con --forzar)
DIAS_REPOSO = 30            # se borran clips y entradas más viejos que esto
HORA_MIN = 8                # solo horas de luz (hora de Madrid)
HORA_MAX = 20

MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"
VARS_MAR = "wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction,wind_wave_height,wind_wave_period,wind_wave_direction,sea_surface_temperature"
VARS_METEO = "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 MeteoSurf_Cs/1.0"
)
TIEMPO_HTTP = 20

# Rosa de los vientos en castellano, como la usa js/forecast.js
ROSA_VIENTOS = (
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO",
)


def _configurar_stdout() -> None:
    """Evita que la consola de Windows se coma las tildes."""
    for flujo in (sys.stdout, sys.stderr):
        if flujo and hasattr(flujo, "reconfigure"):
            try:
                flujo.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


# ------------------------------------------------------------------ hora de Madrid


def _ultimo_domingo(year: int, mes: int) -> int:
    """Día del último domingo de un mes (1-31)."""
    dia = date(year, mes, 31)
    return dia.day - ((dia.weekday() + 1) % 7)


class _MadridCET(tzinfo):
    """CET/CEST con la regla de la UE, para cuando no hay base de datos IANA.

    Windows no trae base IANA, así que `zoneinfo` puede fallar si no está el
    paquete `tzdata`. Con esta clase (último domingo de marzo 01:00 UTC a
    último domingo de octubre 01:00 UTC) las fechas siempre salen bien.

    `fromutc` decide el desfase con la hora UTC y `utcoffset` con la hora local,
    que es lo que espera cualquier `astimezone`/`isoformat` posterior.
    """

    @staticmethod
    def _cambios(year: int) -> Tuple[datetime, datetime]:
        """Instantes (en UTC) del cambio a horario de verano y al de invierno."""
        return (
            datetime(year, 3, _ultimo_domingo(year, 3), 1),
            datetime(year, 10, _ultimo_domingo(year, 10), 1),
        )

    def fromutc(self, dt: datetime) -> datetime:
        if dt.tzinfo is not None and dt.tzinfo is not self:
            raise ValueError("fromutc(): dt.tzinfo no es esta zona horaria")
        utc = dt.replace(tzinfo=None)
        verano, otono = self._cambios(utc.year)
        if verano <= utc < otono:
            return (utc + timedelta(hours=2)).replace(tzinfo=self)
        local = (utc + timedelta(hours=1)).replace(tzinfo=self)
        if otono <= utc < otono + timedelta(hours=1):
            # Hora que se repite cada octubre: `fold` la desambigua.
            local = local.replace(fold=1)
        return local

    def _es_verano_local(self, dt: Optional[datetime]) -> bool:
        if dt is None:
            return False
        local = dt.replace(tzinfo=None)
        verano, otono = self._cambios(local.year)
        # En hora local el verano va del último domingo de marzo (a las 03:00, porque
        # las 02:00 no existen) al último domingo de octubre (hasta las 03:00).
        fin_verano = otono + timedelta(hours=2)
        if getattr(dt, "fold", 0) and otono + timedelta(hours=1) <= local < fin_verano:
            return False  # segunda vuelta de la hora repetida de octubre
        return verano + timedelta(hours=1) <= local < fin_verano

    def utcoffset(self, dt: Optional[datetime]) -> timedelta:
        return timedelta(hours=2 if self._es_verano_local(dt) else 1)

    def dst(self, dt: Optional[datetime]) -> timedelta:
        return timedelta(hours=1) if self._es_verano_local(dt) else timedelta(0)

    def tzname(self, dt: Optional[datetime]) -> str:
        return "CEST" if self._es_verano_local(dt) else "CET"


def zona_madrid() -> tzinfo:
    """Zona horaria Europe/Madrid, con respaldo si no hay base de datos IANA."""
    try:
        from zoneinfo import ZoneInfo

        return ZoneInfo(ZONA_HORARIA)
    except Exception:
        return _MadridCET()


def ahora_utc() -> datetime:
    return datetime.now(timezone.utc)


def ahora_madrid() -> datetime:
    return ahora_utc().astimezone(zona_madrid())


def iso_local(momento: datetime) -> str:
    """'2026-09-29T23:59:00+02:00' (con el desfase de Madrid aplicado)."""
    return momento.astimezone(zona_madrid()).isoformat(timespec="seconds")


def texto_local(momento: datetime) -> str:
    """'2026-09-29 23:59', para pintar en la web."""
    return momento.astimezone(zona_madrid()).strftime("%Y-%m-%d %H:%M")


def etiqueta_clip(spot_id: str, momento: datetime) -> str:
    """'rewind_Planetario_20260929-2359.mp4' (sin tildes ni espacios: va en una URL)."""
    return f"rewind_{spot_id}_{momento.astimezone(zona_madrid()).strftime('%Y%m%d-%H%M')}.mp4"


def etiqueta_release(momento: datetime) -> str:
    """'rewinds-2026-09'."""
    return f"rewinds-{momento.astimezone(zona_madrid()).strftime('%Y-%m')}"


def url_descarga(repo: str, tag: str, archivo: str) -> str:
    return f"https://github.com/{repo}/releases/download/{tag}/{archivo}"


def rosa(grados: Optional[float]) -> Optional[str]:
    if grados is None:
        return None
    idx = int(round(((grados % 360) + 360) % 360 / 22.5)) % 16
    return ROSA_VIENTOS[idx]


def _num(valor: Any) -> Optional[float]:
    try:
        if valor is None:
            return None
        return round(float(valor), 1)
    except (TypeError, ValueError):
        return None


# ------------------------------------------------------------------ spots y cámaras


def leer_spots(ruta: Path = SPOTS_JS_PATH) -> Dict[str, Dict[str, Any]]:
    """Lee `js/spots.js` sin depender de Node.

    El archivo es un módulo ES con un ayudante `S()` que calcula el punto de mar
    (seaLat/seaLon) a ~1,2 km de la playa, así que aquí se replica exactamente la
    misma fórmula. Si el spot trae seaLat/seaLon explícitos, mandan esos.
    """
    texto = Path(ruta).read_text(encoding="utf-8")
    spots: Dict[str, Dict[str, Any]] = {}
    for bloque in texto.split("S({")[1:]:
        id_s = re.search(r"""id:\s*['"]([^'"]+)['"]""", bloque)
        if not id_s:
            continue
        nombre = re.search(r"""name:\s*['"]([^'"]+)['"]""", bloque)
        lat = re.search(r"(?<!sea)lat:\s*(-?[\d.]+)", bloque)
        lon = re.search(r"(?<!sea)lon:\s*(-?[\d.]+)", bloque)
        facing = re.search(r"facing:\s*(-?[\d.]+)", bloque)
        if not (lat and lon):
            continue
        spot: Dict[str, Any] = {
            "id": id_s.group(1),
            "name": nombre.group(1) if nombre else id_s.group(1),
            "lat": float(lat.group(1)),
            "lon": float(lon.group(1)),
            "facing": float(facing.group(1)) if facing else 90.0,
        }
        sea_lat = re.search(r"seaLat:\s*(-?[\d.]+)", bloque)
        sea_lon = re.search(r"seaLon:\s*(-?[\d.]+)", bloque)
        if sea_lat and sea_lon:
            spot["seaLat"] = float(sea_lat.group(1))
            spot["seaLon"] = float(sea_lon.group(1))
        else:
            k = 0.012
            r = math.radians(spot["facing"])
            spot["seaLat"] = float(f"{spot['lat'] + k * math.cos(r):.4f}")
            spot["seaLon"] = float(
                f"{spot['lon'] + (k * math.sin(r)) / math.cos(math.radians(spot['lat'])):.4f}"
            )
        spots[spot["id"]] = spot
    return spots


def leer_webcams(ruta: Path = WEBCAMS_PATH) -> List[Dict[str, Any]]:
    datos = json.loads(Path(ruta).read_text(encoding="utf-8"))
    cams = datos.get("webcams", []) if isinstance(datos, dict) else datos
    return [c for c in cams if isinstance(c, dict)]


def camaras_rewind(
    webcams: Sequence[Dict[str, Any]],
    spots_objetivo: Sequence[str] = SPOTS_CON_CAMARA,
) -> List[Dict[str, Any]]:
    """Cámaras HLS de Turisme CV que cubren algún spot objetivo y están activas."""
    objetivo = set(spots_objetivo)
    elegidas = []
    for cam in webcams:
        if cam.get("embedType") != "hls":
            continue
        if cam.get("enabled") is False:
            continue
        url = cam.get("embedUrl") or ""
        if urllib.parse.urlparse(url).netloc != HOST_CV:
            continue
        cubiertos = [s for s in (cam.get("spots") or []) if s in objetivo]
        if not cubiertos:
            continue
        # Orden estable: primero el spot que prefiera la web para nombrar el clip.
        cubiertos.sort(key=lambda s: PREFERENCIA_SPOT.index(s) if s in PREFERENCIA_SPOT else 99)
        cam = dict(cam)
        cam["spotsCubiertos"] = cubiertos
        elegidas.append(cam)
    elegidas.sort(key=lambda c: (c["spotsCubiertos"][0], c.get("id", "")))
    return elegidas


def ahora_madrid_horas_validas(momento: Optional[datetime] = None) -> bool:
    hora = (momento or ahora_madrid()).hour
    return HORA_MIN <= hora <= HORA_MAX


# ------------------------------------------------------------------ previsión


def _json_remoto(url: str) -> Dict[str, Any]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIEMPO_HTTP) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _actual(datos: Dict[str, Any]) -> Dict[str, Any]:
    actual = datos.get("current")
    return actual if isinstance(actual, dict) else {}


def prevision_mar(sea_lat: float, sea_lon: float) -> Dict[str, Any]:
    """Altura, periodo y dirección del oleaje en el punto de mar (Open-Meteo marine)."""
    url = (
        f"{MARINE_URL}?latitude={sea_lat}&longitude={sea_lon}"
        f"&current={VARS_MAR}&cell_selection=sea&timezone={urllib.parse.quote(ZONA_HORARIA)}"
    )
    act = _actual(_json_remoto(url))
    altura = _num(act.get("wave_height"))
    periodo = _num(act.get("wave_period"))
    direccion = _num(act.get("wave_direction"))
    return {
        "altura": altura,
        "periodo": periodo,
        "direccion": direccion,
        "direccionTxt": rosa(direccion),
        "swellAltura": _num(act.get("swell_wave_height")),
        "swellPeriodo": _num(act.get("swell_wave_period")),
        "marDeVientoAltura": _num(act.get("wind_wave_height")),
        "temperaturaAgua": _num(act.get("sea_surface_temperature")),
        "horaApi": act.get("time"),
    }


def prevision_viento(lat: float, lon: float) -> Dict[str, Any]:
    """Viento a 10 m en el punto de la playa (Open-Meteo forecast, km/h)."""
    url = (
        f"{WEATHER_URL}?latitude={lat}&longitude={lon}"
        f"&current={VARS_METEO}&wind_speed_unit=kmh&timezone={urllib.parse.quote(ZONA_HORARIA)}"
    )
    act = _actual(_json_remoto(url))
    dir_viento = _num(act.get("wind_direction_10m"))
    return {
        "viento": _num(act.get("wind_speed_10m")),
        "vientoRacha": _num(act.get("wind_gusts_10m")),
        "vientoDireccion": dir_viento,
        "vientoDireccionTxt": rosa(dir_viento),
        "temperatura": _num(act.get("temperature_2m")),
    }


def prevision_spots(
    ids: Iterable[str], spots: Dict[str, Dict[str, Any]]
) -> Dict[str, Dict[str, Any]]:
    """Previsión combinada (mar + viento) de cada spot, con los fallos aislados."""
    salida: Dict[str, Dict[str, Any]] = {}
    for spot_id in dict.fromkeys(ids):
        spot = spots.get(spot_id)
        if not spot:
            print(f"  [aviso] Spot desconocido: {spot_id}")
            continue
        try:
            datos = prevision_mar(spot["seaLat"], spot["seaLon"])
            datos.update(prevision_viento(spot["lat"], spot["lon"]))
            salida[spot_id] = datos
            print(
                f"  {spot['name']}: {datos['altura']} m / {datos['periodo']} s "
                f"{datos['direccionTxt']} · viento {datos['viento']} km/h {datos['vientoDireccionTxt']}"
            )
        except Exception as exc:  # una API caída no debe tumbar la grabación entera
            print(f"  [aviso] Previsión de {spot_id} falló: {exc}")
    return salida


def supera_umbral(datos: Dict[str, Any], minimo: float = MIN_ALTURA_M) -> bool:
    altura = datos.get("altura")
    return isinstance(altura, (int, float)) and altura >= minimo


# ------------------------------------------------------------------ descarga HLS


def _texto(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIEMPO_HTTP) as resp:
        return resp.read().decode("utf-8", errors="replace")


def url_absoluta(base: str, ref: str) -> str:
    ref = ref.strip()
    if ref.startswith("http://") or ref.startswith("https://"):
        return ref
    return urllib.parse.urljoin(base, ref)


def sub_playlist(url_maestro: str) -> str:
    """De la playlist maestra devuelve la variante de menor ancho de banda."""
    cuerpo = _texto(url_maestro)
    base = url_maestro if url_maestro.endswith("/") else url_maestro.rsplit("/", 1)[0] + "/"
    variantes: List[Tuple[int, str]] = []
    ancho_actual = 0
    for linea in cuerpo.splitlines():
        linea = linea.strip()
        if linea.startswith("#EXT-X-STREAM-INF"):
            m = re.search(r"BANDWIDTH=(\d+)", linea)
            ancho_actual = int(m.group(1)) if m else 0
        elif linea and not linea.startswith("#") and linea.endswith(".m3u8"):
            variantes.append((ancho_actual, url_absoluta(base, linea)))
    if not variantes:
        return url_maestro
    variantes.sort()
    return variantes[0][1]


def segmentos_recientes(url_maestro: str, duracion: int = DURACION_S) -> List[str]:
    """URLs de los últimos segmentos HLS (del más antiguo al más nuevo).

    Se piden algo más de `duracion` (un 20 %) porque los segmentos no dividen
    justo: con eso siempre sobra material aunque el último sea un trozo corto,
    y luego ffmpeg recorta a la duración exacta.
    """
    cuerpo = _texto(sub_playlist(url_maestro))
    base = url_maestro if url_maestro.endswith("/") else url_maestro.rsplit("/", 1)[0] + "/"
    pares: List[Tuple[float, str]] = []
    duracion_actual = 0.0
    for linea in cuerpo.splitlines():
        linea = linea.strip()
        if linea.startswith("#EXTINF"):
            duracion_actual = float(re.split(r"[:,]", linea)[1])
        elif linea and not linea.startswith("#"):
            pares.append((duracion_actual, url_absoluta(base, linea)))
    if not pares:
        return []
    elegidos: List[Tuple[float, str]] = []
    objetivo = duracion * 1.2
    acumulado = 0.0
    for par in reversed(pares):
        elegidos.append(par)
        acumulado += par[0]
        if acumulado >= objetivo:
            break
    elegidos.reverse()
    return [url for _, url in elegidos]


def descargar_segmentos(urls: Sequence[str], destino: Path) -> int:
    """Descarga los segmentos en un solo .ts y devuelve los bytes escritos."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    with open(destino, "wb") as salida:
        for url in urls:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=60) as resp:
                datos = resp.read()
            salida.write(datos)
            total += len(datos)
    return total


# ------------------------------------------------------------------ ffmpeg


def ffmpeg() -> str:
    return os.environ.get("FFMPEG") or "ffmpeg"


def ffprobe() -> str:
    return os.environ.get("FFPROBE") or "ffprobe"


def grabar_directo(url_maestro: str, salida: Path, duracion: int = DURACION_S) -> bool:
    """Graba del directo con ffmpeg; es el camino normal."""
    cmd = [
        ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
        "-i", url_maestro, "-t", str(duracion),
        "-c", "copy", "-f", "mpegts", str(salida),
    ]
    try:
        subprocess.run(cmd, check=True, timeout=180)
    except Exception as exc:
        print(f"  [aviso] ffmpeg no pudo grabar del directo ({exc})")
        return False
    return salida.exists() and salida.stat().st_size > 100_000


def comprimir(
    entrada: Path, salida: Path, duracion: int = DURACION_S, alto: int = ALTO_MAXIMO,
    desenfoque: int = DESENFOQUE, crf: int = 25, max_mb: float = MAX_MB,
) -> Dict[str, Any]:
    """Baja el clip a H.264 sin audio, 480p y desenfocado, y reintenta si se pasa del tamaño."""
    intentos = [
        (alto, crf),
        (alto, crf + 3),
        (min(alto, 360), crf + 4),
        (min(alto, 270), crf + 6),
    ][:MAX_INTENTOS]
    for intento, (alto_i, crf_i) in enumerate(intentos, start=1):
        # Tope de bitrate para que los `duracion` segundos entren de sobra en el objetivo.
        escala_i = f"scale=-2:{alto_i}" if alto_i > 0 else "scale=-2:480"
        vf_i = escala_i + (f",boxblur={desenfoque}:1" if desenfoque > 0 else "")
        topes = max(200, int(max_mb * 1000 * 0.8 / max(duracion, 1) * 0.8))
        cmd = [
            ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
            "-i", str(entrada), "-t", str(duracion), "-an",
            "-vf", vf_i,
            "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main", "-pix_fmt", "yuv420p",
            "-crf", str(crf_i), "-maxrate", f"{topes}k", "-bufsize", f"{topes * 2}k",
            "-movflags", "+faststart", str(salida),
        ]
        subprocess.run(cmd, check=True, timeout=300)
        info = verificar_clip(salida)
        peso_mb = info["bytes"] / 1_048_576
        print(
            f"    intento {intento}: {info['ancho']}x{info['alto']} crf {crf_i} "
            f"-> {peso_mb:.2f} MB ({info['duracion']:.1f} s)"
        )
        if peso_mb <= max_mb and info["duracion"] >= duracion - 2.0:
            info["intentos"] = intento
            return info
    raise RuntimeError(
        f"no se ha podido bajar el clip a {max_mb:.1f} MB en {MAX_INTENTOS} intentos"
    )


def verificar_clip(ruta: Path) -> Dict[str, Any]:
    """Sondea el clip con ffprobe: tamaño, duración, resolución, códec y si lleva audio."""
    cmd = [
        ffprobe(), "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", str(ruta),
    ]
    salida = subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=120)
    datos = json.loads(salida.stdout or "{}")
    flujos = datos.get("streams", []) or [{}]
    video = next((f for f in flujos if f.get("codec_type") == "video"), flujos[0])
    return {
        "bytes": int((datos.get("format") or {}).get("size") or ruta.stat().st_size),
        "duracion": float((datos.get("format") or {}).get("duration") or 0.0),
        "bitrate": int((datos.get("format") or {}).get("bit_rate") or 0),
        "ancho": int(video.get("width") or 0),
        "alto": int(video.get("height") or 0),
        "codec": video.get("codec_name") or "",
        "audio": any(f.get("codec_type") == "audio" for f in flujos),
        "fps": video.get("avg_frame_rate") or "",
    }


def comprobar_clip(info: Dict[str, Any], duracion: int = DURACION_S) -> Optional[str]:
    """Devuelve el motivo del fallo o None si el clip sirve."""
    if info["codec"] != "h264":
        return f"códec {info['codec']} (se esperaba h264)"
    if info["audio"]:
        return "el clip lleva pista de audio"
    if info["alto"] > 720:
        return f"alto de {info['alto']} px (se pidió 720 o menos)"
    if info["duracion"] < duracion - 2.0:
        return f"solo {info['duracion']:.1f} s de {duracion}"
    if info["bytes"] <= 0:
        return "archivo vacío"
    return None


# ------------------------------------------------------------------ índice


def indice_vacio() -> Dict[str, Any]:
    return {
        "updatedAt": None,
        "timezone": ZONA_HORARIA,
        "dias": DIAS_REPOSO,
        "rewinds": [],
    }


def cargar_indice(ruta: Path = INDICE_PATH) -> Dict[str, Any]:
    try:
        datos = json.loads(Path(ruta).read_text(encoding="utf-8"))
    except Exception:
        return indice_vacio()
    if isinstance(datos, list):  # índices antiguos en plano
        datos = {"updatedAt": None, "timezone": ZONA_HORARIA, "dias": DIAS_REPOSO, "rewinds": datos}
    if not isinstance(datos, dict):
        return indice_vacio()
    datos.setdefault("timezone", ZONA_HORARIA)
    datos.setdefault("dias", DIAS_REPOSO)
    if not isinstance(datos.get("rewinds"), list):
        datos["rewinds"] = []
    return datos


def guardar_indice(indice: Dict[str, Any], ruta: Path = INDICE_PATH) -> None:
    """Ordena el índice del más nuevo al más viejo y guarda en UTF-8.

    Si una entrada se repite (por ejemplo, dos ejecuciones en el mismo minuto)
    se queda solo con la más reciente, que es la que apunta al clip subido.
    """
    ruta.parent.mkdir(parents=True, exist_ok=True)
    entradas = sorted(
        (e for e in indice.get("rewinds", []) if isinstance(e, dict)),
        key=lambda e: e.get("hora") or "",
        reverse=True,
    )
    vistas = set()
    indice["rewinds"] = []
    for entrada in entradas:
        clave = (entrada.get("spot"), entrada.get("archivo"))
        if clave in vistas:
            continue
        vistas.add(clave)
        indice["rewinds"].append(entrada)
    Path(ruta).write_text(
        json.dumps(indice, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def _fecha_entrada(entrada: Dict[str, Any]) -> Optional[datetime]:
    bruto = entrada.get("hora")
    if not isinstance(bruto, str):
        return None
    try:
        momento = datetime.fromisoformat(bruto.replace("Z", "+00:00"))
    except ValueError:
        return None
    return momento if momento.tzinfo else momento.replace(tzinfo=zona_madrid())


def podar_indice(
    indice: Dict[str, Any], max_dias: int = DIAS_REPOSO, referencia: Optional[datetime] = None
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Separa las entradas más viejas de `max_dias` del resto."""
    ref = referencia or ahora_utc()
    fuera: List[Dict[str, Any]] = []
    dentro: List[Dict[str, Any]] = []
    for entrada in indice.get("rewinds", []):
        momento = _fecha_entrada(entrada) if isinstance(entrada, dict) else None
        if momento is None:
            dentro.append(entrada)
            continue
        if (ref - momento.astimezone(timezone.utc)).days >= max_dias:
            fuera.append(entrada)
        else:
            dentro.append(entrada)
    return dentro, fuera


def entrada_indice(
    spot: Dict[str, Any], cam: Dict[str, Any], prevision: Dict[str, Any],
    info: Dict[str, Any], momento: datetime, archivo: str, tag: str, url: str,
) -> Dict[str, Any]:
    """Una entrada del índice por spot cubierto por la cámara (el clip es el mismo)."""
    local = momento.astimezone(zona_madrid())
    return {
        "id": f"{spot['id']}-{local.strftime('%Y%m%d-%H%M')}",
        "spot": spot["id"],
        "spotNombre": spot["name"],
        "camara": cam.get("id"),
        "camaraNombre": cam.get("name"),
        "camaraCorta": cam.get("short") or cam.get("name"),
        "credito": cam.get("credit"),
        "hora": iso_local(momento),
        "horaLocal": texto_local(momento),
        "url": url,
        "archivo": archivo,
        "release": tag,
        "duracion": round(info["duracion"], 1),
        "bytes": info["bytes"],
        "ancho": info["ancho"],
        "alto": info["alto"],
        "desenfoque": DESENFOQUE,
        "prevision": prevision,
    }


def guardar_ficha(clip: Path, datos: Dict[str, Any]) -> Path:
    """Ficha JSON junto al clip con la previsión de ese momento (no se versiona)."""
    ficha = clip.with_suffix(".json")
    ficha.write_text(json.dumps(datos, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return ficha


def limpiar_clips_locales(directorio: Path, max_dias: int = DIAS_REPOSO) -> int:
    if not directorio.is_dir():
        return 0
    ref = ahora_utc()
    borrados = 0
    for ruta in directorio.iterdir():
        if not ruta.is_file():
            continue
        if (ref - datetime.fromtimestamp(ruta.stat().st_mtime, timezone.utc)).days < max_dias:
            continue
        ruta.unlink()
        borrados += 1
    return borrados


# ------------------------------------------------------------------ GitHub Releases


def gh(args: Sequence[str], check: bool = True) -> str:
    cmd = ["gh"] + list(args)
    env = dict(os.environ)
    env.setdefault("GH_TOKEN", env.get("GITHUB_TOKEN", ""))
    proc = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=300)
    if check and proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or "").strip()[:400])
    return proc.stdout


def asegurar_release(repo: str, tag: str, dry_run: bool = False) -> None:
    if dry_run:
        return
    try:
        gh(["release", "view", tag, "--repo", repo, "--json", "tagName"])
    except Exception:
        cuerpo = (
            f"Clips Rewinds de MeteoSurf_Cs · {tag}\n\n"
            "Grabados automáticamente con `scripts/rewind.py` desde las cámaras HLS de "
            "Turisme Comunitat Valenciana. El índice está en `data/rewinds.json`. "
            "Se guardan clips de 20 s a 480p y sin audio; los borra el propio script "
            "pasados 30 días."
        )
        gh(["release", "create", tag, "--repo", repo, "--title", f"Rewinds {tag[9:]}", "--notes", cuerpo])


def subir_clip(clip: Path, repo: str, tag: str, dry_run: bool = False) -> bool:
    if dry_run:
        print(f"    [dry-run] subiría {clip.name} a {repo}@{tag}")
        return True
    asegurar_release(repo, tag, dry_run)
    try:
        gh(["release", "upload", tag, str(clip), "--repo", repo, "--clobber"])
    except Exception as exc:
        print(f"  [aviso] No se pudo subir {clip.name}: {exc}")
        return False
    print(f"    subido a {url_descarga(repo, tag, clip.name)}")
    return True


def borrar_assets_viejos(repo: str, max_dias: int = DIAS_REPOSO, dry_run: bool = False) -> List[str]:
    """Borra los assets de las releases rewinds-* con más de `max_dias` días."""
    try:
        releases = json.loads(gh(["api", f"repos/{repo}/releases?per_page=100"]))
    except Exception as exc:
        print(f"  [aviso] No se pudieron listar las releases: {exc}")
        return []
    ref = ahora_utc()
    borrados: List[str] = []
    for release in releases if isinstance(releases, list) else []:
        tag = release.get("tag_name", "")
        if not tag.startswith("rewinds-"):
            continue
        quedan = 0
        for asset in release.get("assets", []) or []:
            creado = (asset.get("created_at") or "").replace("Z", "+00:00")
            try:
                momento = datetime.fromisoformat(creado)
            except ValueError:
                quedan += 1
                continue
            if (ref - momento).days < max_dias:
                quedan += 1
                continue
            nombre = asset.get("name")
            if not nombre:
                quedan += 1
                continue
            if dry_run:
                print(f"    [dry-run] borraría {tag}/{nombre}")
            else:
                try:
                    gh(["release", "delete-asset", tag, nombre, "--repo", repo, "--yes"])
                    print(f"    borrado {tag}/{nombre}")
                except Exception as exc:
                    print(f"  [aviso] No se pudo borrar {tag}/{nombre}: {exc}")
                    quedan += 1
                    continue
            borrados.append(f"{tag}/{nombre}")
        if not quedan and not dry_run and release.get("assets"):
            try:
                gh(["release", "delete", tag, "--repo", repo, "--yes", "--cleanup-tag"])
                print(f"    release {tag} vacía: eliminada")
            except Exception:
                try:
                    gh(["release", "delete", tag, "--repo", repo, "--yes"])
                    print(f"    release {tag} vacía: eliminada")
                except Exception as exc:
                    print(f"  [aviso] No se pudo borrar la release {tag}: {exc}")
    return borrados


# ------------------------------------------------------------------ grabación


def descargar_bruto(url_maestro: str, destino: Path, duracion: int = DURACION_S) -> None:
    """Deja en `destino` un .ts con el directo.

    Primero con ffmpeg (lo normal) y, si el directo no se deja, descargando a mano
    los últimos segmentos de la playlist. El servidor de Turisme CV da 404 de vez
    en cuando cuando está re-publicando un canal, así que se reintenta un par de
    veces antes de rendirse.
    """
    espera = (5, 12)
    for intento in range(1, len(espera) + 2):
        if intento > 1:
            print(f"    reintento {intento - 1}: el canal puede estar re-publicándose")
            time.sleep(espera[intento - 2])
        destino.unlink(missing_ok=True)
        if grabar_directo(url_maestro, destino, duracion):
            return
        try:
            urls = segmentos_recientes(url_maestro, duracion)
            if not urls:
                raise RuntimeError("la playlist HLS no devuelve segmentos")
            descargar_segmentos(urls, destino)
            if destino.stat().st_size > 100_000:
                print(f"    respaldo: {len(urls)} segmentos HLS descargados a mano")
                return
            raise RuntimeError("los segmentos descargados salen vacíos")
        except Exception as exc:
            if intento == len(espera) + 1:
                raise
            print(f"    [aviso] Fallo al descargar ({exc})")


def grabar_camara(
    cam: Dict[str, Any], spots: Dict[str, Dict[str, Any]], prevision: Dict[str, Dict[str, Any]],
    args: argparse.Namespace, momento: datetime,
) -> Tuple[Optional[Path], List[Dict[str, Any]]]:
    """Graba un clip de la cámara y devuelve el archivo y las entradas del índice."""
    tag = etiqueta_release(momento)
    spot_principal = cam["spotsCubiertos"][0]
    archivo = etiqueta_clip(spot_principal, momento)
    clip = Path(args.salida) / archivo
    clip.parent.mkdir(parents=True, exist_ok=True)
    crudo = clip.with_suffix(".grab.ts")

    print(f"  Descargando {args.duracion} s de {cam.get('name')} ({cam['id']})")
    try:
        descargar_bruto(cam["embedUrl"], crudo, args.duracion)
    except Exception as exc:
        print(f"  [ERROR] No se pudo grabar {cam['id']}: {exc}")
        crudo.unlink(missing_ok=True)
        return None, []

    print("  Comprimiendo (H.264, sin audio, desenfocado)")
    try:
        info = comprimir(crudo, clip, args.duracion, args.alto, args.desenfoque, args.crf, args.max_mb)
    except Exception as exc:
        print(f"  [ERROR] Falló la compresión de {cam['id']}: {exc}")
        crudo.unlink(missing_ok=True)
        clip.unlink(missing_ok=True)
        return None, []
    finally:
        crudo.unlink(missing_ok=True)

    problema = comprobar_clip(info, args.duracion)
    if problema:
        print(f"  [ERROR] Clip descartado: {problema}")
        clip.unlink(missing_ok=True)
        return None, []

    print(
        f"  Listo: {archivo} · {info['bytes'] / 1_048_576:.2f} MB · "
        f"{info['duracion']:.1f} s · {info['ancho']}x{info['alto']} · "
        f"códec {info['codec']} · audio {'sí' if info['audio'] else 'no'}"
    )

    print("  Guardando ficha e índice")
    guardar_ficha(clip, {
        "archivo": archivo,
        "camara": {
            "id": cam.get("id"), "nombre": cam.get("name"), "url": cam.get("embedUrl"),
            "credito": cam.get("credit"),
        },
        "grabadoEn": iso_local(momento),
        "horaLocal": texto_local(momento),
        "duracion": round(info["duracion"], 1),
        "bytes": info["bytes"],
        "resolucion": f"{info['ancho']}x{info['alto']}",
        "desenfoque": args.desenfoque,
        "prevision": {sid: prevision[sid] for sid in cam["spotsCubiertos"] if sid in prevision},
    })

    url = url_descarga(args.repo, tag, archivo)
    entradas = [
        entrada_indice(spots[sid], cam, prevision[sid], info, momento, archivo, tag, url)
        for sid in cam["spotsCubiertos"]
        if sid in prevision and sid in spots
    ]
    return clip, entradas


# ------------------------------------------------------------------ main


def analizar(args: argparse.Namespace) -> argparse.Namespace:
    args.spots_objetivo = (
        [s.strip() for s in args.spots.split(",") if s.strip()]
        if args.spots else list(SPOTS_CON_CAMARA)
    )
    args.salida = Path(args.salida)
    args.indice = Path(args.indice)
    return args


def main(argv: Optional[Sequence[str]] = None) -> int:
    _configurar_stdout()
    parser = argparse.ArgumentParser(
        description="Graba clips Rewinds de las cámaras y mantiene data/rewinds.json."
    )
    parser.add_argument("--cameras", help="solo estas cámaras (ids separados por comas).")
    parser.add_argument("--spots", help="solo estos spots (ids separados por comas).")
    parser.add_argument("--duracion", type=int, default=DURACION_S, help="segundos por clip.")
    parser.add_argument("--alto", type=int, default=ALTO_MAXIMO, help="alto del clip en píxeles.")
    parser.add_argument("--desenfoque", type=int, default=DESENFOQUE,
                        help="desenfoque para anonimizar (0 desactiva).")
    parser.add_argument("--crf", type=int, default=25, help="calidad H.264 inicial (más bajo = más peso).")
    parser.add_argument("--max-mb", type=float, default=MAX_MB, help="objetivo de tamaño por clip.")
    parser.add_argument("--min-altura", type=float, default=MIN_ALTURA_M,
                        help="oleaje mínimo en metros para grabar.")
    parser.add_argument("--dias", type=int, default=DIAS_REPOSO, help="días que se conservan.")
    parser.add_argument("--salida", default=str(CLIPS_DIR), help="carpeta de clips.")
    parser.add_argument("--indice", default=str(INDICE_PATH), help="ruta del índice JSON.")
    parser.add_argument("--repo", default=REPO_POR_DEFECTO, help="repo de GitHub para la release.")
    parser.add_argument("--subir", action="store_true", help="sube los clips a la release del mes.")
    parser.add_argument("--forzar", action="store_true",
                        help="graba aunque sea de noche o sin oleaje, y sin gate de altura.")
    parser.add_argument("--dry-run", action="store_true", help="no escribe índice ni sube nada.")
    args = analizar(parser.parse_args(argv))

    momento = ahora_madrid()
    print(f"--- REWINDS · MeteoSurf_Cs · {texto_local(momento)} ({ZONA_HORARIA}) ---")

    if not args.forzar and not ahora_madrid_horas_validas(momento):
        print(f"[INFO] Son las {momento.hour:02d}: fuera de las horas de luz "
              f"({HORA_MIN:02d}-{HORA_MAX:02d}). No se graba nada.")
        return 0

    try:
        spots = leer_spots()
    except Exception as exc:
        print(f"[ERROR] No se pudo leer js/spots.js: {exc}")
        return 1
    if not spots:
        print("[ERROR] js/spots.js no ha dado ningún spot.")
        return 1

    try:
        webcams = leer_webcams()
    except Exception as exc:
        print(f"[ERROR] No se pudo leer webcams.json: {exc}")
        return 1

    camaras = camaras_rewind(webcams, args.spots_objetivo)
    if args.cameras:
        pedidas = {c.strip() for c in args.cameras.split(",") if c.strip()}
        camaras = [c for c in camaras if c.get("id") in pedidas]
    if not camaras:
        print("[INFO] No hay cámaras HLS de Turisme CV para los spots pedidos.")
        return 0

    print("Cámaras candidatas:")
    for cam in camaras:
        print(f"  - {cam.get('name')} ({cam['id']}): {', '.join(cam['spotsCubiertos'])}")

    ids_spots = [sid for cam in camaras for sid in cam["spotsCubiertos"] if sid in spots]
    print(f"\n[1/3] Pidiendo previsión a Open-Meteo de {len(set(ids_spots))} spots...")
    prevision = prevision_spots(ids_spots, spots)
    if not prevision:
        print("[ERROR] No se pudo leer ninguna previsión; no se graba nada.")
        return 1

    print("\n[2/3] Comprobando el oleaje:")
    elegidas: List[Dict[str, Any]] = []
    for cam in camaras:
        datos = [prevision[s] for s in cam["spotsCubiertos"] if s in prevision]
        if not datos:
            continue
        maximo = max(d.get("altura") or 0.0 for d in datos)
        if args.forzar:
            print(f"  {cam.get('short')}: {maximo} m (forzado)")
        elif maximo < args.min_altura:
            print(f"  {cam.get('short')}: {maximo} m, por debajo de {args.min_altura} m. Se descarta.")
            continue
        else:
            print(f"  {cam.get('short')}: {maximo} m, se graba")
        elegidas.append(cam)

    if not elegidas:
        print(f"\n[OK] Ningún spot llega a {args.min_altura} m. No hay nada que grabar.")
        return 0

    print("\n[3/3] Grabando clips:")
    clips: List[Path] = []
    entradas: List[Dict[str, Any]] = []
    fallos = 0
    for cam in elegidas:
        clip, nuevas = grabar_camara(cam, spots, prevision, args, momento)
        if clip is None:
            fallos += 1
            continue
        if args.subir and not args.dry_run:
            if not subir_clip(clip, args.repo, etiqueta_release(momento)):
                fallos += 1
                continue
        clips.append(clip)
        entradas.extend(nuevas)
        print()

    if not clips:
        print("[AVISO] No se ha grabado ningún clip.")
        return 0 if not fallos else 1

    indice = cargar_indice(args.indice)
    indice["dias"] = args.dias
    dentro, viejas = podar_indice(indice, args.dias)
    indice["rewinds"] = dentro + entradas
    indice["timezone"] = ZONA_HORARIA
    indice["updatedAt"] = iso_local(momento)
    if viejas:
        print(f"[INFO] Fuera del índice: {len(viejas)} clips de más de {args.dias} días.")
    if args.subir:
        borrados = borrar_assets_viejos(args.repo, args.dias, args.dry_run)
        if borrados:
            print(f"[INFO] Borrados {len(borrados)} clips de más de {args.dias} días de las releases.")
    locales = limpiar_clips_locales(args.salida, args.dias)

    if not args.dry_run:
        guardar_indice(indice, args.indice)
        print(f"[OK] Índice actualizado en {args.indice} ({len(indice['rewinds'])} clips).")
    else:
        print("[DRY-RUN] No se ha escrito el índice.")
    if not args.subir:
        print("[INFO] Los clips no se han subido a ninguna release (falta --subir).")

    total = sum(c.stat().st_size for c in clips if c.exists()) / 1_048_576
    print(f"\n[RESUMEN] {len(clips)} clips · {total:.2f} MB · {len(entradas)} entradas de índice")
    return 0


if __name__ == "__main__":
    sys.exit(main())
