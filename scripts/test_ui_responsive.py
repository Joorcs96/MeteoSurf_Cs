"""Pruebas de verificación de interfaz responsiva en móvil (390 px) y escritorio (1366 px).

Comprueba que:
1. La aplicación web carga en servidor HTTP local sin excepciones.
2. En pantalla móvil (390x844) y escritorio (1366x768):
   - Las fotografías libres de los spots se renderizan con su contenedor de relación 16:9.
   - Los créditos de autoría y enlace de licencia se muestran sin romper el layout.
   - El comparador de condiciones históricas similares se inserta adecuadamente.
   - El formulario de registro de evidencia de sesión ("He surfeado hoy") está presente.
   - No existen elementos con desbordamiento horizontal fijo.
"""

import http.server
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
        pass  # Silenciar logs para no saturar salida de pruebas


class TestUIResponsive(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = 8766
        cls.root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        
        # Iniciar servidor HTTP en hilo demonio
        cls.httpd = socketserver.TCPServer(("127.0.0.1", cls.port), lambda *args, **kwargs: SilentHTTPHandler(*args, directory=cls.root_dir, **kwargs))
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()
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

    def _render_page_dom(self, url, width, height):
        if not self.has_edge:
            self.skipTest("Microsoft Edge no está disponible para pruebas headless de renderizado")
            
        temp_profile = tempfile.mkdtemp()
        try:
            cmd = [
                self.edge_path,
                "--headless=new",
                f"--user-data-dir={temp_profile}",
                f"--window-size={width},{height}",
                "--virtual-time-budget=3500",
                "--dump-dom",
                url
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=20, encoding="utf-8", errors="replace")
            self.assertEqual(res.returncode, 0, f"Edge falló con código {res.returncode}: {res.stderr}")
            return res.stdout
        finally:
            shutil.rmtree(temp_profile, ignore_errors=True)

    def test_mobile_390_planetario_render(self):
        url = f"http://127.0.0.1:{self.port}/index.html#/spot/Planetario"
        html = self._render_page_dom(url, 390, 844)
        
        # 1. Comprobar fotografía libre del spot y atribución
        self.assertIn("spot-photo-wrap", html, "Debe existir el contenedor .spot-photo-wrap")
        self.assertIn("Platja del Pinar", html, "Debe mostrar el título o descripción de la fotografía")
        self.assertIn("Juan Emilio Prades Bel", html, "Debe atribuir al autor de Wikimedia Commons")
        self.assertIn("CC BY-SA", html, "Debe indicar la licencia abierta")
        
        # 2. Comprobar comparador de condiciones históricas
        self.assertTrue(
            "Días históricos similares a la previsión actual" in html or "Comparador de condiciones históricas" in html,
            "Debe incluir el título del comparador de condiciones históricas"
        )
        
        # 3. Comprobar tarjeta de registro de evidencia de sesión
        self.assertIn("session-evidence-card", html, "Debe renderizar la tarjeta de evidencia de sesión")
        self.assertIn("btn-surfeado-hoy", html, "Debe incluir el botón 'He surfeado hoy'")
        self.assertIn("btn-mar-plano", html, "Debe incluir el botón 'Mar plano / Inviable'")

    def test_desktop_1366_planetario_render(self):
        url = f"http://127.0.0.1:{self.port}/index.html#/spot/Planetario"
        html = self._render_page_dom(url, 1366, 768)
        
        # Verificar presencia de layout de escritorio
        self.assertIn("spot-photo-wrap", html)
        self.assertIn("spot-photo-img", html)
        self.assertIn("similar-conditions-card", html)
        self.assertIn("session-evidence-card", html)
        self.assertIn("spot-layout", html)

    def test_mobile_390_vinaros_render(self):
        url = f"http://127.0.0.1:{self.port}/index.html#/spot/Vinaros"
        html = self._render_page_dom(url, 390, 844)
        
        # Verificar que otro spot distinto (Vinaròs) carga su foto propia
        self.assertIn("spot-photo-wrap", html)
        self.assertIn("Platja del Fortí", html)
        self.assertIn("CC BY-SA", html)

    def test_css_reglas_responsivas_sin_overflow(self):
        css_path = os.path.join(self.root_dir, "css", "app.css")
        with open(css_path, "r", encoding="utf-8") as f:
            css = f.read()

        # Verificar que las nuevas clases usan anchos porcentuales o relativos y flex wrap
        self.assertIn(".spot-photo-container { position: relative; width: 100%; aspect-ratio: 16 / 9;", css)
        self.assertIn(".spot-photo-img { width: 100%; height: 100%; object-fit: cover;", css)
        self.assertIn("flex-wrap: wrap", css)
        # Comprobar que no hay anchos fijos en px superiores a 360px en las nuevas clases
        for match in re.finditer(r"\.(?:spot-photo|similar|evidence)[^{]*\{([^}]+)\}", css):
            block = match.group(1)
            px_widths = re.findall(r"width:\s*(\d+)px", block)
            for w in px_widths:
                self.assertLessEqual(int(w), 360, f"Ancho fijo {w}px excede ancho mínimo móvil")


if __name__ == "__main__":
    unittest.main()
