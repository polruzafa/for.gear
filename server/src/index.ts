// API de Fardell: comptes d'usuari, una còpia del JSON de dades per usuari i
// les seves fotografies. Worker de Cloudflare sense dependències; les dades
// viuen a D1 (SQLite) i les fotografies a R2.
//
// Endpoints (JSON, si no es diu el contrari):
//   POST   /api/register  { email, password, code? }     → { token, email }
//   POST   /api/login     { email, password }            → { token, email }
//   POST   /api/logout    (Bearer)                       → 204
//   GET    /api/data      (Bearer)                       → { payload, updatedAt }
//   PUT    /api/data      (Bearer) { payload, baseUpdatedAt } → { updatedAt } | 409
//   GET    /api/photos    (Bearer)                       → { keys }
//   GET    /api/photos/:clau (Bearer)                    → el binari de la imatge
//   PUT    /api/photos/:clau (Bearer, cos binari)        → 204
//   DELETE /api/photos/:clau (Bearer)                    → 204
//   DELETE /api/account   (Bearer) { password }          → 204

export interface Env {
  DB: D1Database
  /** Bucket R2 de les fotografies. Opcional: sense bucket, els endpoints de
   * fotografies responen 501 i l'app les deixa en local, com abans. */
  PHOTOS?: R2Bucket
  /** Codi d'invitació per crear comptes (npx wrangler secret put REGISTER_SECRET).
   * Sense definir, el registre és obert: recomanable només per provar. */
  REGISTER_SECRET?: string
}

const MAX_PAYLOAD_BYTES = 1_000_000
const MAX_PHOTO_BYTES = 1_000_000
/** Contenció d'abusos: amb un compte robat o hostil, el mal té sostre. */
const MAX_PHOTOS_PER_USER = 1000
const MAX_SESSIONS_PER_USER = 10
/** Una sessió sense fer servir durant tants dies caduca. */
const SESSION_IDLE_DAYS = 90
/** L'única cosa que es guarda i se serveix són imatges: res de text/html. */
const PHOTO_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const PBKDF2_ITERATIONS = 100_000

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

const fail = (status: number, error: string) => json({ error }, status)

// ── Criptografia (Web Crypto, disponible als Workers) ───────────────────────

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  )
  return toHex(bits)
}

async function sha256Hex(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function randomHex(bytes: number): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer)
}

// ── Utilitats ────────────────────────────────────────────────────────────────

type UserRow = { id: string; email: string; password_hash: string; salt: string }

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null
}

async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const body = await req.json().catch(() => null)
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
}

async function createSession(env: Env, userId: string): Promise<string> {
  const token = randomHex(32)
  const now = new Date().toISOString()
  await env.DB.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, last_used_at) VALUES (?, ?, ?, ?)',
  )
    .bind(await sha256Hex(token), userId, now, now)
    .run()
  // Es conserven només les sessions més recents: iniciar sessió en bucle no
  // pot fer créixer la taula sense límit.
  await env.DB.prepare(
    `DELETE FROM sessions WHERE user_id = ?1 AND token_hash NOT IN (
       SELECT token_hash FROM sessions WHERE user_id = ?1
       ORDER BY last_used_at DESC LIMIT ?2)`,
  )
    .bind(userId, MAX_SESSIONS_PER_USER)
    .run()
  return token
}

/** Retorna l'id de l'usuari del testimoni Bearer, o null si no és vàlid. */
async function authenticate(req: Request, env: Env): Promise<string | null> {
  const header = req.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!/^[0-9a-f]{64}$/.test(token)) return null
  const tokenHash = await sha256Hex(token)
  const row = await env.DB.prepare(
    'SELECT user_id, last_used_at FROM sessions WHERE token_hash = ?',
  )
    .bind(tokenHash)
    .first<{ user_id: string; last_used_at: string }>()
  if (!row) return null
  // Una sessió abandonada caduca: un testimoni perdut no val per sempre.
  if (Date.now() - Date.parse(row.last_used_at) > SESSION_IDLE_DAYS * 86_400_000) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
    return null
  }
  await env.DB.prepare('UPDATE sessions SET last_used_at = ? WHERE token_hash = ?')
    .bind(new Date().toISOString(), tokenHash)
    .run()
  return row.user_id
}

