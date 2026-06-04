import type { NextRequest } from 'next/server'
import type { JWTPayload, JWTVerifyGetKey, KeyObject } from 'jose'
import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose'

/**
 * Server-side auth layer.
 *
 * Flow: the host page (WPF WebView2 / ASP.NET web) injects a JWT signed by the
 * host backend. POST /api/session verifies it and exchanges it for a short-lived
 * session token (our own JWT). Every data route then requires that session token
 * in the Authorization header, and the identity/tenant used against Dify comes
 * EXCLUSIVELY from its verified claims — never from the request body.
 *
 * Secrets live only on the server (no NEXT_PUBLIC_*).
 */

const SESSION_TOKEN_TTL_SECONDS = 2 * 60 * 60 // 2h

export interface SessionClaims {
  sub: string
  tenant_id: string
  empresa: string
  user_id: string
  user_rol: string
}

const encoder = new TextEncoder()

// Auth is enabled when secrets are configured. In production, routes fail closed
// (503) if it is NOT configured — same policy as the Basic Auth middleware.
export const isAuthConfigured = () =>
  !!(process.env.SESSION_SECRET && (process.env.JWT_VERIFY_SECRET || process.env.JWT_JWKS_URL))

export const isAuthRequired = () =>
  isAuthConfigured() || process.env.NODE_ENV === 'production'

/**
 * Key resolution for the HOST token, isolated so switching HS256 (shared
 * secret) -> RS256 (JWKS public keys) is a config change, not a rewrite:
 * set JWT_JWKS_URL and remove JWT_VERIFY_SECRET.
 */
const getHostTokenVerifier = (): { key: Uint8Array | KeyObject | JWTVerifyGetKey, algorithms: string[] } => {
  const jwksUrl = process.env.JWT_JWKS_URL
  if (jwksUrl) {
    return {
      key: createRemoteJWKSet(new URL(jwksUrl)),
      algorithms: ['RS256'],
    }
  }
  return {
    key: encoder.encode(process.env.JWT_VERIFY_SECRET),
    algorithms: ['HS256'],
  }
}

const extractClaims = (payload: JWTPayload): SessionClaims | null => {
  const { sub } = payload
  const tenantId = payload.tenant_id
  const empresa = payload.empresa
  const userId = payload.user_id
  const userRol = payload.user_rol
  if (typeof sub !== 'string' || !sub) { return null }
  if (typeof tenantId !== 'string' || !tenantId) { return null }
  if (typeof empresa !== 'string' || !empresa) { return null }
  if (typeof userId !== 'string' || !userId) { return null }
  if (typeof userRol !== 'string' || !userRol) { return null }
  return { sub, tenant_id: tenantId, empresa, user_id: userId, user_rol: userRol }
}

/**
 * Verifies the JWT injected by the host (signature, exp, iss, aud) and returns
 * its identity claims. Returns null on any validation failure.
 */
export const verifyHostToken = async (token: string): Promise<SessionClaims | null> => {
  try {
    const { key, algorithms } = getHostTokenVerifier()
    const { payload } = await jwtVerify(token, key as Uint8Array, {
      algorithms,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    })
    return extractClaims(payload)
  }
  catch {
    return null
  }
}

/**
 * Issues our own short-lived session JWT carrying the verified claims.
 */
export const createSessionToken = async (claims: SessionClaims): Promise<{ token: string, expiresIn: number }> => {
  const token = await new SignJWT({
    tenant_id: claims.tenant_id,
    empresa: claims.empresa,
    user_id: claims.user_id,
    user_rol: claims.user_rol,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TOKEN_TTL_SECONDS}s`)
    .sign(encoder.encode(process.env.SESSION_SECRET))
  return { token, expiresIn: SESSION_TOKEN_TTL_SECONDS }
}

export const verifySessionToken = async (token: string): Promise<SessionClaims | null> => {
  try {
    const { payload } = await jwtVerify(token, encoder.encode(process.env.SESSION_SECRET), {
      algorithms: ['HS256'],
    })
    return extractClaims(payload)
  }
  catch {
    return null
  }
}

export type SessionResult
  = | { status: 'ok', claims: SessionClaims }
    | { status: 'disabled' } // auth not configured outside production -> legacy behavior
    | { status: 'unauthorized' }
    | { status: 'unconfigured' } // production without secrets -> fail closed

/**
 * Route-handler guard. Reads `Authorization: Bearer <sessionToken>` and verifies it.
 */
export const requireSession = async (request: NextRequest): Promise<SessionResult> => {
  if (!isAuthConfigured()) {
    if (process.env.NODE_ENV === 'production') { return { status: 'unconfigured' } }
    return { status: 'disabled' }
  }

  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) { return { status: 'unauthorized' } }

  const claims = await verifySessionToken(auth.slice('Bearer '.length))
  if (!claims) { return { status: 'unauthorized' } }

  return { status: 'ok', claims }
}

export const sessionErrorResponse = (result: SessionResult): Response | null => {
  if (result.status === 'unauthorized') {
    return Response.json({ message: 'Sesión no válida o caducada' }, { status: 401 })
  }
  if (result.status === 'unconfigured') {
    return Response.json({ message: 'Auth no configurada en el servidor' }, { status: 503 })
  }
  return null
}
