"""Pruebas de scripts/rewind.py (sin red, sin ffmpeg).

Se comprueba lo que no depende de Internet: la lectura de `js/spots.js`, la
selección de cámaras, la hora de Madrid (con y sin base de datos IANA), el
formato de nombres y URLs, la poda del índice y la rosa de los vientos.

    python -m unittest scripts.test_rewind
"""

import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts import rewind  # noqa: E402

# Valores reales sacados de `node` con el SPOTS de js/spots.js.
SEA_LAT_LON_ESPERADO = {
    "Planetario": (39.976, 0.0419),
    "Gurugu": (39.9954, 0.0464),
    "Voramar": (40.0452, 0.0921),
    "Heliopolis": (40.0206, 0.0595),
    "MorroGos": (40.0928, 0.1640),
    "Renega": (40.0518, 0.1289),
    "Piramides": (40.0039, 0.0498),
}


class TestLeerSpots(unittest.TestCase):
    def setUp(self):
        self.spots = rewind.leer_spots()

    def test_todos_los_spots_del_catalogo(self):
        self.assertEqual(len(self.spots), 13)
        for spot_id in ("Planetario", "Gurugu", "Voramar", "MorroGos", "Renega"):
            self.assertIn(spot_id, self.spots)

    def test_punto_de_mar_igual_que_javascript(self):
        for spot_id, (sea_lat, sea_lon) in SEA_LAT_LON_ESPERADO.items():
            self.assertAlmostEqual(self.spots[spot_id]["seaLat"], sea_lat, places=4, msg=spot_id)
            self.assertAlmostEqual(self.spots[spot_id]["seaLon"], sea_lon, places=4, msg=spot_id)

    def test_el_punto_de_mar_cae_al_mar(self):
        for spot in self.spots.values():
            self.assertGreater(abs(spot["seaLon"] - spot["lon"]), 0.0)
            self.assertLessEqual(abs(spot["seaLon"] - spot["lon"]), 0.02)

    def test_nombres_con_tilde(self):
        self.assertEqual(self.spots["Gurugu"]["name"], "Gurugú")
        self.assertEqual(self.spots["Heliopolis"]["name"], "Heliópolis")
        self.assertEqual(self.spots["Renega"]["name"], "La Renegà")


class TestSeleccionCamaras(unittest.TestCase):
    def setUp(self):
        self.webcams = rewind.leer_webcams()

    def test_solo_las_tres_areas_pedidas(self):
        cams = rewind.camaras_rewind(self.webcams)
        self.assertEqual(
            sorted(c["id"] for c in cams),
            ["cv-benicassim-vela-hls", "cv-oropesa-hls", "cv_grao_castellon"],
        )

    def test_descarta_mjpeg_jpg_iframe_y_otros_servidores(self):
        for cam in rewind.camaras_rewind(self.webcams):
            self.assertEqual(cam["embedType"], "hls")
            self.assertIn("streaming.comunitatvalenciana.com", cam["embedUrl"])

    def test_cobertura_de_spots(self):
        cams = {c["id"]: c for c in rewind.camaras_rewind(self.webcams)}
        self.assertEqual(cams["cv_grao_castellon"]["spotsCubiertos"], ["Planetario", "Gurugu"])
        self.assertEqual(cams["cv-benicassim-vela-hls"]["spotsCubiertos"], ["Voramar", "Heliopolis"])
        self.assertEqual(cams["cv-oropesa-hls"]["spotsCubiertos"], ["MorroGos", "Renega"])

    def test_no_toma_camaras_deshabilitadas(self):
        cams = rewind.camaras_rewind(self.webcams)
        for cam in cams:
            self.assertNotEqual(cam.get("enabled"), False)

    def test_filtro_por_spots(self):
        cams = rewind.camaras_rewind(self.webcams, ["Renega"])
        self.assertEqual([c["id"] for c in cams], ["cv-oropesa-hls"])


