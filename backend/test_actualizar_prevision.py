"""Pruebas del desglose de oleaje y del calculo de la prevision horaria.

No tocan la red: se alimentan series horarias sinteticas con la misma forma que
devuelve Open-Meteo Marine, para que la separacion entre mar de fondo y mar de
viento se pueda verificar sin depender de la API.
"""

import math
import unittest

from backend.actualizar_prevision import (
    TRENES_MARINOS,
    calcular_prevision_spots,
    desglose_oleaje,
)


class TestDesgloseOleaje(unittest.TestCase):
    """La altura es la suma energetica de los trenes; el dominante manda."""

    def test_sin_desglose_usa_el_total(self):
        hourly = {
            "time": ["2026-10-05T06:00"],
            "wave_height": [1.2],
            "wave_period": [8.0],
            "wave_direction": [90],
        }
        res = desglose_oleaje(hourly, 0)
        self.assertEqual(res["altura"], 1.2)
        self.assertEqual(res["periodo"], 8.0)
        self.assertEqual(res["direccion"], 90)
        self.assertEqual(res["trenes"], [])
        self.assertEqual(res["fraccion_viento"], 0.0)

    def test_altura_es_la_suma_energetica_de_los_tres_trenes(self):
        # Sin el tren secundario la suma se queda corta: la API publica el total
        # como la energia de los tres, no solo de los dos que se pedian antes.
        hourly = {
            "wave_height": [0.75],
            "wave_period": [9.0],
            "wave_direction": [80],
            "swell_wave_height": [0.5],
            "swell_wave_period": [10.0],
            "swell_wave_direction": [70],
            "secondary_swell_wave_height": [0.4],
            "secondary_swell_wave_period": [12.0],
            "secondary_swell_wave_direction": [60],
            "wind_wave_height": [0.3],
            "wind_wave_period": [4.0],
            "wind_wave_direction": [100],
        }
        res = desglose_oleaje(hourly, 0)
        esperado = math.sqrt(0.5 ** 2 + 0.4 ** 2 + 0.3 ** 2)
        self.assertAlmostEqual(res["altura"], esperado, places=6)
        # Y se queda cerca del total que publica la API (medido: de 0.93 a 1.03
        # en la relacion suma-de-trenes / total).
        self.assertLess(abs(res["altura"] - 0.75), 0.05)
        # Pedir solo fondo y viento daba 0.583: se perdia el 18% de la altura.
        self.assertGreater(res["altura"], math.sqrt(0.5 ** 2 + 0.3 ** 2))
        self.assertEqual([t["clase"] for t in res["trenes"]], ["Fondo", "Fondo 2", "Viento"])
        # Dominante = Fondo (0.5 m), asi que manda su periodo y su direccion.
        self.assertEqual(res["periodo"], 10.0)
        self.assertEqual(res["direccion"], 70)

    def test_dominante_es_el_de_mas_energia_no_el_primero(self):
        hourly = {
            "wave_height": [0.7],
            "wave_period": [6.0],
            "wave_direction": [150],
            "swell_wave_height": [0.1],
            "swell_wave_period": [14.0],
            "swell_wave_direction": [300],
            "wind_wave_height": [0.7],
            "wind_wave_period": [4.5],
            "wind_wave_direction": [95],
        }
        res = desglose_oleaje(hourly, 0)
        self.assertEqual(res["periodo"], 4.5)
        self.assertEqual(res["direccion"], 95)
        self.assertAlmostEqual(res["fraccion_viento"], 0.7 / math.sqrt(0.7 ** 2 + 0.1 ** 2), places=6)

    def test_fraccion_viento_entre_0_y_1(self):
        hourly = {
            "wave_height": [1.0],
            "swell_wave_height": [0.8],
            "swell_wave_period": [9.0],
            "swell_wave_direction": [70],
            "wind_wave_height": [0.6],
            "wind_wave_period": [4.0],
            "wind_wave_direction": [100],
        }
        res = desglose_oleaje(hourly, 0)
        self.assertGreater(res["fraccion_viento"], 0.0)
        self.assertLessEqual(res["fraccion_viento"], 1.0)

    def test_nulls_y_series_cortas_no_revientan(self):
        hourly = {
            "time": ["2026-10-05T06:00", "2026-10-05T07:00", "2026-10-05T08:00"],
            "wave_height": [0.9, None, 0.5],
            "wave_period": [8.0],
            "wave_direction": [80],
            "swell_wave_height": [0.9, None],
            "wind_wave_height": [None],
        }
        # Indice 1: el swell es null y el resto no llega -> se queda con el total.
        res = desglose_oleaje(hourly, 1)
        self.assertEqual(res["altura"], 0.0)
        self.assertEqual(res["trenes"], [])
        # Indice 2: la serie del swell no llega a esa posicion.
        res = desglose_oleaje(hourly, 2)
        self.assertEqual(res["altura"], 0.5)
        # Indice fuera de rango.
        res = desglose_oleaje(hourly, 99)
        self.assertEqual(res["altura"], 0.0)

    def test_trenes_sin_periodo_caen_al_periodo_total(self):
        hourly = {
            "wave_height": [0.8],
            "wave_period": [7.5],
            "wave_direction": [85],
            "swell_wave_height": [0.8],
            "swell_wave_period": [None],
            "swell_wave_direction": [None],
        }
        res = desglose_oleaje(hourly, 0)
        self.assertEqual(res["periodo"], 7.5)
        self.assertEqual(res["direccion"], 85)

    def test_trenes_declarados_en_el_mismo_orden_que_la_web(self):
        self.assertEqual(
            [clase for _, clase in TRENES_MARINOS],
            ["Fondo", "Fondo 2", "Viento"],
        )


