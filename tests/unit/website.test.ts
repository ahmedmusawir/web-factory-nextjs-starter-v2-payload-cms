import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contentReader, fieldName, safeEditorialLink, websiteStructure } from '../../content/website'

test('reference mapping uses stored content/media and never a hardcoded editorial fallback', () => {
  const reader = contentReader([{ key: 'home.agency', heroHeading: 'Editor changed this', imgSrc1: { url: 'https://images.example/a.png' } }])
  assert.equal(reader('home', 'agency.h1_text_1'), 'Editor changed this')
  assert.equal(reader('home', 'agency.img_src_1'), 'https://images.example/a.png')
  assert.equal(reader('home', 'agency.p_text_1'), '')
  const fields = [...new Set(Object.values(websiteStructure.sections).flat())]
  assert.equal(new Set(fields.map(fieldName)).size, fields.length)
  assert.equal(websiteStructure.pages.length, 7)
})
test('editorial link values reject script schemes and protocol-relative destinations', () => {
  for (const url of ['/contact/', '#main', 'https://example.com', 'tel:+18009830668', 'mailto:person@example.com']) assert.ok(safeEditorialLink(url))
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//evil.example', '/\\evil.example', '/path\nother']) assert.equal(safeEditorialLink(url), false)
})
