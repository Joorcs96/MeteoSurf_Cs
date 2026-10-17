// tools/pw-capacidades.cjs — Qué soporta de verdad este navegador para grabar.
//
// Comprueba, con ventana, lo que decide el diseño de la vigía: WebCodecs
// (VideoEncoder), qué códecs, el muxador de WebM por CDN, captureStream de
// vídeo y de canvas, y los MIME de MediaRecorder. Sin modificar nada.

const { chromium } = require('playwright');

(async () => {
  const navegador = await chromium.launch({ headless: false });
  const pagina = await (await navegador.newContext()).newPage();
  // WebCodecs exige contexto seguro: bout:blank no lo es, localhost sí.
  await pagina.goto(process.argv[2] || 'http://127.0.0.1:8767/index.html');
  const r = await pagina.evaluate(async () => {
    const out = {};
    out.webcodecs = typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';
    out.codecs = {};
    if (out.webcodecs) {
      for (const codec of ['vp8', 'vp09.00.10.08', 'avc1.42001f', 'av01.0.04M.08']) {
        try {
          const s = await VideoEncoder.isConfigSupported({ codec, width: 640, height: 360, bitrate: 1_200_000, framerate: 10 });
          out.codecs[codec] = !!s.supported;
        } catch (e) { out.codecs[codec] = 'error:' + e.message; }
      }
    }
    out.mediaRecorder = typeof window.MediaRecorder === 'function';
    out.mimes = out.mediaRecorder
      ? ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].filter((t) => MediaRecorder.isTypeSupported(t))
      : [];
    // captureStream: en iOS Safari no existe en <video>; en canvas sí o menos.
    const v = document.createElement('video');
    out.captureStreamVideo = typeof v.captureStream === 'function';
    out.captureStreamCanvas = typeof document.createElement('canvas').captureStream === 'function';
    out.mozCaptureStream = typeof v.mozCaptureStream === 'function';
    return out;
  });
  console.log(JSON.stringify(r, null, 1));

  // ¿Se puede cargar el muxador de WebM por CDN?
  try {
    const m = await pagina.evaluate(async () => {
      const res = await fetch('https://cdn.jsdelivr.net/npm/webm-muxer@5.0.3/build/webm-muxer.mjs', { method: 'GET' });
      return res.status;
    });
    console.log('webm-muxer CDN status', m);
  } catch (e) { console.log('webm-muxer CDN error', e.message); }

  await navegador.close();
})().catch((e) => { console.error('FALLO', e); process.exit(1); });