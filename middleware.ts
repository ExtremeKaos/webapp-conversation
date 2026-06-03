import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER
  const password = process.env.BASIC_AUTH_PASSWORD

  // Sin credenciales configuradas, no se aplica protección (entorno local)
  if (!user || !password)
  { return NextResponse.next() }

  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Basic ')) {
    const decoded = atob(auth.slice('Basic '.length))
    const separatorIndex = decoded.indexOf(':')
    const reqUser = decoded.slice(0, separatorIndex)
    const reqPassword = decoded.slice(separatorIndex + 1)
    if (reqUser === user && reqPassword === password)
    { return NextResponse.next() }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Gextor Contabilidad"' },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
