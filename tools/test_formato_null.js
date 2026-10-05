import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS } from '../js/spots.js';
import * as F from '../js/forecast.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'js/app.js');
const ASSISTANT = path.join(ROOT, 'js/assistant.js');

function extractFn(file, name) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => l.includes(`const ${name} = `) || l.includes(`function ${name}(`));
  if (start < 0) throw new Error(`No se encuentra ${name} en ${file}`);
  if (/;\s*$/.test(lines[start]) && !/^\s*\};?\s*$/.test(lines[start])) return lines[start].trim();
  let src = lines[start];
  for (let i = start + 1; i < lines.length; i++) {
    src += '\n' + lines[i];
    if (/^\s*\};?\s*$/.test(lines[i])) return src.trim();
  }
  throw new Error(`No se cierra ${name} en ${file}`);
}

const load = (file, name) => new Function(extractFn(file, name) + `\nreturn ${name};`)();

const range = load(APP, 'range');
const kmh = load(APP, 'kmh');
const rnd = load(APP, 'rnd');
const starRating = load(APP, 'starRating');
const fmtRange = load(ASSISTANT, 'fmtRange');
const kmhAs = load(ASSISTANT, 'kmh');

let passed = 0;
let total = 0;
function test(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  [OK] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

const spot = SPOTS.find((s) => s.id === 'Planetario');
const srcApp = fs.readFileSync(APP, 'utf8');
const srcAssistant = fs.readFileSync(ASSISTANT, 'utf8');

console.log('======================================================================');
console.log('PRUEBAS DE FORMATO: NULO vs 0 Y RANGOS DE ALTURA (código real de js/)');
console.log('======================================================================\n');

console.log('1. Regresión: range() con {min,max} sin mid NO puede devolver siempre guion');
test('range({min,max}) devuelve el rango, no "–" (regresión de 89c1d42)', () => {
  assert.strictEqual(range({ min: 0.3, max: 0.7 }), '0.3–0.7');
  assert.strictEqual(range({ min: 1.1, max: 2.4 }), '1.1–2.4');
  assert.strictEqual(range({ min: 0.2, max: 1.6 }), '0.2–1.6');
});
test('range() no debe decidir la validez por s.mid', () => {
  assert.ok(!extractFn(APP, 'range').includes('s.mid'), 'range() sigue guardando por s.mid');
});
test('range() con mid presente sigue funcionando', () => {
  assert.strictEqual(range({ min: 0.4, max: 0.9, mid: 0.65 }), '0.4–0.9');
});
test('range() mar plano devuelve 0–0.2', () => {
  assert.strictEqual(range({ min: 0.1, max: 0.1, mid: 0.1 }), '0–0.2');
  assert.strictEqual(range({ min: 0, max: 0.15 }), '0–0.2');
});
test('range() sin datos o NaN devuelve guion y nunca NaN', () => {
  assert.strictEqual(range({ min: null, max: null }), '–');
  assert.strictEqual(range({ min: NaN, max: NaN }), '–');
  assert.strictEqual(range(null), '–');
  assert.strictEqual(range(undefined), '–');
  assert.ok(!range({ min: null, max: null }).includes('NaN'));
});
test('todos los range({min,max}) de app.js pasan min y max', () => {
  const calls = srcApp.match(/range\(\{[^}]*\}\)/g) || [];
  assert.ok(calls.length >= 3, `se esperaban al menos 3 llamadas range({min,max}), hay ${calls.length}`);
  calls.forEach((c) => {
    assert.ok(c.includes('min'), `llamada sin min: ${c}`);
    assert.ok(c.includes('max'), `llamada sin max: ${c}`);
  });
});

console.log('\n2. Nulo no puede vestirse de 0 en viento y rachas');
test('kmh(null) y rnd(null) muestran guion, no 0', () => {
  assert.strictEqual(kmh(null), '–');
  assert.strictEqual(kmh(undefined), '–');
  assert.strictEqual(kmh(NaN), '–');
  assert.strictEqual(rnd(null), '–');
  assert.strictEqual(rnd(NaN), '–');
});
test('kmh(0) sí es 0 km/h: el cero medido es un dato válido', () => {
  assert.strictEqual(kmh(0), '0 km/h');
  assert.strictEqual(kmh(12.6), '13 km/h');
  assert.strictEqual(kmh(12.4), '12 km/h');
  assert.strictEqual(rnd(30.2), 30);
  assert.strictEqual(`${rnd(30.2)}`, '30');
});
test('el asistente usa el mismo kmh y no Math.round(windSpeed)', () => {
  assert.strictEqual(kmhAs(null), '–');
  assert.strictEqual(kmhAs(9.7), '10 km/h');
  const sinGuarda = /Math\.round\([A-Za-z_.?]*wind(?:Speed|Gust)\)/;
  [srcApp, srcAssistant].forEach((src) => {
    src.split(/\r?\n/).forEach((line, i) => {
      if (!sinGuarda.test(line)) return;
      assert.ok(line.includes('!= null'), `Math.round de viento sin guarda de nulo en línea ${i + 1}: ${line.trim()}`);
    });
  });
});

