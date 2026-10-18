"""Pruebas unitarias para scripts/vigilante.py (100% sin red, sin ffmpeg obligatorio).

Verifica la lógica completa del vigilante:
- Franja horaria diurna de Madrid (08:00 a 20:00).
- Detector cinemático y filtros de falsos positivos (boyas, nadadores, surfistas en espera).
- Detección de ola positiva con trayectoria direccional.
- Puntuación de clips (tiempo de pie, avance, tamaño de ola, nitidez, previsión).
- Buffer circular de fotogramas (-10 s pre-evento y +20 s post-evento).
- Renderizado de HUD y desenfoque para privacidad de caras.
- Selección de los 3-5 mejores clips por cámara.
- Actualización y poda del índice data/rewinds.json.
- Manejo del estado 404 de cv-benicassim-vela-hls y resolución de IPCamLive.
- Ejecución completa en modo prueba con fotogramas sintéticos.

Uso:
    python -m unittest scripts.test_vigilante
"""

import io
import json
import math
import os
import shutil
import tempfile
import unittest
import unittest.mock
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image

from scripts import vigilante


class TestZonaHorariaYFranja(unittest.TestCase):
    def test_madrid_cet_verano_e_invierno(self):
        tz = vigilante.zona_madrid()
        invierno = datetime(2026, 1, 15, 12, 0, tzinfo=tz)
        verano = datetime(2026, 7, 15, 12, 0, tzinfo=tz)
        self.assertEqual(invierno.utcoffset(), timedelta(hours=1))
        self.assertEqual(verano.utcoffset(), timedelta(hours=2))

    def test_franja_diurna(self):
        tz = vigilante.zona_madrid()
        self.assertTrue(vigilante.esta_en_franja_diurna(datetime(2026, 10, 18, 8, 0, tzinfo=tz)))
        self.assertTrue(vigilante.esta_en_franja_diurna(datetime(2026, 10, 18, 14, 30, tzinfo=tz)))
        self.assertTrue(vigilante.esta_en_franja_diurna(datetime(2026, 10, 18, 19, 59, tzinfo=tz)))

        # Noche y límites
        self.assertFalse(vigilante.esta_en_franja_diurna(datetime(2026, 10, 18, 5, 0, tzinfo=tz)))
        self.assertFalse(vigilante.esta_en_franja_diurna(datetime(2026, 10, 18, 20, 0, tzinfo=tz)))
        self.assertFalse(vigilante.esta_en_franja_diurna(datetime(2026, 10, 18, 22, 15, tzinfo=tz)))


class TestDetectorCinematicoVigilante(unittest.TestCase):
    def setUp(self):
        self.detector = vigilante.DetectorSurfCinematicoVigilante(fps=0.4, escala_px_m=15.0)

    def test_filtro_descartado_muy_corto(self):
        track = [{"t": 0.0, "x": 100.0, "y": 100.0}, {"t": 2.5, "x": 110.0, "y": 105.0}]
        res = self.detector.clasificar_trayectoria(track)
        self.assertFalse(res["es_posible_ola"])
        self.assertEqual(res["tipo"], "descartado_corto")

    def test_filtro_boya_oscilante(self):
        # Oscilación periódica en torno al mismo punto
        track = [
            {"t": i * 2.5, "x": 100.0 + 3.0 * math.sin(i * 1.5), "y": 100.0 + 3.0 * math.cos(i * 1.5)}
            for i in range(6)
        ]
        res = self.detector.clasificar_trayectoria(track)
        self.assertFalse(res["es_posible_ola"])
        self.assertEqual(res["tipo"], "boya")

    def test_filtro_nadador_lento(self):
        # Desplazamiento lento
        track = [{"t": i * 2.5, "x": 100.0 + i * 5.0, "y": 150.0} for i in range(6)]
        res = self.detector.clasificar_trayectoria(track)
        self.assertFalse(res["es_posible_ola"])
        self.assertIn(res["tipo"], ("nadador", "banista", "surfista_espera"))

    def test_filtro_surfista_espera(self):
        # Apenas se desplaza (< 5 m netos a velocidad < 3 km/h)
        track = [{"t": i * 2.5, "x": 200.0 + (i % 2) * 2.0, "y": 120.0 + i * 1.0} for i in range(5)]
        res = self.detector.clasificar_trayectoria(track)
        self.assertFalse(res["es_posible_ola"])
        self.assertIn(res["tipo"], ("surfista_espera", "boya", "nadador"))

    def test_deteccion_ola_positiva(self):
        # Trayectoria rápida y direccional (ola cabalgada)
        # Avance neto de 300 px (20 m) en 5s -> 4 m/s -> 14.4 km/h
        track = [
            {"t": 0.0, "x": 100.0, "y": 100.0},
            {"t": 2.5, "x": 250.0, "y": 105.0},
            {"t": 5.0, "x": 400.0, "y": 110.0},
        ]
        res = self.detector.clasificar_trayectoria(track)
        self.assertTrue(res["es_posible_ola"])
        self.assertEqual(res["tipo"], "posible_ola")
        self.assertGreaterEqual(res["confianza"], 0.70)


