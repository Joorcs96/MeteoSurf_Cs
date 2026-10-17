"""Pruebas E2E de la vigía de ola, con navegador CON VENTANA (Playwright).

Dos pruebas, y las dos necesitan el Chromium de Playwright con ventana:

  * `test_01_deteccion_a_clip`: monta una escena sintética (agua, espuma, boya y
    surfistas que la cruzan) y comprueba la cadena ENTERA: el detector ve
    surfistas, dispara y el clip entregado **se reproduce con su duración
    completa**, incluido el búfer previo. Aquí sí se demuestra que la detección
    dispara, con píxeles reales generados en el momento.

  * `test_02_emision_real_del_club`: repite la grabación sobre la emisión de
    verdad del Club Surfers Castellón. Aquí el disparo es MANUAL y la prueba lo
    dice: no existe ningún clip del club con un surfista confirmado y etiquetado,
    así que lo que se demuestra es que la grabación de la cámara real entrega un
    archivo entero y reproducible, no que el detector acierte con ella.

Uso:
    python scripts/probar_vigia_e2e.py
    python scripts/probar_vigia_e2e.py --solo deteccion
    python scripts/probar_vigia_e2e.py --budget 180000

Requiere Playwright ya instalado (se busca en el perfil de usuario, sin instalar
nada) y que el repositorio esté en un origen http://127.0.0.1, porque WebCodecs
solo existe en contexto seguro.
"""

import argparse
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import unittest

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass


def ruta_playwright():
    """Busca el paquete de Playwright ya instalado, sin instalar nada."""
    candidatas = [
        os.environ.get("PLAYWRIGHT_PATH"),
        os.path.join(os.environ.get("APPDATA", ""), "npm", "node_modules", "playwright"),
        os.path.join(os.path.dirname(RAIZ), "node_modules", "playwright"),
        os.path.join(RAIZ, "node_modules", "playwright"),
    ]
    for c in candidatas:
        if c and os.path.isdir(c):
            return c
    return None


