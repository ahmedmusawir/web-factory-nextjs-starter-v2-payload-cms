import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withDOM } from '@lexical/headless/dom'

test('Lexical DOM helper remains compatible with the scoped Happy DOM security update', () => {
  withDOM(window => {
    const doc = new window.DOMParser().parseFromString('<p>Persisted <strong>content</strong></p>', 'text/html')
    assert.equal(doc.querySelector('strong')?.textContent, 'content')
  })
  assert.equal(globalThis.window, undefined)
})
