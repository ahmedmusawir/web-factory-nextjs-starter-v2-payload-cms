import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeWordPressHTML } from '../../scripts/wordpress-html'
test('WordPress sanitizer removes executable markup and URLs while retaining article structure', () => {
 const html=sanitizeWordPressHTML('<h2 onclick="alert(1)">Heading</h2><script>alert(1)</script><iframe src="https://evil.example"></iframe><a href="java&#x73;cript:alert(1)">bad</a><img src="data:image/svg+xml,attack" onerror="alert(1)"><p><strong>Text</strong></p><ul><li>Item</li></ul><table><tbody><tr><td colspan="2">Cell</td></tr></tbody></table>')
 assert.ok(!/script|iframe|onclick|onerror|data:image|javascript:/i.test(html))
 for(const fragment of ['<h2>Heading</h2>','<strong>Text</strong>','<li>Item</li>','<td colspan="2">Cell</td>']) assert.ok(html.includes(fragment))
})
test('legacy WordPress image URLs become HTTPS without enabling protocol-relative links', () => {
 const html=sanitizeWordPressHTML('<img src="//cyberizegroup.com/wp-content/uploads/a.jpg" alt="Example"><a href="//untrusted.example">Link</a>')
 assert.ok(html.includes('src="https://cyberizegroup.com/'));assert.ok(!html.includes('href='))
})
