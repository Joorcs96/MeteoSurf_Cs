import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// 1. MEJ-04 en index.html
const indexPath = path.join(ROOT, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf-8');

const targetIndex = `<div class="pro-modal-overlay" id="pro-modal" role="dialog" aria-modal="true" aria-labelledby="pro-modal-title" style="display:none">
    <div class="pro-modal-card">
      <span class="pro-badge-top">METEOSURF PRO</span>
      <h2 id="pro-modal-title" class="pro-modal-title">Desbloquea MeteoSurf Pro</h2>
      <div class="pro-modal-price">
        <span class="pro-price-num">2,99 €</span>
        <span class="pro-price-period">/mes</span>
      </div>
      <p class="pro-modal-sub">Todo el potencial para no perderte ni un solo baño.</p>
      <ul class="pro-modal-features">
        <li><span class="pro-check" aria-hidden="true">✓</span> Previsión completa 16 días</li>
        <li><span class="pro-check" aria-hidden="true">✓</span> Rewind de cámaras ilimitado</li>
        <li><span class="pro-check" aria-hidden="true">✓</span> Alertas push de condiciones</li>
        <li><span class="pro-check" aria-hidden="true">✓</span> Soporte para más spots</li>
        <li><span class="pro-check" aria-hidden="true">✓</span> Sin publicidad</li>
      </ul>
      <div class="pro-modal-actions">
        <a href="#/pro" class="btn pro-btn-primary" id="pro-subscribe-btn">Suscribirse</a>
        <button type="button" class="btn pro-btn-secondary" id="pro-dismiss-btn">Ahora no</button>
      </div>
    </div>
  </div>`;

const replIndex = `<div class="pro-modal-overlay" id="pro-modal" role="dialog" aria-modal="true" aria-labelledby="pro-modal-title" style="display:none">
    <div class="pro-modal-card">
      <span class="pro-badge-top">METEOSURF PRO · EVALUACIÓN</span>
      <h2 id="pro-modal-title" class="pro-modal-title">MeteoSurf Pro (En evaluación)</h2>
      <div class="pro-modal-price">
        <span class="pro-price-num">2,99 €</span>
        <span class="pro-price-period">/mes (hipotético)</span>
      </div>
      <p class="pro-modal-sub">Evaluación técnica y lista de espera. Actualmente el servicio es 100% gratuito y sin cobros activos.</p>
      <ul class="pro-modal-features">
        <li><span class="pro-check" aria-hidden="true">✓</span> Previsión completa 16 días</li>
        <li><span class="pro-check" aria-hidden="true">✓</span> Rewind de cámaras ilimitado</li>
        <li><span class="pro-check" aria-hidden="true">✓</span> Alertas de condiciones</li>
        <li><span class="pro-check" aria-hidden="true">✓</span> Soporte para más spots</li>
        <li><span class="pro-check" aria-hidden="true">✓</span> Sin publicidad</li>
      </ul>
      <div class="pro-modal-actions">
        <a href="#/pro" class="btn pro-btn-primary" id="pro-subscribe-btn">Ver hoja de ruta</a>
        <button type="button" class="btn pro-btn-secondary" id="pro-dismiss-btn">Entendido</button>
      </div>
    </div>
  </div>`;

const normIndex = indexContent.replace(/\r\n/g, '\n');
const normTargetIndex = targetIndex.replace(/\r\n/g, '\n');
const normReplIndex = replIndex.replace(/\r\n/g, '\n');

if (normIndex.includes(normTargetIndex)) {
  const updated = normIndex.replace(normTargetIndex, normReplIndex);
  fs.writeFileSync(indexPath, updated.replace(/\n/g, '\r\n'), 'utf-8');
  console.log('index.html actualizado con microcopia honesta de pro modal.');
} else {
  console.warn('Target index no encontrado en index.html');
}

// 2. MEJ-04 y MEJ-05 en js/app.js
const appPath = path.join(ROOT, 'js/app.js');
let appContent = fs.readFileSync(appPath, 'utf-8');
let normApp = appContent.replace(/\r\n/g, '\n');

// 2.1 MEJ-04 banner en assistant
const targetAssistantBanner = `<span>Previsión 16 días, rewind ilimitado y alertas personalizadas por 2,99 €/mes.</span>`;
const replAssistantBanner = `<span>Evaluación técnica de funciones avanzadas. Actualmente todas las funciones son 100% gratuitas.</span>`;
if (normApp.includes(targetAssistantBanner)) {
  normApp = normApp.replace(targetAssistantBanner, replAssistantBanner);
  console.log('js/app.js banner asistente actualizado.');
}

// 2.2 MEJ-04 renderPro
const targetRenderPro = `function renderPro() {
  document.title = 'MeteoSurf Pro · MeteoSurf_Cs';
  view.innerHTML = \`
    <div class="region-head">
      <div>
        <span class="pro-badge" style="margin-bottom:8px">PRO</span>
        <h1>MeteoSurf Pro</h1>
        <p>2,99 €/mes · Acceso completo a todas las funciones avanzadas</p>
      </div>
    </div>
    <div class="card pad" style="max-width:540px;margin:24px auto;text-align:center">
      <h2 style="margin-top:0">¡Gracias por tu interés en MeteoSurf Pro!</h2>
      <p style="color:var(--text-2);margin-bottom:20px">La suscripción Pro estará disponible en la próxima actualización con pasarela directa.</p>`;

const replRenderPro = `function renderPro() {
  document.title = 'MeteoSurf Pro · MeteoSurf_Cs';
  view.innerHTML = \`
    <div class="region-head">
      <div>
        <span class="pro-badge" style="margin-bottom:8px">PRO</span>
        <h1>MeteoSurf Pro (En evaluación)</h1>
        <p>Actualmente 100% gratuito · Fase de evaluación técnica y lista de espera</p>
      </div>
    </div>
    <div class="card pad" style="max-width:540px;margin:24px auto;text-align:center">
      <h2 style="margin-top:0">¡Gracias por tu interés en MeteoSurf Pro!</h2>
      <p style="color:var(--text-2);margin-bottom:20px">MeteoSurf_Cs es un proyecto independiente 100% gratuito. Evaluamos el interés de funciones avanzadas sin ningún cobro activo.</p>`;

if (normApp.includes(targetRenderPro)) {
  normApp = normApp.replace(targetRenderPro, replRenderPro);
  console.log('js/app.js renderPro actualizado.');
}

// 2.3 MEJ-05 Botón reintentar en estado offline
const targetErrorBanner = `  } catch (e) {
    view.insertAdjacentHTML('afterbegin', \`<div class="banner">No se ha podido descargar la previsión (\${esc(e.message)}). Revisa la conexión y vuelve a intentarlo.</div>\`);
    return;
  }`;

const replErrorBanner = `  } catch (e) {
    view.insertAdjacentHTML('afterbegin', \`<div class="banner" id="error-banner" role="alert" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <span>No se ha podido descargar la previsión (\${esc(e.message)}). Revisa la conexión y vuelve a intentarlo.</span>
      <button type="button" class="btn" id="btn-reintentar" style="min-height:44px;min-width:44px;padding:8px 16px;cursor:pointer">Reintentar</button>
    </div>\`);
    document.getElementById('btn-reintentar')?.addEventListener('click', () => {
      document.getElementById('error-banner')?.remove();
      refresh(true);
    });
    return;
  }`;

if (normApp.includes(targetErrorBanner)) {
  normApp = normApp.replace(targetErrorBanner, replErrorBanner);
  console.log('js/app.js error banner con botón reintentar añadido.');
}

fs.writeFileSync(appPath, normApp.replace(/\n/g, '\r\n'), 'utf-8');
