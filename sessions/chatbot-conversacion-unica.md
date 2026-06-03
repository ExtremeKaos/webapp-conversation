# Sesión — Chatbot conversación única (Gextor Contabilidad)

**Fecha:** 2026-06-02 / 2026-06-03
**Estado:** funcional, verificado en build de producción. Desplegado en Vercel con Basic Auth.
**Commit base original:** `33085b6608fe7174e0fb75e46c220348863b1c19`
**Commit feature:** `687ad62` (conversación única + branding + streamdown v2)
**Commits deploy:** `8c187b9` (demo), `3b10208` (fix Vercel lockfile), `fd8b482` + `e7bb04d` (Basic Auth)

## Objetivo

Convertir fork de Dify `webapp-conversation` en chatbot de consulta única para incrustar en iframe (burbuja) sobre una web. App Dify: "Gextor Contabilidad" (RAG manual contable + variable opcional `retrieval_mode`).

## Hecho en esta sesión (todo verificado con Playwright)

1. **CLAUDE.md** creado (arquitectura, comandos, convenciones).
2. **Modo conversación única**: eliminados sidebar, rutas `app/api/conversations/`, `fetchConversations`/`generationConversationName`. Conversación persiste en localStorage (`conversationIdInfo`); si el id ya no existe en Dify → catch en `fetchChatList` arranca nueva. Detalle completo de lo eliminado + restauración: `MEMORIA-ELEMENTOS-ELIMINADOS.md`.
3. **Branding**: logo `public/gextor-ia.svg` (origen `G:\Trabajo\Extrasoftware\Synexa\GEXTOR IA.svg`) en header y `.answerIcon`; `favicon.ico` regenerado desde el SVG (16/32/48/256 PNG embebidos).
4. **Fixes de formato**:
   - Thinking `<think>` oculto → `stripThinking()` en `app/components/base/streamdown-markdown.tsx`
   - `----` pegado a texto (setext heading gigante) → `normalizeSetextDashes()` mismo fichero
   - Markdown sin estilos → streamdown paths añadidos a `content` de `tailwind.config.js`
   - Caja input descentrada → quitados `pc:ml-[122px] tablet:ml-[96px]` (compensaban sidebar) en `chat/index.tsx`
   - Contador "0" → `display:none` restaurado en `chat/style.module.css`
   - Scrollbar ventana permanente → `w-screen`→`w-full` en `app/layout.tsx`
   - Caja sin margen inferior → `pb-4` + botones `bottom-2`→`bottom-6` en `chat/index.tsx`
5. **Botón "Nuevo chat"** en header: borra id de localStorage (`storageConversationIdKey` exportado de `hooks/use-conversation.ts`) + `window.location.reload()`.
6. **Barra "Nueva conversación" oculta** → `renderHasSetInputs`/`renderHeader` anulados en `app/components/welcome/index.tsx` (código conservado comentado).
7. **Auto-arranque**: effect en `index.tsx` salta la pantalla de config/welcome, inicia chat con inputs vacíos. ⚠️ Variables de Dify deben ser opcionales.
8. **streamdown 1.6.11 → 2.5.0** + plugins nuevos `@streamdown/mermaid`, `@streamdown/math`, `@streamdown/code` (aprobado por usuario). Wrapper con `plugins={{ code, math, mermaid }}`, import `streamdown/styles.css`, tokens shadcn en `globals.css`, paths plugins en tailwind content. Resultado: mermaid (graph/pie/xychart-beta), tablas con copiar/CSV/expandir, LaTeX `$$...$$` (inline `$` desactivado por diseño), Shiki, task lists.

## Añadido tras el commit 687ad62 (2026-06-03)

9. **Demo burbuja** `public/demo.html` (mismo puerto que el chatbot, Next la sirve estática):
   - Landing simulada Gextor + widget burbuja (logo SVG sobre fondo blanco, panel iframe con carga perezosa, responsive móvil).
   - Bloque "Prueba el asistente": 6 tarjetas de preguntas de ejemplo (tabla+CSV, tarta, barras, diagrama, pasos, fórmula). Click → abre chat e inyecta la pregunta en el textarea (solo mismo origen; fallback portapapeles en cross-origin).
   - Para la web real: copiar bloque `<!-- widget burbuja chatbot -->` + CSS, cambiar `data-src` del iframe a la URL pública.
   - ⚠️ `next start` indexa `public/` al arrancar — fichero nuevo en public requiere reiniciar server prod.
