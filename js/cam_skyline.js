(() => {
  const params = new URLSearchParams(location.search);
  const defaultPage = 'https://www.skylinewebcams.com/webcam/espana/comunidad-valenciana/castellon/oropesa-del-mar.html';
  const requestedPage = params.get('page') || defaultPage;
  const isBenicasim = requestedPage.includes('benicasim');
  const pageUrl = isBenicasim
    ? 'https://www.skylinewebcams.com/webcam/espana/comunidad-valenciana/castellon/benicasim.html'
    : defaultPage;

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
  let haReproducido = false;
  let isInitializing = false;
  let isInternalPlay = false;
  let pausedAt = null;

  function notifyParent(data) {
    try {
      window.parent.postMessage(data, '*');
    } catch {
      // Ignorar si el padre no está disponible
    }
  }

  function requestPlay() {
    isInternalPlay = true;
    const attempt = v.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch((error) => {
        if (error?.name === 'AbortError') return;
        if (error?.name !== 'NotAllowedError') {
          retry();
          return;
        }
        waitingForTap = true;
        startAction = 'play';
        start.textContent = '▶ Ver playa en directo';
        start.hidden = false;
        notifyParent({ type: 'skyline_tap_required' });
      });
    }
    setTimeout(() => { isInternalPlay = false; }, 600);
  }

  v.addEventListener('click', () => {
    if (v.paused) {
      if (haReproducido && pausedAt != null && performance.now() - pausedAt > 1500) {
        pausedAt = null;
        initStream();
      } else {
        requestPlay();
      }
    }
  });

  v.addEventListener('pause', () => {
    pausedAt = performance.now();
  });

  v.addEventListener('play', () => {
    if (isInternalPlay) return;
    // Al pulsar Play tras una pausa de más de 1.5s, renovamos la petición para tener directo fresco
    if (haReproducido && pausedAt != null && performance.now() - pausedAt > 1500) {
      pausedAt = null;
      initStream();
    }
  });

  start.addEventListener('click', async () => {
    if (startAction === 'retry' || (haReproducido && performance.now() - lastProgress > 3000)) {
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
        initStream();
      }
    }
  });

  function retry() {
    if (renewTimer) return;
    if (requestController) {
      try { requestController.abort(); } catch {}
      requestController = null;
    }
    waitingForTap = false;
    start.hidden = true;
    notifyParent({ type: 'skyline_waiting' });
    if (hls) {
      try { hls.destroy(); } catch {}
      hls = null;
    }
    if (++attempts >= 3) {
      notifyParent({ type: 'skyline_error' });
      attempts = 0;
      startAction = 'retry';
      start.textContent = '↻ Reintentar directo';
      start.hidden = false;
      renewTimer = setTimeout(initStream, 15000);
      return;
    }
    renewTimer = setTimeout(initStream, 2000);
  }

  async function initStream() {
    if (isInitializing) return;
    isInitializing = true;
    clearTimeout(renewTimer);
    renewTimer = null;
    start.hidden = true;
    startAction = 'play';
    lastProgress = performance.now();
    lastTime = -1;
    notifyParent({ type: 'skyline_waiting' });

    if (requestController) {
      try { requestController.abort(); } catch {}
      requestController = null;
    }
    const controller = new AbortController();
    requestController = controller;
    const requestTimeout = setTimeout(() => {
      try { controller.abort(); } catch {}
    }, 10000);

    if (hls) {
      try { hls.destroy(); } catch {}
      hls = null;
    }

    try {
      const res = await fetch(pageUrl, { cache: 'no-cache', signal: controller.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const html = await res.text();
      const match = html.match(/source\s*:\s*['"](?:livee|live)\.m3u8\?a=([^'"]+)['"]/i);
      if (!match) throw new Error('Token no encontrado');
      const token = match[1];
      const streamUrl = 'https://hd-auth.skylinewebcams.com/live.m3u8?a=' + token;

      if (window.Hls && window.Hls.isSupported()) {
        hls = new Hls({
          lowLatencyMode: true,
          backBufferLength: 4,
          maxBufferLength: 8,
          maxMaxBufferLength: 15,
          liveSyncDurationCount: 2,
          liveMaxLatencyDurationCount: 5,
          capLevelToPlayerSize: true
        });
        hls.loadSource(streamUrl);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          requestPlay();
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            retry();
          }
        });
      } else if (v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = streamUrl;
        v.load();
        requestPlay();
      } else {
        throw new Error('HLS no compatible');
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.warn('initStream falló:', err);
      retry();
    } finally {
      clearTimeout(requestTimeout);
      if (requestController === controller) requestController = null;
      isInitializing = false;
    }
  }

  // Sincronización en vivo cuando la pestaña cambia de visibilidad
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      v.pause();
      pausedAt = performance.now();
    } else {
      // Al regresar a la pestaña, renovamos la petición para tener emisión viva
      if (haReproducido) {
        initStream();
      } else {
        requestPlay();
      }
    }
  });

  // Mensajes desde el contenedor principal (MeteoSurf)
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'play') {
      if (haReproducido && (pausedAt == null || performance.now() - pausedAt > 1500 || v.readyState < 3)) {
        initStream();
      } else {
        requestPlay();
      }
    } else if (data.type === 'pause') {
      v.pause();
      pausedAt = performance.now();
    } else if (data.type === 'renovar') {
      initStream();
    }
  });

  v.addEventListener('playing', () => {
    haReproducido = true;
    pausedAt = null;
    waitingForTap = false;
    start.hidden = true;
    lastProgress = performance.now();
    notifyParent({
      type: 'skyline_playing',
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
      currentTime: v.currentTime
    });
  });

  v.addEventListener('timeupdate', () => {
    if (v.videoWidth > 0 && v.currentTime > lastTime + 0.1) {
      lastTime = v.currentTime;
      lastProgress = performance.now();
      attempts = 0;
    }
    notifyParent({
      type: 'skyline_time',
      currentTime: v.currentTime,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight
    });
  });

  v.addEventListener('waiting', () => {
    if (!waitingForTap) notifyParent({ type: 'skyline_waiting' });
  });

  v.addEventListener('stalled', () => {
    if (!waitingForTap) notifyParent({ type: 'skyline_waiting' });
  });

  v.addEventListener('error', retry);

  // Perro guardián contra atascos en el búfer
  setInterval(() => {
    if (renewTimer || waitingForTap || document.hidden || v.paused || isInitializing) return;
    const diff = performance.now() - lastProgress;
    if (diff > 4000) {
      initStream();
    }
  }, 2000);

  initStream();
})();
