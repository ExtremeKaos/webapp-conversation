/**
 * Client-side auth: receives the JWT injected by the HOST page and exchanges it
 * for our session token via POST /api/session.
 *
 * Channels listened to:
 *  - window 'message' (postMessage) for web hosts — origin checked against
 *    NEXT_PUBLIC_ALLOWED_HOST_ORIGINS (plus own origin, for the same-origin demo).
 *  - window.chrome.webview 'message' for WPF WebView2 — native channel, only the
 *    host app can post on it, so no origin check applies.
 *
 * Expected message: { type: 'auth', token: '<jwt>' }.
 * The session token is kept IN MEMORY only — never cookies/localStorage (the
 * iframe runs in a third-party context where those are blocked) and never the URL.
 */

const AUTH_MESSAGE_TYPE = 'auth'
const READY_MESSAGE_TYPE = 'auth-ready'
const ASK_MESSAGE_TYPE = 'ask'
const ASK_RECEIVED_MESSAGE_TYPE = 'ask-received'
const HOST_TOKEN_TIMEOUT_MS = 15000

// in-memory session token (module scope — survives re-renders, dies with the page)
let sessionToken: string | null = null

export const getSessionToken = () => sessionToken

const getAllowedOrigins = (): string[] => {
  const fromEnv = (process.env.NEXT_PUBLIC_ALLOWED_HOST_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
  // own origin always allowed: covers the same-origin demo.html host
  return [...new Set([window.location.origin, ...fromEnv])]
}

interface AuthMessage {
  type: string
  token?: string
}

const parseAuthMessage = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') { return null }
  const message = data as AuthMessage
  if (message.type !== AUTH_MESSAGE_TYPE || typeof message.token !== 'string' || !message.token) { return null }
  return message.token
}

const exchangeHostToken = async (hostToken: string): Promise<boolean> => {
  try {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: hostToken }),
    })
    if (!res.ok) { return false }
    const data = await res.json()
    if (typeof data.session_token !== 'string') { return false }
    sessionToken = data.session_token
    return true
  }
  catch {
    return false
  }
}

const getWebView2 = (): any => (window as any).chrome?.webview

// tell the host we are ready to receive the token (covers iframe reloads and
// races where the host posts before our listener exists)
const announceReady = () => {
  try {
    if (window.parent && window.parent !== window) {
      getAllowedOrigins().forEach((origin) => {
        window.parent.postMessage({ type: READY_MESSAGE_TYPE }, origin)
      })
    }
  }
  catch { /* host may not listen — fine */ }
  try {
    getWebView2()?.postMessage({ type: READY_MESSAGE_TYPE })
  }
  catch { /* not running inside WebView2 — fine */ }
}

/**
 * Host asks the chat to pre-fill a question (widget bubble cards, deep links…).
 * Injects into the chat textarea via the native setter so React picks it up.
 * Returns true when injected (the host stops retrying on the ack).
 */
const handleAskMessage = (data: unknown, reply: (message: object) => void): void => {
  if (!data || typeof data !== 'object') { return }
  const message = data as { type?: string, question?: string }
  if (message.type !== ASK_MESSAGE_TYPE || typeof message.question !== 'string' || !message.question) { return }

  const textarea = document.querySelector<HTMLTextAreaElement>('textarea.rc-textarea')
  if (!textarea) { return } // chat not mounted yet — host keeps retrying
  if (textarea.value === message.question) {
    // duplicate retry already applied: just re-ack
    reply({ type: ASK_RECEIVED_MESSAGE_TYPE })
    return
  }
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
  if (!setter) { return }
  setter.call(textarea, message.question)
  textarea.dispatchEvent(new Event('input', { bubbles: true })) // notify React
  textarea.focus()
  reply({ type: ASK_RECEIVED_MESSAGE_TYPE })
}

let listenersInstalled = false

/**
 * Installs permanent listeners on both channels. Every valid auth message is
 * exchanged for a fresh session token (so the host can renew it at will).
 * The 'ask' channel (question injection from the host widget) shares them.
 */
const installListeners = (onToken: (hostToken: string) => void) => {
  if (listenersInstalled) { return }
  listenersInstalled = true

  const allowedOrigins = getAllowedOrigins()

  window.addEventListener('message', (event: MessageEvent) => {
    if (!allowedOrigins.includes(event.origin)) { return }
    const token = parseAuthMessage(event.data)
    if (token) { onToken(token) }
    handleAskMessage(event.data, (message) => {
      (event.source as Window | null)?.postMessage(message, event.origin)
    })
  })

  const webview = getWebView2()
  if (webview?.addEventListener) {
    webview.addEventListener('message', (event: any) => {
      const token = parseAuthMessage(event.data)
      if (token) { onToken(token) }
      handleAskMessage(event.data, message => getWebView2()?.postMessage(message))
    })
  }
}

export type AuthInitResult = 'ready' | 'disabled' | 'timeout' | 'rejected'

/**
 * Full auth bootstrap. Resolves:
 *  - 'disabled'  -> server has no auth configured (local dev); legacy flow.
 *  - 'ready'     -> host token received and exchanged; session token in memory.
 *  - 'rejected'  -> host token received but the server refused it (401).
 *  - 'timeout'   -> no host token arrived in time.
 */
export const initHostAuth = async (): Promise<AuthInitResult> => {
  let authRequired = true
  try {
    const res = await fetch('/api/session', { method: 'GET' })
    ;({ authRequired } = await res.json())
  }
  catch {
    // if the status check itself fails, keep going: auth may still work
  }

  return new Promise<AuthInitResult>((resolve) => {
    let settled = false
    const settle = (result: AuthInitResult) => {
      if (settled) { return }
      settled = true
      resolve(result)
    }

    // listeners always installed: 'ask' must work even with auth disabled
    installListeners(async (hostToken) => {
      if (!authRequired) { return }
      const ok = await exchangeHostToken(hostToken)
      if (ok) {
        settle('ready')
      }
      else if (!settled) {
        settle('rejected')
      }
      // listeners stay installed: later messages keep renewing the session
    })

    if (!authRequired) {
      settle('disabled')
      return
    }

    setTimeout(() => settle('timeout'), HOST_TOKEN_TIMEOUT_MS)
    announceReady()
  })
}
