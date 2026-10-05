"""Conjunto exhaustivo de pruebas unitarias para motor_fisica.py.

Valida la configuración de spots, la función getSpotConfig, calcularFisica
y calcularCalidad respetando estrictamente las matemáticas y constantes.
"""

import math
import unittest
from backend.motor_fisica import (
    DEFAULT_SPOT_CONFIG,
    SPOT_CONFIG,
    calcular_calidad,
    calcular_fisica,
    calcularCalidad,
    calcularFisica,
    get_spot_config,
    getSpotConfig,
)


class TestSpotConfig(unittest.TestCase):
    """Pruebas de la configuración y catálogo de spots."""

    def test_all_10_spots_present(self):
        expected_spots = [
            'Planetario',
            'Gurugu',
            'Pirámides',
            'Voramar',
            'La Renegà',
            'Burriana',
            'Nules',
            'Almenara',
            'Peñíscola N',
            'Vinaròs',
        ]
        self.assertEqual(len(SPOT_CONFIG), 10)
        for spot in expected_spots:
            self.assertIn(spot, SPOT_CONFIG, f"Falta el spot: {spot}")

    def test_spot_config_fields_and_ranges(self):
        required_keys = {'azimut', 'thetaCrit', 'sBase', 'offshoreMin', 'offshoreMax'}
        for spot, cfg in SPOT_CONFIG.items():
            self.assertEqual(set(cfg.keys()), required_keys, f"Campos incorrectos en {spot}")
            self.assertGreaterEqual(cfg['azimut'], 0)
            self.assertLessEqual(cfg['azimut'], 360)
            self.assertGreaterEqual(cfg['thetaCrit'], 0)
            self.assertLessEqual(cfg['thetaCrit'], 180)
            self.assertGreater(cfg['sBase'], 0.0)
            self.assertLessEqual(cfg['sBase'], 1.0)
            self.assertGreaterEqual(cfg['offshoreMin'], 0)
            self.assertLessEqual(cfg['offshoreMax'], 360)

    def test_get_spot_config_exact(self):
        for spot in SPOT_CONFIG:
            cfg = getSpotConfig(spot)
            self.assertEqual(cfg, SPOT_CONFIG[spot])

    def test_get_spot_config_substring(self):
        # Subcadenas simulando nombres de estación o descripciones de usuario
        self.assertEqual(getSpotConfig('Playa del Planetario'), SPOT_CONFIG['Planetario'])
        self.assertEqual(getSpotConfig('Castellón - Gurugu Norte'), SPOT_CONFIG['Gurugu'])
        self.assertEqual(getSpotConfig('Puerto de Burriana'), SPOT_CONFIG['Burriana'])
        self.assertEqual(getSpotConfig('Cala La Renegà'), SPOT_CONFIG['La Renegà'])
        self.assertEqual(getSpotConfig('Peñíscola N Playa'), SPOT_CONFIG['Peñíscola N'])

    def test_get_spot_config_fallback(self):
        self.assertEqual(getSpotConfig('Spot Inexistente'), DEFAULT_SPOT_CONFIG)
        self.assertEqual(getSpotConfig(None), DEFAULT_SPOT_CONFIG)
        self.assertEqual(getSpotConfig(''), DEFAULT_SPOT_CONFIG)

    def test_snake_case_alias(self):
        self.assertEqual(get_spot_config('Burriana'), SPOT_CONFIG['Burriana'])


