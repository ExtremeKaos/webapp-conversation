# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fork of Dify's `webapp-conversation` chat template (Next.js 15, App Router, React 19, TypeScript strict). Branded as "Gextor Contabilidad" (`config/index.ts`). Upstream: https://github.com/ExtremeKaos/webapp-conversation.

The app is a chat UI that proxies all traffic to a Dify backend — there is no own database or business logic on the server beyond the proxy.

## Commands

```bash
npm run dev        # dev server on http://localhost:3000
npm run build      # production build
npm run start      # serve production build
npm run lint       # next lint
npm run fix        # eslint . --fix
```

No test suite exists. Husky + lint-staged run `eslint --fix` on staged `.ts/.tsx/.js/.jsx`. ESLint config is `@antfu/eslint-config` based (`eslint.config.mjs`).

Required env in `.env.local` (see `.env.example`): `NEXT_PUBLIC_APP_ID`, `NEXT_PUBLIC_APP_KEY`, `NEXT_PUBLIC_API_URL` (Dify app ID, API key, and API base URL).

## Architecture

Request flow: **browser → `service/` client → `app/api/**/route.ts` (Next.js route handlers) → `dify-client` SDK → Dify API**.

- `app/api/utils/common.ts` — creates the shared `ChatClient` (dify-client) with `API_KEY`/`API_URL`, and derives the Dify `user` from a `session_id` cookie (`getInfo`/`setSession`). The API key never reaches the browser; route handlers proxy everything.
- `app/api/{chat-messages,conversations,messages,parameters,file-upload}` — one `route.ts` per Dify endpoint. `chat-messages` streams the Dify SSE response straight through.
- `service/base.ts` — client-side HTTP layer: `get/post/put/del` (auto JSON body, timeout, error toasts via `app/components/base/toast`) and `ssePost` which parses the SSE stream and dispatches event callbacks (`onData`, `onThought`, `onFile`, `onMessageEnd`, `onMessageReplace`, `onWorkflowStarted`, `onNodeStarted`, `onNodeFinished`, `onWorkflowFinished`, `onError`).
- `service/index.ts` — domain functions (`sendChatMessage`, `fetchConversations`, `fetchChatList`, `fetchAppParams`, `updateFeedback`, `generationConversationName`). New API calls go here, built on `service/base.ts`.
- `app/components/index.tsx` (`Main`, client component) — the application shell: owns app config, conversation state, message sending, streaming callbacks, and workflow/agent-thought rendering. Most state logic lives here, not in pages.
- `hooks/use-conversation.ts` — conversation list/current-conversation state (incl. localStorage persistence of conversation ID).
- `app/components/chat/**` — message list, input, markdown/code rendering; `app/components/base/**` — shared primitives (toast, loading, uploader, icons…); `app/components/workflow/**` — workflow-run progress UI.
- `config/index.ts` — `APP_INFO` (title, default language `es`, `disable_session_same_site` for iframe embedding), `isShowPrompt`, `promptTemplate`.

### i18n

- Server: `getLocaleOnServer()` (`i18n/server.ts`) reads cookie / negotiates `Accept-Language`; used in `app/layout.tsx` for `<html lang>`.
- Client: `getLocaleOnClient()` / `setLocaleOnClient()` (`i18n/client.ts`), cookie name `LOCALE_COOKIE_NAME` from config.
- Resources in `i18n/lang/app.*.ts`, `common.*.ts`, `tools.*.ts` — keep keys in sync across locales (es/en/fr/ja/vi/zh; note `tools.es.ts` is missing while other `*.es.ts` exist).

## Conventions (from .cursor/rules)

- `@/*` path alias for absolute imports; strict TS, avoid `any`.
- Server components by default; add `'use client'` only when state/effects/browser APIs needed.
- Tailwind-first styling; colocated `style.module.css` or SCSS only where necessary; `classnames` / `tailwind-merge` for conditional classes.
- Errors/notifications via `app/components/base/toast`.
- New client API calls: use `get/post/put/del`/`ssePost` from `service/base.ts`, expose as domain function in `service/index.ts`.
