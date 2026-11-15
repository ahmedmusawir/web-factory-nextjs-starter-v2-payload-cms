import './load-env'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { readEnvironment } from '../cms/environment'

const [command, ...args] = process.argv.slice(2)
const allowed = ['migrate', 'migrate:status', 'migrate:create', 'generate:types', 'generate:importmap']
if (!allowed.includes(command)) throw new Error(`Allowed commands: ${allowed.join(', ')}. Destructive migration commands are intentionally excluded.`)
if (args.length && (command !== 'migrate:create' || args.length !== 1 || !/^[a-z0-9-]+$/.test(args[0]))) throw new Error('Only a simple migration name is accepted; config overrides and extra flags are not allowed')
const env = readEnvironment()
if (command === 'migrate:create' && env.kind !== 'sqlite') throw new Error('Generate migrations against a local SQLite configuration')
if (command === 'migrate' && env.kind === 'turso' && process.env.MIGRATION_TARGET_HOST !== process.env.DATABASE_TARGET_HOST) {
  throw new Error('Review the migration and set MIGRATION_TARGET_HOST to the approved database hostname before applying it')
}
if (env.kind === 'sqlite') mkdirSync(path.dirname(env.url.slice(5)), { recursive: true })
const result = spawnSync(process.execPath, ['node_modules/payload/bin.js', command, ...args], { env: process.env, stdio: 'inherit' })
process.exit(result.status ?? 1)
