"""Regresiones de seguridad y calidad: python -m unittest scripts.test_realtime."""
import json
import ssl
import tempfile
import unittest
import urllib.error
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch

from scripts import realtime as rt


class RealtimeTests(unittest.TestCase):
    def setUp(self):
        self.tls = rt._TLS_SIN_VERIFICAR
        rt._TLS_SIN_VERIFICAR = False

    def tearDown(self):
        rt._TLS_SIN_VERIFICAR = self.tls

    def cert_error(self, code=19):
        error = ssl.SSLCertVerificationError('certificate verify failed')
        error.verify_code = code
        error.verify_message = 'untrusted chain'
        return urllib.error.URLError(error)

    def test_tls_fallback_is_only_for_portus_chain(self):
        url = rt.API_PORTUS + '/estaciones/rt/WIND?locale=es'
        with patch.object(rt, '_descarga', side_effect=[self.cert_error(), b'[]']) as get:
            self.assertEqual(rt.descarga(url), b'[]')
            self.assertEqual([c.kwargs['verificar'] for c in get.call_args_list], [True, False])
        # El indicador persistente nunca afecta a otro dominio ni a HTTP.
        for url in ['https://api.aemet.es/data', 'https://portus.puertos.es.evil.test/data',
                    'http://portus.puertos.es/portussvr/api/data',
                    'https://portus.puertos.es/otra-ruta',
                    'https://portus.puertos.es:444/portussvr/api/data']:
            with self.subTest(url=url), patch.object(rt, '_descarga', return_value=b'[]') as get:
                rt.descarga(url)
                self.assertTrue(get.call_args.kwargs['verificar'])

    def test_no_downgrade_on_expiry_hostname_or_custom_ca(self):
        url = rt.API_PORTUS + '/data'
        for code in [10, 62]:
            with self.subTest(code=code), patch.object(rt, '_descarga', side_effect=self.cert_error(code)) as get:
                with self.assertRaises(urllib.error.URLError):
                    rt.descarga(url)
                self.assertEqual(get.call_count, 1)
        with patch.dict(rt.os.environ, {'REALTIME_CA_BUNDLE': 'explicit.pem'}), patch.object(rt, '_descarga', side_effect=self.cert_error()) as get:
            with self.assertRaises(urllib.error.URLError):
                rt.descarga(url)
            self.assertEqual(get.call_count, 1)

    def test_insecure_requests_and_redirects_cannot_escape(self):
        with self.assertRaises(ValueError):
            rt._descarga('https://example.com/', None, 1, False)
        request = rt.urllib.request.Request(rt.API_PORTUS + '/data')
        with self.assertRaises(urllib.error.HTTPError):
            rt._SinRedireccion().redirect_request(request, None, 302, '', {}, 'https://example.com/')

    def test_values_reject_sentinels_broken_factors_and_nonfinite(self):
        for value, factor in [(9999, 10000), (-9999, 10000), ('NaN', 1), ('Infinity', 1),
                              (10, 0), (10, -1), (10, 'oops'), (10, 'NaN'), (10, None)]:
            with self.subTest(value=value, factor=factor):
                self.assertIsNone(rt._valor_de({'valor': value, 'factor': factor, 'paramEseoo': 'Hm0'}))
        self.assertEqual(rt._valor_de({'valor': 70, 'factor': 100, 'paramEseoo': 'Hm0'}), 0.7)
        self.assertEqual(rt._valor_de({'valor': 0, 'factor': 100, 'paramEseoo': 'WindSpeed'}), 0)
        self.assertIsNone(rt._valor_de({'valor': 70, 'factor': 100, 'averia': True}))

    def test_dates_keep_timezone_and_reject_future_rows(self):
        self.assertEqual(rt.iso_utc(rt._fecha_de('2026-09-30T02:00:00+02:00')), '2026-09-30T00:00:00Z')
        def row(date, parameter, value):
            return {'fecha': rt.iso_utc(date), 'datos': [{'valor': value, 'factor': 1, 'paramEseoo': parameter}]}
        now = rt.ahora()
        rows = [row(now + timedelta(hours=1), 'Hm0', 2), row(now, 'WaterTemp', 25),
                row(now - timedelta(hours=1), 'Hm0', 0.7), None]
        self.assertEqual(rt._elige_fila(rows, 'Hm0')['valores']['Hm0'], 0.7)

    def test_missing_stations_and_fresh_fallback(self):
        errors = []
        self.assertIsNone(rt.bloque_viento([], errors))
        self.assertIn('30 km', errors[0]['mensaje'])
        stations = [{'id': i, 'nombre': f'Boya {i}', 'boya': True, 'latitud': 39,
                     'longitud': 0, 'distancia_km': i, 'cadencia': 60} for i in [1, 2]]
        def observation(est, variables):
            return {'fecha': rt.ahora() - timedelta(hours=4 if est['id'] == 1 else 1),
                    'valores': {'Hm0': 0.7, 'SeaLevel': 0.1, 'WindSpeed': 0}}
        with patch.object(rt, 'leer_observacion', side_effect=observation):
            self.assertEqual(rt.bloque_oleaje(stations, [])['principal']['estacion_id'], 2)
            self.assertEqual(rt.bloque_nivel_mar(stations, [])['estacion_id'], 2)
            self.assertEqual(rt.bloque_viento(stations, [])['estacion_id'], 2)

    def test_atomic_json_and_stable_comparison(self):
        with tempfile.TemporaryDirectory() as folder:
            destination = Path(folder) / 'realtime.json'
            rt.escribir({'ok': True}, destination)
            self.assertEqual(json.loads(destination.read_text()), {'ok': True})
            self.assertFalse(destination.with_suffix('.json.tmp').exists())
        self.assertEqual(rt.comparable({'generado': 'a', 'oleaje': None}),
                         rt.comparable({'generado': 'b', 'oleaje': None}))

    def test_bad_catalog_rows_do_not_hide_valid_station(self):
        station = {'id': 1, 'nombre': 'Boya', 'latitud': 39.5, 'longitud': 0.2}
        rows = [None, {}, {**station, 'latitud': 'oops'}, {**station, 'longitud': float('nan')}, station]
        with patch.object(rt, 'pedir_api', return_value=rows):
            self.assertEqual(len(rt.catalogo('WAVE')), 1)
        self.assertGreater(rt.antiguedad_min(rt.ahora() - timedelta(hours=3, seconds=1)), 180)


if __name__ == '__main__':
    unittest.main()