class TestPuntuacionClips(unittest.TestCase):
    def test_puntuacion_rango_y_desglose(self):
        res = vigilante.puntuar_clip(
            tiempo_de_pie_s=12.0,
            avance_m=35.0,
            tamano_ola_m=1.0,
            nitidez=8.0,
            prevision={"altura": 0.9, "periodo": 8.0, "viento": 10.0},
        )
        self.assertIn("nota", res)
        self.assertGreaterEqual(res["nota"], 1.0)
        self.assertLessEqual(res["nota"], 10.0)
        self.assertIn("desglose", res)
        self.assertIn("metricas", res)
        self.assertEqual(res["metricas"]["tiempoDePieS"], 12.0)
        self.assertEqual(res["metricas"]["avanceM"], 35.0)

    def test_ola_excelente_puntua_mas_que_ola_pobre(self):
        buena = vigilante.puntuar_clip(15.0, 40.0, 1.2, 9.0, {"altura": 1.1, "periodo": 8.0, "viento": 8.0})
        pobre = vigilante.puntuar_clip(2.0, 5.0, 0.3, 4.0, {"altura": 0.2, "periodo": 4.0, "viento": 25.0})
        self.assertGreater(buena["nota"], pobre["nota"])
        self.assertGreaterEqual(buena["nota"], 7.5)


class TestFotogramaBuffer(unittest.TestCase):
    def test_buffer_captura_pre_y_post_evento(self):
        buf = vigilante.FotogramaBuffer(capacidad_pre=3, capacidad_post=4)

        for i in range(5):
            res = buf.anadir_fotograma({"idx": i, "t": i * 2.5})
            self.assertIsNone(res)

        buf.disparar_evento(metadata={"evento": "ola_detectada"})
        self.assertTrue(buf.grabacion_activa)

        clip_listo = None
        for i in range(5, 10):
            res = buf.anadir_fotograma({"idx": i, "t": i * 2.5})
            if res:
                clip_listo = res
                break

        self.assertIsNotNone(clip_listo)
        self.assertEqual(len(clip_listo["fotogramas"]), 7)
        self.assertFalse(buf.grabacion_activa)


class TestHUDYPrivacidad(unittest.TestCase):
    def setUp(self):
        img = Image.new("RGB", (640, 360), color=(50, 100, 180))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        self.img_bytes = buf.getvalue()

    def test_renderizado_hud_con_recuadro_y_estela(self):
        track = [{"t": 0.0, "x": 100.0, "y": 150.0}, {"t": 2.5, "x": 150.0, "y": 160.0}]
        hud_bytes = vigilante.renderizar_hud_y_privacidad(
            img_bytes=self.img_bytes,
            spot_nombre="Planetario",
            momento_local=datetime(2026, 10, 18, 16, 30, tzinfo=vigilante.zona_madrid()),
            bbox_surfista=(120, 140, 40, 50),
            track=track,
            puntuacion={"nota": 8.5},
            desenfoque_caras=True,
        )
        self.assertIsInstance(hud_bytes, bytes)
        self.assertGreater(len(hud_bytes), 1000)

        res_img = Image.open(io.BytesIO(hud_bytes))
        self.assertEqual(res_img.size, (640, 360))


