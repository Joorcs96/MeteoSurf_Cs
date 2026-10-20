// js/config.js — Configuración del servicio de avisos y push web
// WORKER_URL queda vacío hasta que Jordi despliegue el Cloudflare Worker.
export const WORKER_URL = '';

export const CONFIG = {
  WORKER_URL
};

if (typeof window !== 'undefined') {
  window.METEOSURF_CONFIG = CONFIG;
  window.WORKER_URL = WORKER_URL;
}

export default CONFIG;
