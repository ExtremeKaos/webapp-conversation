import type { NextRequest } from 'next/server'
import { client, getUserContext } from '@/app/api/utils/common'

export async function POST(request: NextRequest) {
  const context = await getUserContext(request)
  if (context instanceof Response) { return context }
  const { user } = context

  try {
    const formData = await request.formData()
    formData.append('user', user)
    const res = await client.fileUpload(formData)
    return new Response(res.data.id as any)
  }
  catch (e: any) {
    return new Response(e.message)
  }
}
