import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

async function sha256(text: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(text)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data))
}

// Comparación en tiempo constante sobre hashes de longitud fija
function digestsEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = 0
  for (let i = 0; i < a.length; i++)
  { diff |= a[i] ^ b[i] }
  return diff === 0
}

// `/` sirve demo.html; ambas rutas quedan tras Basic Auth.
// El resto del dominio (chat /chat, widget.js, API) queda fuera del matcher:
// lo protege la sesión JWT del host y debe ser accesible desde webs externas.
function serve(req: NextRequest) {
  if (req.nextUrl.pathname === '/')
  { return NextResponse.rewrite(new URL('/demo.html', req.url)) }
  return NextResponse.next()
}

export async function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER
  const password = process.env.BASIC_AUTH_PASSWORD

  if (!user || !password) {
    // En producción sin credenciales configuradas, fail-closed
    if (process.env.NODE_ENV === 'production') {
      return new NextResponse('Service unavailable: authentication not configured', {
        status: 503,
      })
    }
    // En desarrollo local, sin protección
    return serve(req)
  }

  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Basic ')) {
    const decoded = atob(auth.slice('Basic '.length))
    const [expected, received] = await Promise.all([
      sha256(`${user}:${password}`),
      sha256(decoded),
    ])
    if (digestsEqual(expected, received))
    { return serve(req) }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Gextor Contabilidad"' },
  })
}

export const config = {
  matcher: ['/', '/demo.html'],
}
