import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readEnvironment } from '../../cms/environment'
const base = { APP_ENV: 'local', DATABASE_KIND: 'sqlite', DATABASE_URL: 'file:./.data/local/payload.db', PAYLOAD_SECRET: 'x'.repeat(32), MEDIA_STORAGE: 'local', MEDIA_PREFIX: 'poc/editorial' }
const remote = { ...base, APP_ENV: 'test', DATABASE_KIND: 'turso', DATABASE_URL: 'libsql://disposable.example', DATABASE_AUTH_TOKEN: 'test-only', DATABASE_TARGET_HOST: 'disposable.example', MEDIA_STORAGE: 'r2', R2_BUCKET: 'configuration-only', R2_TARGET_BUCKET: 'configuration-only', R2_ENDPOINT: `https://${'0'.repeat(32)}.r2.cloudflarestorage.com`, R2_ACCESS_KEY_ID: 'unit-test-only', R2_SECRET_ACCESS_KEY: 'unit-test-only', R2_PUBLIC_URL: 'https://delivery.example', R2_PREFIX: 'poc/editorial' }
test('local SQLite/media needs no R2 credentials; test data remains isolated', () => {
  assert.equal(readEnvironment(base).r2, undefined)
  assert.equal(readEnvironment({ ...base, APP_ENV: 'test', DATABASE_URL: 'file:./.data/test/test.db' }).appEnv, 'test')
})
test('rejects environment mismatch, traversal, missing secret and deployed local files', () => {
  for (const patch of [{ APP_ENV: 'production' }, { DATABASE_URL: 'file:./.data/local/../../other.db' }, { DATABASE_URL: 'file:./.data/test/test.db' }, { PAYLOAD_SECRET: '' }, { VERCEL: '1', VERCEL_ENV: 'preview' }]) assert.throws(() => readEnvironment({ ...base, ...patch }))
})
test('remote mode requires complete, identified Turso and R2 settings without fallback', () => {
  assert.equal(readEnvironment(remote).r2?.bucket, remote.R2_BUCKET)
  for (const jurisdiction of ['eu', 'us', 'fedramp']) assert.ok(readEnvironment({ ...remote, R2_ENDPOINT: `https://${'0'.repeat(32)}.${jurisdiction}.r2.cloudflarestorage.com` }).r2)
  assert.equal(readEnvironment({ ...remote, APP_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production' }).storage, 'r2')
  for (const key of ['DATABASE_AUTH_TOKEN', 'DATABASE_TARGET_HOST', 'R2_BUCKET', 'R2_TARGET_BUCKET', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL', 'R2_PREFIX']) assert.throws(() => readEnvironment({ ...remote, [key]: '' }), key)
  for (const patch of [{ DATABASE_TARGET_HOST: 'wrong.example' }, { R2_TARGET_BUCKET: 'wrong-bucket' }, { MEDIA_STORAGE: 'local' }, { MEDIA_STORAGE: 'gcs' }, { R2_PREFIX: '../outside' }, { R2_PREFIX: 'a//b' }, { R2_PUBLIC_URL: remote.R2_ENDPOINT }, { R2_ENDPOINT: remote.R2_PUBLIC_URL }, { R2_ENDPOINT: remote.R2_ENDPOINT + '/bucket' }, { R2_PUBLIC_URL: 'http://delivery.example' }, { R2_PUBLIC_URL: 'https://user:password@delivery.example' }, { R2_PUBLIC_URL: 'https://delivery.example?token=secret' }, { R2_PUBLIC_URL: 'https://delivery.example/path' }]) assert.throws(() => readEnvironment({ ...remote, ...patch }))
})