class TestCalcularFisica(unittest.TestCase):
    """Pruebas del motor físico de propagación, sombra y difracción costera."""

    def test_zero_or_negative_height(self):
        self.assertEqual(calcularFisica('Planetario', 0, 8, 80), 0)
        self.assertEqual(calcularFisica('Planetario', -1.5, 8, 80), 0)
        self.assertEqual(calcularFisica('Planetario', None, 8, 80), 0)
        self.assertEqual(calcularFisica('Planetario', 'abc', 8, 80), 0)

    def test_specific_spot_values(self):
        # Casos verificados contra el motor JS original
        # Planetario: h=1.2, p=8.5, dir=80 -> 0.97
        res_planetario = calcularFisica('Planetario', 1.2, 8.5, 80)
        self.assertAlmostEqual(res_planetario, 0.97, places=2)

        # Gurugu: h=0.8, p=6.0, dir=60 -> 0.45
        res_gurugu = calcularFisica('Gurugu', 0.8, 6.0, 60)
        self.assertAlmostEqual(res_gurugu, 0.45, places=2)

        # Burriana: h=1.5, p=9.0, dir=110 -> 1.49
        res_burriana = calcularFisica('Burriana', 1.5, 9.0, 110)
        self.assertAlmostEqual(res_burriana, 1.49, places=2)

        # Voramar: h=2.0, p=10.0, dir=45 -> 0.07
        res_voramar = calcularFisica('Voramar', 2.0, 10.0, 45)
        self.assertAlmostEqual(res_voramar, 0.07, places=2)

        # La Renegà: h=0.3, p=4.0, dir=90 -> 0.3
        res_renega = calcularFisica('La Renegà', 0.3, 4.0, 90)
        self.assertAlmostEqual(res_renega, 0.30, places=2)

        # Peñíscola N: h=0.1, p=3.0, dir=90 -> 0.1
        res_peniscola = calcularFisica('Peñíscola N', 0.1, 3.0, 90)
        self.assertAlmostEqual(res_peniscola, 0.10, places=2)

    def test_swell_angle_amplification_cutoff(self):
        # Con dirSwell < 75 se aplica amplificador dependiente de (periodo/4)^2
        h = 1.0
        p_alto = 10.0
        # A 70° (amplificación activa) vs a 80° (sin amplificación, amplificador=1.0)
        res_amplif = calcularFisica('Planetario', h, p_alto, 70)
        res_no_amplif = calcularFisica('Planetario', h, p_alto, 80)
        # A 70° el amplificador es > 1.0
        self.assertGreater(res_amplif, 0)
        self.assertGreater(res_no_amplif, 0)

    def test_gain_clamping(self):
        # ganancia = (p/4)^2, acotada entre 1.0 y 2.5
        # p=2 -> (2/4)^2 = 0.25 -> clamped a 1.0
        # p=4 -> (4/4)^2 = 1.0 -> 1.0
        # p=10 -> (10/4)^2 = 6.25 -> clamped a 2.5
        # p=20 -> clamped a 2.5 (mismo resultado que p=10 para el amplificador)
        res_p10 = calcularFisica('Gurugu', 1.0, 10.0, 50)
        res_p20 = calcularFisica('Gurugu', 1.0, 20.0, 50)
        self.assertEqual(res_p10, res_p20)

    def test_exposure_floor(self):
        # La exposición angular tiene un suelo mínimo de 0.05
        # Para Burriana: azimut=26, normalCosta=116.
        # Si dirSwell = 116 + 90 = 206, cos(90°) = 0, el floor garantiza 0.05
        res = calcularFisica('Burriana', 1.0, 4.0, 206)
        # sf a 206°: dirSwell=206 >> thetaCrit(45), sf ~ 1.0
        # amplificador = 1.0 (dirSwell >= 75)
        # exposicion = max(0, 0.05) = 0.05
        # h * sf * amplificador * exposicion ~ 1.0 * 1.0 * 1.0 * 0.05 = 0.05
        self.assertAlmostEqual(res, 0.05, places=2)

    def test_string_inputs(self):
        res_str = calcularFisica('Burriana', '1.5', '9.0', '110')
        res_num = calcularFisica('Burriana', 1.5, 9.0, 110)
        self.assertEqual(res_str, res_num)

    def test_unknown_spot_uses_default(self):
        res_unknown = calcularFisica('Desconocido', 1.0, 7.0, 70)
        self.assertGreater(res_unknown, 0)

    def test_snake_case_alias(self):
        self.assertEqual(
            calcular_fisica('Burriana', 1.5, 9.0, 110),
            calcularFisica('Burriana', 1.5, 9.0, 110),
        )


