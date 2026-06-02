# Memoria — Conversión a chatbot de conversación única

**Fecha:** 2026-06-02
**Commit base (código original recuperable):** `33085b6608fe7174e0fb75e46c220348863b1c19`

## Objetivo

Convertir el template `webapp-conversation` de Dify (multi-conversación con histórico en sidebar) en un chatbot de consulta única para embeber en una web. Se eliminó toda la UI y lógica de gestión de múltiples conversaciones.

**Comportamiento resultante:**
- Una sola conversación por usuario, persistida en `localStorage` (clave `conversationIdInfo`) — al recargar la página se retoma la misma conversación.
- Si la conversación guardada ya no existe en Dify, se arranca una nueva automáticamente (catch en `handleConversationSwitch`).
- Sin sidebar, sin botón "nuevo chat", sin renombrado automático de conversaciones.

> Para que cada visita empiece con chat limpio: en `app/components/index.tsx` (init effect), ignorar `getConversationIdFromStorage` y dejar siempre `isNotNewConversation = false`.

**Añadido posteriormente:** botón "Nuevo chat" en el header (`onRestart` en `header.tsx` + `handleRestartChat` en `index.tsx`): borra el id de localStorage y recarga la página para arrancar conversación limpia. Sustituye la funcionalidad de "nuevo chat" que daba el sidebar.

---

## Elementos eliminados

### 1. Componente Sidebar (carpeta completa)

**Ruta:** `app/components/sidebar/` (`index.tsx`, `card.tsx`, `card.module.css`)
**Qué hacía:** listaba conversaciones del usuario, permitía cambiar entre ellas y crear nueva.

**Restaurar:**
```bash
git checkout 33085b6 -- app/components/sidebar
```

### 2. Rutas API de conversaciones (carpeta completa)

**Ruta:** `app/api/conversations/`
- `route.ts` — GET: lista de conversaciones vía `client.getConversations(user)` (también hacía `setSession`; no es problema: `app/api/parameters/route.ts` sigue seteando la cookie `session_id` en el init).
- `[conversationId]/name/route.ts` — POST: renombrado (auto-generado) de conversación vía `client.renameConversation`.

**Restaurar:**
```bash
git checkout 33085b6 -- app/api/conversations
```

### 3. `service/index.ts` — funciones de dominio

Eliminadas:
```ts
export const fetchConversations = async () => {
  return get('conversations', { params: { limit: 100, first_id: '' } })
}

export const generationConversationName = async (id: string) => {
  return post(`conversations/${id}/name`, { body: { auto_generate: true } })
}
```

### 4. `app/components/index.tsx` — lógica multi-conversación

| Elemento eliminado | Detalle |
|---|---|
| Import `Sidebar` | y los imports `fetchConversations`, `generationConversationName`, tipo `ConversationItem`, `useBreakpoints`/`MediaType` |
| `media` / `isMobile` | solo se usaban para el layout del sidebar y botones del header móvil |
| `isShowSidebar` + `showSidebar`/`hideSidebar` | toggle del sidebar en móvil |
| `handleConversationIdChange(id)` | cambio de conversación desde sidebar / botón nuevo chat (id `'-1'` = nueva) |
| Init effect: `fetchConversations()` en `Promise.all` | ahora solo `fetchAppParams()`. La validación de la conversación guardada contra la lista del servidor se sustituyó por: confiar en localStorage + catch de `fetchChatList` que resetea a `'-1'` si la conversación ya no existe |
| Init: `setConversationList(conversations)` | la lista de conversaciones ya no se carga del servidor (`conversationList` del hook sigue existiendo, solo se usa para la entrada `'-1'` de `createNewChat`) |
| Init: `currentConversation.name` en `setExistConversationInfo` | sustituido por nombre por defecto (`app.chat.newChatDefaultName`) |
| `onCompleted`: bloque rename | tras el primer mensaje llamaba a `fetchConversations()` + `generationConversationName()` para autogenerar nombre y refrescar la lista. Eliminado (sin sidebar el nombre no se muestra) |
| `getConversationIdChangeBecauseOfNew` | tercer elemento del `useGetState` — solo lo usaba el bloque rename |
| `renderSidebar()` + JSX del sidebar | bloque desktop (`!isMobile && renderSidebar()`) y overlay móvil |
| Props de `<Header>` | `isMobile`, `onShowSideBar`, `onCreateNewChat` |

**Restaurar versión completa:**
```bash
git checkout 33085b6 -- app/components/index.tsx
```

### 5. `app/components/header.tsx` — botones móviles

Eliminados: icono hamburguesa (`Bars3Icon`, abría sidebar) e icono nuevo chat (`PencilSquareIcon`), junto con las props `isMobile`, `onShowSideBar`, `onCreateNewChat`. Título ahora centrado.

Además: `<AppIcon size="small" />` (emoji 🤖) sustituido por logo `<img src='/gextor-ia.svg' />` (`public/gextor-ia.svg`, origen `G:\Trabajo\Extrasoftware\Synexa\GEXTOR IA.svg`). `AppIcon` sigue existiendo — lo usan los iconos de herramientas en `chat/thought/tool.tsx` y `workflow/block-icon.tsx`.

**Restaurar:**
```bash
git checkout 33085b6 -- app/components/header.tsx
```

---

## Elementos conservados (no tocar al reactivar)

- `hooks/use-conversation.ts` — intacto. Mantiene `conversationList`, persistencia en localStorage y toda la API del hook; reutilizable tal cual si se restaura el sidebar.
- `app/api/chat-messages`, `app/api/messages`, `app/api/parameters`, `app/api/file-upload` — intactos.
- `fetchChatList` (`service/index.ts`) — se sigue usando para recargar el histórico de la conversación única tras recargar la página.

## Reactivación completa (multi-conversación)

```bash
git checkout 33085b6 -- app/components/sidebar app/api/conversations app/components/index.tsx app/components/header.tsx service/index.ts
```

(Revisar después conflictos con cambios posteriores a esta fecha.)
