import { copyFileSync, existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import assert from 'node:assert/strict'

// A disposable renderer, not a repository copy. Never reads .env/.git or writes the reference.
const reference = path.resolve('../web-factory-poc-site-1')
const destination = '/tmp/stark-mission002-reference-site'
assert.ok(!existsSync(destination), 'Reference fixture already exists; preserve it and use its existing build')
const inventory: Record<string, string> = JSON.parse(readFileSync('evidence/mission-002/reference-hashes.json', 'utf8'))
for (const [file, expected] of Object.entries(inventory)) {
  assert.ok(/^(?:app\/|components\/cyberize\/|content\/|public\/cyberize\/assets\/|package\.json$|tsconfig\.json$)/.test(file) && !file.includes('..'))
  const bytes = readFileSync(path.join(reference, file))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, 'Reference source changed: review before comparison')
}
for (const file of Object.keys(inventory)) {
  const target = path.join(destination, file)
  mkdirSync(path.dirname(target), { recursive: true }); copyFileSync(path.join(reference, file), target)
}
symlinkSync(path.resolve('node_modules'), path.join(destination, 'node_modules'), 'dir')
console.log('Selected reference renderer prepared. Build in /tmp/stark-mission002-reference-site with: node node_modules/next/dist/bin/next build --webpack')
