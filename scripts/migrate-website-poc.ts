import './load-env'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createClient } from '@libsql/client'
import { readEnvironment } from '../cms/environment'

// Deliberately narrow operator entry point: only the reviewed additive POC migration.
const env = readEnvironment()
const host = new URL(env.url).hostname
assert.ok(env.appEnv === 'test' && env.kind === 'turso' && /^web-factory-v2-poc-db-.*\.turso\.io$/.test(host))
assert.equal(env.r2?.bucket, 'stark-web-factory-poc-media')
for (const key of ['DATABASE_TARGET_HOST', 'MIGRATION_TARGET_HOST', 'BOOTSTRAP_TARGET_HOST']) assert.equal(process.env[key], host, 'Target confirmation mismatch')
const source = readFileSync('migrations/20261114_072417_website.ts', 'utf8')
const digest = createHash('sha256').update(source).digest('hex')
assert.equal(digest, '338692b6eb0fa91513966c3452cab7ec16cb2d7bd98c17dc6075e07481ca0276', 'Migration changed since review')
const up = source.split('export async function down')[0]
const statements = [...up.matchAll(/db\.run\(sql`([\s\S]*?)`\)/g)].map(match => match[1])
assert.equal(statements.length, 29)
assert.ok(statements.every(sql => /^(?:CREATE (?:UNIQUE )?(?:TABLE|INDEX) |ALTER TABLE [^;]+ ADD )/.test(sql)), 'Only reviewed CREATE and ADD statements permitted')
const db = createClient({ url: env.url, authToken: process.env.DATABASE_AUTH_TOKEN })
try {
  const names = (await db.execute('SELECT name FROM payload_migrations ORDER BY id')).rows.map(row => row.name)
  assert.deepEqual(names, ['20261114_040213_foundation'], 'Expected only the verified foundation migration; stop for review otherwise')
  const counts: Record<string, number> = {}
  for (const table of ['pages', 'posts', 'media', 'users', 'site_settings']) counts[table] = Number((await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n)
  for (const table of ['pages', 'posts', 'media', 'users']) assert.equal(counts[table], 0, 'Unexpected content: stop before migration')
  assert.equal(counts.site_settings, 1)
  console.log('PASS: approved targets, foundation-only schema, no user content, reviewed additive migration.')
  if (process.argv.includes('--apply-approved-additive')) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/payload-cli.ts', 'migrate'], { env: process.env, stdio: 'pipe', timeout: 120000 })
    assert.equal(result.status, 0, 'Migration command failed; inspect remote migration state before retrying')
    const after = (await db.execute('SELECT name, batch FROM payload_migrations ORDER BY id')).rows
    assert.deepEqual(after.map(row => row.name), [...names, '20261114_072417_website'])
    for (const [table, count] of Object.entries(counts)) assert.equal(Number((await db.execute(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n), count)
    const tables = (await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")).rows.map(row => row.name)
    writeFileSync('evidence/mission-002/remote-migration.json', JSON.stringify({ status: 'PASS', migrationSHA256: digest, migrations: after, preservedCounts: counts, tables }, null, 2) + '\n')
    console.log('PASS: additive migration applied; existing record counts preserved.')
  }
} finally { db.close() }
