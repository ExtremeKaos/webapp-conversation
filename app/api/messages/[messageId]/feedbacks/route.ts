import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { client, getUserContext } from '@/app/api/utils/common'

export async function POST(request: NextRequest, { params }: {
  params: Promise<{ messageId: string }>
}) {
  const context = await getUserContext(request)
  if (context instanceof Response) { return context }
  const { user } = context

  const body = await request.json()
  const {
    rating,
  } = body
  const { messageId } = await params
  const { data } = await client.messageFeedback(messageId, rating, user)
  return NextResponse.json(data)
}
