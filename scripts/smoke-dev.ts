import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, openSync, closeSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'

const probe = createServer()
await new Promise<void>((resolve, reject) => { probe.once('error', reject); probe.listen(3001, '127.0.0.1', () => probe.close(() => resolve())) })
const env = { ...process.env, APP_ENV: 'test', DATABASE_KIND: 'sqlite', DATABASE_URL: `file:./.data/test/dev-${randomUUID()}.db`, DATABASE_AUTH_TOKEN: '', MEDIA_STORAGE: 'local', MEDIA_PREFIX: 'test/dev', PAYLOAD_SECRET: randomBytes(32).toString('hex') }
mkdirSync('.data/test', { recursive: true })
const migration = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/payload-cli.ts', 'migrate'], { env, stdio: 'inherit' })
assert.equal(migration.status, 0)
const log = openSync('evidence/r2-001/dev-server.log', 'w')
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '-p', '3001'], { env, detached: true, stdio: ['ignore', log, log] })
try {
  let ready = false
  for (let n = 0; n < 60; n++) {
    if (child.exitCode !== null) throw new Error('Development server exited before readiness')
    try { if ((await fetch('http://127.0.0.1:3001', { signal: AbortSignal.timeout(10000) })).ok) { ready = true; break } } catch { /* wait for our own server */ }
    await setTimeout(500)
  }
  assert.ok(ready, 'Development server did not become ready')
  for (const route of ['/admin', '/api/pages', '/content']) {
    const response = await fetch(`http://127.0.0.1:3001${route}`, { signal: AbortSignal.timeout(90000) })
    assert.equal(response.status, 200, route)
    console.log(`PASS development HTTP ${route}: 200`)
  }
} finally {
  if (child.pid && child.exitCode === null) {
    process.kill(-child.pid, 'SIGTERM')
    await Promise.race([new Promise<void>(resolve => child.once('exit', () => resolve())), setTimeout(5000)])
    if (child.exitCode === null && child.signalCode === null) process.kill(-child.pid, 'SIGKILL')
  }
  closeSync(log)
}
console.log('Development smoke passed; only the task-owned process group was stopped.')