class TestHoraDeMadrid(unittest.TestCase):
    def test_verano_e_invierno_con_respaldo_sin_base_de_datos(self):
        cet = rewind._MadridCET()
        verano = datetime(2026, 7, 15, 12, 0)
        invierno = datetime(2026, 1, 15, 12, 0)
        self.assertEqual(cet.utcoffset(verano), timedelta(hours=2))
        self.assertEqual(cet.dst(verano), timedelta(hours=1))
        self.assertEqual(cet.utcoffset(invierno), timedelta(hours=1))
        self.assertEqual(cet.dst(invierno), timedelta(0))

    def test_cambio_de_hora_en_los_ultimos_domingos(self):
        cet = rewind._MadridCET()
        # 29/03/2026 y 25/10/2026 son los últimos domingos: el cambio es a la 01:00 UTC.
        cambios = (
            (datetime(2026, 3, 29, 0, 30), "2026-03-29T01:30:00+01:00"),
            (datetime(2026, 3, 29, 1, 30), "2026-03-29T03:30:00+02:00"),  # 02:30 no existe
            (datetime(2026, 10, 25, 0, 30), "2026-10-25T02:30:00+02:00"),
            (datetime(2026, 10, 25, 1, 30), "2026-10-25T02:30:00+01:00"),  # hora repetida
        )
        for utc, esperado in cambios:
            with self.subTest(utc=utc):
                marca = utc.replace(tzinfo=timezone.utc)
                self.assertEqual(marca.astimezone(cet).isoformat(timespec="seconds"), esperado)

    def test_ultimo_domingo(self):
        self.assertEqual(rewind._ultimo_domingo(2026, 3), 29)
        self.assertEqual(rewind._ultimo_domingo(2026, 10), 25)

    def test_coincide_con_zoneinfo_cuando_esta_disponible(self):
        try:
            from zoneinfo import ZoneInfo

            oficial = ZoneInfo("Europe/Madrid")
        except Exception:
            self.skipTest("sin base de datos IANA en esta máquina")
        cet = rewind._MadridCET()
        instantes = (
            datetime(2026, 1, 15, 8, 0), datetime(2026, 3, 29, 0, 30), datetime(2026, 3, 29, 1, 30),
            datetime(2026, 6, 1, 12, 0), datetime(2026, 10, 25, 1, 30), datetime(2026, 12, 31, 23, 59),
        )
        for utc in instantes:
            with self.subTest(utc=utc):
                marca = utc.replace(tzinfo=timezone.utc)
                con_oficial = marca.astimezone(oficial)
                con_respaldo = marca.astimezone(cet)
                self.assertEqual(con_oficial.utcoffset(), con_respaldo.utcoffset())
                self.assertEqual(con_oficial.replace(tzinfo=None), con_respaldo.replace(tzinfo=None))

    def test_iso_local_con_el_respaldo_sin_base_de_datos(self):
        try:
            from zoneinfo import ZoneInfo

            oficial = ZoneInfo("Europe/Madrid")
        except Exception:
            self.skipTest("sin base de datos IANA en esta máquina")
        original = rewind.zona_madrid
        rewind.zona_madrid = rewind._MadridCET
        try:
            for utc in (
                datetime(2026, 1, 15, 12, 0), datetime(2026, 3, 29, 1, 30),
                datetime(2026, 7, 15, 20, 54), datetime(2026, 10, 25, 1, 30),
            ):
                with self.subTest(utc=utc):
                    marca = utc.replace(tzinfo=timezone.utc)
                    esperado = marca.astimezone(oficial).isoformat(timespec="seconds")
                    self.assertEqual(rewind.iso_local(marca), esperado)
        finally:
            rewind.zona_madrid = original

    def test_iso_local_y_texto(self):
        momento = datetime(2026, 9, 29, 21, 54, tzinfo=timezone.utc)
        self.assertEqual(rewind.iso_local(momento), "2026-09-29T23:54:00+02:00")
        self.assertEqual(rewind.texto_local(momento), "2026-09-29 23:54")
        invierno = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
        self.assertEqual(rewind.iso_local(invierno), "2026-01-15T13:00:00+01:00")

    def test_horas_de_luz(self):
        momento = datetime(2026, 9, 29, 8, 0)
        self.assertTrue(rewind.ahora_madrid_horas_validas(momento))
        self.assertTrue(rewind.ahora_madrid_horas_validas(momento.replace(hour=20)))
        self.assertFalse(rewind.ahora_madrid_horas_validas(momento.replace(hour=7)))
        self.assertFalse(rewind.ahora_madrid_horas_validas(momento.replace(hour=21)))


