import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

test('CLI uses Next environment precedence, interpolation, shell isolation and test-mode rules', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'stark-env-test-'))
  const loader = pathToFileURL(path.resolve('scripts/load-env.ts')).href
  const tsx = pathToFileURL(path.resolve('node_modules/tsx/dist/loader.mjs')).href
  try {
    writeFileSync(path.join(directory, '.env'), 'FIXTURE_BASE=base\nFIXTURE_TARGET=base\nFIXTURE_SHELL=file\n')
    writeFileSync(path.join(directory, '.env.local'), 'FIXTURE_TARGET=local\nFIXTURE_EXPANDED=$FIXTURE_TARGET/suffix\n')
    writeFileSync(path.join(directory, '.env.development.local'), 'FIXTURE_TARGET=development\n')
    writeFileSync(path.join(directory, '.env.test'), 'FIXTURE_TARGET=test\n')
    for (const [mode, target, expanded] of [['production', 'local', 'local/suffix'], ['development', 'development', 'development/suffix'], ['test', 'test', null]] as const) {
      const result = spawnSync(process.execPath, ['--import', tsx, '--input-type=module', '--eval', `await import(${JSON.stringify(loader)}); console.log(JSON.stringify(['FIXTURE_BASE','FIXTURE_TARGET','FIXTURE_SHELL','FIXTURE_EXPANDED'].map(key => process.env[key] ?? null)))`], {
        cwd: directory, encoding: 'utf8', env: { PATH: process.env.PATH, NODE_ENV: mode, FIXTURE_SHELL: 'shell' },
      })
      assert.equal(result.status, 0, 'Fixture-only environment loader process must succeed')
      assert.deepEqual(JSON.parse(result.stdout), ['base', target, 'shell', expanded])
    }
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
