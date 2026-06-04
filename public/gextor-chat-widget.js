/**
 * Gextor Chat Widget — burbuja + iframe + canal de comunicación con el chatbot.
 * Vanilla JS, sin dependencias. Se sirve desde el propio dominio del chatbot.
 *
 * Integración mínima en la web host:
 *
 *   <script>
 *     window.GextorChatConfig = {
 *       chatUrl: 'https://chatbot.midominio.com',          // URL del chatbot desplegado
 *       getToken: () => fetch('/api/chat-token')           // JWT firmado por TU backend
 *         .then(r => r.text()),                            //  (string o Promise<string>)
 *     }
 *   </script>
 *   <script src="https://chatbot.midominio.com/gextor-chat-widget.js" defer></script>
 *
 * Config opcional: logoUrl, title, zIndex.
 * API pública: GextorChat.open() / .close() / .toggle() / .ask(pregunta) / .updateToken(jwt)
 *
 * Protocolo iframe (postMessage, origin SIEMPRE el del chatbot):
 *   chatbot → host : { type: 'auth-ready' }          el chat espera el token
 *   host → chatbot : { type: 'auth', token }         JWT del host (nunca por URL)
 *   host → chatbot : { type: 'ask', question }       inyecta pregunta en el input
 */
(function () {
  'use strict'

  var userConfig = window.GextorChatConfig || {}

  var config = {
    chatUrl: userConfig.chatUrl || (document.currentScript && document.currentScript.src.replace(/\/[^/]*$/, '')) || '',
    getToken: userConfig.getToken || null, // función (sync/async) o string JWT
    logoUrl: userConfig.logoUrl || null, // por defecto: <chatUrl>/gextor-ia.svg
    title: userConfig.title || 'Asistente Gextor Contabilidad',
    zIndex: userConfig.zIndex || 9998,
  }

  if (!config.chatUrl) {
    console.error('[gextor-chat] falta chatUrl en GextorChatConfig')
    return
  }

  var chatOrigin = new URL(config.chatUrl, window.location.href).origin
  var logoUrl = config.logoUrl || (config.chatUrl.replace(/\/$/, '') + '/gextor-ia.svg')

  /* ---------- estilos ---------- */
  var style = document.createElement('style')
  style.textContent = ''
    + '#gextor-chat-bubble{position:fixed;bottom:24px;right:24px;z-index:' + (config.zIndex + 1) + ';'
    + 'width:60px;height:60px;border-radius:50%;background:#fff;border:1px solid #e5e7eb;cursor:pointer;'
    + 'display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(28,100,242,.35);'
    + 'transition:transform .15s ease;padding:0}'
    + '#gextor-chat-bubble:hover{transform:scale(1.08)}'
    + '#gextor-chat-bubble img{width:52px;height:52px}'
    + '#gextor-chat-bubble .gextor-close{display:none;color:#1c64f2;font-size:28px;line-height:1;font-family:system-ui,sans-serif}'
    + '#gextor-chat-bubble.open img{display:none}'
    + '#gextor-chat-bubble.open .gextor-close{display:block}'
    + '#gextor-chat-panel{position:fixed;bottom:96px;right:24px;z-index:' + config.zIndex + ';'
    + 'width:420px;height:min(640px,calc(100vh - 120px));border:1px solid #e5e7eb;border-radius:16px;'
    + 'box-shadow:0 16px 48px rgba(0,0,0,.18);overflow:hidden;background:#fff;'
    + 'opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .2s ease,transform .2s ease}'
    + '#gextor-chat-panel.open{opacity:1;transform:translateY(0);pointer-events:auto}'
    + '#gextor-chat-panel iframe{width:100%;height:100%;border:none}'
    + '@media (max-width:480px){#gextor-chat-panel{right:0;bottom:0;width:100vw;height:100vh;border-radius:0}}'
  document.head.appendChild(style)

  /* ---------- DOM ---------- */
  var bubble = document.createElement('button')
  bubble.id = 'gextor-chat-bubble'
  bubble.setAttribute('aria-label', 'Abrir asistente')
  var bubbleImg = document.createElement('img')
  bubbleImg.src = logoUrl // asignación por propiedad: sin riesgo de inyección HTML
  bubbleImg.alt = ''
  var bubbleClose = document.createElement('span')
  bubbleClose.className = 'gextor-close'
  bubbleClose.textContent = '×'
  bubble.appendChild(bubbleImg)
  bubble.appendChild(bubbleClose)

  var panel = document.createElement('div')
  panel.id = 'gextor-chat-panel'

  var iframe = document.createElement('iframe')
  iframe.title = config.title
  iframe.setAttribute('allow', 'clipboard-write')
  panel.appendChild(iframe)

  function mount() {
    document.body.appendChild(bubble)
    document.body.appendChild(panel)
  }
  if (document.body) { mount() }
  else { document.addEventListener('DOMContentLoaded', mount) }

  /* ---------- auth: entrega del JWT al chatbot ---------- */
  function resolveToken() {
    try {
      var t = typeof config.getToken === 'function' ? config.getToken() : config.getToken
      return Promise.resolve(t)
    }
    catch (e) {
      return Promise.reject(e)
    }
  }

  function sendAuthToken() {
    if (!iframe.src || !config.getToken) { return }
    resolveToken().then(function (token) {
      if (typeof token === 'string' && token) {
        iframe.contentWindow.postMessage({ type: 'auth', token: token }, chatOrigin)
      }
    }).catch(function (e) {
      console.error('[gextor-chat] error obteniendo el token', e)
    })
  }

  var askTimer = null

  // mensajes del chatbot: 'auth-ready' (pide el token) y 'ask-received' (pregunta entregada)
  window.addEventListener('message', function (event) {
    if (event.origin !== chatOrigin) { return }
    if (!event.data) { return }
    if (event.data.type === 'auth-ready') { sendAuthToken() }
    if (event.data.type === 'ask-received' && askTimer) {
      clearInterval(askTimer)
      askTimer = null
    }
  })
  // fallback: también al terminar de cargar el iframe
  iframe.addEventListener('load', sendAuthToken)

  /* ---------- abrir/cerrar ---------- */
  function ensureLoaded() {
    if (!iframe.src) { iframe.src = config.chatUrl } // carga perezosa
  }
  function open() {
    ensureLoaded()
    bubble.classList.add('open')
    panel.classList.add('open')
  }
  function close() {
    bubble.classList.remove('open')
    panel.classList.remove('open')
  }
  function toggle() {
    ensureLoaded()
    bubble.classList.toggle('open')
    panel.classList.toggle('open')
  }
  bubble.addEventListener('click', toggle)

  /* ---------- API pública ---------- */
  window.GextorChat = {
    open: open,
    close: close,
    toggle: toggle,
    // abre el chat e inyecta la pregunta en el input (postMessage: vale cross-origin).
    // Reintenta hasta ~30s (primera carga del chat); para al recibir 'ask-received'.
    ask: function (question) {
      open()
      if (askTimer) { clearInterval(askTimer) }
      var tries = 0
      askTimer = setInterval(function () {
        tries++
        try { iframe.contentWindow.postMessage({ type: 'ask', question: question }, chatOrigin) }
        catch (e) { /* iframe aún cargando */ }
        if (tries >= 150) {
          clearInterval(askTimer)
          askTimer = null
        }
      }, 200)
    },
    // renueva el token de sesión del chatbot (p.ej. tras renovar login en el host)
    updateToken: function (jwt) {
      if (iframe.src && jwt) { iframe.contentWindow.postMessage({ type: 'auth', token: jwt }, chatOrigin) }
    },
  }
})()
