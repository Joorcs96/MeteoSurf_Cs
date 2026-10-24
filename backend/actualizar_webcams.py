"""Verificación y actualización automática del catálogo de webcams de MeteoSurf_Cs.

Comprueba periódicamente que cada webcam del catálogo `webcams.json` sigue
respondiendo, refresca los tokens de las que lo necesitan y marca como
deshabilitada cualquier cámara que falle varias comprobaciones seguidas.

Restricciones estrictas:
- Solo librerías estándar de Python (urllib.request, re, json, os, sys, datetime, argparse).
- Coste 0 EUR.

Esquema esperado de webcams.json (nuevo, "MeteoSurf_Cs"):
{
  "updatedAt": "<ISO 8601>",
  "webcams": [
    {
      "id": str, "name": str, "short": str, "spots": [str, ...],
      "priority": int,
      "embedType": "iframe" | "youtube" | "hls" | "jpg" | "mjpeg" | "link",
      "embedUrl": str, "pageUrl": str, "credit": str,
      "refreshSeconds": int,
      "distanceKm": number,
      "tokenRefresh": null | {"page": str, "regex": str, "ttlMinutes": int},
      "enabled": bool, "verified": bool, "lastChecked": "<ISO 8601>",
      "notes": str,
      "failCount": int   # contador interno de fallos consecutivos (añadido por este script)
    },
    ...
  ]
}

Si webcams.json todavía tiene el esquema antiguo (sin la clave "embedType" en
sus cámaras), este script no toca el archivo y termina sin error (código 0):
así no rompe nada mientras otro agente migra el catálogo.

Uso:
  python backend/actualizar_webcams.py --streams   # verifica y resuelve data/streams.json
  python backend/actualizar_webcams.py --dry-run   # verifica pero no escribe los archivos
"""

import argparse
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Asegurar codificación UTF-8 en stdout/stderr para entornos Windows
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

ROOT_DIR = Path(__file__).resolve().parent.parent
WEBCAMS_JSON_PATH = os.path.join(ROOT_DIR, "webcams.json")
STREAMS_JSON_PATH = os.path.join(ROOT_DIR, "data", "streams.json")

# Emisiones que no se pueden enlazar directamente: hay que resolverlas en el
# servidor. En IPCamLive el embedUrl es el HTML del player y el `streamid` real
# va dentro; además player.php NO manda Access-Control-Allow-Origin, así que el
# navegador no puede resolverlo por su cuenta. Este script lo hace y publica el
# resultado en data/streams.json para que la web pueda reproducir y grabar.
RESOLVER_IPCAMLIVE = "ipcamlive"
HOST_IPCAMLIVE = "ipcamlive.com"
STREAM_TTL_MIN = 45  # por encima de esto la web avisa en vez de intentar en balde

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 MeteoSurf_Cs/1.0"
)

REQUEST_TIMEOUT = 10  # segundos
MAX_FAIL_COUNT = 3  # comprobaciones fallidas seguidas antes de deshabilitar