class TestNombresYUrls(unittest.TestCase):
    def setUp(self):
        self.momento = rewind.ahora_madrid()

    def test_nombre_de_clip_sin_acentos(self):
        nombre = rewind.etiqueta_clip("Planetario", self.momento)
        self.assertRegex(nombre, r"^rewind_Planetario_\d{8}-\d{4}\.mp4$")
        self.assertTrue(nombre.isascii())

    def test_tag_de_release_mensual(self):
        self.assertEqual(rewind.etiqueta_release(datetime(2026, 9, 1, 12, 0)), "rewinds-2026-09")
        self.assertEqual(rewind.etiqueta_release(datetime(2026, 12, 31, 12, 0)), "rewinds-2026-12")

    def test_url_de_descarga(self):
        url = rewind.url_descarga("Joorcs96/MeteoSurf_Cs", "rewinds-2026-09", "rewind_Gurugu_20260929-2354.mp4")
        self.assertEqual(
            url,
            "https://github.com/Joorcs96/MeteoSurf_Cs/releases/download/rewinds-2026-09/"
            "rewind_Gurugu_20260929-2354.mp4",
        )


class TestRosaDeVientos(unittest.TestCase):
    def test_las_dieciseis_ruedas(self):
        esperado = {
            0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SO", 270: "O", 315: "NO",
            23: "NNE", 68: "ENE", 112: "ESE", 157: "SSE", 202: "SSO", 248: "OSO", 293: "ONO", 338: "NNO",
        }
        for grados, texto in esperado.items():
            self.assertEqual(rewind.rosa(grados), texto, msg=str(grados))

    def test_redondeo_y_nulos(self):
        self.assertEqual(rewind.rosa(359.9), "N")
        self.assertEqual(rewind.rosa(360), "N")
        self.assertIsNone(rewind.rosa(None))


