(() => {
  const v = document.getElementById('v');
  const previewImg = document.getElementById('preview');
  const msgEl = document.getElementById('msg');
  const params = new URLSearchParams(location.search);
  const defaultPage = 'https://www.skylinewebcams.com/webcam/espana/comunidad-valenciana/castellon/oropesa-del-mar.html';
  const pageUrl = params.get('page') || defaultPage;
  const snapshotUrl = params.get('snapshot') || 'https://cdn.skylinewebcams.com/live2815.jpg';

  let hlsInstance = null;
  let retryTimer = null;
  let previewTimer = null;

  function showMsg(text) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.style.display = 'flex';
  }

  function hideMsg() {
    if (!msgEl) return;
    msgEl.style.display = 'none';
  }

  function showPreview() {
    if (!previewImg) return;
    previewImg.src = snapshotUrl + (snapshotUrl.includes('?') ? '&' : '?') + '_=' + Date.now();
    previewImg.style.display = 'block';
    if (!previewTimer) {
      previewTimer = setInterval(() => {
        if (previewImg.style.display !== 'none') {
          previewImg.src = snapshotUrl + (snapshotUrl.includes('?') ? '&' : '?') + '_=' + Date.now();
        }
      }, 8000);
    }
  }

  function hidePreview() {
    if (previewTimer) {
      clearInterval(previewTimer);
      previewTimer = null;
    }
    if (previewImg) previewImg.style.display = 'none';
  }

  async function resolveToken() {
    try {
      const res = await fetch(pageUrl, { cache: 'no-cache' });
      if (!res.ok) return null;
      const html = await res.text();
      const match = html.match(/source\s*:\s*['"](?:livee|live)\.m3u8\?a=([^'"]+)['"]/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  function playNativeSafari(streamUrl) {
    v.src = streamUrl;
    v.addEventListener('playing', () => {
      hidePreview();
      hideMsg();
      window.parent.postMessage({ type: 'skyline_playing' }, '*');
    });
    v.addEventListener('waiting', () => window.parent.postMessage({ type: 'skyline_waiting' }, '*'));
    v.addEventListener('error', () => {
      showPreview();
      showMsg('Reconectando emisión en directo...');
      scheduleRetry();
    });
    v.play().catch(() => {});
  }

  function playHls(streamUrl) {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    const hls = new window.Hls({
      lowLatencyMode: true,
      backBufferLength: 6,
      maxBufferLength: 10,
      maxMaxBufferLength: 20,
      capLevelToPlayerSize: true,
    });
    hlsInstance = hls;

    hls.loadSource(streamUrl);
    hls.attachMedia(v);

    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      v.play().catch(() => {});
    });

    v.addEventListener('playing', () => {
      hidePreview();
      hideMsg();
      window.parent.postMessage({ type: 'skyline_playing' }, '*');
    });

    v.addEventListener('waiting', () => window.parent.postMessage({ type: 'skyline_waiting' }, '*'));

    hls.on(window.Hls.Events.ERROR, async (_, data) => {
      if (data.fatal) {
        showPreview();
        showMsg('Reconectando emisión en directo...');
        scheduleRetry();
      }
    });
  }

  function scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setTimeout(async () => {
      retryTimer = null;
      const token = await resolveToken();
      if (token) {
        startWithToken(token);
      } else {
        scheduleRetry();
      }
    }, 6000);
  }

  function startWithToken(token) {
    const streamUrl = 'https://hd-auth.skylinewebcams.com/live.m3u8?a=' + encodeURIComponent(token);
    const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
      (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Android/.test(navigator.userAgent));

    if (isApple && v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl')) {
      playNativeSafari(streamUrl);
    } else if (window.Hls && window.Hls.isSupported()) {
      playHls(streamUrl);
    } else {
      showPreview();
      showMsg('Tu navegador no soporta HLS.');
    }
  }

  async function init() {
    let token = params.get('token');
    if (!token) {
      token = await resolveToken();
    }

    if (token) {
      startWithToken(token);
    } else {
      // Fallback suave con vista previa mientras conecta
      showPreview();
      showMsg('Conectando emisión en directo...');
      scheduleRetry();
    }
  }

  init();
})();
