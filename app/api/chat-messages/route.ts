import type { NextRequest } from 'next/server'
import { client, getUserContext } from '@/app/api/utils/common'

export async function POST(request: NextRequest) {
  const context = await getUserContext(request)
  if (context instanceof Response) { return context }
  const { user, claims } = context

  const body = await request.json()
  const {
    inputs,
    query,
    files,
    conversation_id: conversationId,
    response_mode: responseMode,
  } = body

  // identity inputs come ONLY from the verified session token — anything the
  // browser sends in `inputs` for those keys is overwritten.
  const safeInputs = claims
    ? {
      ...inputs,
      tenant_id: claims.tenant_id,
      empresa: claims.empresa,
      user_id: claims.user_id,
      user_rol: claims.user_rol,
    }
    : inputs

  // verification log: confirm what actually reaches Dify
  console.log('[chat-messages] user=%s inputs=%o', user, safeInputs)

  const res = await client.createChatMessage(safeInputs, query, user, responseMode, conversationId, files)
  return new Response(res.data as any)
}
