import './load-env'
import { getPayload } from 'payload'
import { readEnvironment } from '../cms/environment'

const env = readEnvironment()
if (!['local', 'test'].includes(env.appEnv)) throw new Error('This POC bootstrap command is limited to local/test environments')
if (env.kind === 'turso' && process.env.BOOTSTRAP_TARGET_HOST !== process.env.DATABASE_TARGET_HOST) throw new Error('BOOTSTRAP_TARGET_HOST must confirm the approved disposable Turso target')
const email = process.env.ADMIN_EMAIL
const password = process.env.ADMIN_PASSWORD
if (!email || !password || password.length < 16) throw new Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 16 characters in your terminal environment')
const { default: config } = await import('../payload.config')
const payload = await getPayload({ config })
try {
  if ((await payload.count({ collection: 'users' })).totalDocs !== 0) throw new Error('A user already exists; bootstrap is closed. Log in to manage users.')
  await payload.create({ collection: 'users', data: { email, password, role: 'admin' }, context: { bootstrapAdmin: true } })
  console.log('Initial administrator created. Log in at /admin. Credentials were not logged.')
} finally { await payload.destroy() }
