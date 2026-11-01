import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Generador pseudo-aleatorio determinista Mulberry32
function createRng(seedStr) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let s = h >>> 0;
  return function nextFloat() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simularVentana(supuestos, mesesTotales, escenarioClave) {
  const rng = createRng(`${supuestos.semilla}-${mesesTotales}-${escenarioClave}`);
  const escenarioCfg = supuestos.escenarios[escenarioClave];
  const cohortesKeys = Object.keys(supuestos.cohortes);
  
  // Base de adquisición inicial distribuida
  const baseAdquisicionTotal = supuestos.usuariosTotalesSinteticos;
  const meses = [];
  
  let baseAcumuladaPorCohorte = {};
  for (const cKey of cohortesKeys) {
    baseAcumuladaPorCohorte[cKey] = 0;
  }

  for (let mIdx = 0; mIdx < mesesTotales; mIdx++) {
    const est = supuestos.estacionalidadMediterranea[mIdx % 12];
    const mesNum = mIdx + 1;

    // Cálculo de nuevos usuarios para este mes
    // Distribución a lo largo del año con peso estacional (más en otoño/invierno por olas y en verano por turismo)
    const factorEstacionalAdq = (est.factorOleaje * 0.6) + (est.factorTurismo * 0.4);
    const cuotaMes = (baseAdquisicionTotal / 12) * factorEstacionalAdq * escenarioCfg.multiplicadorAdquisicion;
    // Variación determinista suave ±5%
    const jitter = 0.95 + (rng() * 0.10);
    const nuevosMesTotal = Math.max(10, Math.round(cuotaMes * jitter));

    const nuevosPorCohorte = {};
    let sumaNuevos = 0;
    for (let i = 0; i < cohortesKeys.length; i++) {
      const cKey = cohortesKeys[i];
      const cCfg = supuestos.cohortes[cKey];
      if (i === cohortesKeys.length - 1) {
        nuevosPorCohorte[cKey] = nuevosMesTotal - sumaNuevos;
      } else {
        const n = Math.round(nuevosMesTotal * cCfg.peso);
        nuevosPorCohorte[cKey] = n;
        sumaNuevos += n;
      }
    }

    // Retención y activos por cohorte
    const activosPorCohorte = {};
    const retencionD7PorCohorte = {};
    const retencionD30PorCohorte = {};
    const abandonosPorCohorte = {};
    let activosTotales = 0;
    let abandonosTotales = 0;
    let sesionesTotales = 0;
    let consultasSpotTotales = 0;
    let conversionesProTotales = 0;

    for (const cKey of cohortesKeys) {
      const cCfg = supuestos.cohortes[cKey];
      // Tasa de retención según estacionalidad y cohorte
      let factorRet = est.factorRetencion * escenarioCfg.multiplicadorRetencion;
      if (cKey === 'visitante_fin_semana') {
        factorRet *= (est.estacion === 'verano' ? 1.3 : 0.85);
      } else if (cKey === 'habitual_local' || cKey === 'avanzado') {
        factorRet *= (est.factorOleaje >= 1.2 ? 1.25 : 0.90);
      }

      const tasaAbandono = Math.min(0.80, Math.max(0.02, (cCfg.abandonoBaseMensual + escenarioCfg.tasaAbandonoExtra) / factorRet));
      const abandono = Math.round(baseAcumuladaPorCohorte[cKey] * tasaAbandono);
      abandonosPorCohorte[cKey] = abandono;
      abandonosTotales += abandono;

      baseAcumuladaPorCohorte[cKey] = Math.max(0, baseAcumuladaPorCohorte[cKey] - abandono) + nuevosPorCohorte[cKey];
      activosPorCohorte[cKey] = baseAcumuladaPorCohorte[cKey];
      activosTotales += activosPorCohorte[cKey];

      // D7 y D30 simulados
      const d7 = Math.min(0.95, Math.max(0.05, (1 - tasaAbandono) * (0.75 + (rng() * 0.1))));
      const d30 = Math.min(0.90, Math.max(0.02, (1 - tasaAbandono) * (0.50 + (rng() * 0.1))));
      retencionD7PorCohorte[cKey] = Math.round(d7 * 1000) / 10;
      retencionD30PorCohorte[cKey] = Math.round(d30 * 1000) / 10;

      // Frecuencia de sesiones
      const freq = cCfg.frecuenciaBaseMensual * est.factorOleaje * (0.95 + (rng() * 0.10));
      const ses = Math.round(activosPorCohorte[cKey] * freq);
      sesionesTotales += ses;
      consultasSpotTotales += Math.round(ses * 2.8);

      // Conversiones hipotéticas a Pro
      const tasaConv = Math.min(0.20, Math.max(0.001, cCfg.tasaConversionProBase * escenarioCfg.multiplicadorConversion * factorRet));
      const conv = Math.round(activosPorCohorte[cKey] * tasaConv);
      conversionesProTotales += conv;
    }

    // Activaciones
    // Activación PWA: 78% de nuevos usuarios
    const activadosPWA = Math.round(nuevosMesTotal * 0.78);
    // Activación Móvil Fase 1: apertura de tab y uso disponible (35% de los que prueban app)
    const activadosMovilFase1 = Math.round(nuevosMesTotal * 0.22 * 0.35);

    // Métricas de producto simuladas
    const wauMauRatio = Math.round((0.42 + (est.factorOleaje * 0.12)) * 100) / 100;
    const wauSimulado = Math.round(activosTotales * wauMauRatio);

    // Embudo de valor
    const embudo = {
      vistasPortada: sesionesTotales,
      aperturasSpot: consultasSpotTotales,
      vistasHorarias: Math.round(consultasSpotTotales * 0.65),
      consultasCamara: Math.round(consultasSpotTotales * (est.estacion === 'verano' ? 0.70 : 0.45)),
      reportesOlasHeSurfeado: Math.round(activosTotales * 0.12)
    };

    // Modelo financiero
    const precioPro = supuestos.modeloFinanciero.precioProHipoteticoMensual;
    const comision = supuestos.modeloFinanciero.comisionPlataformaPct;
    const ingresosBrutos = Math.round(conversionesProTotales * precioPro * 100) / 100;
    const ingresosNetos = Math.round(ingresosBrutos * (1 - comision) * 100) / 100;

    // Costes
    const costesConocidos = supuestos.modeloFinanciero.costes.hosting + supuestos.modeloFinanciero.costes.apiOpenMeteo;
    const margenNeto = ingresosNetos - costesConocidos;

    meses.push({
      mes: mesNum,
      nombreMes: est.nombre,
      estacion: est.estacion,
      usuariosNuevos: nuevosMesTotal,
      nuevosPorCohorte,
      usuariosActivosMensuales: activosTotales,
      activosPorCohorte,
      usuariosActivosSemanales: wauSimulado,
      ratioWauMau: wauMauRatio,
      activadosPWA,
      activadosMovilFase1,
      abandonos: abandonosTotales,
      retornosSimulados: Math.max(0, activosTotales - nuevosMesTotal),
      tasaRetencionD7Promedio: Math.round(Object.values(retencionD7PorCohorte).reduce((a, b) => a + b, 0) / cohortesKeys.length * 10) / 10,
      tasaRetencionD30Promedio: Math.round(Object.values(retencionD30PorCohorte).reduce((a, b) => a + b, 0) / cohortesKeys.length * 10) / 10,
      sesionesTotales,
      consultasSpotTotales,
      embudoValor: embudo,
      modeloInversion: {
        conversionesProSimuladas: conversionesProTotales,
        tasaConversionGlobalPct: Math.round((conversionesProTotales / (activosTotales || 1)) * 1000) / 10,
        precioProHipotetico: precioPro,
        ingresosBrutosEur: ingresosBrutos,
        ingresosNetosEur: ingresosNetos,
        costesConocidosEur: costesConocidos,
        costesPendientes: {
          dominioPersonalizado: "null (sin dominio de pago)",
          apiComercialSla: "null (Open-Meteo free tier actual)",
          soporteMantenimiento: "null (voluntario no computado)"
        },
        margenNetoEur: margenNeto,
        cacLtvAnalisis: "No calculable con evidencia actual (inversión de marketing = 0€; adquisición 100% orgánica)"
      }
    });
  }

  // Resumen agregado
  const totalNuevos = meses.reduce((s, m) => s + m.usuariosNuevos, 0);
  const totalSesiones = meses.reduce((s, m) => s + m.sesionesTotales, 0);
  const totalIngresosNetos = Math.round(meses.reduce((s, m) => s + m.modeloInversion.ingresosNetosEur, 0) * 100) / 100;
  const activosFinales = meses[meses.length - 1].usuariosActivosMensuales;

  return {
    mesesTotales,
    escenario: escenarioClave,
    resumen: {
      totalUsuariosNuevos: totalNuevos,
      usuariosActivosFinales: activosFinales,
      sesionesTotalesAcumuladas: totalSesiones,
      ingresosNetosAcumuladosEur: totalIngresosNetos,
      costeServidorAcumuladoEur: 0.0
    },
    meses
  };
}

