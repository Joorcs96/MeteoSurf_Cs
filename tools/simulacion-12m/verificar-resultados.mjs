import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutarSimulacion } from './simular.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function verificarArchivo(nombreArchivo, mesesEsperados) {
  const filePath = path.join(__dirname, nombreArchivo);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Archivo no encontrado: ${nombreArchivo}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`\nVerificando invariantes en ${nombreArchivo}...`);

  if (data.mesesSimulados !== mesesEsperados) {
    throw new Error(`Meses simulados incorrectos: esperado ${mesesEsperados}, obtenido ${data.mesesSimulados}`);
  }

  const escenarios = ['conservador', 'base', 'favorable'];
  for (const esc of escenarios) {
    const escData = data.escenarios[esc];
    if (!escData) throw new Error(`Escenario ausente: ${esc}`);
    if (escData.meses.length !== mesesEsperados) {
      throw new Error(`Escenario ${esc} no tiene ${mesesEsperados} meses`);
    }

    for (const m of escData.meses) {
      // Invariante 1: No negatividad
      if (m.usuariosNuevos < 0) throw new Error(`Mes ${m.mes} nuevos negativos en ${esc}`);
      if (m.usuariosActivosMensuales < 0) throw new Error(`Mes ${m.mes} activos negativos en ${esc}`);
      if (m.abandonos < 0) throw new Error(`Mes ${m.mes} abandonos negativos en ${esc}`);

      // Invariante 2: Conversiones no superan activos
      const conv = m.modeloInversion.conversionesProSimuladas;
      if (conv < 0) throw new Error(`Mes ${m.mes} conversiones negativas en ${esc}`);
      if (conv > m.usuariosActivosMensuales) {
        throw new Error(`Mes ${m.mes} conversiones (${conv}) superan activos (${m.usuariosActivosMensuales}) en ${esc}`);
      }

      // Invariante 3: Ingresos no negativos
      if (m.modeloInversion.ingresosBrutosEur < 0) throw new Error(`Mes ${m.mes} ingresos brutos negativos`);
      if (m.modeloInversion.ingresosNetosEur < 0) throw new Error(`Mes ${m.mes} ingresos netos negativos`);

      // Invariante 4: Suma de cohortes coincide exactamente con el total
      const sumaNuevosCohortes = Object.values(m.nuevosPorCohorte).reduce((a, b) => a + b, 0);
      if (sumaNuevosCohortes !== m.usuariosNuevos) {
        throw new Error(`Mes ${m.mes} suma cohortes nuevos (${sumaNuevosCohortes}) != total (${m.usuariosNuevos}) en ${esc}`);
      }
      const sumaActivosCohortes = Object.values(m.activosPorCohorte).reduce((a, b) => a + b, 0);
      if (sumaActivosCohortes !== m.usuariosActivosMensuales) {
        throw new Error(`Mes ${m.mes} suma cohortes activos (${sumaActivosCohortes}) != total (${m.usuariosActivosMensuales}) en ${esc}`);
      }
    }
  }

  // Invariante 5: Sensibilidad coherente
  const sens = data.sensibilidad;
  if (!(sens.comparativaActivosFinales.conservador <= sens.comparativaActivosFinales.base &&
        sens.comparativaActivosFinales.base <= sens.comparativaActivosFinales.favorable)) {
    throw new Error(`Invariante de sensibilidad de activos falló en ${nombreArchivo}`);
  }
  if (!(sens.comparativaIngresosNetos.conservador <= sens.comparativaIngresosNetos.base &&
        sens.comparativaIngresosNetos.base <= sens.comparativaIngresosNetos.favorable)) {
    throw new Error(`Invariante de sensibilidad de ingresos falló en ${nombreArchivo}`);
  }

  console.log(`[PASS] Todos los invariantes verificados con éxito en ${nombreArchivo}.`);
}

function verificarIdempotencia() {
  console.log('\nVerificando prueba de idempotencia estricta (2 ejecuciones consecutivas)...');
  ejecutarSimulacion('all');
  const path6m = path.join(__dirname, 'resultados-base-6m.json');
  const path12m = path.join(__dirname, 'resultados-anual-12m.json');

  const content6m_1 = fs.readFileSync(path6m, 'utf-8');
  const content12m_1 = fs.readFileSync(path12m, 'utf-8');
  const hash6m_1 = crypto.createHash('sha256').update(content6m_1).digest('hex');
  const hash12m_1 = crypto.createHash('sha256').update(content12m_1).digest('hex');

  // Segunda ejecución
  ejecutarSimulacion('all');
  const content6m_2 = fs.readFileSync(path6m, 'utf-8');
  const content12m_2 = fs.readFileSync(path12m, 'utf-8');
  const hash6m_2 = crypto.createHash('sha256').update(content6m_2).digest('hex');
  const hash12m_2 = crypto.createHash('sha256').update(content12m_2).digest('hex');

  if (hash6m_1 !== hash6m_2) {
    throw new Error('Fallo de idempotencia en resultados-base-6m.json: hashes distintos');
  }
  if (hash12m_1 !== hash12m_2) {
    throw new Error('Fallo de idempotencia en resultados-anual-12m.json: hashes distintos');
  }
  console.log(`[PASS] Idempotencia estricta verificada: SHA256 6M=${hash6m_1.slice(0, 10)}..., SHA256 12M=${hash12m_1.slice(0, 10)}...`);
}

function main() {
  console.log('=== BATERÍA DE VERIFICACIÓN DE INVARIANTES Y REPRODUCIBILIDAD ===');
  ejecutarSimulacion('all');
  verificarArchivo('resultados-base-6m.json', 6);
  verificarArchivo('resultados-anual-12m.json', 12);
  verificarIdempotencia();
  console.log('\n[VERIFICADO] Batería de simulación completa superada al 100% sin excepciones.\n');
}

main();