class TestIndice(unittest.TestCase):
    def _entrada(self, spot, hora_iso, archivo="a.mp4"):
        return {
            "id": f"{spot}-{archivo}",
            "spot": spot,
            "camara": "cv_grao_castellon",
            "hora": hora_iso,
            "url": f"https://example.invalid/{archivo}",
            "archivo": archivo,
            "prevision": {"altura": 0.8, "periodo": 5.5, "direccion": 68, "viento": 10},
        }

    def test_indice_vacio_tiene_la_forma_acordada(self):
        indice = rewind.indice_vacio()
        self.assertEqual(indice["rewinds"], [])
        self.assertEqual(indice["timezone"], "Europe/Madrid")
        self.assertEqual(indice["dias"], 30)
        self.assertIsNone(indice["updatedAt"])

    def test_poda_por_antiguedad(self):
        ahora = rewind.ahora_utc()
        indice = {"rewinds": [
            self._entrada("Planetario", (ahora - timedelta(days=2)).isoformat(), "nuevo.mp4"),
            self._entrada("Planetario", (ahora - timedelta(days=29)).isoformat(), "justo.mp4"),
            self._entrada("Voramar", (ahora - timedelta(days=31)).isoformat(), "viejo.mp4"),
        ]}
        dentro, fuera = rewind.podar_indice(indice, 30)
        self.assertEqual([e["archivo"] for e in dentro], ["nuevo.mp4", "justo.mp4"])
        self.assertEqual([e["archivo"] for e in fuera], ["viejo.mp4"])

    def test_guardar_ordena_y_acepta_indice_plano(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = Path(tmp) / "rewinds.json"
            indice = {"rewinds": [
                self._entrada("Planetario", "2026-09-20T10:00:00+02:00", "b.mp4"),
                self._entrada("Planetario", "2026-09-29T10:00:00+02:00", "a.mp4"),
            ]}
            rewind.guardar_indice(indice, ruta)
            leido = json.loads(ruta.read_text(encoding="utf-8"))
            self.assertEqual([e["archivo"] for e in leido["rewinds"]], ["a.mp4", "b.mp4"])

            plano = Path(tmp) / "plano.json"
            plano.write_text(json.dumps([self._entrada("Voramar", "2026-09-29T10:00:00+02:00")]),
                             encoding="utf-8")
            self.assertEqual(len(rewind.cargar_indice(plano)["rewinds"]), 1)

            roto = Path(tmp) / "roto.json"
            roto.write_text("{no es json", encoding="utf-8")
            self.assertEqual(rewind.cargar_indice(roto)["rewinds"], [])

    def test_guardar_deduplica_el_mismo_clip(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = Path(tmp) / "rewinds.json"
            indice = {"rewinds": [
                self._entrada("Planetario", "2026-09-29T10:00:00+02:00", "a.mp4"),
                self._entrada("Gurugu", "2026-09-29T10:00:00+02:00", "a.mp4"),  # otro spot, mismo clip
                self._entrada("Planetario", "2026-09-29T09:00:00+02:00", "a.mp4"),  # repetida
            ]}
            rewind.guardar_indice(indice, ruta)
            leido = json.loads(ruta.read_text(encoding="utf-8"))
            self.assertEqual([e["spot"] for e in leido["rewinds"]], ["Planetario", "Gurugu"])

    def test_entrada_de_indice_lleva_todo_lo_pedido(self):
        spot = rewind.leer_spots()["Planetario"]
        cam = {"id": "cv_grao_castellon", "name": "El Grao", "short": "El Grao CV",
               "credit": "Turisme Comunitat Valenciana"}
        prevision = {"altura": 0.8, "periodo": 5.5, "direccion": 68, "direccionTxt": "ENE", "viento": 12}
        info = {"duracion": 20.0, "bytes": 431392, "ancho": 854, "alto": 480}
        momento = datetime(2026, 9, 29, 21, 54, tzinfo=timezone.utc)
        entrada = rewind.entrada_indice(
            spot, cam, prevision, info, momento, "rewind_Planetario_20260929-2354.mp4",
            "rewinds-2026-09",
            "https://github.com/Joorcs96/MeteoSurf_Cs/releases/download/rewinds-2026-09/x.mp4",
        )
        for clave in ("spot", "camara", "hora", "url", "prevision"):
            self.assertIn(clave, entrada)
        self.assertEqual(entrada["spot"], "Planetario")
        self.assertEqual(entrada["hora"], "2026-09-29T23:54:00+02:00")
        self.assertEqual(entrada["horaLocal"], "2026-09-29 23:54")
        self.assertEqual(entrada["prevision"], prevision)
        self.assertEqual(entrada["credito"], "Turisme Comunitat Valenciana")


class TestUmbral(unittest.TestCase):
    def test_umbral_de_oleaje(self):
        self.assertTrue(rewind.supera_umbral({"altura": 0.5}, 0.5))
        self.assertTrue(rewind.supera_umbral({"altura": 1.2}, 0.5))
        self.assertFalse(rewind.supera_umbral({"altura": 0.49}, 0.5))
        self.assertFalse(rewind.supera_umbral({"altura": None}, 0.5))
        self.assertFalse(rewind.supera_umbral({}, 0.5))


class TestAyudas(unittest.TestCase):
    def test_url_absoluta(self):
        base = "https://streaming.comunitatvalenciana.com/webcam/GraodeCastellon/"
        self.assertEqual(
            rewind.url_absoluta(base, "media_w1_1805.ts"),
            base + "media_w1_1805.ts",
        )
        self.assertEqual(
            rewind.url_absoluta(base, "/webcam/otro/playlist.m3u8"),
            "https://streaming.comunitatvalenciana.com/webcam/otro/playlist.m3u8",
        )
        self.assertEqual(
            rewind.url_absoluta(base, "https://otro.example/x.m3u8"),
            "https://otro.example/x.m3u8",
        )

    def test_playlist_y_segmentos_con_playlist_falsa(self):
        maestro = "https://ejemplo.invalid/webcam/X/playlist.m3u8"
        prefijo = maestro.rsplit("/", 1)[0] + "/"
        variantes = {
            maestro: "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=6000000,RESOLUTION=2560x1440\nchunklist_a.m3u8\n"
                     "#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=640x360\nchunklist_b.m3u8\n",
            prefijo + "chunklist_b.m3u8":
                "#EXTM3U\n#EXT-X-TARGETDURATION:11\n"
                "#EXTINF:10.0,\nmedia_b_1.ts\n#EXTINF:10.0,\nmedia_b_2.ts\n#EXTINF:9.9,\nmedia_b_3.ts\n",
        }
        original = rewind._texto
        rewind._texto = lambda url: variantes[url]
        try:
            self.assertEqual(
                rewind.sub_playlist(maestro),
                prefijo + "chunklist_b.m3u8",  # la variante de menos ancho de banda
            )
            # Con material de sobra, coge los segmentos más recientes a partir de 24 s (20 * 1,2).
            self.assertEqual(
                rewind.segmentos_recientes(maestro, 20),
                [prefijo + "media_b_1.ts", prefijo + "media_b_2.ts", prefijo + "media_b_3.ts"],
            )
            # Con 10 s solo necesita los dos últimos (19,9 s >= 12 s).
            self.assertEqual(
                rewind.segmentos_recientes(maestro, 10),
                [prefijo + "media_b_2.ts", prefijo + "media_b_3.ts"],
            )
            # Si no hay material suficiente, se lo lleva todo antes que inventarse nada.
            self.assertEqual(len(rewind.segmentos_recientes(maestro, 40)), 3)
            self.assertEqual(rewind.segmentos_recientes(maestro, 40)[-1], prefijo + "media_b_3.ts")
        finally:
            rewind._texto = original

    def test_playlist_sin_variantes_se_usa_la_misma(self):
        maestro = "https://ejemplo.invalid/webcam/X/playlist.m3u8"
        original = rewind._texto
        rewind._texto = lambda url: "#EXTM3U\n#EXT-X-TARGETDURATION:10\n"
        try:
            self.assertEqual(rewind.sub_playlist(maestro), maestro)
        finally:
            rewind._texto = original

    def test_ficha_json_se_escribe_en_utf8(self):
        with tempfile.TemporaryDirectory() as tmp:
            clip = Path(tmp) / "rewind_Planetario_20260929-2354.mp4"
            clip.write_bytes(b"x")
            ficha = rewind.guardar_ficha(clip, {"prevision": {"Gurugu": {"altura": 0.7}},
                                                "camara": {"nombre": "El Grao de Castellón"}})
            self.assertEqual(ficha.name, "rewind_Planetario_20260929-2354.json")
            texto = ficha.read_text(encoding="utf-8")
            self.assertIn("Castellón", texto)
            self.assertEqual(json.loads(texto)["prevision"]["Gurugu"]["altura"], 0.7)

    def test_comprobar_clip_detecta_problemas(self):
        bien = {"codec": "h264", "audio": False, "alto": 480, "duracion": 20.0, "bytes": 400000}
        self.assertIsNone(rewind.comprobar_clip(bien, 20))
        self.assertIn("audio", rewind.comprobar_clip(dict(bien, audio=True), 20))
        self.assertIn("h264", rewind.comprobar_clip(dict(bien, codec="vp9"), 20))
        self.assertIn("720", rewind.comprobar_clip(dict(bien, alto=1080), 20))
        self.assertIn("s de 20", rewind.comprobar_clip(dict(bien, duracion=12.0), 20))


class TestDescarga(unittest.TestCase):
    """`descargar_bruto`: ffmpeg primero, respaldo con segmentos y reintentos."""

    def setUp(self):
        self.original = {
            "grabar_directo": rewind.grabar_directo,
            "segmentos_recientes": rewind.segmentos_recientes,
            "descargar_segmentos": rewind.descargar_segmentos,
            "sleep": rewind.time.sleep,
        }
        self.espera = []
        rewind.time.sleep = self.espera.append

    def tearDown(self):
        rewind.grabar_directo = self.original["grabar_directo"]
        rewind.segmentos_recientes = self.original["segmentos_recientes"]
        rewind.descargar_segmentos = self.original["descargar_segmentos"]
        rewind.time.sleep = self.original["sleep"]

    def test_usa_ffmpeg_cuando_puede(self):
        llamadas = []

        def directo(url, salida, duracion):
            llamadas.append("ffmpeg")
            salida.write_bytes(b"x" * 200_000)
            return True

        rewind.grabar_directo = directo
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / "clip.grab.ts"
            rewind.descargar_bruto("https://x/playlist.m3u8", destino, 20)
            self.assertEqual(llamadas, ["ffmpeg"])
            self.assertEqual(self.espera, [])

    def test_respaldo_con_segmentos(self):
        rewind.grabar_directo = lambda url, salida, duracion: False
        rewind.segmentos_recientes = lambda url, duracion: ["https://x/a.ts", "https://x/b.ts"]
        descargados = {}

        def manual(urls, destino):
            descargados["urls"] = list(urls)
            destino.write_bytes(b"y" * 200_000)
            return 200_000

        rewind.descargar_segmentos = manual
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / "clip.grab.ts"
            rewind.descargar_bruto("https://x/playlist.m3u8", destino, 20)
            self.assertEqual(descargados["urls"], ["https://x/a.ts", "https://x/b.ts"])
            self.assertEqual(self.espera, [])

    def test_reintenta_antes_de_rendirse(self):
        intentos = {"n": 0}

        def directo(url, salida, duracion):
            intentos["n"] += 1
            if intentos["n"] < 2:  # el canal está re-publicándose un momento
                return False
            salida.write_bytes(b"z" * 200_000)
            return True

        rewind.grabar_directo = directo
        rewind.segmentos_recientes = lambda url, duracion: []
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / "clip.grab.ts"
            rewind.descargar_bruto("https://x/playlist.m3u8", destino, 20)
        self.assertEqual(intentos["n"], 2)
        self.assertEqual(self.espera, [5])

    def test_sale_con_error_si_no_hay_forma(self):
        intentos = {"n": 0}

        def directo(url, salida, duracion):
            intentos["n"] += 1
            return False

        rewind.grabar_directo = directo
        rewind.segmentos_recientes = lambda url, duracion: []

        def manual(urls, destino):
            destino.write_bytes(b"")  # segmentos vacíos
            return 0

        rewind.descargar_segmentos = manual
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / "clip.grab.ts"
            with self.assertRaises(Exception):
                rewind.descargar_bruto("https://x/playlist.m3u8", destino, 20)
        self.assertEqual(intentos["n"], 3)
        self.assertEqual(self.espera, [5, 12])

    def test_descargar_segmentos_concatena_en_orden(self):
        original = rewind.urllib.request.urlopen
        pedidos = []

        class Falso:
            def __init__(self, datos):
                self.datos = datos

            def read(self):
                return self.datos

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        def urlopen(req, timeout=None):
            pedidos.append(req.full_url)
            return Falso(f"contenido-{req.full_url}".encode("utf-8"))

        rewind.urllib.request.urlopen = urlopen
        try:
            with tempfile.TemporaryDirectory() as tmp:
                destino = Path(tmp) / "clip.ts"
                total = rewind.descargar_segmentos(["https://x/a.ts", "https://x/b.ts"], destino)
                self.assertEqual(total, len(destino.read_bytes()))
                self.assertEqual(pedidos, ["https://x/a.ts", "https://x/b.ts"])
                self.assertEqual(
                    destino.read_bytes(),
                    b"contenido-https://x/a.tscontenido-https://x/b.ts",
                )
        finally:
            rewind.urllib.request.urlopen = original


class TestReleases(unittest.TestCase):
    """Subida a la release del mes y borrado de lo que pasa de los 30 días."""

    def setUp(self):
        self.llamadas = []
        self.original = rewind.gh

    def tearDown(self):
        rewind.gh = self.original

    def _gh_falso(self, respuestas=None):
        def falso(args, check=True):
            self.llamadas.append(list(args))
            for clave in (" ".join(args[:2]), args[0]):
                if respuestas and clave in respuestas:
                    valor = respuestas[clave]
                    if isinstance(valor, Exception):
                        raise valor
                    return valor
            return ""
        rewind.gh = falso

    def test_asegurar_release_crea_la_que_falta(self):
        self._gh_falso({"release view": RuntimeError("no existe")})
        rewind.asegurar_release("Joorcs96/MeteoSurf_Cs", "rewinds-2026-09")
        comandos = [" ".join(c[:2]) for c in self.llamadas]
        self.assertEqual(comandos, ["release view", "release create"])
        self.assertIn("rewinds-2026-09", self.llamadas[1])
        self.assertIn("Turisme Comunitat Valenciana", self.llamadas[1][-1])

    def test_asegurar_release_no_recrea_la_existente(self):
        self._gh_falso({"release view": '{"tagName": "rewinds-2026-09"}'})
        rewind.asegurar_release("Joorcs96/MeteoSurf_Cs", "rewinds-2026-09")
        self.assertEqual([" ".join(c[:2]) for c in self.llamadas], ["release view"])

    def test_subir_clip_dry_run_no_toca_github(self):
        self._gh_falso({})
        with tempfile.TemporaryDirectory() as tmp:
            clip = Path(tmp) / "rewind_Planetario_20260929-2354.mp4"
            clip.write_bytes(b"x")
            self.assertTrue(rewind.subir_clip(clip, "Joorcs96/MeteoSurf_Cs", "rewinds-2026-09", True))
        self.assertEqual(self.llamadas, [])

    def _release(self, tag, activos, viejos):
        return {
            "tag_name": tag,
            "assets": [
                {"name": nombre, "created_at": momento.isoformat().replace("+00:00", "Z")}
                for nombre, momento in activos
            ] + [
                {"name": nombre, "created_at": momento.isoformat().replace("+00:00", "Z")}
                for nombre, momento in viejos
            ],
        }

    def test_borrado_de_assets_viejos(self):
        ahora = rewind.ahora_utc()
        payload = json.dumps([
            self._release(
                "rewinds-2026-09",
                [("recien.mp4", ahora - timedelta(days=2))],
                [("viejo.mp4", ahora - timedelta(days=31)), ("mas_viejo.mp4", ahora - timedelta(days=40))],
            ),
            self._release("rewinds-2026-07", [], [("todo_viejo.mp4", ahora - timedelta(days=45))]),
            self._release("v1.0.0", [], []),  # no es nuestra: ni se toca
        ])
        self._gh_falso({"api": payload})
        borrados = rewind.borrar_assets_viejos("Joorcs96/MeteoSurf_Cs", 30)
        self.assertEqual(sorted(borrados), [
            "rewinds-2026-07/todo_viejo.mp4",
            "rewinds-2026-09/mas_viejo.mp4",
            "rewinds-2026-09/viejo.mp4",
        ])
        llamadas = [" ".join(c) for c in self.llamadas]
        # La release que se queda vacía también se borra; las de otros tags no se tocan.
        self.assertIn("release delete rewinds-2026-07 --repo Joorcs96/MeteoSurf_Cs --yes --cleanup-tag",
                      llamadas)
        self.assertFalse([c for c in llamadas if c.startswith("release delete rewinds-2026-09")])
        self.assertFalse([c for c in llamadas if "v1.0.0" in c])

    def test_no_borra_nada_si_todo_es_reciente(self):
        ahora = rewind.ahora_utc()
        payload = json.dumps([
            self._release("rewinds-2026-10", [("a.mp4", ahora - timedelta(days=1)),
                                              ("b.mp4", ahora - timedelta(days=29))], []),
        ])
        self._gh_falso({"api": payload})
        self.assertEqual(rewind.borrar_assets_viejos("Joorcs96/MeteoSurf_Cs", 30), [])
        self.assertEqual([c for c in self.llamadas if c[0] == "release"], [])

    def test_borrado_en_dry_run_no_llama_a_github(self):
        ahora = rewind.ahora_utc()
        payload = json.dumps([
            self._release("rewinds-2026-08", [], [("viejo.mp4", ahora - timedelta(days=60))]),
        ])
        self._gh_falso({"api": payload})
        borrados = rewind.borrar_assets_viejos("Joorcs96/MeteoSurf_Cs", 30, dry_run=True)
        self.assertEqual(borrados, ["rewinds-2026-08/viejo.mp4"])
        self.assertEqual([c for c in self.llamadas if c[0] == "release"], [])


class TestMain(unittest.TestCase):
    """El guion completo: gate de horas, gate de oleaje y montaje del índice.

    Se sustituyen la hora, la previsión y la grabación; ni red ni ffmpeg.
    """

    MEDIODIA = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)  # 14:00 de Madrid
    NOCHE = datetime(2026, 9, 29, 3, 0, tzinfo=timezone.utc)  # 05:00 de Madrid

    def setUp(self):
        self.original = {
            "ahora_madrid": rewind.ahora_madrid,
            "prevision_spots": rewind.prevision_spots,
            "grabar_camara": rewind.grabar_camara,
        }
        self.grabadas = []

    def tearDown(self):
        rewind.ahora_madrid = self.original["ahora_madrid"]
        rewind.prevision_spots = self.original["prevision_spots"]
        rewind.grabar_camara = self.original["grabar_camara"]

    def _prevision(self, altura):
        def prevision_spots(ids, spots):
            return {
                sid: {"altura": altura, "periodo": 5.4, "direccion": 90, "direccionTxt": "E",
                      "viento": 8.0, "vientoDireccionTxt": "O"}
                for sid in dict.fromkeys(ids)
            }
        return prevision_spots

    def _grabacion_falsa(self, salida):
        def grabar_camara(cam, spots, prevision, args, momento):
            self.grabadas.append(cam["id"])
            clip = Path(args.salida) / f"rewind_{cam['spotsCubiertos'][0]}_x.mp4"
            clip.parent.mkdir(parents=True, exist_ok=True)
            clip.write_bytes(b"x" * 1000)
            info = {"duracion": 20.0, "bytes": 1000, "ancho": 854, "alto": 480}
            archivo = clip.name
            tag = rewind.etiqueta_release(momento)
            entradas = [
                rewind.entrada_indice(spots[sid], cam, prevision[sid], info, momento, archivo,
                                      tag, rewind.url_descarga("Joorcs96/MeteoSurf_Cs", tag, archivo))
                for sid in cam["spotsCubiertos"] if sid in prevision
            ]
            return clip, entradas
        return grabar_camara

    def _args(self, tmp, extra=()):
        return ["--salida", str(Path(tmp) / "clips"), "--indice", str(Path(tmp) / "rewinds.json"),
                *extra]

    def test_no_graba_de_nicho(self):
        with tempfile.TemporaryDirectory() as tmp:
            rewind.ahora_madrid = lambda: self.NOCHE.astimezone(rewind.zona_madrid())
            rewind.grabar_camara = self._grabacion_falsa(tmp)
            self.assertEqual(rewind.main(self._args(tmp)), 0)
            self.assertEqual(self.grabadas, [])
            self.assertFalse(Path(tmp, "rewinds.json").exists())

    def test_no_graba_sin_oleaje(self):
        with tempfile.TemporaryDirectory() as tmp:
            rewind.ahora_madrid = lambda: self.MEDIODIA.astimezone(rewind.zona_madrid())
            rewind.prevision_spots = self._prevision(0.3)
            rewind.grabar_camara = self._grabacion_falsa(tmp)
            self.assertEqual(rewind.main(self._args(tmp)), 0)
            self.assertEqual(self.grabadas, [])

    def test_graba_las_tres_camaras_y_monta_el_indice(self):
        with tempfile.TemporaryDirectory() as tmp:
            rewind.ahora_madrid = lambda: self.MEDIODIA.astimezone(rewind.zona_madrid())
            rewind.prevision_spots = self._prevision(0.8)
            rewind.grabar_camara = self._grabacion_falsa(tmp)
            self.assertEqual(rewind.main(self._args(tmp)), 0)
            self.assertEqual(len(self.grabadas), 3)
            indice = json.loads(Path(tmp, "rewinds.json").read_text(encoding="utf-8"))
            self.assertEqual(len(indice["rewinds"]), 6)  # 2 spots por cámara
            self.assertEqual(indice["timezone"], "Europe/Madrid")
            self.assertEqual(indice["updatedAt"], "2026-09-29T14:00:00+02:00")
            self.assertEqual(indice["dias"], 30)
            for entrada in indice["rewinds"]:
                self.assertEqual(entrada["release"], "rewinds-2026-09")
                self.assertIn("rewinds-2026-09", entrada["url"])
                self.assertEqual(entrada["prevision"]["altura"], 0.8)
                self.assertEqual(entrada["hora"], "2026-09-29T14:00:00+02:00")

    def test_filtro_de_camaras(self):
        with tempfile.TemporaryDirectory() as tmp:
            rewind.ahora_madrid = lambda: self.MEDIODIA.astimezone(rewind.zona_madrid())
            rewind.prevision_spots = self._prevision(0.8)
            rewind.grabar_camara = self._grabacion_falsa(tmp)
            self.assertEqual(rewind.main(self._args(tmp, ["--cameras", "cv-oropesa-hls"])), 0)
            self.assertEqual(self.grabadas, ["cv-oropesa-hls"])


class TestConsolaConTildes(unittest.TestCase):
    def test_el_script_arranca_y_saca_ayuda(self):
        raiz = Path(__file__).resolve().parent.parent
        env = dict(os.environ, PYTHONIOENCODING="utf-8")
        proc = subprocess.run(
            [sys.executable, str(raiz / "scripts" / "rewind.py"), "--help"],
            capture_output=True, text=True, encoding="utf-8", env=env, timeout=120,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("data/rewinds.json", proc.stdout)

    def test_no_toca_los_archivos_del_frontend(self):
        raiz = Path(__file__).resolve().parent.parent
        fuente = (raiz / "scripts" / "rewind.py").read_text(encoding="utf-8")
        for prohibido in ("js/app.js", "css/app.css", "index.html", "js/spots.js"):
            self.assertNotIn(f'"{prohibido}"', fuente, msg=prohibido)


if __name__ == "__main__":
    unittest.main()
