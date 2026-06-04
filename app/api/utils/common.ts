import type { NextRequest } from 'next/server'
import { ChatClient } from 'dify-client'
import { v4 } from 'uuid'
import { API_KEY, API_URL, APP_ID, APP_INFO } from '@/config'
import type { SessionClaims } from '@/app/api/utils/auth'
import { requireSession, sessionErrorResponse } from '@/app/api/utils/auth'

const userPrefix = `user_${APP_ID}:`

export const getInfo = (request: NextRequest) => {
  const sessionId = request.cookies.get('session_id')?.value || v4()
  const user = userPrefix + sessionId
  return {
    sessionId,
    user,
  }
}

export interface UserContext {
  sessionId: string
  user: string
  claims: SessionClaims | null
}

/**
 * Resolves the identity used against Dify.
 * - Auth configured: requires a valid session token (Authorization: Bearer) and
 *   uses its verified `sub` as the Dify user. Otherwise returns a 401/503 Response.
 * - Auth not configured (local dev only): legacy anonymous cookie-based user.
 */
export const getUserContext = async (request: NextRequest): Promise<UserContext | Response> => {
  const result = await requireSession(request)
  const error = sessionErrorResponse(result)
  if (error) { return error }

  const { sessionId, user: legacyUser } = getInfo(request)
  if (result.status === 'ok') {
    return {
      sessionId,
      user: result.claims.sub,
      claims: result.claims,
    }
  }
  // 'disabled' -> legacy behavior
  return { sessionId, user: legacyUser, claims: null }
}

export const setSession = (sessionId: string) => {
  if (APP_INFO.disable_session_same_site)
  { return { 'Set-Cookie': `session_id=${sessionId}; SameSite=None; Secure` } }

  return { 'Set-Cookie': `session_id=${sessionId}` }
}

export const client = new ChatClient(API_KEY, API_URL || undefined)
