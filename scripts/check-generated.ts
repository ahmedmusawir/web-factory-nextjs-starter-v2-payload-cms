import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'

for (const [file, command] of [['payload-types.ts', 'generate:types'], ['app/(payload)/admin/importMap.js', 'generate:importmap']]) {
  const hash = () => createHash('sha256').update(readFileSync(file)).digest('hex')
  const before = hash()
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/payload-cli.ts', command], { stdio: 'inherit', env: process.env })
  assert.equal(result.status, 0)
  assert.equal(hash(), before, `${file} was stale; generated output has been refreshed`)
  console.log(`${file}: consistent (${before})`)
}
