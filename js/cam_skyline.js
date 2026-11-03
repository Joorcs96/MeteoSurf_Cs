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
  let frameCount = 0;

  function showMsg(text) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.style.display = 'flex';
  }

  function hideMsg() {
    if (!msgEl) return;
    msgEl.style.display = 'none';
  }

  function refreshSnapshot() {
    if (!previewImg) return;
    const nextImg = new Image();
    nextImg.referrerPolicy = 'no-referrer';
    nextImg.onload = () => {
      previewImg.src = nextImg.src;
      previewImg.style.display = 'block';
      hideMsg();
      frameCount++;
      window.parent.postMessage({
        type: 'skyline_playing',
        videoWidth: nextImg.naturalWidth || 1920,
        videoHeight: nextImg.naturalHeight || 1080,
        currentTime: frameCount * 2
      }, '*');
    };
    nextImg.src = snapshotUrl + (snapshotUrl.includes('?') ? '&' : '?') + '_=' + Date.now();
  }

  function startPhotogramStream() {
    refreshSnapshot();
    if (previewTimer) clearInterval(previewTimer);
    previewTimer = setInterval(refreshSnapshot, 2500);
  }

  // Skyline publica una autorización de vida corta dentro de su página.
  async function resolveStream() {
    try {
      const res = await fetch(pageUrl, { cache: 'no-cache' });
      if (!res.ok) return null;
      const html = await res.text();
      const match = html.match(/source\s*:\s*['"]([^'"]+\.m3u8\?a=[^'"]+)['"]/i);
      if (!match) return null;
      const clean = match[1].replace(/livee\.m3u8/i, 'live.m3u8');
      return new URL(clean, 'https://hd-auth.skylinewebcams.com/').href;
    } catch {
      return null;
    }
  }

  function playNativeSafari(streamUrl) {
    v.src = streamUrl;
    v.addEventListener('playing', () => {
      hideMsg();
      window.parent.postMessage({
        type: 'skyline_playing',
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
        currentTime: v.currentTime
      }, '*');
    });
    v.addEventListener('timeupdate', () => {
      window.parent.postMessage({ type: 'skyline_time', currentTime: v.currentTime }, '*');
    });
    v.addEventListener('error', () => {
      startPhotogramStream();
    });
    v.play().catch(() => {
      startPhotogramStream();
    });
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
      v.play().catch(() => startPhotogramStream());
    });

    v.addEventListener('playing', () => {
      hideMsg();
      window.parent.postMessage({
        type: 'skyline_playing',
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
        currentTime: v.currentTime
      }, '*');
    });

    v.addEventListener('timeupdate', () => {
      window.parent.postMessage({ type: 'skyline_time', currentTime: v.currentTime }, '*');
    });

    hls.on(window.Hls.Events.ERROR, async (_, data) => {
      if (data.fatal) {
        startPhotogramStream();
      }
    });
  }

  function startWithStream(streamUrl) {
    const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
      (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|Android/.test(navigator.userAgent));

    if (isApple && v.canPlayType && v.canPlayType('application/vnd.apple.mpegurl')) {
      playNativeSafari(streamUrl);
    } else if (window.Hls && window.Hls.isSupported()) {
      playHls(streamUrl);
    } else {
      startPhotogramStream();
    }
  }

  async function init() {
    startPhotogramStream();
    const streamUrl = await resolveStream();
    if (streamUrl) {
      startWithStream(streamUrl);
    }
  }

  init();
})();