class TestCalcularCalidad(unittest.TestCase):
    """Pruebas del algoritmo de calidad pre-IA (escala 0 a 5)."""

    def test_flat_conditions_under_thresholds(self):
        # h < 0.2 -> calidad 0 inmediata
        self.assertEqual(calcularCalidad(0.1, 10, 5, 290, 'Planetario'), 0)
        self.assertEqual(calcularCalidad(0.0, 5, 5, 290, 'Planetario'), 0)
        self.assertEqual(calcularCalidad(-0.5, 8, 5, 290, 'Planetario'), 0)

        # 0.2 <= h < 0.35 -> calidad 1 inmediata
        self.assertEqual(calcularCalidad(0.20, 10, 5, 290, 'Planetario'), 1)
        self.assertEqual(calcularCalidad(0.34, 10, 5, 290, 'Planetario'), 1)

    def test_height_bonuses(self):
        # Base s=2
        # h=0.4: sin bonus de h (s=2)
        # Con viento neutro y sin bonuses
        c_base = calcularCalidad(0.4, 4.0, 16, 180, 'Planetario', 1015)
        # h=0.6: bonus h>=0.5 (+1 -> s=3)
        c_h06 = calcularCalidad(0.6, 4.0, 16, 180, 'Planetario', 1015)
        self.assertEqual(c_h06 - c_base, 1)

        # h=1.0: bonus h>=0.5 (+1) y h>=0.9 (+1) -> s=4
        c_h10 = calcularCalidad(1.0, 4.0, 16, 180, 'Planetario', 1015)
        self.assertEqual(c_h10 - c_base, 2)

    def test_period_bonuses(self):
        # p>=6 (+0.5), p>=8 (+0.5)
        # h=0.4 (base s=2)
        # Viento neutro: wd=180 es de mar y ws=8 se queda por debajo del tramo
        # de penalizacion, asi que el unico termino variable es el periodo.
        c_p5 = calcularCalidad(0.4, 5.5, 8, 180, 'Planetario', 1015)
        self.assertEqual(c_p5, 2)

        # p=6.5 -> s=2.5 -> Math.round -> 3
        c_p6 = calcularCalidad(0.4, 6.5, 8, 180, 'Planetario', 1015)
        self.assertEqual(c_p6, 3)

        # p=8.5 -> s=3 (bonus p>=6 y p>=8)
        c_p8 = calcularCalidad(0.4, 8.5, 8, 180, 'Planetario', 1015)
        self.assertEqual(c_p8, 3)

    def test_wave_energy_bonuses(self):
        # energia = h * h * p
        # Si energia >= 5: +0.5; si energia >= 15: +0.5
        # h=0.8, p=8 -> energia = 0.64 * 8 = 5.12 (>= 5, < 15) -> +0.5
        # h=1.5, p=8 -> energia = 2.25 * 8 = 18.0 (>= 15) -> +1.0
        c1 = calcularCalidad(0.8, 8, 16, 180, 'Planetario', 1015)
        c2 = calcularCalidad(1.5, 8, 16, 180, 'Planetario', 1015)
        self.assertGreaterEqual(c2, c1)

    def test_spot_offshore_wind(self):
        # Planetario offshore: 275 a 315
        # Si wd=290 (offshore):
        # ws < 15 -> +1
        # ws < 8 -> +0.5 (total +1.5)
        # h=0.4 (base s=2)
        # Con ws=10 y wd=290: isOffshore=True, ws<15 (+1) -> s=3
        c_off_10 = calcularCalidad(0.4, 4.0, 10, 290, 'Planetario', 1015)
        self.assertEqual(c_off_10, 3)

        # Con ws=5 y wd=290: isOffshore=True, ws<15 (+1), ws<8 (+0.5) -> s=3.5 -> round -> 4
        c_off_5 = calcularCalidad(0.4, 4.0, 5, 290, 'Planetario', 1015)
        self.assertEqual(c_off_5, 4)

        # Con viento onshore (wd=90) y ws=5: no hay bonus offshore -> s=2
        c_on_5 = calcularCalidad(0.4, 4.0, 5, 90, 'Planetario', 1015)
        self.assertEqual(c_on_5, 2)

    def test_generic_offshore_when_no_spot_provided(self):
        # Sin spot: offGen = (260 <= wd <= 360) || (0 <= wd < 45)
        # Si ws < 12: +1
        # wd=300 (offshore genérico), ws=10 -> +1
        c_gen_off = calcularCalidad(0.4, 4.0, 10, 300, None, 1015)
        self.assertEqual(c_gen_off, 3)

        # wd=180 (no offshore), ws=10 -> s=2
        c_gen_on = calcularCalidad(0.4, 4.0, 10, 180, None, 1015)
        self.assertEqual(c_gen_on, 2)

    def test_high_wind_penalties(self):
        # ws > 20 -> -1
        # ws > 30 -> -1 adicional
        # Caso base con s=2:
        # h=0.4, p=4.0, wd=180 (sin bonus de viento), presion=1015
        # ws=15: s=2 -> 2
        # ws=25: ws>20 (-1) -> s=1 -> 1
        # ws=35: ws>30 (-1 más) -> s=0 -> 0
        c_ws15 = calcularCalidad(0.4, 4.0, 15, 180, 'Planetario', 1015)
        c_ws25 = calcularCalidad(0.4, 4.0, 25, 180, 'Planetario', 1015)
        c_ws35 = calcularCalidad(0.4, 4.0, 35, 180, 'Planetario', 1015)

        self.assertEqual(c_ws15, 2)
        self.assertEqual(c_ws25, 1)
        self.assertEqual(c_ws35, 0)

    def test_pressure_bonus(self):
        # presion < 1008: +0.5
        # presion < 995: +0.5 adicional
        # h=0.4 (base s=2)
        # Viento neutro (ws=8 de mar) para que solo varye la presion.
        self.assertEqual(calcularCalidad(0.4, 4.0, 8, 180, 'Planetario', 1013), 2)
        # presion=1005 (< 1008) -> s=2.5 -> round -> 3
        self.assertEqual(calcularCalidad(0.4, 4.0, 8, 180, 'Planetario', 1005), 3)
        # presion=990 (< 995) -> s=3 -> 3
        self.assertEqual(calcularCalidad(0.4, 4.0, 8, 180, 'Planetario', 990), 3)

    def test_presion_default_fallback(self):
        # presion=None o 0 debe tomar por defecto 1013
        res_none = calcularCalidad(0.4, 4.0, 16, 180, 'Planetario', None)
        res_zero = calcularCalidad(0.4, 4.0, 16, 180, 'Planetario', 0)
        res_1013 = calcularCalidad(0.4, 4.0, 16, 180, 'Planetario', 1013)
        self.assertEqual(res_none, res_1013)
        self.assertEqual(res_zero, res_1013)

    def test_clamping_range_0_to_5(self):
        # Épico con todos los factores al máximo -> debe limitarse a 5
        c_epic = calcularCalidad(2.5, 12, 5, 290, 'Planetario', 990)
        self.assertEqual(c_epic, 5)

        # Condiciones pésimas de viento huracanado -> mínimo 0
        c_awful = calcularCalidad(0.36, 3, 50, 90, 'Planetario', 1025)
        self.assertGreaterEqual(c_awful, 0)
        self.assertLessEqual(c_awful, 5)

    def test_visib_argument_compatibility(self):
        # visib es opcional pero compatible con llamadas JS de 7 argumentos
        res = calcularCalidad(1.0, 8.0, 10, 290, 'Planetario', 1012, 10000)
        self.assertEqual(res, 5)

    def test_snake_case_alias(self):
        self.assertEqual(
            calcular_calidad(1.0, 8.0, 10, 290, 'Planetario'),
            calcularCalidad(1.0, 8.0, 10, 290, 'Planetario'),
        )


