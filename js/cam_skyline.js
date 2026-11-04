(() => {
  const params = new URLSearchParams(location.search);
  const defaultPage = 'https://www.skylinewebcams.com/webcam/espana/comunidad-valenciana/castellon/oropesa-del-mar.html';
  const requestedPage = params.get('page') || defaultPage;
  const pageUrl = [defaultPage, 'https://www.skylinewebcams.com/webcam/espana/comunidad-valenciana/castellon/benicasim.html'].includes(requestedPage) ? requestedPage : defaultPage;
  // El iframe exterior ya tiene origen opaco por su sandbox. Reproducir aquí
  // evita que los navegadores móviles tengan que atravesar otro iframe data:.
  // Esto permite realizar fetch cross-origin sin cabecera Origin restrictiva,
  // recibiendo los fragmentos de vídeo real en directo (speed-*.ts) en vez de cortinilla.
    const v = document.getElementById('player_vid');
    const start = document.getElementById('start');
    let hls = null;
    let renewTimer = null;
    let requestController = null;
    let waitingForTap = false;
    let startAction = 'play';
    let attempts = 0;
    let lastProgress = performance.now();
    let lastTime = -1;

    function requestPlay() {
      const attempt = v.play();
      if (attempt && typeof attempt.catch === 'function') attempt.catch((error) => {
        if (error?.name !== 'NotAllowedError') { retry(); return; }
        waitingForTap = true;
        startAction = 'play';
        start.textContent = '▶ Ver playa en directo';
        start.hidden = false;
        window.parent.postMessage({ type: 'skyline_tap_required' }, '*');
      });
    }

    start.addEventListener('click', async () => {
      if (startAction === 'retry') {
        clearTimeout(renewTimer);
        renewTimer = null;
        start.hidden = true;
        initStream();
        return;
      }
      try {
        await v.play();
        waitingForTap = false;
        start.hidden = true;
      } catch (error) {
        if (error?.name === 'NotAllowedError') {
          waitingForTap = true;
          start.hidden = false;
        } else {
          retry();
        }
      }
    });

    function retry() {
      if (renewTimer) return;
      if (requestController) requestController.abort();
      waitingForTap = false;
      start.hidden = true;
      window.parent.postMessage({ type: 'skyline_waiting' }, '*');
      if (hls) { hls.destroy(); hls = null; }
      if (++attempts >= 3) {
        window.parent.postMessage({ type: 'skyline_error' }, '*');
        attempts = 0;
        startAction = 'retry';
        start.textContent = '↻ Reintentar directo';
        start.hidden = false;
        renewTimer = setTimeout(initStream, 30000);
        return;
      }
      renewTimer = setTimeout(initStream, 3500);
    }

    async function initStream() {
      renewTimer = null;
      start.hidden = true;
      startAction = 'play';
      lastProgress = performance.now();
      lastTime = -1;
      const controller = new AbortController();
      requestController = controller;
      const requestTimeout = setTimeout(() => controller.abort(), 12000);
      try {
        const res = await fetch(pageUrl, { cache: 'no-cache', signal: controller.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const html = await res.text();
        const match = html.match(/source\s*:\s*['"]livee?\.m3u8\?a=([^'"]+)['"]/i);
        if (!match) throw new Error('Token no encontrado');
        const token = match[1];
        const streamUrl = 'https://hd-auth.skylinewebcams.com/live.m3u8?a=' + token;
        const playlist = await fetch(streamUrl, { cache: 'no-store', signal: controller.signal });
        if (!playlist.ok || /copyright_violation/i.test(await playlist.text())) throw new Error('Emisión no autorizada');

        if (hls) {
          hls.destroy();
          hls = null;
        }

        if (window.Hls && window.Hls.isSupported()) {
          hls = new Hls({
            lowLatencyMode: true,
            backBufferLength: 4,
            maxBufferLength: 10,
            capLevelToPlayerSize: true
          });
          hls.loadSource(streamUrl);
          hls.attachMedia(v);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            requestPlay();
          });
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) retry();
          });
        } else if (v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl')) {
          v.src = streamUrl;
          requestPlay();
        } else { throw new Error('HLS no compatible'); }
      } catch (err) {
        retry();
      } finally {
        clearTimeout(requestTimeout);
        if (requestController === controller) requestController = null;
      }
    }

    v.addEventListener('playing', () => {
      waitingForTap = false;
      start.hidden = true;
      window.parent.postMessage({
        type: 'skyline_playing',
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
        currentTime: v.currentTime
      }, '*');
    });

    v.addEventListener('timeupdate', () => {
      if (v.videoWidth > 0 && v.currentTime > lastTime + 0.1) {
        lastTime = v.currentTime;
        lastProgress = performance.now();
        attempts = 0;
      }
      window.parent.postMessage({
        type: 'skyline_time',
        currentTime: v.currentTime,
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight
      }, '*');
    });

    v.addEventListener('waiting', () => {
      if (!waitingForTap) window.parent.postMessage({ type: 'skyline_waiting' }, '*');
    });

    v.addEventListener('error', retry);
    setInterval(() => { if (!renewTimer && !waitingForTap && performance.now() - lastProgress > 18000) retry(); }, 5000);

    initStream();
})();