def _http_get(url: str, timeout: int = REQUEST_TIMEOUT):
    """Realiza una petición GET con cabecera de navegador y devuelve la respuesta abierta."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    return urllib.request.urlopen(req, timeout=timeout)


def is_new_schema(data: Dict[str, Any]) -> bool:
    """Determina si webcams.json ya usa el nuevo esquema de MeteoSurf_Cs.

    Se considera nuevo esquema si existe la clave "webcams" (lista) y, cuando
    la lista no está vacía, al menos alguna cámara tiene la clave "embedType"
    (propia del esquema nuevo; el antiguo usa "streamType").
    """
    if not isinstance(data, dict):
        return False
    webcams = data.get("webcams")
    if not isinstance(webcams, list):
        return False
    if not webcams:
        # Lista vacía: no hay forma de distinguir, se trata como nuevo esquema
        # vacío (no hay nada que verificar, pero no es un error).
        return True
    return any(isinstance(cam, dict) and "embedType" in cam for cam in webcams)


def verificar_hls(url: str) -> bool:
    """Comprueba que una URL de playlist HLS (.m3u8) responde y parece una playlist válida."""
    try:
        with _http_get(url) as resp:
            if not (200 <= resp.status < 400):
                return False
            body = resp.read(2048).decode("utf-8", errors="ignore")
            return "#EXTM3U" in body or url.lower().endswith(".m3u8")
    except Exception as e:
        print(f"    [aviso] HLS no responde ({url}): {e}")
        return False


def verificar_imagen(url: str) -> bool:
    """Comprueba que una URL de imagen (jpg/mjpeg) responde con content-type de imagen."""
    try:
        with _http_get(url) as resp:
            if not (200 <= resp.status < 400):
                return False
            ctype = resp.headers.get("Content-Type", "")
            if ctype and "image" in ctype.lower():
                return True
            # Algunos servidores no informan content-type correcto: aceptar 200 igualmente
            return 200 <= resp.status < 300
    except Exception as e:
        print(f"    [aviso] Imagen no responde ({url}): {e}")
        return False


def verificar_generica(url: str) -> bool:
    """Comprueba de forma genérica (iframe/youtube) que la URL responde 2xx/3xx."""
    try:
        with _http_get(url) as resp:
            return 200 <= resp.status < 400
    except Exception as e:
        print(f"    [aviso] No responde ({url}): {e}")
        return False


def verificar_embed(embed_type: str, embed_url: str) -> bool:
    """Verifica una cámara según su tipo de embed."""
    if not embed_url:
        return False
    if embed_type == "hls":
        return verificar_hls(embed_url)
    if embed_type in ("jpg", "mjpeg"):
        return verificar_imagen(embed_url)
    # iframe / youtube / otros: comprobación genérica de disponibilidad
    return verificar_generica(embed_url)


def refrescar_token(cam: Dict[str, Any]) -> Optional[str]:
    """Si la cámara define tokenRefresh, descarga la página indicada, aplica la regex
    y devuelve la nueva embedUrl (grupo 1). Devuelve None si no aplica o falla."""
    token_cfg = cam.get("tokenRefresh")
    if not token_cfg or not isinstance(token_cfg, dict):
        return None
    page = token_cfg.get("page")
    pattern = token_cfg.get("regex")
    if not page or not pattern:
        return None
    try:
        with _http_get(page) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
        match = re.search(pattern, html)
        if not match:
            print(f"    [aviso] tokenRefresh: la regex no encontró coincidencia en {page}")
            return None
        return match.group(1)
    except Exception as e:
        print(f"    [aviso] tokenRefresh falló para {page}: {e}")
        return None


def procesar_camara(cam: Dict[str, Any], now_iso: str) -> None:
    """Procesa una cámara: refresca token si aplica, verifica el embed y actualiza su estado."""
    cam_id = cam.get("id", "?")
    name = cam.get("name", cam_id)
    embed_type = cam.get("embedType", "")

    # Un enlace a la web del propietario no es un stream: no se verifica ni se deshabilita
    if embed_type == "link":
        return

    # La URL real de estas cámaras está en data/streams.json y cambia sola; su
    # estado no se deduce de un embedUrl vacío. Las resuelve `resolver_streams`.
    if cam.get("resolver") == RESOLVER_IPCAMLIVE:
        cam["lastChecked"] = now_iso
        return

    if cam.get("tokenRefresh"):
        nueva_url = refrescar_token(cam)
        if nueva_url and nueva_url != cam.get("embedUrl"):
            print(f"  [token] {name}: embedUrl actualizada por regex de {cam['tokenRefresh'].get('page')}")
            cam["embedUrl"] = nueva_url

    embed_url = cam.get("embedUrl")
    print(f"Verificando {name} ({cam_id}) [{embed_type}] -> {embed_url}")

    if not embed_url:
        ok = False
    else:
        ok = verificar_embed(embed_type, embed_url)

    fail_count = int(cam.get("failCount") or 0)
    if ok:
        fail_count = 0
        cam["verified"] = True
        if cam.get("enabled") is False and fail_count == 0:
            print(f"  [OK] {name} vuelve a responder: se rehabilita.")
        cam["enabled"] = True
        print(f"  [OK] {name}")
    else:
        fail_count += 1
        cam["verified"] = False
        if fail_count >= MAX_FAIL_COUNT:
            if cam.get("enabled") is not False:
                print(f"  [DESHABILITADA] {name}: {fail_count} fallos seguidos.")
            cam["enabled"] = False
        else:
            print(f"  [fallo {fail_count}/{MAX_FAIL_COUNT}] {name}")

    cam["failCount"] = fail_count
    cam["lastChecked"] = now_iso


def actualizar_catalogo_webcams(dry_run: bool = False) -> int:
    """Lee webcams.json, verifica cada cámara del nuevo esquema y guarda el estado actualizado.

    Devuelve el número de cámaras procesadas (0 si el archivo no existe, está
    vacío o todavía usa el esquema antiguo: en ese caso no se modifica nada).
    """
    print("--- VERIFICACIÓN DE WEBCAMS · MeteoSurf_Cs ---")
    if not os.path.exists(WEBCAMS_JSON_PATH):
        print(f"[INFO] No existe {WEBCAMS_JSON_PATH}. Nada que hacer.")
        return 0

    try:
        with open(WEBCAMS_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[ERROR] No se pudo leer webcams.json: {e}")
        return 0

    if not is_new_schema(data):
        print("[INFO] webcams.json usa todavía el esquema antiguo. No se modifica nada.")
        return 0

    webcams: List[Dict[str, Any]] = data.get("webcams", [])
    if not webcams:
        print("[INFO] webcams.json no tiene cámaras. Nada que verificar.")
        return 0

    now_iso = datetime.now(timezone.utc).isoformat()
    # Huella sin marcas de tiempo: solo se guarda si cambia algo real (URL, estado, fallos)
    huella = lambda: json.dumps([{k: v for k, v in c.items() if k != "lastChecked"}
                                 for c in webcams if isinstance(c, dict)], sort_keys=True)
    antes = huella()

    for cam in webcams:
        if not isinstance(cam, dict):
            continue
        try:
            procesar_camara(cam, now_iso)
        except Exception as e:
            print(f"  [ERROR] Fallo verificando {cam.get('id', '?')}: {e}")

    if huella() == antes:
        print("\n[OK] Sin cambios en las cámaras. No se reescribe webcams.json.")
        return len(webcams)
    data["updatedAt"] = now_iso

    if dry_run:
        activos = sum(1 for c in webcams if isinstance(c, dict) and c.get("enabled"))
        print(f"\n[DRY-RUN] {activos}/{len(webcams)} cámaras activas. No se ha escrito webcams.json.")
        return len(webcams)

    with open(WEBCAMS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    activos = sum(1 for c in webcams if isinstance(c, dict) and c.get("enabled"))
    print(f"\n[OK] webcams.json actualizado: {activos}/{len(webcams)} cámaras activas.")
    return len(webcams)


def _resolver_stream_ipcamlive(alias: str) -> Optional[Dict[str, str]]:
    """Saca el `address` y el `streamid` reales del player público de IPCamLive.

    No usa credenciales: el alias va en la URL pública y la página lo sirve sin
    login (el club tiene el "domain lock" desactivado). El `streamid` rota solo,
    por eso se resuelve cada vez y no se escribe a mano en webcams.json.
    """
    url = f"https://g0.{HOST_IPCAMLIVE}/player/player.php?alias={alias}"
    try:
        with _http_get(url) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"    [aviso] No se pudo abrir el player de IPCamLive: {e}")
        return None
    m_addr = re.search(r"var\s+address\s*=\s*['\"]([^'\"]+)['\"]", html)
    m_stream = re.search(r"var\s+streamid\s*=\s*['\"]([^'\"]+)['\"]", html)
    if not (m_addr and m_stream):
        print("    [aviso] El player no trae address/streamid; puede ser que esté caída")
        return None
    address = m_addr.group(1).strip()
    if not address.endswith("/"):
        address += "/"
    address = address.replace("http://", "https://")
    streamid = m_stream.group(1).strip()
    return {
        "address": address,
        "streamid": streamid,
        "hls": f"{address}streams/{streamid}/stream.m3u8",
        "snapshot": f"{address}streams/{streamid}/snapshot.jpg",
    }


def resolver_streams(dry_run: bool = False) -> int:
    """Resuelve las emisiones dinámicas y las publica en data/streams.json.

    Devuelve el número de cámaras resueltas con éxito. Solo escribe si algún
    `resolvedAt` o URL cambia de verdad, para no generar un commit por corrida.
    """
    print("\n--- EMISIONES DINÁMICAS (data/streams.json) ---")
    if not os.path.exists(WEBCAMS_JSON_PATH):
        print(f"[INFO] No existe {WEBCAMS_JSON_PATH}. Nada que resolver.")
        return 0
    try:
        with open(WEBCAMS_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[ERROR] No se pudo leer webcams.json: {e}")
        return 0

    pendientes = [
        cam for cam in data.get("webcams", [])
        if isinstance(cam, dict) and cam.get("resolver") == RESOLVER_IPCAMLIVE
    ]
    if not pendientes:
        print("[INFO] Ninguna cámara necesita resolución dinámica.")
        return 0

    previo = _leer_streams()
    anterior = {k: v.get("hls") for k, v in previo.get("streams", {}).items()}
    ahora_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    salidas: Dict[str, Any] = {}
    resueltas = 0

    for cam in pendientes:
        cam_id = cam.get("id", "?")
        alias = cam.get("alias") or _alias_de_embed(cam.get("embedUrl") or "")
        print(f"Resolviendo {cam.get('name', cam_id)} (alias {alias})")
        if not alias:
            print(f"  [aviso] Sin alias de IPCamLive: no se puede resolver")
            salidas[cam_id] = _entrada_stream_fallida(ahora_iso, "sin alias de IPCamLive")
            continue
        dato = _resolver_stream_ipcamlive(alias)
        if not dato:
            salidas[cam_id] = _entrada_stream_fallida(ahora_iso, "el player no respondió")
            continue
        # No basta con resolverlo: la URL tiene que devolver una playlist de verdad,
        # o la web enseñaría un reproductor negro sin explicación.
        if not verificar_hls(dato["hls"]):
            salidas[cam_id] = _entrada_stream_fallida(ahora_iso, "la playlist HLS no responde")
            continue
        salidas[cam_id] = {
            "alias": alias,
            "hls": dato["hls"],
            "snapshot": dato["snapshot"],
            "ok": True,
            "motivo": "",
            "resolvedAt": ahora_iso,
            "ttlMin": STREAM_TTL_MIN,
        }
        resueltas += 1
        print(f"  [OK] {dato['hls']}")

    if not dry_run:
        indice = {
            "updatedAt": ahora_iso,
            "timezone": "Europe/Madrid",
            "streams": salidas,
        }
        nuevo_hls = {k: v.get("hls") for k, v in salidas.items()}
        # Se escribe cuando cambia la URL... y también cuando la anterior ya es
        # vieja aunque la URL sea la misma. Si no, una emisión estable (el mismo
        # streamid durante horas) dejaría de reproducirse en la web al caducar su
        # ttl, sin que nadie lo haya tocado.
        caducada = False
        for cam_id, viejo in previo.get("streams", {}).items():
            if not viejo.get("resolvedAt"):
                caducada = True
                break
            edad = datetime.now(timezone.utc) - datetime.fromisoformat(
                viejo["resolvedAt"].replace("Z", "+00:00")
            )
            if edad.total_seconds() > STREAM_TTL_MIN * 30:
                caducada = True
                break
        if nuevo_hls != anterior or caducada:
            os.makedirs(os.path.dirname(STREAMS_JSON_PATH), exist_ok=True)
            with open(STREAMS_JSON_PATH, "w", encoding="utf-8") as f:
                json.dump(indice, f, indent=2, ensure_ascii=False)
                f.write("\n")
            motivo = "las emisiones han cambiado" if nuevo_hls != anterior else "la anterior ya caducaba"
            print(f"[OK] Escrito {STREAMS_JSON_PATH} ({resueltas}/{len(pendientes)} resueltas): {motivo}.")
        else:
            print("[OK] Las emisiones no han cambiado y la anterior aún es válida: no se reescribe data/streams.json.")
    else:
        print(f"[DRY-RUN] {resueltas}/{len(pendientes)} emisiones resueltas. No se escribe nada.")
    return resueltas


def _alias_de_embed(embed_url: str) -> str:
    """Saca el alias IPCamLive de una URL de player.php, si lo lleva."""
    if HOST_IPCAMLIVE not in embed_url:
        return ""
    m = re.search(r"alias=([A-Za-z0-9]+)", embed_url)
    return m.group(1) if m else ""


def _leer_streams() -> Dict[str, Any]:
    if not os.path.exists(STREAMS_JSON_PATH):
        return {}
    try:
        with open(STREAMS_JSON_PATH, "r", encoding="utf-8") as f:
            datos = json.load(f)
        return datos if isinstance(datos, dict) else {}
    except Exception:
        return {}


def _entrada_stream_fallida(ahora_iso: str, motivo: str) -> Dict[str, Any]:
    """Entrada de una emisión que no se pudo resolver ahora mismo.

    Se guarda igual, con `ok: false` y el motivo, para que la web pueda explicar
    por qué no hay vídeo en vez de quedarse en silencio.
    """
    return {
        "alias": "",
        "hls": "",
        "snapshot": "",
        "ok": False,
        "motivo": motivo,
        "resolvedAt": ahora_iso,
        "ttlMin": STREAM_TTL_MIN,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Verifica y actualiza el catálogo de webcams de MeteoSurf_Cs.")
    parser.add_argument("--dry-run", action="store_true", help="Verifica pero no escribe cambios en webcams.json.")
    parser.add_argument("--streams", action="store_true",
                        help="resuelve además las emisiones dinámicas a data/streams.json.")
    args = parser.parse_args()
    actualizar_catalogo_webcams(dry_run=args.dry_run)
    if args.streams:
        resolver_streams(dry_run=args.dry_run)
    return 0


if __name__ == "__main__":
    sys.exit(main())