class TestSeleccionYActualizacionIndice(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.json_path = Path(self.temp_dir) / "rewinds.json"

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_seleccion_top_clips(self):
        candidatos = [
            {"camara_id": "camA", "puntuacion": {"nota": 5.0}},
            {"camara_id": "camA", "puntuacion": {"nota": 8.0}},
            {"camara_id": "camA", "puntuacion": {"nota": 9.5}},
            {"camara_id": "camA", "puntuacion": {"nota": 6.2}},
            {"camara_id": "camA", "puntuacion": {"nota": 7.1}},
            {"camara_id": "camA", "puntuacion": {"nota": 9.1}},
            {"camara_id": "camB", "puntuacion": {"nota": 8.8}},
        ]
        mejores = vigilante.seleccionar_mejores_clips(candidatos, min_clips=3, max_clips=4)
        notas_camA = [c["puntuacion"]["nota"] for c in mejores if c["camara_id"] == "camA"]
        self.assertEqual(len(notas_camA), 4)
        self.assertEqual(notas_camA, [9.5, 9.1, 8.0, 7.1])

    def test_actualizar_indice_y_poda(self):
        ahora = datetime.now(timezone.utc)
        entradas = [
            {
                "id": "Planetario-20261018-1200",
                "spot": "Planetario",
                "horaUtc": ahora.isoformat().replace("+00:00", "Z"),
                "hora": ahora.isoformat(),
                "url": "https://example.com/clip1.mp4",
            },
            {
                "id": "Planetario-antiguo",
                "spot": "Planetario",
                "horaUtc": (ahora - timedelta(days=45)).isoformat().replace("+00:00", "Z"),
                "hora": (ahora - timedelta(days=45)).isoformat(),
                "url": "https://example.com/clip_viejo.mp4",
            },
        ]
        agregados = vigilante.actualizar_indice_rewinds(entradas, ruta_indice=self.json_path, max_dias=30)
        self.assertEqual(agregados, 2)

        data = json.loads(self.json_path.read_text(encoding="utf-8"))
        ids = [e["id"] for e in data["rewinds"]]
        self.assertIn("Planetario-20261018-1200", ids)
        self.assertNotIn("Planetario-antiguo", ids)


class TestComprobarCamarasYResolucion(unittest.TestCase):
    def test_cv_vela_404_registrado(self):
        with unittest.mock.patch("urllib.request.urlopen") as mock_url:
            mock_url.side_effect = Exception("HTTP Error 404: Not Found")
            estado = vigilante.comprobar_estado_camara_vela()
            self.assertFalse(estado["activa"])
            self.assertEqual(estado["id"], "cv-benicassim-vela-hls")
            self.assertEqual(estado["status"], 404)

    def test_cv_vela_reactivacion_detectada(self):
        mock_resp = unittest.mock.MagicMock()
        mock_resp.status = 200
        with unittest.mock.patch("urllib.request.urlopen") as mock_url:
            mock_url.return_value.__enter__.return_value = mock_resp
            estado = vigilante.comprobar_estado_camara_vela()
            self.assertTrue(estado["activa"])
            self.assertEqual(estado["status"], 200)

    def test_resolver_ipcamlive_html(self):
        fake_html = """
        var address = 'http://s169.ipcamlive.com/';
        var streamid = 'test_stream_id_123';
        """
        mock_resp = unittest.mock.MagicMock()
        mock_resp.read.return_value = fake_html.encode("utf-8")
        with unittest.mock.patch("urllib.request.urlopen") as mock_url:
            mock_url.return_value.__enter__.return_value = mock_resp
            res = vigilante.resolver_ipcamlive(alias="609a27d8a9c83")
            self.assertIsNotNone(res)
            self.assertEqual(res["streamid"], "test_stream_id_123")
            self.assertEqual(res["hls"], "https://s169.ipcamlive.com/streams/test_stream_id_123/stream.m3u8")
            self.assertEqual(res["snapshot"], "https://s169.ipcamlive.com/streams/test_stream_id_123/snapshot.jpg")


class TestEjecucionVigilanteModoPrueba(unittest.TestCase):
    def setUp(self):
        img = Image.new("RGB", (640, 360), color=(30, 80, 160))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        self.mock_frame = buf.getvalue()

    def test_ejecucion_mock_sin_red(self):
        def fn_descarga_mock(cam_id: str):
            return self.mock_frame

        with unittest.mock.patch("scripts.vigilante.subir_clips_a_release") as mock_subir:
            res = vigilante.ejecutar_vigilante(
                duracion_minutos=1.0,
                modo_prueba=True,
                subir=False,
                fn_descarga=fn_descarga_mock,
            )
            self.assertEqual(res["status"], "completado")
            self.assertGreater(res["clips_detectados"], 0)
            self.assertGreater(res["clips_seleccionados"], 0)


if __name__ == "__main__":
    unittest.main()
