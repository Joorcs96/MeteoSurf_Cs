#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/realtime.py - Última observación real frente a Castellón (oleaje, nivel del mar y viento).

Sirve para comparar lo que predice la web con lo que de verdad se mide. Todas las fuentes son
gratuitas y no piden clave: la red de Puertos del Estado (Portus), que además es la que la propia
web oficial usa para pintar sus mapas en tiempo real.

Fuentes y cómo sesacamos cada dato
----------------------------------
* Oleaje: red de boyas REDEXT de Puertos del Estado. No hay boya en Castellón, así que se usa la
  más cercana que haya en marcha, que hoy es la Boya de Valencia (unos 55 km al sur). Se listan
  además las siguientes más cercanas por si la primera falla.
* Nivel del mar: mareógrafo de Puertos del Estado más cercano. Puertos no tiene ninguno en
  Castellón, así que se cae al de Sagunto (unos 44 km) y se avisa de ello en el JSON.
* Viento: estaciones meteorológicas REMPOR de Puertos del Estado. En el puerto de Castellón hay
  seis, a menos de 5 km, con velocidad, racha y dirección. Se prueban por orden de cercanía hasta
  que una devuelva dato reciente.
* AEMET queda preparado y desactivado: sólo se consulta si hay clave en la variable de entorno
  AEMET_API_KEY (se pondría en un secret del workflow). Es el último recurso para el viento.

API que se usa (descubierta en el propio JavaScript de portus.puertos.es)
----------------------------------------------------------------------
    GET  https://portus.puertos.es/portussvr/api/estaciones/rt/<TIPO>?locale=es
         -> catálogo de estaciones con nombre, coordenadas, disponibilidad y tipo de sensor.
            TIPO = WAVE (oleaje), SEA_LEVEL (nivel del mar), WIND (viento).
    POST https://portus.puertos.es/portussvr/api/parametros/<id>?locale=es
         con ["WAVE","WIND",...]  -> ids numéricos de los parámetros de esa estación.
    POST https://portus.puertos.es/portussvr/api/RTData/station/<id>?locale=es
         con esos ids           -> las últimas filas de observación.

Los valores vienen enteros y hay que dividirlos por el campo "factor" de cada parámetro. La API
marca con "averia": true los sensores que no dan dato válido, y usa centinelas (9999, -9999) para
lo que no mide; aquí se descartan por parámetro con los límites de RANGOS.

Salida
------
data/realtime.json, con la hora en UTC, la fuente de cada bloque y los errores de lo que falle.
El script nunca aborta: si una fuente cae, sigue con las demás y lo anota en "errores".

Uso
---
    python scripts/realtime.py              descarga y escribe data/realtime.json
    python scripts/realtime.py --comprobar  sólo escribe si los datos han cambiado de verdad
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import socket
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

# --------------------------------------------------------------------------------------
# Configuración
# --------------------------------------------------------------------------------------

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "data" / "realtime.json"

API_PORTUS = os.environ.get("REALTIME_API_PORTUS", "https://portus.puertos.es/portussvr/api")
API_AEMET = "https://api.aemet.es/opendata/api/observaciones"
# Estación de AEMET más próxima a Castellón (Castellón, Almassora). Sólo se usa con clave.
ESTACION_AEMET = "B228"

TIMEOUT = 25

# Referencia para distancias: el mar delante de Castelló de la Plana (Zona de Planetario).
REF_LAT, REF_LON = 39.9858, 0.0277
REF_NOMBRE = "Castellón de la Plana"

# Distancia máxima a la que se busca estación de viento (km).
RADIO_VIENTO_KM = 30.0

# Cuánto puede envejecer una observación y seguir publicándose. La boya va cada 60 min, el
# mareógrafo cada 5 y las estaciones de viento cada 10.
MAX_EDAD_HORAS = {
    "oleaje": float(os.environ.get("REALTIME_MAX_EDAD_OLEAJE_H", 6)),
    "nivel_mar": float(os.environ.get("REALTIME_MAX_EDAD_NIVEL_H", 3)),
    "viento": float(os.environ.get("REALTIME_MAX_EDAD_VENTO_H", 3)),
}

