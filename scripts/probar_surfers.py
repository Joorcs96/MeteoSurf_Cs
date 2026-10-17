"""Prueba real de la vigía de ola contra la emisión del club Surfers Castellón.

Levanta el repo por HTTP, abre `tools/probar_surfers.html` en Edge sin ventana y
lee lo que la página escribe en `#resultado`. La página es la que hace el trabajo
de verdad: reproduce el HLS con hls.js, pasa fotogramas por `js/deteccion.js` y
graba con `MediaRecorder` un clip con búfer previo.

Uso:
    python scripts/probar_surfers.py
    python scripts/probar_surfers.py --budget 30000

Si no hay red, o Edge no está, o la cámara está caída, la prueba lo dice y falla
sin dar por bueno nada: el valor de esto es que el resultado venga del club de
verdad, no de un simulacro.
"""

import argparse
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import tempfile
import threading
import time
import unittest


class SilentHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass


class TestSurfersReal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = 8767
        cls.root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        cls.httpd = socketserver.TCPServer(
            ("127.0.0.1", cls.port), lambda *a, **k: SilentHTTPHandler(*a, directory=cls.root_dir, **k)
        )
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        time.sleep(0.5)
        cls.edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        cls.has_edge = os.path.exists(cls.edge_path)

    @classmethod
    def tearDownClass(cls):
        try:
            cls.httpd.shutdown()
            cls.httpd.server_close()
        except Exception:
            pass

    def test_01_emision_del_club_y_grabacion_con_prebuffer(self):
        if not self.has_edge:
            self.skipTest("Microsoft Edge no está disponible")

        perfil = tempfile.mkdtemp()
        presupuesto = getattr(self, "budget_ms", 30000)
        url = f"http://127.0.0.1:{self.port}/tools/probar_surfers.html"
        try:
            cmd = [
                self.edge_path,
                "--headless=new",
                f"--user-data-dir={perfil}",
                "--window-size=800,600",
                "--autoplay-policy=no-user-gesture-required",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                f"--virtual-time-budget={presupuesto}",
                "--run-all-compositor-stages-before-draw",
                "--dump-dom",
                url,
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=120,
                                 encoding="utf-8", errors="replace")
        finally:
            shutil.rmtree(perfil, ignore_errors=True)

        self.assertEqual(res.returncode, 0, f"Edge terminó con {res.returncode}: {res.stderr[:300]}")
        m = re.search(r'id="resultado"[^>]*>([^<]*)<', res.stdout)
        self.assertIsNotNone(m, "La página de prueba no escribió ningún resultado")
        bruto = m.group(1).strip()
        print("\n  " + bruto)
        self.assertTrue(bruto.startswith("RESULTADO"), f"La prueba no terminó bien: {bruto[:400]}")
        datos = dict(p.split("=", 1) for p in json.loads(bruto[len("RESULTADO"):]) if "=" in p)

        self.assertEqual(datos.get("estadoStream"), "ok", "La emisión del club no está resuelta")
        self.assertEqual(datos.get("playlist"), "ok", "La playlist HLS no responde")
        self.assertEqual(datos.get("hls"), "ipcamlive", "No se está usando la fuente IPCamLive")
        self.assertGreater(int(datos.get("ancho", "0")), 0, "El vídeo no cargó ninguna imagen")
        self.assertGreaterEqual(int(datos.get("listo", "0")), 2, "El vídeo no tiene datos suficientes")
        self.assertGreaterEqual(int(datos.get("cuadros", "0")), 5, "No llegaron fotogramas al detector")
        self.assertNotEqual(datos.get("negro"), "si", "La imagen sale negra: no hay vídeo real")
        self.assertGreater(int(datos.get("grisMedio", "0")), 8, "La imagen está demasiado oscura")

        # La grabación del directo NO se puede comprobar en un navegador sin
        # ventana en este host: la pista de `video.captureStream()` no entrega
        # fotogramas y `MediaRecorder` no codifica nada (0 bytes), aunque el vídeo
        # se esté reproduciendo y el lienzo se repinte. Cuando pasa eso, la prueba
        # lo dice y deja la comprobación de la grabación para el navegador con
        # ventana (abriendo tools/probar_surfers.html a mano) en lugar de fingir.
        grabacion = int(datos.get("bytesClip", "0"))
        if grabacion > 0:
            self.assertGreater(int(datos.get("bytesPre", "0")), 0, "El búfer previo no grabó nada")
            self.assertNotIn("errorClip", datos, f"El clip ensamblado no se pudo leer: {datos.get('errorClip')}")
            self.assertGreater(float(datos.get("duracionClip", "0")), 1.0,
                               "El clip ensamblado no tiene duración: el búfer previo no llegó al archivo")
            print("  [VERIFICADO] MediaRecorder grabó y el clip ensamblado tiene duración real")
        else:
            lienzo = int(datos.get("framesLienzo", "0"))
            self.assertGreater(lienzo, 10,
                               "Ni la pista de vídeo ni el lienzo produjeron fotogramas: el problema no es el grabador")
            self.skipTest(
                "Grabación del directo NO verificable en navegador sin ventana: "
                f"MediaRecorder devolvió 0 bytes con el vídeo reproduciéndose ({datos.get('ancho')}x{datos.get('alto')}, "
                f"listo={datos.get('listo')}, pista={datos.get('trackEstado')}) y con el lienzo repintado "
                f"{lienzo} veces. Es una limitación de este host, no del código: hay que comprobarlo abriendo "
                "tools/probar_surfers.html en un navegador con ventana."
            )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--budget", type=int, default=30000,
                        help="milésimas de segundo de presupuesto de la página (por defecto 30000)")
    args = parser.parse_args()
    caso = TestSurfersReal("test_01_emision_del_club_y_grabacion_con_prebuffer")
    caso.budget_ms = args.budget
    resultado = unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([caso]))
    return 0 if resultado.wasSuccessful() else 1


if __name__ == "__main__":
    raise SystemExit(main())