# Sesión — Auth JWT del host (identidad usuario/tenant/empresa)

**Fecha:** 2026-06-04
**Estado:** funcional, verificado E2E (Playwright + curl) en dev. Sin commitear.
**Claims actuales:** `sub`, `tenant_id`, `empresa`, `user_id`, `user_rol` — todos
obligatorios en el JWT del host (falta alguno → 401). Los 4 últimos van a `inputs`
de Dify; `sub` → `user` (sale como `sys.user_id`).
**Feature previa:** `chatbot-conversacion-unica.md`

## Objetivo

Identificar usuario/empresa al instanciar el chatbot vía JWT inyectado por el host
(postMessage web / WebView2 WPF), verificarlo en servidor, y llamar a Dify con
`user` = sub e `inputs` = { tenant_id, empresa } del token verificado. El navegador
no puede falsear identidad ni tenant.

## Arquitectura implementada

Flujo: host → postMessage `{type:'auth',token}` → front → POST `/api/session`
(verifica JWT host) → token de sesión propio (2h, HS256 `SESSION_SECRET`) → en
memoria (nunca cookies/storage/URL) → header `Authorization: Bearer` en cada
llamada → rutas API verifican y usan claims.

### Ficheros

- `app/api/utils/auth.ts` — lib jose: `verifyHostToken` (HS256 `JWT_VERIFY_SECRET`
  + iss/aud/exp; **RS256/JWKS**: definir `JWT_JWKS_URL` y vaciar el secret, sin
  reescribir), `createSessionToken`/`verifySessionToken`, `requireSession(request)`.
- `app/api/session/route.ts` — GET status `{authRequired}`, POST intercambio (401 inválido).
- `app/api/utils/common.ts` — `getUserContext(request)`: sesión válida → user=sub +
  claims; auth sin configurar fuera de prod → legacy cookie (`getInfo`); prod sin
  secretos → 503 fail-closed (mismo patrón que Basic Auth).
- 5 rutas (`chat-messages`, `messages`, `parameters`, `file-upload`, `feedbacks`)
  → `getUserContext`, devuelven Response de error si no autorizado.
- `chat-messages`: `inputs = { ...bodyInputs, tenant_id, empresa }` — claims SIEMPRE
  pisan lo del navegador. `console.log` de verificación (quitar o bajar a debug en prod).
- `service/auth.ts` (cliente) — token en memoria módulo; listeners permanentes
  `window message` (whitelist `NEXT_PUBLIC_ALLOWED_HOST_ORIGINS` + propio origen) y
  `chrome.webview` (WebView2, sin check origin); handshake: chatbot postea
  `{type:'auth-ready'}` al parent y al webview, host responde con token; cada token
  nuevo re-intercambia (host puede renovar). `initHostAuth()` → 'ready'|'disabled'|'timeout'(15s)|'rejected'.
- `service/base.ts` — `buildHeaders` añade Bearer en `baseFetch`/`ssePost`; también en `upload` (XHR).
- `app/components/index.tsx` — estado `authStatus`; init espera 'ready'/'disabled';
  'timeout'/'rejected' → `AppUnavailable` con mensaje.
- `scripts/make-test-jwt.mjs` — genera JWT de prueba (lee .env.local, flags --sub --tenant --empresa --exp).
- `public/demo.html` — bloque auth host: TEST_JWT pegado (caduca 1h, regenerar),
  responde a 'auth-ready' + fallback en load del iframe.
- `.env.example` + `.env.local` — `JWT_VERIFY_SECRET`, `JWT_ISSUER=gextor-host`,
  `JWT_AUDIENCE=gextor-chatbot`, `SESSION_SECRET`, `NEXT_PUBLIC_ALLOWED_HOST_ORIGINS`
  (coma-separado; vacío = solo mismo origen). `.env.local` tiene secretos dev de prueba.
- Dependencia nueva: `jose`.

## Verificado

- GET /api/session → `{authRequired:true}`; POST token válido → session_token; basura → 401.
- /api/parameters sin Bearer → 401; con Bearer → 200.
- Spoof: body con `tenant_id:"FALSO", empresa:"HACKER SL"` → a Dify llegó
  `tenant-001 / Empresa Demo SL` del token, `user=usuario-demo-1`.
- E2E demo.html: burbuja → iframe → handshake → chat responde.
- Acceso directo sin host → 15s → "No se ha recibido la autenticación del host".
- Build prod OK; tsc/eslint limpios en ficheros tocados (errores restantes = upstream).

## Widget host standalone (añadido misma sesión)

- `public/gextor-chat-widget.js` — vanilla JS, cero deps, servido por el chatbot.
  Crea burbuja+panel+iframe (lazy), CSS inyectado, API `GextorChat.open/close/toggle/ask/updateToken`.
  Config: `window.GextorChatConfig = { chatUrl, getToken (string|fn|Promise), logoUrl?, title?, zIndex? }`
  antes del `<script src=".../gextor-chat-widget.js" defer>`.
- Protocolo postMessage (origin SIEMPRE validado contra el del chatbot):
  - chatbot→host `{type:'auth-ready'}`; host→chatbot `{type:'auth',token}`
  - host→chatbot `{type:'ask',question}` (inyecta pregunta en textarea, cross-origin OK);
    chatbot→host `{type:'ask-received'}` (ack, para reintentos del widget; reintenta hasta ~30s
    porque primera carga puede ser lenta — en dev compilación on-demand >8s).
- `service/auth.ts` amplió: `handleAskMessage` (querySelector `textarea.rc-textarea` +
  native setter + evento input); listeners se instalan SIEMPRE (también con auth
  disabled en dev) — initHostAuth reestructurado.
- demo.html reescrito: 2 tags de integración (config + script) — bloque copiable a web real.
  Inyección DOM same-origin eliminada (sustituida por postMessage).
- E2E verificado: click tarjeta → burbuja abre → auth → pregunta inyectada en textarea.
- Widget en `public/` → con `next start`/Vercel cambios requieren redeploy/reinicio.

## Decisiones

- Whitelist origins en `NEXT_PUBLIC_` — no es secreto (visible en JS igual); secretos JWT/Dify solo servidor.
- `parameters` también protegida (init va tras handshake) — evita fuga de config.
- localStorage de conversación sigue por APP_ID: si cambia el usuario en la misma
  máquina, el catch de `fetchChatList` (404 de Dify por user distinto) arranca limpia.
- Sin renovación automática al caducar sesión (2h): 401 → toast. El host puede
  re-postear token en cualquier momento y se renueva sola.

## Pendiente

- [ ] Commitear (pedir confirmación).
- [ ] Hosts reales: WPF → `CoreWebView2.PostWebMessageAsJson("{\"type\":\"auth\",\"token\":\"...\"}")`
      tras recibir 'auth-ready'; ASP.NET → snippet demo.html con JWT firmado en servidor.
- [ ] En Vercel/prod: configurar los 4 secretos + origins; quitar/condicionar el
      console.log de chat-messages.
- [ ] TEST_JWT de demo.html caduca 1h — regenerar con `node scripts/make-test-jwt.mjs` al probar.
- [ ] Producción real: pasar a RS256 (JWT_JWKS_URL) cuando el host tenga endpoint JWKS.
- [ ] Pendientes heredados de `chatbot-conversacion-unica.md` siguen vivos.
- [ ] Dify Studio: declarar `tenant_id`, `empresa`, `user_id`, `user_rol` como
      variables OPCIONALES en nodo Inicio — Dify descarta inputs no declarados.
      (No salen cajas en UI: pantalla config eliminada en feature anterior.)
