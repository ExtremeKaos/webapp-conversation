import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { client, getUserContext, setSession } from '@/app/api/utils/common'

export async function GET(request: NextRequest) {
  const context = await getUserContext(request)
  if (context instanceof Response) { return context }
  const { sessionId, user } = context

  const { searchParams } = new URL(request.url)
  const conversationId = searchParams.get('conversation_id')
  const { data }: any = await client.getConversationMessages(user, conversationId as string)
  return NextResponse.json(data, {
    headers: setSession(sessionId),
  })
}
