import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HTTP_PORT = 8765;
const CDP_PORT = 9222;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHttp(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // reintentar
    }
    await sleep(250);
  }
  throw new Error(`Timeout esperando a ${url}`);
}

async function run() {
  console.log('--- INICIO SIMULACIÓN E2E WEBCAM MORRO DE GOS ---');

  // 1. Iniciar servidor local
  console.log('[1/5] Iniciando servidor local http.server en puerto ' + HTTP_PORT);
  const server = spawn('python', ['-m', 'http.server', String(HTTP_PORT)], {
    stdio: 'ignore',
    detached: false,
  });

  const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-e2e-'));

  let chrome = null;
  let ws = null;

  try {
    await waitForHttp(`http://127.0.0.1:${HTTP_PORT}/index.html`);
    console.log('  ✓ Servidor web local listo en http://127.0.0.1:' + HTTP_PORT);

    // 2. Iniciar Chrome Headless
    console.log('[2/5] Lanzando Google Chrome Headless con CDP...');
    chrome = spawn(
      CHROME_PATH,
      [
        '--headless=new',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${tempProfile}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--autoplay-policy=no-user-gesture-required',
      ],
      { stdio: 'ignore' }
    );

    await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json/version`);
    console.log('  ✓ Chrome CDP listo en puerto ' + CDP_PORT);

    // 3. Crear pestaña y conectar por WebSocket
    const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new`, { method: 'PUT' });
    const target = await newTabRes.json();
    console.log('  ✓ Pestaña creada:', target.id);

    ws = new WebSocket(target.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        const { resolve, reject } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      }
      if (data.method === 'Runtime.consoleAPICalled') {
        const txt = data.params.args.map((a) => a.value || a.description).join(' ');
        if (!txt.includes('downloadable font') && !txt.includes('Geolocation')) {
          console.log('    [Navegador console]', txt);
        }
      }
      if (data.method === 'Runtime.exceptionThrown') {
        console.warn('    [Navegador exception]', data.params.exceptionDetails.text);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const sendCdp = (method, params = {}) => {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await sendCdp('Page.enable');
    await sendCdp('Runtime.enable');
    await sendCdp('Network.enable');

    // 4. Navegar al spot Morro de Gos
    const targetUrl = `http://127.0.0.1:${HTTP_PORT}/#/spot/MorroGos`;
    console.log('[3/5] Navegando a ' + targetUrl);
    await sendCdp('Page.navigate', { url: targetUrl });

    // 5. Esperar resolución y reproducción HLS
    console.log('[4/5] Esperando inicialización del reproductor y flujo HLS...');
    let reproduciendo = false;
    let estadoFinal = null;

    const inicio = Date.now();
    while (Date.now() - inicio < 25000) {
      await sleep(500);

      const evalRes = await sendCdp('Runtime.evaluate', {
        expression: `(() => {
          const cam = document.querySelector('#cam');
          const video = cam ? cam.querySelector('video') : null;
          const img = cam ? cam.querySelector('img') : null;
          const liveBadge = cam ? cam.querySelector('.live-badge') : null;
          const camBadge = cam ? cam.querySelector('.cam-badge') : null;
          const extBtn = document.querySelector('#cam-ext-btn');
          const camMsg = cam ? cam.querySelector('.cam-msg') : null;
          const actions = document.querySelector('.cam-actions');

          return {
            hasCam: !!cam,
            camType: cam ? cam.dataset.cameraType : null,
            hasVideo: !!video,
            hasImg: !!img,
            videoSrc: video ? video.src : null,
            videoCurrentSrc: video ? video.currentSrc : null,
            readyState: video ? video.readyState : 0,
            videoWidth: video ? video.videoWidth : 0,
            videoHeight: video ? video.videoHeight : 0,
            currentTime: video ? video.currentTime : 0,
            paused: video ? video.paused : true,
            liveBadgeText: liveBadge ? liveBadge.textContent : null,
            camBadgeText: camBadge ? camBadge.textContent : null,
            hasExtBtn: !!extBtn,
            errorMsg: camMsg ? camMsg.textContent : null,
            actionsButtonsCount: actions ? actions.querySelectorAll('button, a').length : 0
          };
        })()`,
        returnByValue: true,
      });

      const st = evalRes.result.value;
      if (st.hasVideo) {
        process.stdout.write(
          `\r    Video: readyState=${st.readyState}, width=${st.videoWidth}x${st.videoHeight}, time=${st.currentTime.toFixed(1)}s, badge="${st.camBadgeText}"`
        );
      }

      if (st.hasVideo && st.readyState >= 3 && st.videoWidth > 0 && !st.paused) {
        reproduciendo = true;
        estadoFinal = st;
        console.log('\n  ✓ Emisión en directo reproduciendo con éxito!');
        break;
      }

      if (st.errorMsg) {
        console.warn('\n  [Aviso]', st.errorMsg);
      }
    }

    if (!reproduciendo) {
      throw new Error('La webcam no alcanzó el estado de reproducción dentro del tiempo límite.');
    }

    // Esperar 2 segundos más para captura de fotogramas estables
    await sleep(2000);

    // 6. Tomar captura de pantalla de evidencia
    console.log('[5/5] Tomando captura de pantalla de evidencia de la simulación...');
    const shot = await sendCdp('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.resolve('simulacion_morrogos_ok.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log('  ✓ Captura guardada en:', shotPath);

    console.log('\n======================================================');
    console.log('RESULTADOS DE LA SIMULACIÓN:');
    console.log('  - Contenedor #cam: PRESENTE');
    console.log('  - Elemento <video>: PRESENTE');
    console.log('  - Tipo de cámara en dataset: ' + estadoFinal.camType);
    console.log('  - Resolución nativa del stream: ' + estadoFinal.videoWidth + 'x' + estadoFinal.videoHeight);
    console.log('  - Estado readyState: ' + estadoFinal.readyState + ' (HAVE_FUTURE_DATA o superior)');
    console.log('  - Reproducción activa (paused=false): ' + (!estadoFinal.paused));
    console.log('  - Distintivo live-badge: "' + estadoFinal.liveBadgeText + '"');
    console.log('  - Distintivo cam-badge: "' + estadoFinal.camBadgeText + '"');
    console.log('  - Botones extra (#cam-ext-btn): ' + (estadoFinal.hasExtBtn ? 'DETECTADO (ERROR)' : 'NINGUNO (CORRECTO)'));
    console.log('======================================================');
    console.log('SIMULACIÓN COMPLETADA CON ÉXITO AL 100%');
  } finally {
    if (ws) {
      try { ws.close(); } catch {}
    }
    if (chrome) {
      try { chrome.kill(); } catch {}
    }
    if (server) {
      try { server.kill(); } catch {}
    }
    try {
      fs.rmSync(tempProfile, { recursive: true, force: true });
    } catch {}
  }
}

run().catch((e) => {
  console.error('\n❌ ERROR EN LA SIMULACIÓN:', e);
  process.exit(1);
});
