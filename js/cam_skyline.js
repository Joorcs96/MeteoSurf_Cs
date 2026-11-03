(() => {
  const params = new URLSearchParams(location.search);
  const defaultPage = 'https://www.skylinewebcams.com/webcam/espana/comunidad-valenciana/castellon/oropesa-del-mar.html';
  const pageUrl = params.get('page') || defaultPage;
  const snapshotUrl = params.get('snapshot') || (pageUrl.includes('benicasim') ? 'https://cdn.skylinewebcams.com/live2816.jpg' : 'https://cdn.skylinewebcams.com/live2815.jpg');

  const subFrame = document.getElementById('sky_player');
  const mirrorVideo = document.getElementById('v');

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

    async function initStream() {
      try {
        const res = await fetch('${pageUrl}', { cache: 'no-cache' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const html = await res.text();
        const match = html.match(/source\\s*:\\s*['"]livee?\\.m3u8\\?a=([^'"]+)['"]/i);
        if (!match) throw new Error('Token no encontrado');
        const token = match[1];
        const streamUrl = 'https://hd-auth.skylinewebcams.com/live.m3u8?a=' + token;

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
            if (data.fatal) {
              if (renewTimer) clearTimeout(renewTimer);
              renewTimer = setTimeout(initStream, 3000);
            }
          });
        } else if (v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl')) {
          v.src = streamUrl;
          v.play().catch(() => {});
        }
      } catch (err) {
        if (renewTimer) clearTimeout(renewTimer);
        renewTimer = setTimeout(initStream, 4000);
      }
    }

    v.addEventListener('playing', () => {
      window.parent.postMessage({
        type: 'skyline_playing',
        videoWidth: v.videoWidth || 1920,
        videoHeight: v.videoHeight || 1080,
        currentTime: v.currentTime || 1
      }, '*');
    });

    v.addEventListener('timeupdate', () => {
      window.parent.postMessage({
        type: 'skyline_time',
        currentTime: v.currentTime || 0
      }, '*');
    });

    v.addEventListener('waiting', () => {
      window.parent.postMessage({ type: 'skyline_waiting' }, '*');
    });

    initStream();
  </script>
</body>
</html>`;

  subFrame.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(innerHtml);

  // Reenviar mensajes de reproducción hacia la ventana principal de la aplicación
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'skyline_playing') {
      if (mirrorVideo) {
        mirrorVideo.currentTime = data.currentTime || 1;
        // Marcar ancho y alto en espejo
        Object.defineProperty(mirrorVideo, 'videoWidth', { value: data.videoWidth || 1920, configurable: true });
        Object.defineProperty(mirrorVideo, 'videoHeight', { value: data.videoHeight || 1080, configurable: true });
        Object.defineProperty(mirrorVideo, 'paused', { value: false, configurable: true });
      }
      window.parent.postMessage(data, '*');
    } else if (data.type === 'skyline_time') {
      if (mirrorVideo) {
        mirrorVideo.currentTime = data.currentTime || 0;
      }
      window.parent.postMessage(data, '*');
    } else if (data.type === 'skyline_waiting' || data.type === 'skyline_error') {
      window.parent.postMessage(data, '*');
    }
  });
})();