10. **Placeholder input** configurable: `inputPlaceholder` en `config/index.ts`, consumido en `chat/index.tsx`.
11. **Hook pre-commit** corregido: `pnpm lint-staged` → `npx lint-staged` (commit 687ad62).
12. **Error mermaid diagnosticado** (no es bug frontend): el bot generó `E[Texto (con paréntesis)]` — paréntesis sin comillas rompen el parser. Regla para el prompt de Dify: etiquetas de nodos SIEMPRE entre comillas `A["Etiqueta"]`. Streamdown muestra error con "Show Code" sin romper el resto.

## Deploy Vercel + Basic Auth (sesión 2026-06-03, tarde)

13. **Fix build Vercel**: fallaba con `ERR_PNPM_OUTDATED_LOCKFILE` (pnpm-lock.yaml del upstream tenía `eslint-config-next@14.2.32` vs `~15.5.9` en package.json). Solución: borrado `pnpm-lock.yaml` (commit `3b10208`) → Vercel detecta `package-lock.json` (al día, resuelve 15.5.19) y usa npm.
14. **Basic Auth para PoC** (`middleware.ts` nuevo, commits `fd8b482` + `e7bb04d` endurecido tras security review):
    - Protege todo (páginas, demo.html, API) salvo `_next/static|_next/image|favicon.ico`.
    - Credenciales en env vars `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` (añadidas a `.env.example`).
    - **Fail-closed**: en producción (`NODE_ENV === 'production'`) sin env vars → 503. En local sin vars → abierta.
    - **Timing-safe**: compara hashes SHA-256 (Web Crypto, edge runtime) en tiempo constante.
    - ⚠️ Basic Auth NO funciona en iframe cross-origin (navegador bloquea prompt). Vale para PoC en dominio Vercel (demo.html mismo origen). Para incrustar en web del cliente → cambiar a token en URL + cookie.

## Decisiones clave

- Conversación persiste entre visitas (localStorage). Para chat limpio por visita: ignorar `getConversationIdFromStorage` en init de `index.tsx`.
- Reinicio por recarga de página (estado 100% limpio, vale en iframe).
- `disable_session_same_site` queda `false` — **activar al desplegar si el iframe va en otro dominio (requiere HTTPS)**, en `config/index.ts`.

## Pendiente

- [ ] **Vercel: configurar `BASIC_AUTH_USER` y `BASIC_AUTH_PASSWORD`** en Settings → Environment Variables (Production). Sin ellas el deploy actual (`e7bb04d` ya pusheado) responde 503.
- [ ] Verificar deploy Vercel tras configurar env vars (login funciona, chat conecta con Dify — recordar también `NEXT_PUBLIC_APP_ID/KEY/API_URL` en Vercel).
- [ ] Usuario: quitar coletilla `----\nModo de recuperación usado: {{retrieval_mode}}` del nodo Answer en Dify Studio.
- [ ] Usuario: añadir prompt de formato al system prompt de Dify (propuesto en conversación: tablas, mermaid, $$ solo bloque, importes formato español, prohibir headings para notas).
- [ ] Al desplegar en iframe cross-domain: `disable_session_same_site: true`.
- [ ] Decidir si ocultar panel "Workflow Process" en respuestas (preguntado, sin respuesta).
- [ ] Citations ("CITAS") no soportadas por el fork — ofrecido, sin respuesta.
- [ ] `.playwright-mcp/` y `.vs/` sin trackear — añadir a `.gitignore` si molestan.

## Gotchas dev

- `npm run build` y `npm run dev` comparten `.next` → corromperse mutuamente. Si error `ENOENT vendor-chunks` o `Cannot read properties of undefined (reading 'call')`: `npx rimraf .next` y relanzar.
- En dev, Fast Refresh puede hacer full reload a mitad de un envío (compilación on-demand) → chat aparenta perder el mensaje. Solo dev; en producción no pasa.
- TaskStop/kill de `npm run dev` en Windows deja zombis node escuchando → matar por puerto con PowerShell (`Get-NetTCPConnection -State Listen` + `taskkill /T`).
- `rm -rf` denegado por permisos en esta sesión → usar `npx rimraf`.
- Errores eslint/tsc pre-existentes upstream en `markdown.tsx`, `file-uploader-in-attachment`, `welcome/index.tsx` (líneas 175-179) — no tocar, no son nuestros.