console.log('\n3. Rango de altura del asistente: sin datos no puede decir 0–0 m');
test('fmtRange distingue sin datos de mar plano', () => {
  assert.strictEqual(fmtRange(null, null), '–');
  assert.strictEqual(fmtRange(0.3, 0.7), '0.3–0.7');
  assert.strictEqual(fmtRange(0.1, 0.1), '0–0.2');
  assert.notStrictEqual(fmtRange(null, null), '0–0.2', 'sin datos no puede parecer mar plano');
});
test('Math.min de nulos no llega a formatear alturas', () => {
  const mins = [null, null].filter((v) => v != null && !isNaN(v));
  const maxs = [null, null].filter((v) => v != null && !isNaN(v));
  assert.strictEqual(fmtRange(mins.length ? Math.min(...mins) : null, maxs.length ? Math.max(...maxs) : null), '–');
});

console.log('\n4. Cinco estrellas tienen que justificar buenas condiciones');
const winds = [
  { key: 'glassy', label: 'Calma' },
  { key: 'offshore', label: 'Terral' },
  { key: 'crossoff', label: 'Terral cruzado' },
  { key: 'cross', label: 'Cruzado' },
  { key: 'onshore', label: 'De mar' }
];
const periods = [3, 4, 5, 6, 7, 8, 9, 11];
test('con menos de 1.05 m en rompiente nunca salen 5 estrellas', () => {
  let nasty = null;
  for (let h = 0.22; h < 1.05; h += 0.01) {
    for (const p of periods) {
      for (const w of winds) {
        for (const v of [0, 5, 12, 25, 40]) {
          const r = F.rate(spot, { mid: h }, p, w, v, v + 6);
          if (starRating(r) >= 5) nasty = `h=${h.toFixed(2)} p=${p} ${w.key} ${v}km/h -> r${r} ${starRating(r)}★`;
        }
      }
    }
  }
  assert.strictEqual(nasty, null, `5★ con mar pequeño: ${nasty}`);
});
test('1.2 m limpios (7 s y calma) sí alcanzan 5 estrellas', () => {
  const r = F.rate(spot, { mid: 1.2 }, 7, { key: 'glassy', label: 'Calma' }, 8, 10);
  assert.strictEqual(starRating(r), 5, `1.2 m/7 s/calma dio r${r} (${starRating(r)}★)`);
  assert.ok(r >= 6, `1.2 m/7 s/calma dio r${r}, se esperaba r>=6`);
});
test('las estrellas no bajan al subir la altura con viento limpio', () => {
  let prev = -1;
  for (let h = 0.3; h <= 2.2; h += 0.05) {
    const st = starRating(F.rate(spot, { mid: h }, 8, { key: 'offshore', label: 'Terral' }, 10, 12));
    assert.ok(st >= prev, `estrellas bajaron de ${prev} a ${st} con h=${h.toFixed(2)}`);
    prev = st;
  }
});
test('mar plato es 0 y sin datos es null: nunca se confunden', () => {
  assert.strictEqual(F.rate(spot, { mid: 0.15 }, 8, { key: 'glassy' }, 2, 4), 0);
  assert.strictEqual(F.rate(spot, { mid: null }, 8, { key: 'glassy' }, 2, 4), null);
  assert.strictEqual(starRating(0), 0);
  assert.strictEqual(starRating(null), 0);
});

console.log('\n======================================================================');
if (passed === total) {
  console.log(`TODAS LAS PRUEBAS SUPERADAS: ${passed}/${total}.`);
} else {
  console.log(`FALLOS: ${total - passed}/${total}.`);
}
console.log('======================================================================\n');
process.exit(process.exitCode || 0);