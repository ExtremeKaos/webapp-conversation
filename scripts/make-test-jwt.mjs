/**
 * Genera un JWT de prueba firmado con JWT_VERIFY_SECRET, como lo haría el
 * backend del host (WPF / ASP.NET). Pegar el resultado en public/demo.html
 * (constante TEST_JWT) o usarlo con curl contra /api/session.
 *
 * Uso:
 *   node scripts/make-test-jwt.mjs
 *   node scripts/make-test-jwt.mjs --sub usuario42 --tenant T001 --empresa "Empresa Demo SL" --user-id 42 --rol admin
 *
 * Lee JWT_VERIFY_SECRET / JWT_ISSUER / JWT_AUDIENCE de .env.local si existe.
 */
import { readFileSync } from 'node:fs'
import { SignJWT } from 'jose'

// .env.local mínimo (sin dependencia dotenv)
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) { process.env[m[1]] = m[2].replace(/^["']|["']$/g, '') }
  }
}
catch { /* sin .env.local: usar variables de entorno */ }

const args = process.argv.slice(2)
const getArg = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}

const secret = process.env.JWT_VERIFY_SECRET
if (!secret) {
  console.error('Falta JWT_VERIFY_SECRET (en .env.local o como variable de entorno)')
  process.exit(1)
}

const sub = getArg('sub', 'usuario-demo-1')
const tenantId = getArg('tenant', 'tenant-001')
const empresa = getArg('empresa', 'Empresa Demo SL')
const userId = getArg('user-id', 'u-42')
const userRol = getArg('rol', 'contable')
const expiresIn = getArg('exp', '1h')

async function main() {
  const token = await new SignJWT({ tenant_id: tenantId, empresa, user_id: userId, user_rol: userRol })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer(process.env.JWT_ISSUER || 'gextor-host')
    .setAudience(process.env.JWT_AUDIENCE || 'gextor-chatbot')
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret))

  console.log(token)
}

main()
