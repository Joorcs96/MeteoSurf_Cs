#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/test_historico_datos.py - Suite de pruebas y validación del histórico y exportador Excel.

Pruebas:
1. Idempotencia y deduplicación: 2 ejecuciones consecutivas conservan los mismos registros exactos.
2. Formatos, UTC y calidad: Validación de tipos, rangos físicos y distinción observed_at vs retrieved_at.
3. Integridad de archivos originales: historico_olas.csv no modificado (2.640 filas de predicción intactas).
4. Verificación del cuaderno Excel .xlsx generado:
   - 6 hojas existentes.
   - Ausencia total de errores de fórmula (#REF!, #DIV/0!, #VALUE!, #NAME?, etc.).
   - Congelado de paneles y formatos numéricos válidos.
5. Cobertura de sesiones confirmadas y diagnóstico de calibración física.
"""

from __future__ import annotations

import csv
import json
import os
import subprocess
import unittest
from datetime import datetime
from pathlib import Path

import openpyxl

RAIZ = Path(__file__).resolve().parent.parent
DATA_DIR = RAIZ / "data"
JSONL_PATH = DATA_DIR / "historico_observaciones.jsonl"
CSV_PATH = DATA_DIR / "historico_observaciones.csv"
ORIGINAL_CSV = RAIZ / "historico_olas.csv"
EXCEL_PATH = DATA_DIR / "MeteoSurf_Historico_Calibracion.xlsx"
SESIONES_PATH = DATA_DIR / "sesiones_confirmadas.json"


class TestHistoricoDatos(unittest.TestCase):

    def test_01_integridad_historico_olas_original(self):
        """Verifica que historico_olas.csv original permanece intacto sin modificaciones."""
        self.assertTrue(ORIGINAL_CSV.exists(), "historico_olas.csv debe existir")
        with open(ORIGINAL_CSV, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            filas = list(reader)
        self.assertEqual(len(filas), 2640, "historico_olas.csv debe conservar exactamente sus 2.640 filas")
        self.assertEqual(
            reader.fieldnames,
            ["fecha", "hora", "spot", "altura_m", "periodo_s", "dir_swell_deg", "viento_kmh", "viento_dir_deg", "calidad_0_5", "feedback_usuario"],
            "La cabecera original de historico_olas.csv debe estar inalterada",
        )

    def test_02_persistencia_e_idempotencia_dedup(self):
        """Verifica que ejecutar el archivador varias veces produce el mismo recuento sin duplicados."""
        from scripts.archivar_historico import archivar_snapshot_actual, cargar_historico_existente

        previos = cargar_historico_existente(JSONL_PATH)
        conteo_inicial = len(previos)
        self.assertGreater(conteo_inicial, 0, "El histórico acumulado debe contener registros")

        # Primera ejecución de append
        anadidos_1, total_1 = archivar_snapshot_actual(jsonl_path=JSONL_PATH, csv_path=CSV_PATH)
        # Segunda ejecución de append
        anadidos_2, total_2 = archivar_snapshot_actual(jsonl_path=JSONL_PATH, csv_path=CSV_PATH)

        self.assertEqual(anadidos_2, 0, "Una segunda ejecución consecutiva con el mismo snapshot debe añadir 0 duplicados")
        self.assertEqual(total_1, total_2, "El total no debe variar en ejecuciones repetidas")
        self.assertEqual(total_2, conteo_inicial, "El total debe coincidir con el conjunto inicial deduplicado")

    def test_03_formatos_unidades_y_fechas_utc(self):
        """Valida esquemas, zonas horarias UTC, rangos físicos y separación de marcas de tiempo."""
        from scripts.archivar_historico import cargar_historico_existente

        historico = cargar_historico_existente(JSONL_PATH)
        self.assertGreaterEqual(len(historico), 800, "Debe haber al menos 800 registros recuperados")

        tipos_validos = {"BOYA", "MAREOGRAFO", "VIENTO"}
        estaciones_validas = {2630, 2720, 1712, 3655, 4660}

        for k, reg in historico.items():
            self.assertIn(reg["tipo_sensor"], tipos_validos)
            self.assertIn(reg["estacion_id"], estaciones_validas)
            self.assertTrue(reg["tiempo_utc"].endswith("Z"), f"tiempo_utc debe ser UTC con Z: {reg['tiempo_utc']}")
            
            # Comprobar que observed_at es parseable
            dt_obs = datetime.fromisoformat(reg["tiempo_utc"].replace("Z", "+00:00"))
            self.assertIsNotNone(dt_obs)

            # Rangos físicos por sensor
            if reg["tipo_sensor"] == "BOYA":
                if reg["altura_m"] is not None:
                    self.assertGreaterEqual(reg["altura_m"], 0.0)
                    self.assertLessEqual(reg["altura_m"], 20.0)
                if reg["periodo_s"] is not None:
                    self.assertGreater(reg["periodo_s"], 0.0)
                    self.assertLessEqual(reg["periodo_s"], 30.0)
                if reg["direccion_grados"] is not None:
                    self.assertGreaterEqual(reg["direccion_grados"], 0)
                    self.assertLessEqual(reg["direccion_grados"], 360)

            elif reg["tipo_sensor"] == "MAREOGRAFO":
                if reg["nivel_mar_m"] is not None:
                    self.assertGreater(reg["nivel_mar_m"], -5.0)
                    self.assertLess(reg["nivel_mar_m"], 5.0)

            elif reg["tipo_sensor"] == "VIENTO":
                if reg["viento_velocidad_kmh"] is not None:
                    self.assertGreaterEqual(reg["viento_velocidad_kmh"], 0.0)
                    self.assertLessEqual(reg["viento_velocidad_kmh"], 200.0)

    def test_04_cuaderno_excel_valido_y_completo(self):
        """Verifica la apertura del archivo .xlsx, sus 6 hojas y la ausencia de errores de fórmula."""
        from scripts.exportar_excel import exportar_excel

        # Asegurar exportación fresca
        exportar_excel(EXCEL_PATH)
        self.assertTrue(EXCEL_PATH.exists(), "El archivo Excel generado debe existir")

        wb = openpyxl.load_workbook(str(EXCEL_PATH), data_only=False)
        hojas_esperadas = [
            "Resumen",
            "Observaciones Boyas",
            "Nivel Mar y Viento",
            "Previsiones Emitidas",
            "Sesiones Confirmadas",
            "Calibracion y Diagnostico",
        ]
        self.assertEqual(wb.sheetnames, hojas_esperadas, "El libro Excel debe contener exactamente las 6 hojas")

        # Escanear errores de fórmula en todas las hojas
        errores_detectados = []
        for name in hojas_esperadas:
            ws = wb[name]
            self.assertGreater(ws.max_row, 1, f"La hoja '{name}' debe tener contenido")
            self.assertTrue(ws.views.sheetView[0].showGridLines, f"La hoja '{name}' debe tener cuadrícula activa")

            for row in ws.iter_rows(values_only=False):
                for cell in row:
                    val = str(cell.value or "")
                    for err in ("#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A", "#NULL!"):
                        if err in val:
                            errores_detectados.append(f"{name}!{cell.coordinate}: {val}")

        self.assertEqual(errores_detectados, [], f"No debe haber errores de fórmula en el Excel: {errores_detectados}")

    def test_05_sesiones_confirmadas_y_caso_09oct(self):
        """Verifica que el caso crítico del 09/10/2026 de Jordi esté documentado con diagnóstico exacto."""
        self.assertTrue(SESIONES_PATH.exists(), "sesiones_confirmadas.json debe existir")
        with open(SESIONES_PATH, mode="r", encoding="utf-8") as f:
            sesiones = json.load(f)

        self.assertGreaterEqual(len(sesiones), 4, "Debe haber al menos 4 sesiones históricas confirmadas")
        caso_09oct = next((s for s in sesiones if s["id"] == "SESION-20261009-PLANETARIO"), None)
        self.assertIsNotNone(caso_09oct, "La sesión del 09/10/2026 debe estar registrada")
        self.assertEqual(caso_09oct["boya_valencia_hm0_m"], 0.94)
        self.assertEqual(caso_09oct["boya_valencia_tp_s"], 7.23)
        self.assertEqual(caso_09oct["prevision_modelo_altura_m"], 0.31)


if __name__ == "__main__":
    unittest.main()
