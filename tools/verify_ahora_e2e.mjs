import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const HTTP_PORT = 8797;
const CDP_PORT = 9267;

const server = http.createServer((req, res) => {
  let filePath = path.join(process.cwd(), req.url.split('?')[0]);
  if (req.url === '/' || req.url === '/index.html' || req.url.startsWith('/#/')) {
    filePath = path.join(process.cwd(), 'index.html');
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp'
  };
  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(filePath));
});

server.listen(HTTP_PORT, async () => {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join(process.cwd(), 'temp_chrome_verify_ahora3');
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank'
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new`, { method: 'PUT' });
    const target = await newTabRes.json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id && callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg.result);
        callbacks.delete(msg.id);
      }
    };

    await new Promise((r) => (ws.onopen = r));
    const send = (method, params = {}) =>
      new Promise((res) => {
        const curId = id++;
        callbacks.set(curId, res);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: `http://127.0.0.1:${HTTP_PORT}/#/ahora` });
    await new Promise((r) => setTimeout(r, 1200));

    // Cerrar onboarding y cualquier overlay
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('ob_done', '1');
        document.querySelectorAll('.onboard-overlay, #pro-modal').forEach(el => el.remove());
      `
    });

    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    console.log('Esperando 7 segundos para que reproduzca la webcam...');
    await new Promise((r) => setTimeout(r, 7000));

    const shotMobile = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ahora_mobile_verified.png', Buffer.from(shotMobile.data, 'base64'));
    console.log('✓ Captura móvil sin modal guardada: ahora_mobile_verified.png');

    // Cambiar a escritorio
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await new Promise((r) => setTimeout(r, 1500));

    const shotDesktop = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('ahora_desktop_verified.png', Buffer.from(shotDesktop.data, 'base64'));
    console.log('✓ Captura escritorio guardada: ahora_desktop_verified.png');

    ws.close();
  } catch (e) {
    console.error('Error durante la verificación:', e);
  } finally {
    chrome.kill('SIGTERM');
    server.close();
    setTimeout(() => {
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {}
      process.exit(0);
    }, 1000);
  }
});