# Límites razonables por parámetro. Fuera de ellos el sensor está averiado o devuelve un
# centinela, y el valor se descarta en lugar de publicarlo como si fuera real.
RANGOS = {
    "Hm0": (0.0, 20.0),
    "Hmax": (0.0, 25.0),
    "Tp": (0.0, 30.0),
    "Tm02": (0.0, 30.0),
    "MeanDir": (0.0, 360.0),
    "MeanDirPeak": (0.0, 360.0),
    "WindSpeed": (0.0, 75.0),
    "WindSpeedMax": (0.0, 100.0),
    "WindDir": (0.0, 360.0),
    "SeaLevel": (-3.0, 5.0),
    "WaterTemp": (0.0, 40.0),
    "AirTemp": (-30.0, 60.0),
}

ROSA = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO",
        "O", "ONO", "NO", "NNO"]

NOTAS: list[str] = []


# --------------------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------------------


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(dt: datetime | None) -> str | None:
    return None if dt is None else dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def rosa_vientos(deg: float | None) -> str | None:
    if deg is None:
        return None
    return ROSA[int(round(deg % 360 / 22.5)) % 16]


def distancia_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia en km entre dos puntos (fórmula del haversine)."""
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def redondea(valor: float | None, decimales: int = 2):
    return None if valor is None else round(valor, decimales)


def grados(valor: float | None) -> int | None:
    """Un rumbo es un número entero en grados, redondeado al más cercano."""
    return None if valor is None else int(round(valor)) % 360


# --------------------------------------------------------------------------------------
# HTTPS
#
# puertos.es firma con una cadena de la FNMT que no está en los almacenes de certificados
# públicos, así que la verificación normal falla contra "self-signed certificate in chain".
# Se intenta primero con verificación completa; sólo si eso falla se reintenta sin ella, y se
# deja constancia en el JSON. Los datos son públicos y de sólo lectura, y el riesgo real está
# en que un valor llegue manipulado; por eso el aviso es explícito y se puede fijar una CA
# propia con REALTIME_CA_BUNDLE cuando Puertos lo permita.
# --------------------------------------------------------------------------------------


def contexto_tls(verificar: bool) -> ssl.SSLContext:
    if not verificar:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    ctx = ssl.create_default_context()
    ca = os.environ.get("REALTIME_CA_BUNDLE")
    if ca:
        ctx.load_verify_locations(ca)
    return ctx


_TLS_SIN_VERIFICAR = False


def _descarga(url: str, cuerpo: bytes | None, timeout: int, verificar: bool) -> bytes:
    peticion = urllib.request.Request(
        url,
        data=cuerpo,
        headers={
            "User-Agent": "MeteoSurf_Cs/1.0 (datos reales; contacto: joorcs96)",
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip",
            **({"Content-Type": "application/json"} if cuerpo is not None else {}),
        },
        method="POST" if cuerpo is not None else "GET",
    )
    with urllib.request.urlopen(peticion, context=contexto_tls(verificar), timeout=timeout) as r:
        bruto = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            bruto = gzip.decompress(bruto)
        return bruto


def _es_error_de_certificado(exc: BaseException) -> str | None:
    """
    urllib envuelve el fallo de certificado en un URLError, así que hay que mirar dentro.

    Devuelve el texto del aviso de ssl, o None si el fallo no es de certificado.
    """
    vistos = set()
    pendientes = [exc]
    while pendientes:
        actual = pendientes.pop()
        if id(actual) in vistos:
            continue
        vistos.add(id(actual))
        if isinstance(actual, ssl.SSLCertVerificationError):
            return str(actual.verify_message or actual.reason or actual)
        if isinstance(actual, ssl.SSLError):
            return str(actual.reason or actual)
        for atributo in ("reason", "args"):
            valor = getattr(actual, atributo, None)
            if isinstance(valor, BaseException):
                pendientes.append(valor)
            elif isinstance(valor, (list, tuple)):
                pendientes.extend(v for v in valor if isinstance(v, BaseException))
    return None


def descarga(url: str, cuerpo=None, timeout: int = TIMEOUT) -> bytes:
    """Descarga bytes, reintentando sin verificación TLS si la cadena de puertos.es no valida."""
    global _TLS_SIN_VERIFICAR
    datos = json.dumps(cuerpo).encode("utf-8") if cuerpo is not None else None
    if _TLS_SIN_VERIFICAR:
        return _descarga(url, datos, timeout, verificar=False)
    try:
        return _descarga(url, datos, timeout, verificar=True)
    except Exception as exc:  # noqa: BLE001
        motivo_cert = _es_error_de_certificado(exc) if isinstance(exc, urllib.error.URLError) else None
        if motivo_cert is None:
            raise
        aviso = ("Puertos del Estado firma con una cadena de la FNMT que no está en el almacén "
                 f"de certificados del sistema ({motivo_cert}); se repite la petición sin "
                 "verificar el certificado.")
        if aviso not in NOTAS:
            NOTAS.append(aviso)
        _TLS_SIN_VERIFICAR = True
        return _descarga(url, datos, timeout, verificar=False)


def pedir_json(url: str, cuerpo=None, timeout: int = TIMEOUT):
    bruto = descarga(url, cuerpo, timeout)
    try:
        return json.loads(bruto.decode("utf-8", "replace"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"respuesta no es JSON válido: {exc}") from exc


def pedir_api(ruta: str, cuerpo=None):
    return pedir_json(API_PORTUS + ruta, cuerpo)


# --------------------------------------------------------------------------------------
# Lectura de la API de Puertos del Estado
# --------------------------------------------------------------------------------------


def catalogo(tipo: str) -> list[dict]:
    """Catálogo de estaciones de un tipo: WAVE, SEA_LEVEL o WIND."""
    datos = pedir_api(f"/estaciones/rt/{tipo}?locale=es")
    if not isinstance(datos, list):
        raise ValueError(f"el catálogo {tipo} no es una lista")
    for e in datos:
        e["distancia_km"] = distancia_km(e["latitud"], e["longitud"], REF_LAT, REF_LON)
    return datos


def elegir_por_cercania(estaciones: list[dict], radio_km: float | None = None) -> list[dict]:
    """Estaciones utilizables, de la más cercana a la más lejana."""
    out = [e for e in estaciones if e.get("disponible") and e.get("estado") in (0, None)]
    if radio_km is not None:
        out = [e for e in out if e["distancia_km"] <= radio_km]
    return sorted(out, key=lambda e: e["distancia_km"])


def leer_observacion(estacion: dict, variables: list[str]) -> dict | None:
    """
    Última fila de observación de una estación.

    Devuelve {fecha: datetime UTC, valores: {paramEseoo: valor en unidades reales}} o None si la
    estación no tiene variables pedidas o no devuelve filas.
    """
    id_est = estacion["id"]
    parametros = pedir_api(f"/parametros/{id_est}?locale=es", variables)
    if not isinstance(parametros, list) or not parametros:
        return None
    ids = [p["id"] for p in parametros if isinstance(p, dict) and "id" in p]
    if not ids:
        return None
    filas = pedir_api(f"/RTData/station/{id_est}?locale=es", ids)
    if not isinstance(filas, list) or not filas:
        return None
    return _elige_fila(filas)


def _elige_fila(filas: list[dict]) -> dict | None:
    """La fila más reciente con valores utilizables."""
    ordenadas = []
    for fila in filas:
        fecha = _fecha_de(fila.get("fecha"))
        if fecha is None:
            continue
        ordenadas.append((fecha, fila))
    ordenadas.sort(key=lambda x: x[0], reverse=True)

    for fecha, fila in ordenadas:
        valores = {}
        for dato in fila.get("datos") or []:
            v = _valor_de(dato)
            if v is not None:
                valores[dato.get("paramEseoo") or dato.get("id")] = v
        if valores:
            return {"fecha": fecha, "valores": valores, "crudo": fila}
    return None


def _fecha_de(texto: str | None) -> datetime | None:
    """Portus devuelve la hora de observación en GMT, tipo "2026-09-29 22:00:00.0"."""
    if not texto:
        return None
    limpio = str(texto).strip().replace("T", " ").split("+")[0].split("Z")[0]
    for formato in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
        try:
            return datetime.strptime(limpio, formato).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _valor_de(dato: dict) -> float | None:
    """Valor de un parámetro en sus unidades reales, o None si está averiado o es centinela."""
    if dato.get("averia"):
        return None
    bruto = dato.get("valor")
    if bruto is None or bruto == "":
        return None
    try:
        numero = float(bruto)
    except (TypeError, ValueError):
        return None
    if math.isnan(numero) or math.isinf(numero):
        return None
    factor = dato.get("factor") or 1.0
    valor = numero / float(factor)
    limites = RANGOS.get(dato.get("paramEseoo"))
    if limites and not (limites[0] <= valor <= limites[1]):
        return None
    return valor


def antiguedad_min(fecha: datetime) -> int:
    """
    Minutos transcurridos desde la observación.

    Sólo se usa para decidir si un bloque está obsoleto. La edad en minutos no se escribe en el
    JSON porque cambia en cada ejecución: si fuera dentro, el workflow commitearía cada hora aunque
    las medidas fueran las mismas. Quien lo use la calcula con "fecha".
    """
    return int((ahora() - fecha).total_seconds() / 60)


# --------------------------------------------------------------------------------------
# Bloques del JSON
# --------------------------------------------------------------------------------------


def _estacion(est: dict) -> dict:
    return {
        "estacion": est["nombre"],
        "estacion_id": est["id"],
        "lat": est["latitud"],
        "lon": est["longitud"],
        "distancia_km": redondea(est["distancia_km"], 1),
    }


def bloque_oleaje(candidatas: list[dict], errores: list[dict]) -> dict | None:
    """
    Bloque de oleaje. La principal es la Boya de Valencia si está en marcha; si no, la boya real
    más cercana. Se añaden hasta tres boyas para tener comparación y respaldo.
    """
    # Sólo boyas reales: el catálogo incluye también puntos de propagación de un modelo
    # matemático, que no son medidas y no sirven para comparar con la realidad.
    boyas = [e for e in candidatas if e.get("boya") and "Propagaci" not in e["nombre"]]
    if not boyas:
        errores.append({"bloque": "oleaje", "fuente": "Puertos del Estado",
                        "mensaje": "no hay ninguna boya de oleaje disponible cerca de Castellón"})
        return None

    detalle, principal = [], None
    for est in boyas[:3]:
        obs = None
        try:
            obs = leer_observacion(est, ["WAVE", "WATER_TEMP"])
        except Exception as exc:  # noqa: BLE001 - una boya caída no debe tumbar el bloque
            errores.append({"bloque": "oleaje", "fuente": f"{est['nombre']} ({est['id']})",
                            "mensaje": f"no se pudo leer: {_motivo(exc)}"})
        if not obs:
            continue
        v = obs["valores"]
        item = {
            **_estacion(est),
            "fecha": iso_utc(obs["fecha"]),
            "altura_m": redondea(v.get("Hm0")),
            "altura_max_m": redondea(v.get("Hmax")),
            "periodo_s": redondea(v.get("Tp")),
            "periodo_medio_s": redondea(v.get("Tm02")),
            "direccion_grados": grados(v.get("MeanDir")),
            "direccion_pico_grados": grados(v.get("MeanDirPeak")),
            "temperatura_agua_c": redondea(v.get("WaterTemp")),
            "cadencia_min": est.get("cadencia"),
        }
        item["direccion"] = rosa_vientos(item["direccion_grados"])
        item["direccion_pico"] = rosa_vientos(item["direccion_pico_grados"])
        detalle.append(item)
        if principal is None and item["altura_m"] is not None:
            principal = item
        if len(detalle) >= 3:
            break

    if principal is None:
        errores.append({"bloque": "oleaje", "fuente": "Puertos del Estado",
                        "mensaje": "las boyas cercanas responden pero sin altura de oleaje válida"})
        return None

    if principal["cadencia_min"]:
        # La boya transmite cada hora: una lectura de hace más de una hora y mediarare ya no
        # describe la realidad de ahora.
        margen = max(MAX_EDAD_HORAS["oleaje"], (principal["cadencia_min"] / 60) * 1.5)
    else:
        margen = MAX_EDAD_HORAS["oleaje"]
    antiguedad = antiguedad_min(datetime.strptime(principal["fecha"], "%Y-%m-%dT%H:%M:%SZ")
                                .replace(tzinfo=timezone.utc))
    principal = {
        **principal,
        "fuente": "Puertos del Estado · red de boyas REDEXT",
        "obsoleto": antiguedad > margen * 60,
    }
    return {"principal": principal, "boyas_cercanas": detalle}


def bloque_nivel_mar(candidatas: list[dict], errores: list[dict]) -> dict | None:
    """Nivel del mar observado en el mareógrafo más cercano."""
    if not candidatas:
        errores.append({"bloque": "nivel_mar", "fuente": "Puertos del Estado",
                        "mensaje": "no hay ningún mareógrafo disponible cerca de Castellón"})
        return None

    for est in candidatas[:3]:
        try:
            obs = leer_observacion(est, ["SEA_LEVEL"])
        except Exception as exc:  # noqa: BLE001
            errores.append({"bloque": "nivel_mar", "fuente": f"{est['nombre']} ({est['id']})",
                            "mensaje": f"no se pudo leer: {_motivo(exc)}"})
            continue
        if not obs:
            continue
        nivel = obs["valores"].get("SeaLevel")
        if nivel is None:
            continue
        fecha = iso_utc(obs["fecha"])
        antiguedad = antiguedad_min(obs["fecha"])
        return {
            "fuente": "Puertos del Estado · mareógrafo",
            **_estacion(est),
            "fecha": fecha,
            "nivel_m": redondea(nivel, 3),
            "obsoleto": antiguedad > MAX_EDAD_HORAS["nivel_mar"] * 60,
            "nota": "Puertos del Estado no tiene mareógrafo en Castellón; se publica el más "
                    "cercano, junto con su distancia.",
        }
    errores.append({"bloque": "nivel_mar", "fuente": "Puertos del Estado",
                    "mensaje": "ningún mareógrafo cercano devolvió nivel de mar válido"})
    return None


def bloque_viento_aemet(errores: list[dict]) -> dict | None:
    """Viento de AEMET. Sólo actúa si hay AEMET_API_KEY; el acceso a datos de AEMet es gratuito."""
    clave = os.environ.get("AEMET_API_KEY")
    if not clave:
        return None
    hasta = ahora()
    desde = hasta - timedelta(hours=6)
    url = (f"{API_AEMET}/fechainicial/{desde.strftime('%Y-%m-%dT%H:%M:%SUTC')}"
           f"/fechainicial/{hasta.strftime('%Y-%m-%dT%H:%M:%SUTC')}"
           f"/estacion/{ESTACION_AEMET}?api_key={clave}")
    try:
        datos = pedir_json(url, timeout=30)
    except urllib.error.HTTPError as exc:
        errores.append({"bloque": "viento", "fuente": "AEMET OpenData",
                        "mensaje": f"la clave de AEMET no es válida (HTTP {exc.code})"})
        return None
    except Exception as exc:  # noqa: BLE001
        errores.append({"bloque": "viento", "fuente": "AEMET OpenData",
                        "mensaje": f"no se pudo consultar: {_motivo(exc)}"})
        return None
    if not isinstance(datos, dict) or not datos.get("respuesta"):
        errores.append({"bloque": "viento", "fuente": "AEMET OpenData",
                        "mensaje": "AEMET no devolvió observaciones"})
        return None

    # AEMET responde con fecha en UTC y los campos en el idioma de la petición.
    filas = []
    for feature in datos["respuesta"]:
        for prop, obs in (feature.get("properties") or {}).items():
            fecha = _fecha_de(obs.get("fecha"))
            if fecha is None:
                continue
            def numero(clave_alt, factor):
                try:
                    v = obs.get(clave_alt)
                    return None if v is None else float(v.replace(",", ".")) / factor
                except (TypeError, ValueError, AttributeError):
                    return None
            filas.append({
                "fecha": fecha,
                "fecha_texto": obs.get("fecha"),
                "velocidad_ms": numero("vv", 1.0),
                "racha_ms": numero("vmax", 1.0),
                "direccion_grados": numero("dv", 1.0),
                "temperatura_c": numero("ta", 1.0),
                "presion_hpa": numero("p", 1.0),
            })
    filas.sort(key=lambda f: f["fecha"], reverse=True)
    usable = next((f for f in filas if f["velocidad_ms"] is not None), None)
    if usable is None:
        return None
    antiguedad = antiguedad_min(usable["fecha"])
    return {
        "fuente": "AEMET OpenData",
        "estacion": f"Estación AEMET {ESTACION_AEMET} (Castellón, Almassora)",
        "estacion_id": ESTACION_AEMET,
        "fecha": iso_utc(usable["fecha"]),
        "velocidad_ms": redondea(usable["velocidad_ms"], 1),
        "racha_ms": redondea(usable["racha_ms"], 1),
        "direccion_grados": grados(usable["direccion_grados"]),
        "direccion": rosa_vientos(grados(usable["direccion_grados"])),
        "temperatura_c": redondea(usable["temperatura_c"], 1),
        "presion_hpa": redondea(usable["presion_hpa"], 1),
        "obsoleto": antiguedad > MAX_EDAD_HORAS["viento"] * 60,
        "nota": "AEMET publica el viento en m/s y la dirección de procedencia.",
    }


def bloque_viento(candidatas: list[dict], errores: list[dict]) -> dict | None:
    """Viento observado en la estación REMPOR más cercana que tenga dato reciente."""
    if not candidatas:
        errores.append({"bloque": "viento", "fuente": "Puertos del Estado",
                        "mensaje": f"no hay estación de viento en un radio de "
                                   f"{RADIO_VENTO_KM:.0f} km"})
        aemet = bloque_viento_aemet(errores)
        if aemet:
            return aemet
        return None

    # Se prueban hasta tres estaciones por cercanía y se queda con la primera lectura válida. Si
    # todas están viejas se devuelve igualmente la más cercana marcada como obsoleto, igual que
    # hacen los otros dos bloques: mejor un dato viejo y señalizado que un bloque vacío.
    leidas = 0
    respaldo = None
    for est in candidatas:
        if leidas >= 3:
            break
        leidas += 1
        try:
            obs = leer_observacion(est, ["WIND", "AIR_TEMP"])
        except Exception as exc:  # noqa: BLE001
            errores.append({"bloque": "viento", "fuente": f"{est['nombre']} ({est['id']})",
                            "mensaje": f"no se pudo leer: {_motivo(exc)}"})
            continue
        if not obs:
            continue
        v = obs["valores"]
        if v.get("WindSpeed") is None:
            continue
        antiguedad = antiguedad_min(obs["fecha"])
        bloque = {
            "fuente": "Puertos del Estado · estaciones meteorológicas REMPOR",
            **_estacion(est),
            "fecha": iso_utc(obs["fecha"]),
            "velocidad_ms": redondea(v.get("WindSpeed"), 1),
            "racha_ms": redondea(v.get("WindSpeedMax"), 1),
            "direccion_grados": grados(v.get("WindDir")),
            "direccion": rosa_vientos(grados(v.get("WindDir"))),
            "temperatura_c": redondea(v.get("AirTemp"), 1),
            "cadencia_min": est.get("cadencia"),
            "obsoleto": antiguedad > MAX_EDAD_HORAS["viento"] * 60,
            "nota": "La dirección es la de procedencia, de dónde viene el viento.",
        }
        if not bloque["obsoleto"]:
            return bloque
        if respaldo is None:
            respaldo = bloque
        errores.append({"bloque": "viento", "fuente": f"{est['nombre']} ({est['id']})",
                        "mensaje": f"la última observación es de hace {antiguedad} min"})

    # Si todo lo de Puertos está viejo, se pregunta a AEMET antes de resignarse: puede tener
    # lectura reciente. Sólo si AEMET tampoco sirve se devuelve el dato viejo marcado.
    aemet = bloque_viento_aemet(errores)
    if aemet and not aemet["obsoleto"]:
        return aemet

    if respaldo is not None:
        respaldo["nota"] = (f"{respaldo['nota']} La observación es antigua: se marca como "
                            "obsoleta y no debe usarse como el viento actual.")
        if aemet:
            respaldo["nota"] += (f" AEMET tampoco tenía lectura reciente: "
                                 f"{aemet['nota']}")
        return respaldo

    if aemet:
        return aemet
    errores.append({"bloque": "viento", "fuente": "Puertos del Estado",
                    "mensaje": "ninguna estación cercana devolvió viento válido"})
    return None


def _motivo(exc: Exception) -> str:
    """Mensaje de error corto y legible, sin la traza completa de la excepción."""
    if isinstance(exc, urllib.error.HTTPError):
        return f"HTTP {exc.code} {exc.reason}"
    if isinstance(exc, urllib.error.URLError):
        return str(exc.reason)
    if isinstance(exc, (TimeoutError, socket.timeout)):
        return "tiempo de espera agotado"
    return str(exc) or type(exc).__name__


# --------------------------------------------------------------------------------------
# Programa
# --------------------------------------------------------------------------------------


def recoger() -> dict:
    errores: list[dict] = []
    momento = ahora()
    oleaje = nivel_mar = viento = None

    try:
        oleaje = bloque_oleaje(elegir_por_cercania(catalogo("WAVE")), errores)
    except Exception as exc:  # noqa: BLE001
        errores.append({"bloque": "oleaje", "fuente": "Puertos del Estado",
                        "mensaje": f"no se pudo obtener el catálogo de boyas: {_motivo(exc)}"})

    try:
        mareografos = elegir_por_cercania(catalogo("SEA_LEVEL"))
        # Si algún día Puertos instala un mareógrafo en Castellón, se usará primero.
        castellon = [e for e in mareografos if "castell" in e["nombre"].lower()]
        nivel_mar = bloque_nivel_mar(castellon + [e for e in mareografos if e not in castellon],
                                     errores)
    except Exception as exc:  # noqa: BLE001
        errores.append({"bloque": "nivel_mar", "fuente": "Puertos del Estado",
                        "mensaje": f"no se pudo obtener el catálogo de mareógrafos: {_motivo(exc)}"})

    try:
        viento = bloque_viento(elegir_por_cercania(catalogo("WIND"), RADIO_VIENTO_KM), errores)
    except Exception as exc:  # noqa: BLE001
        errores.append({"bloque": "viento", "fuente": "Puertos del Estado",
                        "mensaje": f"no se pudo obtener el catálogo de estaciones de viento: {_motivo(exc)}"})

    datos = {
        "generado": iso_utc(momento),
        "generado_local": momento.astimezone().isoformat(timespec="seconds"),
        "ok": bool(oleaje and nivel_mar and viento),
        "referencia": {
            "lugar": REF_NOMBRE,
            "lat": REF_LAT,
            "lon": REF_LON,
        },
        "oleaje": oleaje,
        "nivel_mar": nivel_mar,
        "viento": viento,
        "notas": list(NOTAS),
        "errores": errores,
    }
    if not datos["notas"]:
        datos.pop("notas")
    return datos


VOLATILES = ("generado", "generado_local")


def comparable(datos: dict) -> str:
    """El JSON sin los campos que cambian en cada ejecución (la hora de descarga)."""
    limpio = {k: v for k, v in datos.items() if k not in VOLATILES}
    return json.dumps(limpio, ensure_ascii=False, sort_keys=True, indent=2)


def escribir(datos: dict, destino: Path) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    texto = json.dumps(datos, ensure_ascii=False, indent=2) + "\n"
    # newline="\n" para que el fichero sea idéntico en Windows y en el runner de GitHub.
    with open(destino, "w", encoding="utf-8", newline="\n") as f:
        f.write(texto)


def resumen(datos: dict) -> str:
    lineas = [f"Referencia: {datos['referencia']['lugar']}",
              f"Generado:   {datos['generado']}"]
    o = datos.get("oleaje") and datos["oleaje"].get("principal")
    if o:
        lineas.append(
            f"Oleaje:     {o['altura_m']} m / {o['periodo_s']} s de {o['direccion']} "
            f"({o['direccion_grados']}º) en {o['estacion']}, a {o['distancia_km']} km, "
            f"dato de {o['fecha']}")
        extras = datos["oleaje"].get("boyas_cercanas") or []
        for x in extras[1:]:
            lineas.append(f"            · {x['estacion']}: {x['altura_m']} m / {x['periodo_s']} s "
                          f"de {x['direccion']}, a {x['distancia_km']} km")
    else:
        lineas.append("Oleaje:     sin datos")
    n = datos.get("nivel_mar")
    if n:
        lineas.append(f"Nivel mar:  {n['nivel_m']} m en {n['estacion']}, a {n['distancia_km']} km, "
                      f"dato de {n['fecha']}")
    else:
        lineas.append("Nivel mar:  sin datos")
    v = datos.get("viento")
    if v:
        lineas.append(
            f"Viento:     {v['velocidad_ms']} m/s con racha de {v['racha_ms']} m/s de "
            f"{v['direccion']} ({v['direccion_grados']}º) en {v['estacion']}, "
            f"a {v['distancia_km']} km, dato de {v['fecha']}")
    else:
        lineas.append("Viento:     sin datos")
    for e in datos.get("errores") or []:
        lineas.append(f"Aviso:      [{e['bloque']}] {e['fuente']}: {e['mensaje']}")
    for nota in datos.get("notas") or []:
        lineas.append(f"Nota:       {nota}")
    return "\n".join(lineas)


def main() -> int:
    # En Windows la consola puede ir en cp1252 y las tildes romperían la impresión.
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass

    ap = argparse.ArgumentParser(description="Observaciones reales de Puertos del Estado para "
                                             "MeteoSurf_Cs")
    ap.add_argument("--salida", type=Path, default=SALIDA,
                    help="fichero JSON de salida (por defecto data/realtime.json)")
    ap.add_argument("--comprobar", action="store_true",
                    help="sólo escribe si los datos han cambiado de verdad")
    args = ap.parse_args()
    destino = args.salida

    datos = recoger()
    nuevo = comparable(datos)

    anterior = None
    if destino.exists():
        try:
            with open(destino, encoding="utf-8") as f:
                previo = json.load(f)
            anterior = comparable(previo) if isinstance(previo, dict) else None
        except (json.JSONDecodeError, OSError):
            anterior = None

    cambia = nuevo != anterior
    if cambia or not args.comprobar:
        escribir(datos, destino)

    print(resumen(datos))
    print()
    if args.comprobar:
        print("CAMBIADO" if cambia else "SIN CAMBIOS")
    else:
        print(f"Escrito en {destino.relative_to(RAIZ) if destino.is_relative_to(RAIZ) else destino}")
    # Sin datos no es un fallo del script: se anota y se sigue, el JSON conserva el error.
    return 0


if __name__ == "__main__":
    sys.exit(main())
