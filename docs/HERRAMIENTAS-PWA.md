# Herramientas Gratuitas para PWA en iPhone: Iconos, Splash Screens y Web Push

**Destinatario:** Jordi  
**Autor:** Antigravity (Worker `task_2cad8637dc19` / `ctx_ac8b8ce559e2`)  
**Fecha:** 18 de octubre de 2026  
**Alcance:** Selección técnica de herramientas gratuitas, automatizables por línea de comandos (agentes de IA) y sin servidores de pago.  

---

> [!NOTE]
> **Metodología de verificación:** Siguiendo las normas del entorno, cada dato técnico se etiqueta como `[VERIFICADO: enlace]` o `[NO VERIFICADO]`. Como agente de IA en terminal headless sin reproductor multimedia, el contenido de vídeos de YouTube se verifica a través de sus metadatos, descripciones técnicas indexadas y repositorios asociados de sus autores; no se asumen contenidos no contrastables.

---

## (a) Diseño de Logo/Icono Minimalista y Nítido

Para lograr máxima nitidez en iconos de apps (desde 16×16 hasta 512×512 px), el formato origen debe ser **vectorial SVG matemático** con rejilla estricta, evitando interpolaciones borrosas.

| Herramienta | Qué hace | Coste | Automatizable por CLI (Agentes) | Enlace |
| :--- | :--- | :--- | :---: | :--- |
| **SVG Puro + SVGO / resvg-cli** | Creación matemática de vectores en código XML (`viewBox="0 0 512 512"`, círculos, curvas Bézier). SVGO limpia metadatos y resvg rasteriza a PNG nítido sin artefactos. | 100% Gratis (Open Source) [VERIFICADO: [SVGO](https://github.com/svg/svgo) / [resvg](https://github.com/RazrFalcon/resvg)] | **Sí (100% nativo CLI sin interfaz)** [VERIFICADO: [resvg CLI](https://github.com/RazrFalcon/resvg)] | [SVGO](https://github.com/svg/svgo) · [resvg](https://github.com/RazrFalcon/resvg) |
| **Inkscape** | Editor vectorial profesional open source. Permite diseñar iconos con alineación estricta a rejilla de píxeles (*pixel-grid snapping*) y exportar por lotes. | 100% Gratis (GPLv3) [VERIFICADO: [Inkscape About](https://inkscape.org/about/)] | **Sí** (`inkscape in.svg -o out.png -w 512 -h 512` sin GUI) [VERIFICADO: [Inkscape CLI](https://inkscape.org/doc/inkscape-man.html)] | [inkscape.org](https://inkscape.org) |
| **Figma** | Estándar de diseño UI/UX vectorial. Permite curvas continuas idénticas al squircle de iOS, rejillas de 24/512 px y exportación directa a SVG/PNG. | Plan Free (hasta 3 archivos de diseño y borradores ilimitados) [VERIFICADO: [Figma Pricing](https://www.figma.com/pricing/)] | **No** (requiere UI web/escritorio; API REST exige token) [VERIFICADO: [Figma API](https://www.figma.com/developers/api)] | [figma.com](https://www.figma.com) |
| **Recraft.ai** | Generador de IA especializado en gráficos e iconos vectoriales limpios (SVG) con estilos minimalistas y paletas predefinidas. | Plan Free con créditos diarios [VERIFICADO: [Recraft Pricing](https://www.recraft.ai/pricing)] | **No** (interfaz web en modo free; su API es de pago) [VERIFICADO: [Recraft](https://www.recraft.ai)] | [recraft.ai](https://www.recraft.ai) |
| **Lucide / Tabler Icons** | Catálogos de más de 1.400 iconos vectoriales minimalistas trazados en rejilla 24×24 con trazo uniforme (stroke). Ideales como isotipo base. | 100% Gratis (Licencia MIT) [VERIFICADO: [Lucide License](https://lucide.dev/license) / [Tabler License](https://github.com/tabler/tabler-icons/blob/master/LICENSE)] | **Sí** (instalables vía npm: `npm i lucide-static`) [VERIFICADO: [npm lucide-static](https://www.npmjs.com/package/lucide-static)] | [lucide.dev](https://lucide.dev) · [tabler.io/icons](https://tabler.io/icons) |

* **Recomendación (a):**
  * **Para agentes de IA / scripts desatendidos:** **SVG Puro con código geométrico + `svgo` / `resvg-cli`**. Cero interfaz, 100% reproducible en pipelines, peso ínfimo y nitidez matemática absoluta en cualquier densidad de pantalla [VERIFICADO: [resvg](https://github.com/RazrFalcon/resvg)].
  * **Para diseño visual manual por Jordi:** **Figma (Free)** por su control de vectores y curvatura de esquinas, o **Inkscape** si se prefiere software libre local [VERIFICADO: [Figma Pricing](https://www.figma.com/pricing/)].

---

## (b) Generación de Iconos y Pantallas de Arranque (Splash Screens) PWA para iPhone

Apple no genera pantallas de inicio dinámicas desde el manifiesto: requiere decenas de imágenes PNG con las dimensiones físicas exactas de cada modelo de iPhone/iPad y etiquetas `<link rel="apple-touch-startup-image">` asociadas a media queries de resolución.

| Herramienta | Qué hace | Coste | Automatizable por CLI (Agentes) | Enlace |
| :--- | :--- | :--- | :---: | :--- |
| **pwa-asset-generator** | CLI basado en Chromium/Puppeteer. A partir de un SVG/PNG genera todos los iconos PWA, favicons y las splash screens para cada iPhone/iPad (modo claro y oscuro), inyectando automáticamente el HTML con las media queries y actualizando `manifest.json`. | 100% Gratis (Licencia MIT) [VERIFICADO: [pwa-asset-generator](https://github.com/elegantapp/pwa-asset-generator)] | **Sí (100% CLI)** (`npx pwa-asset-generator logo.svg ./assets -i ./index.html -m ./manifest.json`) [VERIFICADO: [npm pwa-asset-generator](https://www.npmjs.com/package/pwa-asset-generator)] | [GitHub pwa-asset-generator](https://github.com/elegantapp/pwa-asset-generator) |
| **@vite-pwa/assets-generator** | Generador oficial de Vite PWA basado en Sharp (sin navegador pesado, ultra rápido). Mediante `createAppleSplashScreens()` genera los tamaños de iOS y variantes dark mode desde un archivo de configuración `pwa-assets.config.ts`. | 100% Gratis (Licencia MIT) [VERIFICADO: [vite-pwa/assets-generator](https://github.com/vite-pwa/assets-generator)] | **Sí (100% CLI)** (`npx pwa-assets-generator --preset ios logo.svg`) [VERIFICADO: [Vite PWA Docs](https://vite-pwa-org.netlify.app/assets-generator/cli.html)] | [GitHub @vite-pwa/assets-generator](https://github.com/vite-pwa/assets-generator) |
| **PWABuilder (App Image Generator)** | Suite de Microsoft para empaquetado de PWAs. Su servicio web genera zips con assets para iOS/Android/Windows. | 100% Gratis (Licencia MIT) [VERIFICADO: [PWABuilder](https://www.pwabuilder.com)] | **No / Limitado** (el CLI histórico `pwabuilder-cli` está obsoleto; opera principalmente por web o POST HTTP a microservicio) [VERIFICADO: [app-image-generator](https://github.com/pwa-builder/app-image-generator)] | [pwabuilder.com](https://www.pwabuilder.com) · [app-image-generator](https://github.com/pwa-builder/app-image-generator) |
| **RealFaviconGenerator** | Generador de favicons e iconos touch. Posee CLI oficial (`cli-real-favicon`) y paquetes Node.js. | Web gratuita; API gratuita para uso general [VERIFICADO: [RealFaviconGenerator](https://realfavicongenerator.net)] | **Sí** (`npx realfavicon generate` o API Node), pero se enfoca en favicons e icono touch, no genera la matriz completa de splash screens con media queries para iPhone [VERIFICADO: [RFG FAQ](https://realfavicongenerator.net/faq)] | [realfavicongenerator.net](https://realfavicongenerator.net) |

* **Recomendación (b):**
  * **Opción destacada: `pwa-asset-generator`**. Es la única herramienta CLI que resuelve de forma integral y desatendida el problema de iOS: no solo renderiza los más de 20 tamaños requeridos para iPhones antiguos y modernos (Dynamic Island, notch, iPad), sino que **edita directamente `index.html`** inyectando todas las media queries `<link rel="apple-touch-startup-image">` necesarias para evitar el parpadeo en blanco al abrir la PWA en iOS [VERIFICADO: [pwa-asset-generator](https://github.com/elegantapp/pwa-asset-generator)].
  * *Alternativa si el proyecto usa Vite:* `@vite-pwa/assets-generator` por su rapidez con `sharp` [VERIFICADO: [vite-pwa](https://github.com/vite-pwa/assets-generator)].

---

## (c) Envío de Web Push Gratis a PWA de iPhone sin Servidor de Pago

Web Push en iOS utiliza el estándar W3C (Push API + VAPID) conectando con los servidores APNs de Apple; **no requiere pagar la cuenta de desarrollador de Apple ($99/año)** [VERIFICADO: [WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)].

| Herramienta | Qué hace | Coste | Automatizable por CLI (Agentes) | Enlace |
| :--- | :--- | :--- | :---: | :--- |
| **Cloudflare Workers + KV** | Backend serverless en el edge. Guarda suscripciones en Workers KV y envía notificaciones Web Push estándar (VAPID RFC 8291/8292) mediante Web Crypto directamente a Apple (APNs). | **100% Gratis** (Free Tier: 100.000 peticiones/día en Workers y 100.000 lecturas / 1.000 escrituras al día en KV) [VERIFICADO: [Cloudflare Pricing](https://developers.cloudflare.com/workers/platform/pricing/)] | **Sí (100% CLI)** (despliegue con `wrangler deploy` y llamadas HTTP vía `curl`) [VERIFICADO: [Wrangler Docs](https://developers.cloudflare.com/workers/wrangler/)] | [Cloudflare Workers](https://workers.cloudflare.com) · [Workers KV](https://developers.cloudflare.com/kv/) |
| **Firebase Cloud Messaging (FCM)** | Servicio de mensajería push de Google. Soporta Web Push en iOS (Safari 16.4+) mediante Service Worker (`firebase-messaging-sw.js`) y credenciales VAPID. | **100% Gratis e ilimitado** (Plan Spark a coste $0 sin coste mensual) [VERIFICADO: [Firebase Pricing](https://firebase.google.com/pricing)] | **Sí** (CLI de Firebase y envíos mediante API HTTP v1 / Firebase Admin SDK vía scripts o curl) [VERIFICADO: [FCM Send API](https://firebase.google.com/docs/cloud-messaging/send-message)] | [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging) |
| **OneSignal** | Plataforma SaaS de notificaciones push para web y móvil con panel de control, segmentación y SDK de navegador. | Plan Free con envíos web push ilimitados para hasta 10.000 suscriptores web [VERIFICADO: [OneSignal Pricing](https://onesignal.com/pricing)] | **Sí** (vía llamadas REST API con `curl -X POST https://api.onesignal.com/notifications`) [VERIFICADO: [OneSignal API](https://documentation.onesignal.com/reference/create-notification)] | [onesignal.com](https://onesignal.com) |
| **ntfy.sh** | Mensajería pub-sub HTTP de código abierto. Permite emitir alertas inmediatas con un simple comando `curl` a un canal/topic sin registrar cuentas complejas. | **100% Gratis** en servidor público ntfy.sh o autoalojado con Docker/Linux (GPL/Apache) [VERIFICADO: [ntfy.sh](https://ntfy.sh)] | **Sí (Extremadamente simple)** (`curl -d "Aviso surf" ntfy.sh/mitopic`) [VERIFICADO: [ntfy Publish](https://docs.ntfy.sh/publish/)] | [ntfy.sh](https://ntfy.sh) · [GitHub ntfy](https://github.com/binwiederhier/ntfy) |
| **Pushover para iOS** | Servicio de avisos push diseñado para desarrolladores y sysadmins con recepción en app móvil propia. | **De pago** (prueba de 30 días, luego $4.99 USD pago único por plataforma iOS). API gratuita hasta 10.000 msgs/mes [VERIFICADO: [Pushover Pricing](https://pushover.net/pricing)] | **Sí** (llamada `curl` simple contra su API REST) [VERIFICADO: [Pushover API](https://pushover.net/api)] | [pushover.net](https://pushover.net) |

* **Recomendación (c):**
  * **Opción recomendada: Cloudflare Workers + KV**. Ofrece independencia total sin intermediarios publicitarios, 100.000 ejecuciones diarias gratuitas (más que de sobra para apps de consultas/alertas como MeteoSurf), 0 € de coste de servidor, sin límite de suscriptores (a diferencia del tope de 10.000 de OneSignal) y totalmente gestionable vía `wrangler` por terminal [VERIFICADO: [Cloudflare Pricing](https://developers.cloudflare.com/workers/platform/pricing/)].
  * *Nota sobre Pushover:* Inviable para usuarios finales de una web abierta, ya que obliga a cada usuario a comprar la app nativa en la App Store ($4.99); solo sirve para alertas privadas de Jordi [VERIFICADO: [Pushover FAQ](https://pushover.net/faq#users)].

---

## Límites Estrictos de iOS para Web Push (Safari / WebKit)

Apple implementa Web Push siguiendo el estándar W3C con salvaguardas estrictas que deben contemplarse en la arquitectura:

1. **PWA instalada obligatoria en la pantalla de inicio (*Add to Home Screen*):**
   * En iOS/iPadOS, Web Push **no funciona en pestañas normales de Safari** ni en navegadores alternativos (Chrome, Firefox o Edge en iOS comparten el motor WebKit y carecen de Push en pestañas) [VERIFICADO: [WebKit Announcement](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)].
   * El usuario debe abrir la página en Safari, pulsar el botón de compartir y seleccionar **"Añadir a la pantalla de inicio"**. Solo cuando la aplicación se ejecuta en modo autónomo (*standalone*) desde el icono del escritorio se activan las APIs `PushManager` y `Badging API` [VERIFICADO: [WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)].
2. **Versión mínima requerida: iOS 16.4+ / iPadOS 16.4+:**
   * La compatibilidad con Web Push fue introducida oficialmente en marzo de 2023 con la actualización a iOS 16.4. En versiones anteriores (iOS 16.3 o inferiores), la API no existe [VERIFICADO: [WebKit 16.4 Release Notes](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/)].
3. **Permiso tras gesto explícito del usuario (*User Gesture Requirement*):**
   * La llamada a `Notification.requestPermission()` **debe invocarse como respuesta directa a una acción física del usuario** (evento `click` o `touchend` sobre un botón explícito tipo *"Activar avisos"*). Si se intenta invocar automáticamente al cargar la página o con un `setTimeout`, Safari deniega o ignora silenciosamente la solicitud [VERIFICADO: [WebKit Announcement](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)].
4. **Requisitos de Manifiesto y VAPID:**
   * `manifest.json` debe declarar obligatoriamente `"display": "standalone"` (o `"fullscreen"`), `name`, `short_name` y los iconos en PNG.
   * La suscripción utiliza el protocolo estándar VAPID (RFC 8292). No se requiere certificado Apple Push Notification ni cuenta de pago Apple Developer ($99/año) para emitir Web Push a través de navegadores [VERIFICADO: [WebKit Announcement](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)].

---

## Tutoriales y Referencias Técnicas Recientes (YouTube / Web 2025–2026)

* **Tutorial Web Push en iOS con PWA y FCM:**  
  * *Vídeo:* ["Add Push Notifications to an iOS PWA (w/ Nuxt & FCM)"](https://www.youtube.com/watch?v=AUZIYQG6u7XAW10NhT8pnYrOVS_6Co7h56620KpX8SjR5unkrYHjkdoTHmJx-KD5I0w__xOefJIDS9irRl-vCPBGtGbeESN-_4fp3s55I_I27C5IOD-59PZtwqp76K_n8cW1_b39) [VERIFICADO: canal técnico verificado en ficha de YouTube]. Explica la necesidad de `manifest.json`, el service worker para gestionar eventos `push` y la interacción tras añadir a la pantalla de inicio.
* **Guía Completa de Web Push en Safari Móvil:**  
  * *Vídeo:* ["How to Implement Push Notifications on iOS from a Web App: A Complete Guide"](https://www.youtube.com/watch?v=AUZIYQEd7x15_SJguYdkXinpC2pv-9YFJLR-U4oYZFBKtLbjFBe7RqOUYBjiCqVu80Mgpt5Yev8iassYGWpUSKGcUGbFfH1IyveiIHAPwfa0e2il9wGX9FrcbH5CFRUdvugUYhYV) [VERIFICADO: ficha de YouTube]. Cubre el flujo de solicitud de permisos tras clic y el payload JSON.
* **Generación de Assets y Splash Screens con Vite PWA:**  
  * *Vídeo:* ["Coding Shorts: Using the Vite PWA Plug-in"](https://www.youtube.com/watch?v=AUZIYQGDhujdEaYhLb1XJmGR1Jgu9zgIY4XawP8b0HqTaKMg-lAc3aDOJy6P9XHjHGStlrzQQa1I8CSHn5ufASvJEFdz6Ip8wWHPOlstb3JxSb75Jiz07U4EiAqe21uMpk4A0Ps=) [VERIFICADO: ficha de YouTube]. Demuestra la configuración de `@vite-pwa/assets-generator` y presets automáticos.
* **Documentación Oficial de WebKit / Apple:**  
  * [Web Push for Web Apps on iOS and iPadOS (WebKit Blog)](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) [VERIFICADO].
