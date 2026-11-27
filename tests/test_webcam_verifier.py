"""Regresiones del verificador de directos, sin consultar la red."""

import importlib.util
from io import BytesIO
from pathlib import Path
from unittest import TestCase, main
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    "actualizar_webcams", Path(__file__).resolve().parents[1] / "backend" / "actualizar_webcams.py"
)
webcams = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(webcams)


class Response(BytesIO):
    def __init__(self, body, content_type="text/plain", status=200):
        super().__init__(body)
        self.status = status
        self.headers = {"Content-Type": content_type}


class WebcamVerifierTests(TestCase):
    def test_html_masquerading_as_hls_is_rejected(self):
        with patch.object(webcams, "_http_get", return_value=Response(b"<html>offline</html>")):
            self.assertFalse(webcams.verificar_hls("https://example.org/live.m3u8"))

    def test_master_variant_and_segment_are_required(self):
        replies = [
            Response(b"#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000\nvariant.m3u8\n"),
            Response(b"#EXTM3U\n#EXTINF:2,\nframe.ts\n"),
            Response(b"\x47\x40", "video/mp2t"),
        ]
        with patch.object(webcams, "_http_get", side_effect=replies) as get:
            self.assertTrue(webcams.verificar_hls("https://example.org/live.m3u8"))
            self.assertEqual(get.call_args.args[0], "https://example.org/frame.ts")

    def test_html_image_is_rejected_but_mjpeg_is_accepted(self):
        with patch.object(webcams, "_http_get", return_value=Response(b"<html/>", "text/html")):
            self.assertFalse(webcams.verificar_imagen("https://example.org/cam.jpg"))
        with patch.object(webcams, "_http_get", return_value=Response(b"--frame", "multipart/x-mixed-replace; boundary=frame")):
            self.assertTrue(webcams.verificar_imagen("https://example.org/cam.mjpg"))


if __name__ == "__main__":
    main()
