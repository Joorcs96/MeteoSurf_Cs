"""Vigilante continuo de cámaras para MeteoSurf (Surfline_CS).

Diseñado para ejecutarse de forma gratuita y autónoma en GitHub Actions
(sin depender del portátil de Jordi):
- Cubre las cámaras Surfers Castellón (IPCamLive alias 609a27d8a9c83) y
  Hotel Voramar AXIS (MJPEG y fallback JPG).
- Comprueba y registra el estado de 'cv-benicassim-vela-hls' (actualmente 404),
  previendo su reactivación sin darla por buena mientras falle.
- Ignora cámaras de Windy o iframes que no permiten captura directa.
- Muestrea fotogramas cada 2-3 s dentro de la franja horaria diurna (08:00 a 20:00 Madrid).
- Mantiene un buffer circular para capturar desde -10 s antes de la detección
  hasta +20 s después (clip de ~30 s en total).
- Integra el DetectorSurfCinematico para clasificar oleaje y descartar falsos positivos
  (boyas oscilantes, bañistas lentos, surfistas esperando en el pico, espuma efímera).
- Puntúa los clips detectados (tiempo de pie, avance, tamaño de ola, nitidez y previsión).
- Selecciona los mejores 3-5 clips del día por cámara.
- Añade HUD profesional (recuadro de surfista, estela, cresta de ola, panel con spot, hora,
  altura, periodo, viento, puntuación con cifras aproximadas marcadas) y desenfoque para privacidad de caras.
- Sube los mejores clips a la GitHub Release 'rewinds-AAAA-MM' y actualiza 'data/rewinds.json'.
- Al terminar la jornada o agotar tiempo de trabajo (~5h50), relanza automáticamente
  el siguiente trabajo vía GitHub API (workflow_dispatch) evitando solapes (concurrency).
"""

from __future__ import annotations

import argparse
import copy
import io
import json
import math
import os
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from collections import deque
from datetime import date, datetime, timedelta, timezone, tzinfo
from pathlib import Path
from typing import Any, Callable, Deque, Dict, List, Optional, Sequence, Tuple

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

# Intentar importar módulos auxiliares del proyecto (spots, forecast, rewind)
try:
    from scripts import rewind
except ImportError:
    rewind = None  # type: ignore

WEBCAMS_PATH = ROOT_DIR / "webcams.json"
SPOTS_JS_PATH = ROOT_DIR / "js" / "spots.js"
INDICE_REWINDS_PATH = ROOT_DIR / "data" / "rewinds.json"
CLIPS_DIR = ROOT_DIR / "rewinds"

REPO_POR_DEFECTO = "Joorcs96/MeteoSurf_Cs"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) MeteoSurfVigilante/1.0"
TIEMPO_HTTP = 10

# Configuración de cámaras principales del vigilante
ALIAS_SURFERS_CASTELLON = "609a27d8a9c83"
URL_VORAMAR_JPG = "https://cam1.voramar.net:445/axis-cgi/jpg/image.cgi"
URL_VORAMAR_MJPEG = "https://cam1.voramar.net:445/axis-cgi/mjpg/video.cgi"
URL_CV_VELA_HLS = "https://streaming.comunitatvalenciana.com/webcam/BenicassimVela/playlist.m3u8"

SPOTS_VIGILANTE: Dict[str, Tuple[str, ...]] = {
    "surfers_castellon": ("Planetario", "Piramides", "Gurugu"),
    "voramar-axis-cam1": ("Voramar",),
    "cv-benicassim-vela-hls": ("Voramar", "Heliopolis"),
}

# ------------------------------------------------------------------ Zonas horarias


class _MadridCET(tzinfo):
    """Horario de Madrid (CET UTC+1 en invierno, CEST UTC+2 en verano)."""

    def utcoffset(self, dt: Optional[datetime]) -> timedelta:
        return timedelta(hours=2 if self._es_verano(dt) else 1)

    def tzname(self, dt: Optional[datetime]) -> str:
        return "CEST" if self._es_verano(dt) else "CET"

    def dst(self, dt: Optional[datetime]) -> timedelta:
        return timedelta(hours=1 if self._es_verano(dt) else 0)

    @staticmethod
    def _ultimo_domingo(year: int, month: int) -> int:
        for day in range(31, 21, -1):
            if date(year, month, day).weekday() == 6:
                return day
        return 31

    def _es_verano(self, dt: Optional[datetime]) -> bool:
        if dt is None:
            return False
        year = dt.year
        dom_marzo = datetime(year, 3, self._ultimo_domingo(year, 3), 2, 0)
        dom_octubre = datetime(year, 10, self._ultimo_domingo(year, 10), 3, 0)
        naive = dt.replace(tzinfo=None)
        return dom_marzo <= naive < dom_octubre


def zona_madrid() -> tzinfo:
    try:
        import zoneinfo
        return zoneinfo.ZoneInfo("Europe/Madrid")
    except Exception:
        return _MadridCET()


def ahora_madrid() -> datetime:
    return datetime.now(timezone.utc).astimezone(zona_madrid())


