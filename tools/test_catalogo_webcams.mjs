import { createHash } from 'node:crypto';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const playwright = await import('playwright').catch(() => import(pathToFileURL(path.join(process.env.APPDATA, 'npm/node_modules/playwright/index.mjs')).href));
const root = process.cwd();
const server = createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime }); createReadStream(file).pipe(res);
});
if (!process.env.TEST_BASE_URL) await new Promise(resolve => server.listen(0, resolve));
const base = (process.env.TEST_BASE_URL || `http://127.0.0.1:${server.address().port}`).replace(/\/$/, '');
const cams = JSON.parse(readFileSync('webcams.json')).webcams.filter(c => c.enabled !== false && !c.soloGrabacion && (c.embedUrl || c.resolver));
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await playwright.chromium.launch({ headless: true, ...(existsSync(chrome) ? { executablePath: chrome } : {}), args: ['--autoplay-policy=no-user-gesture-required'] });
const results = [];
for (const cam of cams) {
  const spot = cam.spots[0];
  const list = cams.filter(c => c.spots.includes(spot)).sort((a,b) => (a.priority ?? 9) - (b.priority ?? 9) || (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
  const index = list.findIndex(c => c.id === cam.id);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1, ignoreHTTPSErrors: true });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0,120)));
  const result = { id: cam.id, type: cam.embedType, spot, index };
  try {
    await page.goto(`${base}/#/spot/${spot}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('#cam').waitFor({ timeout: 20000 });
    if (index > 0) await page.locator(`[data-cam="${index}"]`).click({ timeout: 10000 });
    if (cam.embedType === 'restricted') {
      await page.locator('#cam .cam-msg').waitFor({ timeout: 5000 });
      result.message = await page.locator('#cam .cam-msg').innerText();
      result.ok = result.message.includes('Directo no disponible')
        && await page.locator('#cam iframe, #cam video, #cam img').count() === 0;
    } else if (cam.embedType === 'hls') {
      const v = page.locator('#cam video');
      await v.waitFor({ timeout: 25000 });
      await page.waitForFunction(() => document.querySelector('#cam .cam-badge-directo') != null, null, { timeout: 25000 });
      result.first = await v.evaluate(x => ({ t:x.currentTime,w:x.videoWidth,h:x.videoHeight,paused:x.paused }));
      const hash1 = createHash('sha256').update(await v.screenshot()).digest('hex');
      await page.waitForTimeout(2300);
      result.last = await v.evaluate(x => ({ t:x.currentTime,paused:x.paused }));
      result.changed = hash1 !== createHash('sha256').update(await v.screenshot()).digest('hex');
      result.ok = result.last.t - result.first.t > 1 && result.changed && result.first.w >= 320;
    } else if (cam.embedType === 'iframe' || cam.embedType === 'skyline') {
      const frame = page.frameLocator('#cam iframe');
      await page.waitForTimeout(7000);
      result.frameUrl = await page.locator('#cam iframe').getAttribute('src');
      result.frameText = (await frame.locator('body').innerText({timeout:5000}).catch(()=>'' )).slice(0,200);
      const videos = frame.locator('video');
      result.videoCount = await videos.count();
      if (result.videoCount) {
        const v = videos.first();
        result.first = await v.evaluate(x => ({t:x.currentTime,w:x.videoWidth,h:x.videoHeight,paused:x.paused,ready:x.readyState}));
        const hash1 = createHash('sha256').update(await v.screenshot()).digest('hex');
        await page.waitForTimeout(2300);
        result.last = await v.evaluate(x => ({t:x.currentTime,paused:x.paused}));
        result.changed = hash1 !== createHash('sha256').update(await v.screenshot()).digest('hex');
        result.ok = result.last.t - result.first.t > 1 && result.changed && result.first.w >= 320;
      }
      if (process.env.CAM_SCREENSHOTS) await page.locator('#cam').screenshot({path:`Temp/cam-${cam.id}.png`});
    } else if (cam.embedType === 'mjpeg') {
      const img = page.locator('#cam img');
      await img.waitFor({timeout:15000});
      await page.waitForTimeout(2000);
      result.first = await img.evaluate(x=>({complete:x.complete,w:x.naturalWidth,h:x.naturalHeight,src:x.currentSrc}));
      const hash1 = createHash('sha256').update(await img.screenshot()).digest('hex');
      await page.waitForTimeout(2300);
      result.changed = hash1 !== createHash('sha256').update(await img.screenshot()).digest('hex');
      result.ok = result.first.w >= 320 && result.changed;
      if (process.env.CAM_SCREENSHOTS) await page.locator('#cam').screenshot({path:`Temp/cam-${cam.id}.png`});
    }
    result.badge = (await page.locator('#cam .live-badge, #cam .cam-badge').allInnerTexts()).join('|');
    result.message = (await page.locator('#cam .cam-msg').allInnerTexts()).join('|').slice(0,100);
  } catch(e) { result.error = String(e).slice(0,250); }
  result.pageErrors = errors;
  results.push(result);
  console.log(JSON.stringify(result));
  await page.close();
}
await browser.close();
if (server.listening) await new Promise(resolve => server.close(resolve));
console.log(`DIRECTOS VERIFICADOS ${results.filter(x=>x.ok && x.type !== 'restricted').length}/${results.filter(x=>x.type !== 'restricted').length}; RESTRINGIDOS ${results.filter(x=>x.type === 'restricted').length}`);
if (results.some(x => !x.ok)) process.exitCode = 1;
