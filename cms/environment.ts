import path from 'node:path'

type Env = Record<string, string | undefined>
export function readEnvironment(env: Env = process.env) {
  const required = (key: string) => {
    const value = env[key]
    if (!value) throw new Error(`Missing required environment variable: ${key}`)
    return value
  }
  const appEnv = required('APP_ENV')
  if (!['local', 'test', 'preview', 'production'].includes(appEnv)) throw new Error('Invalid APP_ENV')
  if (env.VERCEL && env.VERCEL_ENV !== appEnv) throw new Error('APP_ENV must match VERCEL_ENV')
  const secret = required('PAYLOAD_SECRET')
  if (secret.length < 32) throw new Error('PAYLOAD_SECRET must contain at least 32 characters')
  const url = required('DATABASE_URL')
  const kind = required('DATABASE_KIND')
  if (kind === 'sqlite') {
    if (!['local', 'test'].includes(appEnv) || env.VERCEL) throw new Error('SQLite is only allowed for local/test execution')
    const expected = appEnv === 'test' ? './.data/test/' : './.data/local/'
    if (!url.startsWith(`file:${expected}`) || path.relative(path.resolve(expected), path.resolve(url.slice(5))).startsWith('..')) {
      throw new Error('SQLite file must be inside the matching .data/local/ or .data/test/ directory')
    }
  } else if (kind === 'turso') {
    if (appEnv === 'local') throw new Error('Turso requires an explicit test, preview, or production environment')
    let target: URL
    try { target = new URL(url) } catch { throw new Error('DATABASE_URL must be a valid libSQL URL') }
    if (target.protocol !== 'libsql:' || target.username || target.password || target.pathname !== '') throw new Error('Expected a libsql://hostname database URL')
    required('DATABASE_AUTH_TOKEN')
    if (required('DATABASE_TARGET_HOST') !== target.hostname) throw new Error('DATABASE_TARGET_HOST does not match DATABASE_URL')
  } else throw new Error('DATABASE_KIND must be sqlite or turso')
  const storage = required('MEDIA_STORAGE')
  if (!['local', 'r2'].includes(storage)) throw new Error('MEDIA_STORAGE must be local or r2')
  if (storage === 'local' && (!['local', 'test'].includes(appEnv) || env.VERCEL)) throw new Error('Deployed media requires R2')
  if ((kind === 'turso') !== (storage === 'r2')) throw new Error('Use SQLite with local media, or Turso with R2')
  const prefixName = storage === 'r2' ? 'R2_PREFIX' : 'MEDIA_PREFIX'
  const prefix = required(prefixName)
  if (!/^[a-z0-9][a-z0-9/_-]*$/.test(prefix) || prefix.includes('//') || prefix.endsWith('/')) throw new Error(`Invalid ${prefixName}`)
  let r2: { bucket: string; endpoint: string; publicURL: string; accessKeyId: string; secretAccessKey: string } | undefined
  if (storage === 'r2') {
    const bucket = required('R2_BUCKET')
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('Invalid R2_BUCKET')
    if (required('R2_TARGET_BUCKET') !== bucket) throw new Error('R2_TARGET_BUCKET must confirm the approved bucket')
    const parse = (key: string) => {
      let parsed: URL
      try { parsed = new URL(required(key)) } catch { throw new Error(`Invalid ${key}`) }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.port || parsed.pathname !== '/') throw new Error(`${key} must be an HTTPS origin without credentials, path, query or fragment`)
      return parsed
    }
    const endpoint = parse('R2_ENDPOINT')
    if (!/^[a-f0-9]{32}(?:\.(?:eu|fedramp|us))?\.r2\.cloudflarestorage\.com$/.test(endpoint.hostname)) throw new Error('R2_ENDPOINT must be a Cloudflare R2 account S3 endpoint')
    const delivery = parse('R2_PUBLIC_URL')
    if (delivery.hostname.endsWith('.cloudflarestorage.com') || delivery.hostname === endpoint.hostname) throw new Error('R2_PUBLIC_URL must be a delivery origin, never an S3 API endpoint')
    r2 = { bucket, endpoint: endpoint.origin, publicURL: delivery.origin, accessKeyId: required('R2_ACCESS_KEY_ID'), secretAccessKey: required('R2_SECRET_ACCESS_KEY') }
  }
  return { appEnv, secret, url, kind, storage, prefix, r2, mediaDir: path.resolve('.data', appEnv === 'test' ? 'test' : 'local', 'media') }
}