class TestCalcularPrevisionSpots(unittest.TestCase):
    """El historico se escribe con el tren dominante y sin romper la cabecera."""

    def _datos(self):
        mar = {
            "hourly": {
                "time": ["2026-10-05T06:00", "2026-10-05T07:00"],
                "wave_height": [0.6, 0.6],
                "wave_period": [9.0, 9.0],
                "wave_direction": [80, 80],
                "swell_wave_height": [0.5, None],
                "swell_wave_period": [10.0, None],
                "swell_wave_direction": [70, None],
                "secondary_swell_wave_height": [0.2, None],
                "wind_wave_height": [0.2, 0.4],
                "wind_wave_period": [4.0, 3.5],
                "wind_wave_direction": [110, 105],
            }
        }
        meteo = {
            "hourly": {
                "time": ["2026-10-05T06:00", "2026-10-05T07:00"],
                "wind_speed_10m": [7.0, 9.0],
                "wind_direction_10m": [112.0, 115.0],
                "surface_pressure": [1013.0, 1013.0],
            }
        }
        return mar, meteo

    def test_usa_el_tren_dominante_para_periodo_y_direccion(self):
        mar, meteo = self._datos()
        regs = calcular_prevision_spots(mar, meteo, spots=["Planetario"])
        self.assertEqual(len(regs), 2)
        # Hora 06:00 manda el fondo (0.5 m) frente al viento (0.2 m).
        self.assertEqual(regs[0]["periodo_s"], "10.0")
        self.assertEqual(regs[0]["dir_swell_deg"], 70)
        self.assertEqual(regs[0]["fecha"], "2026-10-05")
        self.assertEqual(regs[0]["hora"], "06:00")
        # Hora 07:00 solo hay mar de viento, asi que manda el viento.
        self.assertEqual(regs[1]["periodo_s"], "3.5")
        self.assertEqual(regs[1]["dir_swell_deg"], 105)

    def test_cabecera_del_historico_intacta(self):
        mar, meteo = self._datos()
        reg = calcular_prevision_spots(mar, meteo, spots=["Planetario"])[0]
        self.assertEqual(
            list(reg.keys()),
            [
                "fecha", "hora", "spot", "altura_m", "periodo_s", "dir_swell_deg",
                "viento_kmh", "viento_dir_deg", "calidad_0_5", "feedback_usuario",
            ],
        )
        self.assertIsInstance(reg["calidad_0_5"], int)
        self.assertGreaterEqual(reg["calidad_0_5"], 0)
        self.assertLessEqual(reg["calidad_0_5"], 5)

    def test_meteo_desalineado_no_revienta(self):
        mar, _ = self._datos()
        meteo = {"hourly": {"time": [], "wind_speed_10m": [], "wind_direction_10m": [], "surface_pressure": []}}
        regs = calcular_prevision_spots(mar, meteo, spots=["Planetario"])
        self.assertEqual(len(regs), 2)
        self.assertEqual(regs[0]["viento_kmh"], "0.0")


if __name__ == "__main__":
    unittest.main()