import { test } from 'node:test'
import assert from 'node:assert/strict'
import { r2PublicURL } from '../../cms/r2'
import { mediaCollection } from '../../cms/collections'
import type { CollectionBeforeChangeHook } from 'payload'

test('R2 URLs use delivery origin and stored prefix for originals/variants, with safe encoding', () => {
  assert.equal(r2PublicURL('https://delivery.example', 'client/editorial', 'photo.png'), 'https://delivery.example/client/editorial/photo.png')
  assert.equal(r2PublicURL('https://delivery.example', 'client/editorial', 'photo-400x300.png'), 'https://delivery.example/client/editorial/photo-400x300.png')
  assert.equal(r2PublicURL('https://delivery.example', undefined, 'a #?.png'), 'https://delivery.example/a%20%23%3F.png')
})
test('actual collection hook rejects private R2 create/update before storage, preserves local privacy and keys', async () => {
  const hook = (remote: boolean) => mediaCollection('/tmp/unused-test-path', 'client/editorial', remote).hooks!.beforeChange![0]
  const args = (data: Record<string, unknown>, originalDoc?: Record<string, unknown>) => ({ data, originalDoc, req: { context: {} }, operation: originalDoc ? 'update' : 'create' }) as Parameters<CollectionBeforeChangeHook>[0]
  for (const value of [undefined, 'private', 'PUBLIC']) {
    await assert.rejects(async () => hook(true)(args({ visibility: value, filename: 'test.png' })), /public/)
  }
  await assert.rejects(async () => hook(true)(args({ visibility: 'private' }, { visibility: 'public', filename: 'test.png' })), /public/)
  const local = await hook(false)(args({ visibility: 'private', filename: 'test.png' }))
  assert.equal(local.visibility, 'private')
  const publicDoc = await hook(true)(args({ visibility: 'public', filename: 'test.png', prefix: 'attacker', _objectKey: 'attacker' }))
  assert.equal(publicDoc.objectKey, 'client/editorial/test.png')
  assert.equal(publicDoc._objectKey, null)
  const importedArgs = args({ visibility: 'public', filename: 'website.png' })
  importedArgs.req.context.websiteImport = true
  const imported = await hook(true)(importedArgs)
  assert.equal(imported.objectKey, 'client/editorial/web-factory-poc-site-1/website.png')
  const replacement = await hook(true)(args({ visibility: 'public', filename: 'replacement.png', prefix: 'attacker' }, imported))
  assert.equal(replacement.objectKey, 'client/editorial/web-factory-poc-site-1/replacement.png')
})