class TestCalibracionMediterraneo(unittest.TestCase):
    """Reglas fijadas con la calibracion real de Jordi (NOTAS-IA.md).

    El engine heredado es la referencia fisica del historico diario. Su
    algoritmo original era una traduccion del JS de MASTER_CONTEXT.md y todavia
    no recogia dos cosas del Mediterraneo: que 4-6 s es el periodo normal y que
    el viento de mar arruina un dia por debajo de unos 20 km/h.
    """

    def test_periodo_de_4_a_6_s_no_penaliza(self):
        # El estudio fisico v3 fija periodo_ideal 4-9 s y NOTAS-IA que 4-6 s es
        # lo normal: en ese rango el unico termino es la base de 2 estrellas.
        for p in (4.0, 4.5, 5.0, 5.6):
            with self.subTest(periodo=p):
                self.assertEqual(calcularCalidad(0.4, p, 8, 180, 'Planetario', 1015), 2)

    def test_periodo_muy_corto_si_penaliza(self):
        # Por debajo de 4 s el tren ya no llega bien formado a la rompiente. Con
        # terral, donde la suma cae en un medio exacto, la penalizacion se ve.
        con_corto = calcularCalidad(0.4, 3.5, 5, 290, 'Planetario', 1015)
        con_normal = calcularCalidad(0.4, 4.5, 5, 290, 'Planetario', 1015)
        self.assertEqual(con_corto, 3)
        self.assertEqual(con_normal, 4)

    def test_viento_de_mar_penaliza_desde_12_kmh(self):
        # wd=112 es ESE, de mar para Planetario (offshore 275-315).
        # Sin viento: s = 2 + 1 (h>=0.5) + 0.5 (p>=6) = 3.5 -> 4 estrellas.
        base = calcularCalidad(0.5, 6.0, 8, 112, 'Planetario', 1015)
        self.assertEqual(base, 4)
        # A 14 km/h entra el tramo de viento de mar (-0.5).
        self.assertEqual(calcularCalidad(0.5, 6.0, 14, 112, 'Planetario', 1015), 3)
        # A 12 no entra todavia.
        self.assertEqual(calcularCalidad(0.5, 6.0, 12, 112, 'Planetario', 1015), 4)

    def test_viento_de_mar_no_penaliza_si_no_sopla(self):
        # Mismo caso sin viento: la brisa no puede restar.
        self.assertEqual(calcularCalidad(0.5, 6.0, 0, 112, 'Planetario', 1015), 4)

    def test_viento_fuerte_no_se_penaliza_dos_veces(self):
        # Por encima de 20 km/h el propio tramo de viento de mar ya no resta mas:
        # solo queda el global. Asi 25 km/h de mar resta 1.5 en total (0.5 propio
        # + 1 global) y no 2.5, que es lo que pasaba con los dos tramos onshore.
        a_20 = calcularCalidad(0.5, 6.0, 20, 112, 'Planetario', 1015)
        a_25 = calcularCalidad(0.5, 6.0, 25, 112, 'Planetario', 1015)
        a_35 = calcularCalidad(0.5, 6.0, 35, 112, 'Planetario', 1015)
        self.assertEqual(a_20, 3)   # 3.5 - 0.5 propio
        self.assertEqual(a_25, 2)   # 3.5 - 0.5 propio - 1 global (>20)
        self.assertEqual(a_35, 1)   # 3.5 - 0.5 propio - 1 (>20) - 1 (>30)

    def test_sesion_real_de_jordi_30_09_en_planetario(self):
        # 30/09/2026 18:40-19h: 0.36-0.38 m y 5.6 s mar adentro con viento de
        # 6-8 km/h del ESE y rachas de 18. Jordi la describe como "casi sin olas y
        # el viento de mar lo estropeaba": no puede salir como un dia normal.
        calidad = calcularCalidad(0.37, 5.6, 7, 112, 'Planetario', 1013)
        self.assertLessEqual(calidad, 2)
        # Mismo oleaje con terral si es claramente mejor.
        con_terral = calcularCalidad(0.37, 5.6, 7, 295, 'Planetario', 1013)
        self.assertGreater(con_terral, calidad)

    def test_plato_no_tiene_un_salto_de_dos_estrellas(self):
        # Con el segundo umbral antigo (h<0.4 y p<5) un plato de 0.39 m con 5.9 s
        # se puntuaba 1 y a 0.40 m saltaba a 3. El corte queda solo en h<0.35.
        justo_debajo = calcularCalidad(0.34, 5.9, 8, 290, 'Planetario', 1015)
        justo_encima = calcularCalidad(0.35, 5.9, 8, 290, 'Planetario', 1015)
        self.assertEqual(justo_debajo, 1)
        self.assertLessEqual(abs(justo_encima - justo_debajo), 3)


