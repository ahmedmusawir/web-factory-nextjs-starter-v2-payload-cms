import './load-env'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import type { Field } from 'payload'

if (process.argv.includes('--describe')) {
  const { default: promise } = await import('../payload.config')
  const config = await promise
  const media = config.collections.find(c => c.slug === 'media')!
  if (process.env.MEDIA_STORAGE === 'r2') {
    assert.equal(media.upload && media.upload.disableLocalStorage, true)
    assert.ok(!config.endpoints.some(e => e.path.includes('generate-signed-url')))
  }
  const fields = (items: Field[]): unknown[] => items.map(field => ({
    ...('name' in field ? { name: field.name } : {}), type: field.type,
    ...('relationTo' in field ? { relationTo: field.relationTo } : {}),
    ...('hasMany' in field ? { hasMany: field.hasMany } : {}),
    ...('fields' in field ? { fields: fields(field.fields) } : {}),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  const description = JSON.stringify({ collections: config.collections.map(c => ({ slug: c.slug, fields: fields(c.fields) })), globals: config.globals.map(g => ({ slug: g.slug, fields: fields(g.fields) })) })
  if (process.env.CONFIG_SCHEMA_OUTPUT) writeFileSync(process.env.CONFIG_SCHEMA_OUTPUT, description)
  else console.log(description)
} else {
  mkdirSync('.data', { recursive: true })
  const describe = (storage: string) => {
    const output = `.data/schema-${storage}.json`
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-storage-schema.ts', '--describe'], {
      stdio: 'inherit', env: { ...process.env, PAYLOAD_SECRET: 'configuration-only-secret-at-least-32-characters', CONFIG_SCHEMA_OUTPUT: output, MEDIA_STORAGE: storage, ...(storage === 'r2' ? { APP_ENV: 'test', DATABASE_KIND: 'turso', DATABASE_URL: 'libsql://configuration-only.example', DATABASE_TARGET_HOST: 'configuration-only.example', DATABASE_AUTH_TOKEN: 'not-a-real-token', R2_BUCKET: 'configuration-only', R2_TARGET_BUCKET: 'configuration-only', R2_ENDPOINT: `https://${'0'.repeat(32)}.r2.cloudflarestorage.com`, R2_ACCESS_KEY_ID: 'not-a-real-key', R2_SECRET_ACCESS_KEY: 'not-a-real-secret', R2_PUBLIC_URL: 'https://delivery.example', R2_PREFIX: 'test/editorial' } : { APP_ENV: 'test', DATABASE_KIND: 'sqlite', DATABASE_URL: 'file:./.data/test/configuration-only.db', DATABASE_AUTH_TOKEN: '', MEDIA_PREFIX: 'test/editorial' }) },
    })
    assert.equal(result.status, 0, 'Configuration inspection failed')
    return JSON.parse(readFileSync(output, 'utf8'))
  }
  assert.deepEqual(describe('local'), describe('r2'))
  console.log('PASS: local and R2 modes expose identical persisted field structures. No storage client operation was performed.')
}
