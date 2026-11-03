(() => {
  const params = new URLSearchParams(location.search);
  const defaultPage = 'https://www.skylinewebcams.com/webcam/espana/comunidad-valenciana/castellon/oropesa-del-mar.html';
  const requestedPage = params.get('page') || defaultPage;
  const pageUrl = [defaultPage, 'https://www.skylinewebcams.com/webcam/espana/comunidad-valenciana/castellon/benicasim.html'].includes(requestedPage) ? requestedPage : defaultPage;
  const subFrame = document.getElementById('sky_player');

  // Construir el reproductor autónomo con origen opaco (data: URI)
  // Esto permite realizar fetch cross-origin sin cabecera Origin restrictiva,
  // recibiendo los fragmentos de vídeo real en directo (speed-*.ts) en vez de cortinilla.
  const innerHtml = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; background:#000; overflow:hidden; }
    video { width:100%; height:100%; object-fit:cover; display:block; background:#000; }
  </style>
</head>
<body>
  <video id="player_vid" autoplay muted playsinline controls></video>
  <script>
    const v = document.getElementById('player_vid');
    let hls = null;
    let renewTimer = null;
    let attempts = 0;
    let lastProgress = performance.now();
    let lastTime = -1;

    function retry() {
      if (renewTimer) return;
      window.parent.postMessage({ type: 'skyline_waiting' }, '*');
      if (hls) { hls.destroy(); hls = null; }
      if (++attempts >= 3) {
        window.parent.postMessage({ type: 'skyline_error' }, '*');
        attempts = 0;
        renewTimer = setTimeout(initStream, 30000);
        return;
      }
      renewTimer = setTimeout(initStream, 3500);
    }

    async function initStream() {
      renewTimer = null;
      lastProgress = performance.now();
      lastTime = -1;
      try {
        const res = await fetch('${pageUrl}', { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const html = await res.text();
        const match = html.match(/source\\s*:\\s*['"]livee?\\.m3u8\\?a=([^'"]+)['"]/i);
        if (!match) throw new Error('Token no encontrado');
        const token = match[1];
        const streamUrl = 'https://hd-auth.skylinewebcams.com/live.m3u8?a=' + token;
        const playlist = await fetch(streamUrl, { cache: 'no-store' });
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
            v.play().catch(() => {});
          });
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) retry();
          });
        } else if (v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl')) {
          v.src = streamUrl;
          v.play().catch(() => {});
        } else { throw new Error('HLS no compatible'); }
      } catch (err) {
        retry();
      }
    }

    v.addEventListener('playing', () => {
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
      window.parent.postMessage({ type: 'skyline_waiting' }, '*');
    });

    v.addEventListener('error', retry);
    setInterval(() => { if (!renewTimer && performance.now() - lastProgress > 18000) retry(); }, 5000);

    initStream();
  </script>
</body>
</html>`;

  subFrame.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(innerHtml);

  // Reenviar mensajes de reproducción hacia la ventana principal de la aplicación
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object' || event.source !== subFrame.contentWindow) return;
    if (data.type === 'skyline_playing') {
      window.parent.postMessage(data, '*');
    } else if (data.type === 'skyline_time') {
      window.parent.postMessage(data, '*');
    } else if (data.type === 'skyline_waiting' || data.type === 'skyline_error') {
      window.parent.postMessage(data, '*');
    }
  });
})();