async function verifyPassword(user: UserRow, password: unknown): Promise<boolean> {
  if (typeof password !== 'string') return false
  return constantTimeEqual(await hashPassword(password, user.salt), user.password_hash)
}

// ── Endpoints ────────────────────────────────────────────────────────────────

async function register(req: Request, env: Env): Promise<Response> {
  const body = await readBody(req)
  // Amb REGISTER_SECRET definit, crear un compte demana el codi d'invitació;
  // iniciar sessió, no. Sense el codi, el registre queda tancat als estranys.
  if (env.REGISTER_SECRET) {
    const code = body?.code
    if (typeof code !== 'string' || !constantTimeEqual(code, env.REGISTER_SECRET)) {
      return fail(403, 'code')
    }
  }
  const email = normalizeEmail(body?.email)
  const password = body?.password
  if (!email) return fail(400, 'email')
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return fail(400, 'password')
  }
  const salt = randomHex(16)
  const id = crypto.randomUUID()
  try {
    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(id, email, await hashPassword(password, salt), salt, new Date().toISOString())
      .run()
  } catch {
    return fail(409, 'exists') // la restricció UNIQUE de l'email
  }
  return json({ token: await createSession(env, id), email }, 201)
}

async function login(req: Request, env: Env): Promise<Response> {
  const body = await readBody(req)
  const email = normalizeEmail(body?.email)
  if (!email) return fail(401, 'credentials')
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<UserRow>()
  if (!user || !(await verifyPassword(user, body?.password))) return fail(401, 'credentials')
  return json({ token: await createSession(env, user.id), email: user.email })
}

async function logout(req: Request, env: Env): Promise<Response> {
  const header = req.headers.get('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (token) {
    await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await sha256Hex(token))
      .run()
  }
  return new Response(null, { status: 204, headers: CORS })
}

async function getData(env: Env, userId: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT payload, updated_at FROM gear_data WHERE user_id = ?')
    .bind(userId)
    .first<{ payload: string; updated_at: string }>()
  if (!row) return json({ payload: null, updatedAt: null })
  return json({ payload: JSON.parse(row.payload), updatedAt: row.updated_at })
}