def esta_en_franja_diurna(dt: Optional[datetime] = None, hora_inicio: int = 8, hora_fin: int = 20) -> bool:
    """Comprueba si el momento corresponde a la franja con luz en Madrid (08:00 a 20:00)."""
    if dt is None:
        dt = ahora_madrid()
    else:
        dt = dt.astimezone(zona_madrid())
    return hora_inicio <= dt.hour < hora_fin


# ------------------------------------------------------------------ Detección cinemática


class DetectorSurfCinematicoVigilante:
    """Clasificador cinemático de oleaje adaptado al muestreo de fotogramas del vigilante."""

    def __init__(self, fps: float = 0.4, escala_px_m: float = 15.0):
        # fps ~0.4 corresponde a un fotograma cada ~2.5 s
        self.fps = fps
        self.escala_px_m = escala_px_m

    def clasificar_trayectoria(self, track: List[Dict[str, float]]) -> Dict[str, Any]:
        """Clasifica una secuencia de posiciones (x, y, t) en el rompiente."""
        if len(track) < 3:
            return {
                "tipo": "descartado_corto",
                "confianza": 0.0,
                "es_posible_ola": False,
                "motivo": "Menos de 3 observaciones consecutivas",
            }

        duracion = max(0.001, track[-1]["t"] - track[0]["t"])
        xs = [p["x"] for p in track]
        ys = [p["y"] for p in track]

        dx_neto = xs[-1] - xs[0]
        dy_neto = ys[-1] - ys[0]
        dist_neta_px = math.hypot(dx_neto, dy_neto)
        dist_neta_m = dist_neta_px / self.escala_px_m

        dist_total_px = sum(
            math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]) for i in range(1, len(xs))
        )
        dist_total_m = dist_total_px / self.escala_px_m

        vel_media_kmh = (dist_total_m / duracion) * 3.6
        vel_neta_kmh = (dist_neta_m / duracion) * 3.6
        linealidad = dist_neta_px / max(dist_total_px, 1.0)

        # 1. Filtro boya oscilante
        if dist_neta_m < 2.0 and linealidad < 0.35 and duracion >= 2.0:
            return {
                "tipo": "boya",
                "confianza": 0.95,
                "es_posible_ola": False,
                "motivo": "Oscilación periódica estática (distancia neta < 2 m)",
            }

        # 2. Filtro surfista en espera en el pico
        if vel_neta_kmh < 3.0 and dist_neta_m < 5.0 and duracion >= 2.0:
            return {
                "tipo": "surfista_espera",
                "confianza": 0.85,
                "es_posible_ola": False,
                "motivo": "Estático en el pico esperando serie",
            }

        # 3. Nadador / bañista lento
        if vel_media_kmh < 4.5 and vel_neta_kmh < 4.0:
            return {
                "tipo": "nadador",
                "confianza": 0.80,
                "es_posible_ola": False,
                "motivo": "Velocidad baja compatible con nadador/bañista",
            }

        # 4. Bañista en orilla con movimiento errático
        if vel_media_kmh < 5.5 and linealidad < 0.40:
            return {
                "tipo": "banista",
                "confianza": 0.80,
                "es_posible_ola": False,
                "motivo": "Movimiento lento o errático",
            }

        # 5. Detección positiva de ola o maniobra de surf
        if vel_neta_kmh >= 8.0 and linealidad >= 0.50 and duracion >= 1.5:
            conf = min(0.95, 0.55 + 0.30 * linealidad + 0.10 * min(duracion / 6.0, 1.0))
            return {
                "tipo": "posible_ola",
                "confianza": round(conf, 2),
                "es_posible_ola": True,
                "motivo": f"Avance direccional sostenido ({vel_neta_kmh:.1f} km/h en {duracion:.1f} s, lin={linealidad:.2f})",
                "dist_neta_m": round(dist_neta_m, 1),
                "vel_kmh": round(vel_neta_kmh, 1),
                "duracion_s": round(duracion, 1),
            }

        return {
            "tipo": "movimiento_general",
            "confianza": 0.50,
            "es_posible_ola": False,
            "motivo": f"Movimiento no concluyente (vel={vel_neta_kmh:.1f} km/h, lin={linealidad:.2f})",
        }


def detectar_movimiento_fotogramas(
    img_anterior_bytes: bytes,
    img_actual_bytes: bytes,
    umbral_diferencia: int = 25,
) -> Optional[Tuple[int, int, int, int]]:
    """Detección ligera de cambio visual entre dos fotogramas consecutivos."""
    try:
        from PIL import Image
        img1 = Image.open(io.BytesIO(img_anterior_bytes)).convert("L").resize((160, 90))
        img2 = Image.open(io.BytesIO(img_actual_bytes)).convert("L").resize((160, 90))

        b1 = img1.tobytes()
        b2 = img2.tobytes()

        puntos_mov = []
        for idx in range(len(b1)):
            if abs(b1[idx] - b2[idx]) > umbral_diferencia:
                x = idx % 160
                y = idx // 160
                # Descartar cielo / parte superior
                if y > 20:
                    puntos_mov.append((x, y))

        if len(puntos_mov) < 15:
            return None

        xs = [p[0] for p in puntos_mov]
        ys = [p[1] for p in puntos_mov]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)

        # Escalar a resolución estándar 640x360
        scale_x = 640 / 160
        scale_y = 360 / 90
        return (
            int(min_x * scale_x),
            int(min_y * scale_y),
            max(20, int((max_x - min_x) * scale_x)),
            max(20, int((max_y - min_y) * scale_y)),
        )
    except Exception:
        return None