class TestVigiaE2E(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.puerto = 8768
        cls.httpd = socketserver.TCPServer(
            ("127.0.0.1", cls.puerto), lambda *a, **k: Silencioso(*a, directory=RAIZ, **k)
        )
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        time.sleep(0.4)
        cls.pw = ruta_playwright()
        cls.base = f"http://127.0.0.1:{cls.puerto}"
        cls.budget_ms = 150000

    @classmethod
    def tearDownClass(cls):
        try:
            cls.httpd.shutdown()
            cls.httpd.server_close()
        except Exception:
            pass

    def _e2e(self, script, budget=None):
        if not self.pw:
            self.skipTest("No se encuentra Playwright ya instalado; no se instala nada desde la prueba")
        nodo = shutil.which("node")
        if not nodo:
            self.skipTest("No hay Node en el PATH")
        env = dict(os.environ)
        # NODE_PATH apunta al `node_modules` que CONTIENE el paquete, no al paquete.
        env["NODE_PATH"] = os.path.dirname(self.pw)
        salida = os.path.join(tempfile.gettempdir(), f"vigia-e2e-{int(time.time())}.txt")
        proc = subprocess.run(
            [nodo, os.path.join(RAIZ, "tools", script), self.base, salida, str(budget or self.budget_ms)],
            capture_output=True, text=True, timeout=(budget or self.budget_ms) / 1000 + 120,
            env=env, encoding="utf-8", errors="replace",
        )
        if not os.path.exists(salida):
            self.fail(
                "el script de Playwright no dejó registro (código "
                f"{proc.returncode}).\nstdout={proc.stdout[:600]}\nstderr={proc.stderr[:600]}"
            )
        with open(salida, "r", encoding="utf-8") as f:
            log = f.read()
        print("\n" + log.strip()[:1200])
        m = re.search(r"^(RESULTADO|FALLO)\s*(\[.*\])\s*$", log, re.M)
        self.assertIsNotNone(m, f"el script no devolvió resultado\nproc={proc.stdout[:400]}\n{proc.stderr[:400]}")
        self.assertEqual(m.group(1), "RESULTADO", f"la prueba E2E falló: {m.group(2)[:600]}")
        datos = dict(p.split("=", 1) for p in json.loads(m.group(2)) if "=" in p)
        return datos

    # ---------------------------------------------------------------- detección
    def test_01_deteccion_a_clip(self):
        d = self._e2e("pw-vigia-e2e.cjs")
        self.assertEqual(d.get("modo"), "codificado", "El navegador con ventana debe poder usar WebCodecs")
        self.assertEqual(d.get("preparado"), "true")
        self.assertEqual(d.get("disponible"), "true")
        self.assertEqual(d.get("errores"), "ninguno", f"hubo errores de grabación: {d.get('errores')}")
        self.assertGreaterEqual(int(d.get("eventos", "0")), 1, "El detector no disparó ningún clip")
        self.assertEqual(d.get("clipTipoDeteccion"), "coge_ola", d.get("clipTipoDeteccion"))
        self.assertGreater(float(d.get("clipConfianzaDeteccion", "0")), 0.4)
        # El punto crítico: un solo contenedor y la duración COMPLETA.
        self.assertEqual(d.get("clipContenedorUnico"), "true", "el clip se armó concatenando grabaciones")
        self.assertGreater(int(d.get("clipBytes", "0")), 10000, "el clip está vacío")
        self.assertEqual(int(d.get("clipAncho", "0")), 640)
        self.assertEqual(int(d.get("clipAlto", "0")), 360)
        dur = float(d.get("clipDuracionReal", "0"))
        previos = float(d.get("clipSegundosPrevios", "0"))
        self.assertGreater(dur, 1.0, "el clip no se reproduce")
        self.assertGreaterEqual(dur, previos + 1.0, "la duración real no llega a cubrir el búfer previo")
        # Y que no esté negro ni sea un fotograma suelto.
        self.assertGreater(int(d.get("clipGrisMedio", "0")), 10, "el clip sale negro")
        self.assertNotEqual(d.get("clipError"), "", d.get("clipError", ""))

    # ------------------------------------------------------------ cámara real
    def test_02_emision_real_del_club(self):
        # La dirección de la emisión caduca a propósito (`ttlMin`), porque el
        # `streamid` de IPCamLive rota solo. Se resuelve antes de la prueba, que es
        # lo mismo que hace el cron cada 30 minutos; si no, se mediría una
        # dirección caducada en vez de la cámara. Se restaura el fichero al final
        # para no dejar marcas de tiempo de una prueba en el repositorio.
        ruta = os.path.join(RAIZ, "data", "streams.json")
        with open(ruta, "r", encoding="utf-8") as f:
            original = f.read()
        try:
            codigo = (
                "import backend.actualizar_webcams as m; "
                "print('resueltas', m.resolver_streams())"
            )
            proc = subprocess.run([sys.executable, "-c", codigo], cwd=RAIZ, capture_output=True,
                                  text=True, timeout=180, encoding="utf-8", errors="replace")
            with open(ruta, "r", encoding="utf-8") as f:
                datos = json.load(f)
            s = datos.get("streams", {}).get("surfers_castellon_hls", {})
            self.assertTrue(s.get("ok"), f"la emisión del club no se pudo resolver: {s.get('motivo')} / {proc.stdout[-300:]}")
            d = self._e2e("pw-probar-surfers.cjs", budget=180000)
        finally:
            with open(ruta, "w", encoding="utf-8") as f:
                f.write(original)
        self.assertEqual(d.get("estadoStream"), "ok", "la emisión del club no está resuelta")
        self.assertEqual(d.get("playlist"), "ok", "la playlist HLS no responde")
        self.assertEqual(d.get("hls"), "ipcamlive")
        self.assertGreater(int(d.get("ancho", "0")), 0, "el vídeo del club no cargó imagen")
        self.assertGreaterEqual(int(d.get("listo", "0")), 2, "el vídeo no tiene datos suficientes")
        self.assertEqual(d.get("preparado"), "true", f"la vigía no se armó: {d.get('motivo')}")
        # Búfer previo REAL de la cámara: trozos codificados, no cero.
        self.assertGreater(int(d.get("bucleTrozos", "0")), 10, "no se grabó búfer previo de verdad")
        self.assertGreaterEqual(float(d.get("bucleSegundos", "0")), 3.0, "el búfer previo está demasiado corto")
        self.assertEqual(d.get("disparo"), "manual", "el disparo debe ser manual en esta prueba")
        self.assertEqual(d.get("clipContenedorUnico"), "true")
        self.assertGreater(int(d.get("clipBytes", "0")), 10000, "el clip de la cámara real está vacío")
        self.assertNotIn("clipError", d, f"el clip de la cámara real no se pudo leer: {d.get('clipError')}")
        dur = float(d.get("clipDuracionReal", "0"))
        previos = float(d.get("clipSegundosPrevios", "0"))
        self.assertGreater(dur, 1.0, "el clip de la cámara real no se reproduce")
        self.assertGreaterEqual(dur, previos + 1.0, "la duración real no cubre el búfer previo")
        self.assertGreater(int(d.get("clipGrisMedio", "0")), 5, "el clip de la cámara real sale negro")


# ------------------------------------------------------- detector del modelo
    def test_03_modelo_persona_y_tabla(self):
        if not self.pw:
            self.skipTest("No se encuentra Playwright ya instalado")
        nodo = shutil.which("node")
        if not nodo:
            self.skipTest("No hay Node en el PATH")
        env = dict(os.environ)
        env["NODE_PATH"] = os.path.dirname(self.pw)
        salida = os.path.join(tempfile.gettempdir(), f"vigia-ia-{int(time.time())}.txt")
        proc = subprocess.run(
            [nodo, os.path.join(RAIZ, "tools", "pw-vigia-e2e.cjs"), self.base, salida,
             "220000", "?usarIA=1"],
            capture_output=True, text=True, timeout=380, env=env,
            encoding="utf-8", errors="replace",
        )
        if not os.path.exists(salida):
            self.fail(f"sin registro (código {proc.returncode})\n{proc.stdout[:400]}\n{proc.stderr[:400]}")
        with open(salida, "r", encoding="utf-8") as f:
            log = f.read()
        print("\n" + log.strip()[:1400])
        m = re.search(r"^(RESULTADO|FALLO)\s*(\[.*\])\s*$", log, re.M)
        self.assertIsNotNone(m, f"sin resultado\n{proc.stderr[:400]}")
        self.assertEqual(m.group(1), "RESULTADO", f"la fase con modelo falló: {m.group(2)[:600]}")
        d = dict(p.split("=", 1) for p in json.loads(m.group(2)) if "=" in p)

        self.assertEqual(d.get("usarIA"), "true")
        self.assertEqual(d.get("preparado"), "true", f"no se armó con modelo: {d.get('motivo')}")
        self.assertEqual(d.get("iaCargado"), "true", "el modelo no llegó a cargar")
        self.assertEqual(d.get("iaBackend"), "webgl", d.get("iaBackend"))
        self.assertIn("4.22.0", d.get("iaVersiones", ""), d.get("iaVersiones"))
        # La llamada suelta al módulo: tiene que devolver un resultado bien formado
        # sobre el vídeo de verdad, con su recorte y su identificador de fotograma.
        directa = json.loads(d["iaLlamadaDirecta"])
        self.assertIn(directa["estado"], ("listo", "sin_deteccion"), directa["estado"])
        self.assertIsNone(directa["error"], f"el modelo dio error: {directa}")
        self.assertEqual(directa["fuente"], "video")
        self.assertEqual(directa["roi"]["ancho"], 320)
        self.assertGreater(directa["marcoId"], 0, "no se pidió ningún fotograma al modelo")
        self.assertGreater(directa["ms"], 0, "no se midió tiempo de inferencia")
        # Y lo importante: una escena de RECTÁNGULOS no se cuenta como surfista, así
        # que no se dispara ningún clip. Si saliera uno, sería el defecto de tratar un
        # fallo del modelo como si fuera "no hay surfista" al revés.
        self.assertEqual(int(d.get("eventosConRectangulos", "-1")), 0,
                         "el detector de píxeles disparó sin que el modelo viera persona y tabla")
        self.assertEqual(d.get("errores"), "ninguno", d.get("errores"))
        # Y estado() expone diagnóstico real, no un {} vacío.
        estado = json.loads(d["iaEstadoCompleto"])
        self.assertGreater(len(estado.get("claves", [])), 5, "estado() con pocas claves: {estado}")
        self.assertGreater(int(estado.get("tensores", 0)), 0, "el modelo no dejó tensores cargados")
        self.assertEqual(estado.get("rois"), {"ancho": 320, "alto": 180})


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--budget", type=int, default=150000, help="presupuesto de la página en ms")
    p.add_argument("--solo", choices=["deteccion", "club", "ia"], default="",
                   help="ejecutar solo una de las tres")
    args = p.parse_args()
    TestVigiaE2E.budget_ms = args.budget
    nombres = {
        "deteccion": "test_01_deteccion_a_clip",
        "club": "test_02_emision_real_del_club",
        "ia": "test_03_modelo_persona_y_tabla",
    }
    todas = ["test_01_deteccion_a_clip", "test_02_emision_real_del_club", "test_03_modelo_persona_y_tabla"]
    suite = unittest.TestSuite([TestVigiaE2E(nombres[args.solo])] if args.solo
                               else [TestVigiaE2E(n) for n in todas])
    return 0 if unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())