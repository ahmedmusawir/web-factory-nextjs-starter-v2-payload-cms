import './load-env'
import assert from 'node:assert/strict'
import { createClient } from '@libsql/client'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { readEnvironment } from '../cms/environment'
const env = readEnvironment(), host = new URL(env.url).hostname
assert.ok(env.appEnv === 'test' && env.kind === 'turso' && /^web-factory-v2-poc-db-.*\.turso\.io$/.test(host))
assert.equal(env.r2?.bucket, 'stark-web-factory-poc-media'); assert.equal(process.env.MIGRATION_TARGET_HOST, host)
const up = readFileSync('migrations/20261115_065237_wordpress_blog.ts', 'utf8').split('export async function down')[0]
const statements = [...up.matchAll(/db\.run\(sql`([\s\S]*?)`\)/g)].map(m => m[1])
assert.ok(statements.length && statements.every(s => /^(CREATE (UNIQUE )?(TABLE|INDEX) |ALTER TABLE [^;]+ ADD )/.test(s)))
const db = createClient({ url: env.url, authToken: process.env.DATABASE_AUTH_TOKEN })
try {
 const migrations = (await db.execute('SELECT name FROM payload_migrations ORDER BY id')).rows.map(r => r.name)
 assert.deepEqual(migrations, ['20261114_040213_foundation', '20261114_072417_website'])
 const before: Record<string, number> = {}
 for (const t of ['users','pages','posts','media']) before[t] = Number((await db.execute(`SELECT COUNT(*) AS n FROM ${t}`)).rows[0].n)
 assert.ok(before.users >= 1, 'Tony administrator must exist and be preserved')
 const result = spawnSync(process.execPath, ['--import','tsx','scripts/payload-cli.ts','migrate'], { stdio: 'pipe', env: process.env, timeout: 120000 })
 assert.equal(result.status, 0, 'Migration failed; inspect state before retry')
 writeFileSync('evidence/mission-003/remote-migration.json', JSON.stringify({ applied: true, before, additiveStatements: statements.length, administratorPreserved: true }, null, 2))
 console.log('Additive blog migration applied; no content or users deleted.')
} finally { db.close() }
