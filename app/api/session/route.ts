import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createSessionToken, isAuthConfigured, isAuthRequired, verifyHostToken } from '@/app/api/utils/auth'

/**
 * GET /api/session — tells the client whether the auth handshake is required.
 * Carries no secrets; lets local dev without secrets keep the legacy flow.
 */
export async function GET() {
  return NextResponse.json({ authRequired: isAuthRequired() })
}

/**
 * POST /api/session — exchanges the host-injected JWT for our session token.
 * Body: { token: string }. 401 on any validation failure.
 */
export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    // fail closed in production, explicit error otherwise
    const status = process.env.NODE_ENV === 'production' ? 503 : 500
    return NextResponse.json({ message: 'Auth no configurada en el servidor' }, { status })
  }

  let token: unknown
  try {
    ({ token } = await request.json())
  }
  catch {
    return NextResponse.json({ message: 'Cuerpo inválido' }, { status: 400 })
  }

  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ message: 'Falta el token' }, { status: 400 })
  }

  const claims = await verifyHostToken(token)
  if (!claims) {
    return NextResponse.json({ message: 'Token no válido' }, { status: 401 })
  }

  const { token: sessionToken, expiresIn } = await createSessionToken(claims)
  return NextResponse.json({
    session_token: sessionToken,
    expires_in: expiresIn,
  })
}