class TestGroundTruthMatrix(unittest.TestCase):
    """Casos de referencia exactos validados contra la implementación JS."""

    def test_ground_truth_scenarios(self):
        scenarios = [
            # spot, h, p, dirSwell, ws, wd, presion, expected_fis, expected_cal
            ('Planetario', 1.2, 8.5, 80, 10, 290, 1010, 0.97, 5),
            ('Gurugu', 0.8, 6.0, 60, 5, 280, 1005, 0.45, 5),
            ('Burriana', 1.5, 9.0, 110, 25, 290, 990, 1.49, 5),
            ('Voramar', 2.0, 10.0, 45, 35, 90, 1015, 0.07, 4),
            ('La Renegà', 0.3, 4.0, 90, 7, 250, 1013, 0.30, 1),
            ('Peñíscola N', 0.1, 3.0, 90, 5, 270, 1013, 0.10, 0),
            ('Pirámides', 1.1, 7.5, 85, 12, 300, 1012, 0.80, 5),
            ('Nules', 0.7, 5.5, 65, 8, 290, 1007, 0.44, 5),
            ('Almenara', 1.3, 8.0, 100, 14, 280, 1002, 1.25, 5),
            ('Vinaròs', 0.9, 6.5, 75, 6, 270, 1009, 0.82, 5),
        ]

        for spot, h, p, dir_s, ws, wd, pres, exp_fis, exp_cal in scenarios:
            with self.subTest(spot=spot):
                fis = calcularFisica(spot, h, p, dir_s)
                cal = calcularCalidad(h, p, ws, wd, spot, pres)
                self.assertAlmostEqual(
                    fis, exp_fis, places=2,
                    msg=f"Error en física para {spot}: obtenido {fis}, esperado {exp_fis}"
                )
                self.assertEqual(
                    cal, exp_cal,
                    msg=f"Error en calidad para {spot}: obtenido {cal}, esperado {exp_cal}"
                )


if __name__ == '__main__':
    unittest.main()