export function ejecutarSimulacion(modo = 'all') {
  const supuestosPath = path.join(__dirname, 'supuestos.json');
  const supuestos = JSON.parse(fs.readFileSync(supuestosPath, 'utf-8'));

  const generarArchivo = (meses, archivoSalida) => {
    const escenarios = {};
    for (const esc of ['conservador', 'base', 'favorable']) {
      escenarios[esc] = simularVentana(supuestos, meses, esc);
    }

    const payload = {
      generadoEl: "2026-10-26T00:50:00.000Z",
      semilla: supuestos.semilla,
      mesesSimulados: meses,
      escenarios,
      sensibilidad: {
        comparativaActivosFinales: {
          conservador: escenarios.conservador.resumen.usuariosActivosFinales,
          base: escenarios.base.resumen.usuariosActivosFinales,
          favorable: escenarios.favorable.resumen.usuariosActivosFinales
        },
        comparativaIngresosNetos: {
          conservador: escenarios.conservador.resumen.ingresosNetosAcumuladosEur,
          base: escenarios.base.resumen.ingresosNetosAcumuladosEur,
          favorable: escenarios.favorable.resumen.ingresosNetosAcumuladosEur
        }
      }
    };

    const strJson = JSON.stringify(payload, null, 2);
    const hash = crypto.createHash('sha256').update(strJson).digest('hex');
    payload.checksumSha256 = hash;

    const outPath = path.join(__dirname, archivoSalida);
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`Generado ${archivoSalida} (Checksum: ${hash.slice(0, 12)}...)`);
    return payload;
  };

  if (modo === 'base_6m' || modo === 'all') {
    generarArchivo(6, 'resultados-base-6m.json');
  }
  if (modo === 'anual_12m' || modo === 'all') {
    generarArchivo(12, 'resultados-anual-12m.json');
  }
}

// Ejecución CLI directa
const args = process.argv.slice(2);
let scenarioArg = 'all';
const idx = args.indexOf('--scenario');
if (idx !== -1 && args[idx + 1]) {
  scenarioArg = args[idx + 1];
}

ejecutarSimulacion(scenarioArg);
