import { require } from './lib.mjs'
const { chromium } = require('@playwright/test')
const b = await chromium.launch()
for (const o of ['http://127.0.0.1:3002', 'http://127.0.0.1:3001']) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); await p.goto(o + '/', { waitUntil: 'networkidle' })
  const f = () => { const e = document.querySelector('a.skip'), r = e.getBoundingClientRect(), s = getComputedStyle(e); return { top: r.top, left: r.left, w: r.width, pos: s.position, transform: s.transform, focused: document.activeElement === e } }
  console.log(o, 'load', JSON.stringify(await p.evaluate(f)))
  await p.screenshot({ path: '/dev/null', type: 'png', fullPage: true }).catch(() => {})
  await p.evaluate(async () => { for (let y = 0; y < 3000; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)) } scrollTo(0, 0) })
  console.log(o, 'after scroll', JSON.stringify(await p.evaluate(f)))
}
await b.close()
