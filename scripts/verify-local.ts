import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@libsql/client'
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const id = randomUUID()
const evidenceDir = process.env.ENGINEERING_EVIDENCE_DIR || 'evidence/mission-003/local-regression'
mkdirSync(evidenceDir, { recursive: true })
mkdirSync('.data/test', { recursive: true })
const env = {
  ...process.env, ENGINEERING_EVIDENCE_DIR: evidenceDir, NEXT_DIST_DIR: '.next-local-verification',
  APP_ENV: 'test', DATABASE_KIND: 'sqlite', DATABASE_URL: `file:./.data/test/${id}.db`,
  DATABASE_AUTH_TOKEN: '', DATABASE_TARGET_HOST: '',
  MEDIA_STORAGE: 'local', MEDIA_PREFIX: `test/${id}`,
  PAYLOAD_SECRET: randomBytes(32).toString('hex'),
  ADMIN_EMAIL: `admin-${id}@example.test`, ADMIN_PASSWORD: randomBytes(24).toString('base64url'),
  CMS_SMOKE: '1', CMS_RUN_ID: id, PLAYWRIGHT_NO_COPY_PROMPT: '1',
}
function run(args: string[], extra = {}) {
  const result = spawnSync(process.execPath, args, { env: { ...env, ...extra }, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
run(['--import', 'tsx', 'scripts/payload-cli.ts', 'migrate'])
run(['--import', 'tsx', 'scripts/import-website.ts'])
// ISR snapshots must be built against this exact disposable database, never another target.
run(['node_modules/next/dist/bin/next', 'build'])
run(['node_modules/@playwright/test/cli.js', 'test', 'bootstrap.spec.ts', '--project=desktop'], { CMS_PHASE: 'bootstrap' })
run(['--import', 'tsx', 'scripts/create-admin.ts'])
run(['node_modules/@playwright/test/cli.js', 'test'])
// Playwright stops its own server between these runs. The second process uses the same SQLite file.
run(['node_modules/@playwright/test/cli.js', 'test', 'cms.spec.ts', '--project=desktop'], { CMS_PHASE: 'restart' })
run(['--import', 'tsx', 'scripts/payload-cli.ts', 'migrate'])
run(['--import', 'tsx', 'scripts/payload-cli.ts', 'migrate:status'])
const db = createClient({ url: env.DATABASE_URL })
try {
  const tables = (await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map(row => String(row.name))
  const counts: Record<string, number> = {}
  for (const table of ['users', 'users_sessions', 'pages', 'posts', 'media', 'site_settings', 'payload_migrations']) {
    counts[table] = Number((await db.execute(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count)
  }
  writeFileSync(`${evidenceDir}/local-proof.json`, JSON.stringify({ timestamp: new Date().toISOString(), database: env.DATABASE_URL, tables, counts, browser: 'Chromium', phases: ['empty-database registration denied', 'CLI bootstrap', 'browser and REST editing/access checks', 'fresh-process restart persistence', 'repeat migration no-op'] }, null, 2) + '\n')
} finally { db.close() }
console.log('LOCAL PASS: browser workflow, access controls, fresh-server persistence, and repeat migration.')