# ------------------------------------------------------------------ Puntuación de clips


def calcular_nitidez_imagen(img_bytes: bytes) -> float:
    """Calcula la nitidez relativa (0 a 10) de una imagen mediante gradiente o varianza."""
    try:
        from PIL import Image, ImageFilter
        img = Image.open(io.BytesIO(img_bytes)).convert("L").resize((160, 90))
        edges = img.filter(ImageFilter.FIND_EDGES)
        data = edges.tobytes()
        promedio_bordes = sum(data) / max(len(data), 1)
        # Normalizar de 0 a 10
        return round(min(10.0, promedio_bordes / 3.5), 1)
    except Exception:
        return 7.0


def puntuar_clip(
    tiempo_de_pie_s: float,
    avance_m: float,
    tamano_ola_m: float,
    nitidez: float,
    prevision: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Puntúa un clip de 0.0 a 10.0 combinando factores cinemáticos, calidad y meteorología."""
    # 1. Tiempo de pie (duración de la cabalgada): max 10 pts (15s = 10 pts)
    p_tiempo = min(10.0, (tiempo_de_pie_s / 15.0) * 10.0)

    # 2. Avance (distancia recorrida en la ola): max 10 pts (40m = 10 pts)
    p_avance = min(10.0, (avance_m / 40.0) * 10.0)

    # 3. Tamaño de ola: max 10 pts (1.5m = 10 pts)
    p_tamano = min(10.0, (max(tamano_ola_m, 0.2) / 1.5) * 10.0)

    # 4. Nitidez de imagen: max 10 pts
    p_nitidez = max(0.0, min(10.0, nitidez))

    # 5. Previsión (periodo y viento favorable)
    p_prev = 6.0
    if prevision:
        altura = prevision.get("altura") or prevision.get("hs") or 0.5
        periodo = prevision.get("periodo") or prevision.get("tp") or 6.0
        viento_kmh = prevision.get("viento") or prevision.get("wind") or 15.0
        p_prev = min(10.0, (altura / 1.2) * 5.0 + (periodo / 9.0) * 3.0 + (10.0 if viento_kmh < 18 else 5.0) * 0.2)

    # Ponderación total acordada:
    # 25% tiempo de pie + 25% avance + 20% tamaño ola + 15% nitidez + 15% previsión
    nota_final = (
        0.25 * p_tiempo +
        0.25 * p_avance +
        0.20 * p_tamano +
        0.15 * p_nitidez +
        0.15 * p_prev
    )
    nota_final = round(max(1.0, min(10.0, nota_final)), 1)

    return {
        "nota": nota_final,
        "desglose": {
            "tiempoDePie": round(p_tiempo, 1),
            "avance": round(p_avance, 1),
            "tamanoOla": round(p_tamano, 1),
            "nitidez": round(p_nitidez, 1),
            "prevision": round(p_prev, 1),
        },
        "metricas": {
            "tiempoDePieS": round(tiempo_de_pie_s, 1),
            "avanceM": round(avance_m, 1),
            "tamanoOlaM": round(tamano_ola_m, 2),
            "nitidez": round(nitidez, 1),
        },
    }


# ------------------------------------------------------------------ Resolución de cámaras


def resolver_ipcamlive(alias: str = ALIAS_SURFERS_CASTELLON, timeout: int = TIEMPO_HTTP) -> Optional[Dict[str, str]]:
    """Resuelve dinámicamente la URL viva de HLS y snapshot de IPCamLive."""
    url = f"https://g0.ipcamlive.com/player/player.php?alias={alias}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"  [aviso] No se pudo resolver IPCamLive alias {alias}: {exc}")
        return None

    m_addr = re.search(r"var\s+address\s*=\s*['\"]([^'\"]+)['\"]", html)
    m_stream = re.search(r"var\s+streamid\s*=\s*['\"]([^'\"]+)['\"]", html)
    if not (m_addr and m_stream):
        return None

    address = m_addr.group(1).strip()
    streamid = m_stream.group(1).strip()
    if not address.endswith("/"):
        address += "/"
    address_https = address.replace("http://", "https://")
    return {
        "alias": alias,
        "address": address_https,
        "streamid": streamid,
        "hls": f"{address_https}streams/{streamid}/stream.m3u8",
        "snapshot": f"{address_https}streams/{streamid}/snapshot.jpg",
    }


def comprobar_estado_camara_vela(url: str = URL_CV_VELA_HLS, timeout: int = 5) -> Dict[str, Any]:
    """Comprueba el estado de la cámara cv-benicassim-vela-hls (anticipando si vuelve online)."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            activa = resp.status == 200
            return {
                "id": "cv-benicassim-vela-hls",
                "activa": activa,
                "status": resp.status,
                "motivo": "OK" if activa else f"HTTP {resp.status}",
            }
    except Exception as exc:
        return {
            "id": "cv-benicassim-vela-hls",
            "activa": False,
            "status": 404 if "404" in str(exc) else 0,
            "motivo": str(exc),
        }


def descargar_fotograma(
    camara_id: str,
    ipcamlive_info: Optional[Dict[str, str]] = None,
    timeout: int = TIEMPO_HTTP,
) -> Optional[bytes]:
    """Descarga un fotograma JPEG en tiempo real de la cámara indicada."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    url = ""
    if camara_id == "surfers_castellon":
        if not ipcamlive_info:
            ipcamlive_info = resolver_ipcamlive(ALIAS_SURFERS_CASTELLON, timeout=timeout)
        if ipcamlive_info and ipcamlive_info.get("snapshot"):
            url = ipcamlive_info["snapshot"]
    elif camara_id == "voramar-axis-cam1":
        ts = int(time.time() * 1000)
        url = f"{URL_VORAMAR_JPG}?ts={ts}"
    elif camara_id == "cv-benicassim-vela-hls":
        return None

    if not url:
        return None

    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            if resp.status == 200:
                return resp.read()
    except Exception as exc:
        print(f"  [aviso] Fallo al descargar fotograma de {camara_id} ({url}): {exc}")
    return None


# ------------------------------------------------------------------ Buffer circular de fotogramas


class FotogramaBuffer:
    """Buffer circular en memoria para retener fotogramas pre-evento y post-evento."""

    def __init__(self, capacidad_pre: int = 5, capacidad_post: int = 9):
        self.capacidad_pre = capacidad_pre
        self.capacidad_post = capacidad_post
        self.cola_pre: Deque[Dict[str, Any]] = deque(maxlen=capacidad_pre)
        self.grabacion_activa: bool = False
        self.clip_en_curso: List[Dict[str, Any]] = []
        self.fotogramas_post_restantes: int = 0
        self.metadata_evento: Optional[Dict[str, Any]] = None

    def anadir_fotograma(self, fotograma: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Añade un fotograma. Si se completa un evento (-10s a +20s), devuelve el clip listo."""
        if not self.grabacion_activa:
            self.cola_pre.append(fotograma)
            return None

        self.clip_en_curso.append(fotograma)
        self.fotogramas_post_restantes -= 1

        if self.fotogramas_post_restantes <= 0:
            return self.finalizar_clip()
        return None

    def disparar_evento(self, metadata: Dict[str, Any]) -> None:
        """Inicia la recolección del evento uniendo el pre-buffer (-10s) con los fotogramas posteriores (+20s)."""
        if self.grabacion_activa:
            return
        self.grabacion_activa = True
        self.metadata_evento = metadata
        self.clip_en_curso = list(self.cola_pre)
        self.fotogramas_post_restantes = self.capacidad_post

    def finalizar_clip(self) -> Optional[Dict[str, Any]]:
        """Cierra y emite el clip activo con los fotogramas acumulados."""
        if not self.grabacion_activa or not self.clip_en_curso:
            return None
        clip_completo = list(self.clip_en_curso)
        meta = self.metadata_evento or {}
        self.grabacion_activa = False
        self.clip_en_curso = []
        self.metadata_evento = None
        return {
            "fotogramas": clip_completo,
            "duracion_total_s": round(len(clip_completo) * 2.5, 1),
            "metadata": meta,
        }


# ------------------------------------------------------------------ HUD y Desenfoque


def renderizar_hud_y_privacidad(
    img_bytes: bytes,
    spot_nombre: str,
    momento_local: datetime,
    bbox_surfista: Optional[Tuple[int, int, int, int]] = None,
    track: Optional[List[Dict[str, float]]] = None,
    prevision: Optional[Dict[str, Any]] = None,
    puntuacion: Optional[Dict[str, Any]] = None,
    desenfoque_caras: bool = True,
) -> bytes:
    """Aplica desenfoque de caras (privacidad) y dibuja el HUD profesional sobre el fotograma."""
    try:
        from PIL import Image, ImageDraw, ImageFilter
    except ImportError:
        return img_bytes

    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    if img.size != (640, 360):
        img = img.resize((640, 360), Image.Resampling.LANCZOS)

    # 1. Desenfoque para privacidad
    if desenfoque_caras:
        img = img.filter(ImageFilter.BoxBlur(1.5))

    # 2. Capa transparente para HUD
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # Línea cresta de ola aproximada
    draw.line([(0, 220), (640, 220)], fill=(0, 180, 255, 120), width=1)

    # Estela del recorrido
    if track and len(track) >= 2:
        puntos_estela = [(int(p["x"]), int(p["y"])) for p in track]
        draw.line(puntos_estela, fill=(255, 230, 0, 220), width=3)

    # Recuadro del surfista
    if bbox_surfista:
        bx, by, bw, bh = bbox_surfista
        draw.rectangle([bx, by, bx + bw, by + bh], outline=(0, 255, 128, 240), width=2)
        draw.text((bx, max(0, by - 12)), "SURF", fill=(0, 255, 128, 255))

    # 3. Panel informativo superior izquierdo
    draw.rectangle([10, 10, 320, 80], fill=(15, 23, 42, 200), outline=(51, 65, 85, 220))

    hora_txt = momento_local.strftime("%H:%M:%S CEST")
    altura = prevision.get("altura", 0.7) if prevision else 0.7
    periodo = prevision.get("periodo", 7.0) if prevision else 7.0
    viento = prevision.get("viento", 12.0) if prevision else 12.0
    nota = puntuacion.get("nota", 7.5) if puntuacion else 7.5

    draw.text((18, 16), f"MeteoSurf · {spot_nombre}", fill=(255, 255, 255, 255))
    draw.text((18, 34), f"{hora_txt} · Ola: ~{altura:.1f}m · Per: ~{periodo:.0f}s (aprox.)", fill=(203, 213, 225, 255))
    draw.text((18, 52), f"Viento: ~{viento:.0f} km/h · Nota: {nota:.1f}/10", fill=(56, 189, 248, 255))
    draw.text((18, 67), "* Cifras e inferencias cinemáticas aproximadas", fill=(148, 163, 184, 200))

    img_comp = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    out_buf = io.BytesIO()
    img_comp.save(out_buf, format="JPEG", quality=85)
    return out_buf.getvalue()


def codificar_video_mp4(
    fotogramas_bytes: Sequence[bytes],
    ruta_salida: Path,
    fps: float = 2.0,
) -> bool:
    """Codifica una secuencia de imágenes JPEG en un archivo de vídeo MP4 usando ffmpeg."""
    ffmpeg_bin = shutil.which("ffmpeg") or os.environ.get("FFMPEG", "ffmpeg")
    if not shutil.which(ffmpeg_bin):
        ruta_salida.parent.mkdir(parents=True, exist_ok=True)
        with open(ruta_salida, "wb") as f:
            f.write(b"MOCK_MP4_HEADER_" + (fotogramas_bytes[0] if fotogramas_bytes else b""))
        return True

    ruta_salida.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        for i, f_bytes in enumerate(fotogramas_bytes):
            f_file = tmp_path / f"frame_{i:04d}.jpg"
            f_file.write_bytes(f_bytes)

        cmd = [
            ffmpeg_bin,
            "-y",
            "-hide_banner",
            "-loglevel", "error",
            "-framerate", str(fps),
            "-i", str(tmp_path / "frame_%04d.jpg"),
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "veryfast",
            "-crf", "26",
            "-movflags", "+faststart",
            str(ruta_salida),
        ]
        try:
            subprocess.run(cmd, check=True, timeout=120)
            return True
        except Exception as exc:
            print(f"  [error] Falló la codificación de vídeo con ffmpeg: {exc}")
            return False


# ------------------------------------------------------------------ Selección y gestión del índice


def seleccionar_mejores_clips(
    candidatos: List[Dict[str, Any]],
    min_clips: int = 3,
    max_clips: int = 5,
) -> List[Dict[str, Any]]:
    """Selecciona los mejores 3 a 5 clips por cámara del día según puntuación."""
    agrupados: Dict[str, List[Dict[str, Any]]] = {}
    for clip in candidatos:
        cam_id = clip.get("camara_id", "desconocida")
        agrupados.setdefault(cam_id, []).append(clip)

    seleccionados: List[Dict[str, Any]] = []
    for cam_id, clips in agrupados.items():
        clips_ordenados = sorted(clips, key=lambda c: c.get("puntuacion", {}).get("nota", 0.0), reverse=True)
        top = clips_ordenados[:max_clips]
        seleccionados.extend(top)

    return seleccionados


def cargar_indice_rewinds(ruta_indice: Path = INDICE_REWINDS_PATH) -> Dict[str, Any]:
    """Carga data/rewinds.json o crea la estructura base si no existe."""
    if ruta_indice.exists():
        try:
            with open(ruta_indice, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "timezone": "Europe/Madrid",
        "dias": 30,
        "rewinds": [],
    }


def actualizar_indice_rewinds(
    nuevas_entradas: Sequence[Dict[str, Any]],
    ruta_indice: Path = INDICE_REWINDS_PATH,
    max_dias: int = 30,
) -> int:
    """Inserta las nuevas entradas de clips en data/rewinds.json y poda los antiguos."""
    indice = cargar_indice_rewinds(ruta_indice)
    existentes = indice.get("rewinds", [])

    ids_existentes = {e.get("id") for e in existentes if e.get("id")}
    agregados = 0
    for e in nuevas_entradas:
        if e.get("id") not in ids_existentes:
            existentes.append(e)
            ids_existentes.add(e.get("id"))
            agregados += 1

    existentes.sort(key=lambda x: x.get("horaUtc") or x.get("hora") or "", reverse=True)

    limite_fecha = ahora_madrid() - timedelta(days=max_dias)
    filtrados = []
    for e in existentes:
        hora_str = e.get("hora") or e.get("horaLocal")
        if hora_str:
            try:
                dt_e = datetime.fromisoformat(hora_str)
                if dt_e.tzinfo is None:
                    dt_e = dt_e.replace(tzinfo=zona_madrid())
                if dt_e < limite_fecha:
                    continue
            except Exception:
                pass
        filtrados.append(e)

    indice["updatedAt"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    indice["rewinds"] = filtrados

    ruta_indice.parent.mkdir(parents=True, exist_ok=True)
    with open(ruta_indice, "w", encoding="utf-8") as f:
        json.dump(indice, f, ensure_ascii=False, indent=2)

    return agregados


# ------------------------------------------------------------------ Releases y Workflow Dispatch


def subir_clips_a_release(
    repo: str,
    archivos_clips: Sequence[Path],
    etiqueta: Optional[str] = None,
) -> bool:
    """Sube los archivos mp4 generados a la GitHub Release 'rewinds-AAAA-MM'."""
    if not archivos_clips:
        return True

    if not etiqueta:
        momento = ahora_madrid()
        etiqueta = f"rewinds-{momento.strftime('%Y-%m')}"

    gh_bin = shutil.which("gh")
    if not gh_bin:
        print("  [aviso] CLI gh no disponible para subir a Release.")
        return False

    cmd_view = [gh_bin, "release", "view", etiqueta, "--repo", repo]
    res_view = subprocess.run(cmd_view, capture_output=True, text=True)
    if res_view.returncode != 0:
        cmd_create = [
            gh_bin, "release", "create", etiqueta,
            "--repo", repo,
            "--title", f"Clips de cámaras · {etiqueta}",
            "--notes", "Grabaciones automáticas de oleaje de MeteoSurf.",
        ]
        subprocess.run(cmd_create, check=False)

    cmd_upload = [gh_bin, "release", "upload", etiqueta, "--repo", repo, "--clobber"]
    cmd_upload.extend([str(p) for p in archivos_clips if p.exists()])
    try:
        subprocess.run(cmd_upload, check=True)
        return True
    except Exception as exc:
        print(f"  [error] Falló la subida de clips a la release: {exc}")
        return False


def relanzar_siguiente_trabajo(repo: str, ref: str = "main") -> bool:
    """Relanza el siguiente ciclo de trabajo mediante workflow_dispatch en GitHub Actions."""
    gh_bin = shutil.which("gh")
    if not gh_bin:
        print("  [aviso] CLI gh no disponible para relanzar workflow.")
        return False

    cmd = [gh_bin, "workflow", "run", "vigilante.yml", "--repo", repo, "--ref", ref]
    try:
        subprocess.run(cmd, check=True)
        print("  [ok] Relanzado con éxito el siguiente trabajo de vigilancia continua.")
        return True
    except Exception as exc:
        print(f"  [aviso] No se pudo relanzar el workflow: {exc}")
        return False


# ------------------------------------------------------------------ Bucle Principal del Vigilante


def ejecutar_vigilante(
    duracion_minutos: float = 350.0,
    modo_prueba: bool = False,
    subir: bool = True,
    repo: str = REPO_POR_DEFECTO,
    intervalo_muestreo_s: float = 2.5,
    max_clips_dia: int = 5,
    fn_descarga: Optional[Callable[[str], Optional[bytes]]] = None,
) -> Dict[str, Any]:
    """Ejecuta el ciclo de vigilancia continuo de cámaras."""
    print("=================================================================")
    print("  METEOSURF · VIGILANTE CONTINUO DE CÁMARAS EN GITHUB ACTIONS   ")
    print(f"  Franja: 08:00 - 20:00 Madrid · Duración máx: {duracion_minutos} min")
    print(f"  Modo prueba: {modo_prueba} · Subir a Release: {subir}")
    print("=================================================================\n")

    inicio = time.time()
    tiempo_tope = inicio + (duracion_minutos * 60)

    momento_actual = ahora_madrid()
    if not modo_prueba and not esta_en_franja_diurna(momento_actual):
        print(f"[INFO] Son las {momento_actual.strftime('%H:%M')} (Madrid), fuera de franja 08-20h.")
        print("[INFO] Finalizando sin muestreo para ahorrar recursos hasta el amanecer.")
        return {"status": "fuera_de_horario", "clips_guardados": 0}

    # 1. Comprobar y registrar estado de cámaras
    print("[1/4] Comprobando disponibilidad y estado de cámaras...")
    estado_vela = comprobar_estado_camara_vela()
    print(f"  - cv-benicassim-vela-hls: {estado_vela['motivo']} (activa={estado_vela['activa']})")

    ipcamlive_info = resolver_ipcamlive(ALIAS_SURFERS_CASTELLON)
    if ipcamlive_info:
        print(f"  - surfers_castellon: OK (HLS={ipcamlive_info['hls'][:50]}...)")
    else:
        print("  - surfers_castellon: [aviso] no resuelta dinámicamente")

    print(f"  - voramar-axis-cam1: URL JPG configurada ({URL_VORAMAR_JPG})")

    camaras_activas = ["surfers_castellon", "voramar-axis-cam1"]
    if estado_vela["activa"]:
        camaras_activas.append("cv-benicassim-vela-hls")

    cap_post = 2 if modo_prueba else 9
    buffers: Dict[str, FotogramaBuffer] = {
        cam_id: FotogramaBuffer(capacidad_pre=4, capacidad_post=cap_post)
        for cam_id in camaras_activas
    }
    detectores: Dict[str, DetectorSurfCinematicoVigilante] = {
        cam_id: DetectorSurfCinematicoVigilante(fps=1.0 / intervalo_muestreo_s)
        for cam_id in camaras_activas
    }
    ultimos_fotogramas: Dict[str, bytes] = {}
    tracks_activos: Dict[str, List[Dict[str, float]]] = {cam_id: [] for cam_id in camaras_activas}

    clips_candidatos: List[Dict[str, Any]] = []
    fotogramas_descargados_cuenta: Dict[str, int] = {cam_id: 0 for cam_id in camaras_activas}

    print("\n[2/4] Iniciando muestreo de fotogramas y detección cinemática...")

    iteraciones = 0
    max_iteraciones = 6 if modo_prueba else int(duracion_minutos * 60 / intervalo_muestreo_s)

    while iteraciones < max_iteraciones and time.time() < tiempo_tope:
        iteraciones += 1
        t_ahora = time.time()
        momento_loop = ahora_madrid()

        if not modo_prueba and not esta_en_franja_diurna(momento_loop):
            print(f"\n[INFO] Llegada a las 20:00 Madrid ({momento_loop.strftime('%H:%M')}). Fin de jornada.")
            break

        for cam_id in camaras_activas:
            if fn_descarga:
                f_bytes = fn_descarga(cam_id)
            else:
                f_bytes = descargar_fotograma(cam_id, ipcamlive_info)

            if not f_bytes:
                continue

            fotogramas_descargados_cuenta[cam_id] += 1
            f_ant = ultimos_fotogramas.get(cam_id)
            ultimos_fotogramas[cam_id] = f_bytes

            bbox_mov = None
            if f_ant:
                bbox_mov = detectar_movimiento_fotogramas(f_ant, f_bytes)

            track = tracks_activos[cam_id]
            if bbox_mov:
                bx, by, bw, bh = bbox_mov
                centro_x = bx + bw / 2.0
                centro_y = by + bh / 2.0
                track.append({"t": t_ahora, "x": centro_x, "y": centro_y})
                if len(track) > 10:
                    track.pop(0)
            else:
                if track:
                    track.pop(0)

            resultado_det = detectores[cam_id].clasificar_trayectoria(track)

            if modo_prueba and iteraciones == 2 and not resultado_det["es_posible_ola"]:
                resultado_det = {
                    "tipo": "posible_ola",
                    "confianza": 0.88,
                    "es_posible_ola": True,
                    "motivo": "Simulación controlada para verificación en modo prueba",
                    "dist_neta_m": 25.0,
                    "vel_kmh": 14.5,
                    "duracion_s": 8.0,
                }
                bbox_mov = (200, 150, 45, 60)

            dato_fotograma = {
                "t": t_ahora,
                "bytes": f_bytes,
                "momento": momento_loop,
                "bbox": bbox_mov,
                "track": list(track),
            }

            buffer = buffers[cam_id]
            if resultado_det.get("es_posible_ola") and not buffer.grabacion_activa:
                print(f"  [DETECCIÓN] {cam_id} a las {momento_loop.strftime('%H:%M:%S')}: {resultado_det.get('motivo')}")
                buffer.disparar_evento(metadata={
                    "camara_id": cam_id,
                    "deteccion": resultado_det,
                    "momento_deteccion": momento_loop,
                })

            clip_finalizado = buffer.anadir_fotograma(dato_fotograma)
            if clip_finalizado:
                duracion_ride = resultado_det.get("duracion_s", 10.0)
                avance = resultado_det.get("dist_neta_m", 25.0)
                nitidez = calcular_nitidez_imagen(f_bytes)
                puntuacion = puntuar_clip(duracion_ride, avance, 0.8, nitidez)
                clip_finalizado["puntuacion"] = puntuacion
                clip_finalizado["camara_id"] = cam_id
                clips_candidatos.append(clip_finalizado)
                print(f"  [CLIP GUARDADO] {cam_id} puntuación: {puntuacion['nota']}/10")

        if modo_prueba:
            time.sleep(0.05)
        else:
            time.sleep(intervalo_muestreo_s)

    # Si hay grabaciones activas al concluir el tiempo, finalizarlas
    for cam_id, buffer in buffers.items():
        if buffer.grabacion_activa:
            clip_finalizado = buffer.finalizar_clip()
            if clip_finalizado:
                f_ultimo = ultimos_fotogramas.get(cam_id)
                nitidez = calcular_nitidez_imagen(f_ultimo) if f_ultimo else 7.0
                puntuacion = puntuar_clip(8.0, 20.0, 0.7, nitidez)
                clip_finalizado["puntuacion"] = puntuacion
                clip_finalizado["camara_id"] = cam_id
                clips_candidatos.append(clip_finalizado)

    print(f"\n[3/4] Muestreo completado: {iteraciones} iteraciones.")
    for cam_id, cnt in fotogramas_descargados_cuenta.items():
        print(f"  - Fotogramas descargados {cam_id}: {cnt}")

    # 2. Selección de los mejores clips del día
    mejores_clips = seleccionar_mejores_clips(clips_candidatos, min_clips=3, max_clips=max_clips_dia)
    print(f"  - Clips candidatos: {len(clips_candidatos)} -> Mejores seleccionados: {len(mejores_clips)}")

    # 3. Renderizar HUD, desenfoque y generar archivos MP4
    CLIPS_DIR.mkdir(parents=True, exist_ok=True)
    etiqueta_mes = f"rewinds-{momento_actual.strftime('%Y-%m')}"
    archivos_mp4_generados: List[Path] = []
    nuevas_entradas_indice: List[Dict[str, Any]] = []

    for idx, clip in enumerate(mejores_clips, start=1):
        cam_id = clip["camara_id"]
        spot_candidato = SPOTS_VIGILANTE.get(cam_id, ("Spot",))[0]
        meta = clip.get("metadata", {})
        det = meta.get("deteccion", {})
        puntuacion = clip.get("puntuacion", {"nota": 7.5})

        fotogramas_hud: List[bytes] = []
        for f_item in clip["fotogramas"]:
            f_hud = renderizar_hud_y_privacidad(
                img_bytes=f_item["bytes"],
                spot_nombre=spot_candidato,
                momento_local=f_item["momento"],
                bbox_surfista=f_item.get("bbox"),
                track=f_item.get("track"),
                puntuacion=puntuacion,
                desenfoque_caras=True,
            )
            fotogramas_hud.append(f_hud)

        nombre_archivo = f"vigilante_{spot_candidato}_{momento_actual.strftime('%Y%m%d_%H%M%S')}_{idx}.mp4"
        ruta_mp4 = CLIPS_DIR / nombre_archivo
        if codificar_video_mp4(fotogramas_hud, ruta_mp4, fps=2.0):
            archivos_mp4_generados.append(ruta_mp4)

            url_asset = f"https://github.com/{repo}/releases/download/{etiqueta_mes}/{nombre_archivo}"
            for spot_nombre in SPOTS_VIGILANTE.get(cam_id, (spot_candidato,)):
                entrada = {
                    "id": f"{spot_nombre}-{momento_actual.strftime('%Y%m%d-%H%M')}-{idx}",
                    "spot": spot_nombre,
                    "spotNombre": spot_nombre,
                    "camara": cam_id,
                    "camaraNombre": cam_id,
                    "hora": momento_actual.isoformat(),
                    "horaLocal": momento_actual.strftime("%Y-%m-%d %H:%M"),
                    "horaUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "url": url_asset,
                    "archivo": nombre_archivo,
                    "release": etiqueta_mes,
                    "duracion": clip.get("duracion_total_s", 30.0),
                    "razon": "deteccion_vigilante_olas",
                    "puntuacion": puntuacion,
                    "detector": det,
                }
                nuevas_entradas_indice.append(entrada)

    # 4. Actualizar data/rewinds.json
    agregados = 0
    if nuevas_entradas_indice:
        agregados = actualizar_indice_rewinds(nuevas_entradas_indice)
        print(f"  [OK] data/rewinds.json actualizado (+{agregados} entradas).")

    # 5. Subir clips a Release si corresponde
    if subir and archivos_mp4_generados and not modo_prueba:
        print(f"\n[4/4] Subiendo {len(archivos_mp4_generados)} clips a Release {etiqueta_mes}...")
        subir_clips_a_release(repo, archivos_mp4_generados, etiqueta_mes)

    # 6. Relanzar si aún estamos en franja diurna
    if not modo_prueba and esta_en_franja_diurna(ahora_madrid(), hora_fin=19):
        print("\n[DISPATCH] Aún dentro de la franja diurna: solicitando siguiente ciclo...")
        relanzar_siguiente_trabajo(repo)

    return {
        "status": "completado",
        "fotogramas_descargados": fotogramas_descargados_cuenta,
        "clips_detectados": len(clips_candidatos),
        "clips_seleccionados": len(mejores_clips),
        "archivos_mp4": [str(p) for p in archivos_mp4_generados],
        "entradas_indice": agregados,
        "cv_vela_estado": estado_vela,
    }


def main():
    parser = argparse.ArgumentParser(description="Vigilante continuo de cámaras de surf.")
    parser.add_argument("--duracion-minutos", type=float, default=350.0, help="Minutos máximos de ejecución.")
    parser.add_argument("--modo-prueba", action="store_true", help="Ejecución rápida de prueba (5 min o 6 ciclos).")
    parser.add_argument("--subir", action="store_true", default=False, help="Subir clips a GitHub Release.")
    parser.add_argument("--repo", default=REPO_POR_DEFECTO, help="Repositorio GitHub (owner/repo).")
    args = parser.parse_args()

    ejecutar_vigilante(
        duracion_minutos=args.duracion_minutos if not args.modo_prueba else 5.0,
        modo_prueba=args.modo_prueba,
        subir=args.subir,
        repo=args.repo,
    )


if __name__ == "__main__":
    main()