async function putData(req: Request, env: Env, userId: string): Promise<Response> {
  const body = await readBody(req)
  const payload = body?.payload
  if (typeof payload !== 'object' || payload === null) return fail(400, 'payload')
  const text = JSON.stringify(payload)
  if (text.length > MAX_PAYLOAD_BYTES) return fail(413, 'too-large')

  // Control de concurrència optimista: el client diu quina versió del servidor
  // coneixia (baseUpdatedAt); si mentrestant un altre dispositiu ha desat, 409.
  const baseUpdatedAt = body?.baseUpdatedAt ?? null
  const current = await env.DB.prepare('SELECT updated_at FROM gear_data WHERE user_id = ?')
    .bind(userId)
    .first<{ updated_at: string }>()
  if (current && current.updated_at !== baseUpdatedAt) {
    return json({ error: 'conflict', updatedAt: current.updated_at }, 409)
  }

  const updatedAt = new Date().toISOString()
  await env.DB.prepare(
    `INSERT INTO gear_data (user_id, payload, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
    .bind(userId, text, updatedAt)
    .run()
  return json({ updatedAt })
}

// ── Fotografies (R2) ─────────────────────────────────────────────────────────
// Els objectes es guarden com a «userId/clau», on la clau és la mateixa que fa
// servir el client a IndexedDB («id» de l'element, «id#2» d'una ressenya…).

/** La clau de la ruta /api/photos/:clau, o null si no és acceptable. */
function parsePhotoKey(pathname: string): string | null {
  let key: string
  try {
    key = decodeURIComponent(pathname.slice('/api/photos/'.length))
  } catch {
    return null
  }
  if (!key || key.length > 200 || key.includes('/')) return null
  return key
}

async function listPhotos(bucket: R2Bucket, userId: string): Promise<Response> {
  const prefix = `${userId}/`
  const keys: string[] = []
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix, cursor })
    for (const obj of page.objects) keys.push(obj.key.slice(prefix.length))
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return json({ keys })
}

async function getPhoto(bucket: R2Bucket, userId: string, key: string): Promise<Response> {
  const obj = await bucket.get(`${userId}/${key}`)
  if (!obj) return fail(404, 'not-found')
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'image/jpeg',
      // Que el navegador no s'inventi cap altre tipus: això només són imatges.
      'X-Content-Type-Options': 'nosniff',
      ...CORS,
    },
  })
}

async function putPhoto(
  req: Request,
  bucket: R2Bucket,
  userId: string,
  key: string,
): Promise<Response> {
  const contentType = req.headers.get('Content-Type') ?? ''
  if (!PHOTO_CONTENT_TYPES.has(contentType)) return fail(415, 'type')
  const body = await req.arrayBuffer()
  if (body.byteLength === 0) return fail(400, 'empty')
  if (body.byteLength > MAX_PHOTO_BYTES) return fail(413, 'too-large')

  // Quota per usuari: només compta quan la clau és nova; canviar una
  // fotografia existent sempre es pot.
  const objectKey = `${userId}/${key}`
  if (!(await bucket.head(objectKey))) {
    const page = await bucket.list({ prefix: `${userId}/`, limit: MAX_PHOTOS_PER_USER })
    if (page.truncated || page.objects.length >= MAX_PHOTOS_PER_USER) {
      return fail(413, 'too-many')
    }
  }

  await bucket.put(objectKey, body, { httpMetadata: { contentType } })
  return new Response(null, { status: 204, headers: CORS })
}

async function deletePhoto(bucket: R2Bucket, userId: string, key: string): Promise<Response> {
  await bucket.delete(`${userId}/${key}`)
  return new Response(null, { status: 204, headers: CORS })
}

/** Buida totes les fotografies de l'usuari (en suprimir el compte). */
async function purgePhotos(bucket: R2Bucket, userId: string): Promise<void> {
  const prefix = `${userId}/`
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix, cursor })
    if (page.objects.length > 0) await bucket.delete(page.objects.map((o) => o.key))
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
}

async function deleteAccount(req: Request, env: Env, userId: string): Promise<Response> {
  const body = await readBody(req)
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?')
    .bind(userId)
    .first<UserRow>()
  if (!user || !(await verifyPassword(user, body?.password))) return fail(401, 'credentials')
  if (env.PHOTOS) await purgePhotos(env.PHOTOS, userId)
  // Les sessions i les dades cauen en cascada (ON DELETE CASCADE).
  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run()
  return new Response(null, { status: 204, headers: CORS })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const { pathname } = new URL(req.url)
    const route = `${req.method} ${pathname}`
    try {
      if (route === 'POST /api/register') return await register(req, env)
      if (route === 'POST /api/login') return await login(req, env)
      if (route === 'POST /api/logout') return await logout(req, env)

      if (
        route === 'GET /api/data' ||
        route === 'PUT /api/data' ||
        route === 'DELETE /api/account' ||
        pathname === '/api/photos' ||
        pathname.startsWith('/api/photos/')
      ) {
        const userId = await authenticate(req, env)
        if (!userId) return fail(401, 'unauthorized')
        if (route === 'GET /api/data') return await getData(env, userId)
        if (route === 'PUT /api/data') return await putData(req, env, userId)
        if (route === 'DELETE /api/account') return await deleteAccount(req, env, userId)

        const bucket = env.PHOTOS
        if (!bucket) return fail(501, 'no-photos')
        if (route === 'GET /api/photos') return await listPhotos(bucket, userId)
        const key = parsePhotoKey(pathname)
        if (!key) return fail(400, 'key')
        if (req.method === 'GET') return await getPhoto(bucket, userId, key)
        if (req.method === 'PUT') return await putPhoto(req, bucket, userId, key)
        if (req.method === 'DELETE') return await deletePhoto(bucket, userId, key)
      }

      return fail(404, 'not-found')
    } catch (e) {
      console.error(e)
      return fail(500, 'server')
    }
  },
}
