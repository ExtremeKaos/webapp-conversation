import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { client, getUserContext, setSession } from '@/app/api/utils/common'

export async function GET(request: NextRequest) {
  const context = await getUserContext(request)
  if (context instanceof Response) { return context }
  const { sessionId, user } = context

  try {
    const { data } = await client.getApplicationParameters(user)
    return NextResponse.json(data as object, {
      headers: setSession(sessionId),
    })
  }
  catch (error) {
    return NextResponse.json([])
  }
}
