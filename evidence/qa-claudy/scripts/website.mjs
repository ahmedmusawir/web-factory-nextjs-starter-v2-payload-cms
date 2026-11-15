import fs from 'node:fs'
import { R, require } from './lib.mjs'
const { chromium } = require('@playwright/test')
const sharp = require('sharp')
const out = R + '/evidence/qa-claudy/website'; fs.mkdirSync(out, { recursive: true })
const T = 'http://127.0.0.1:3001', REF = 'http://127.0.0.1:3002'
const routes = ['/', '/seo-services/', '/ppc/', '/website-design/', '/web-development/', '/website-support/', '/contact/']
const browser = await chromium.launch()
const results = []
const linkSet = new Set()
for (const [device, width, height] of [['desktop', 1440, 900], ['mobile', 375, 812], ['tablet', 768, 1024]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: device === 'mobile', hasTouch: device === 'mobile' })
  for (const route of routes) {
    const snap = {}
    for (const [label, origin] of [['reference', REF], ['target', T]]) {
      const page = await ctx.newPage()
      const issues = []
      page.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(`console.${m.type()}: ${m.text().slice(0, 300)}`) })
      page.on('pageerror', e => issues.push(`pageerror: ${String(e).slice(0, 300)}`))
      page.on('requestfailed', r => issues.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`))
      page.on('response', r => { if (r.status() >= 400) issues.push(`http ${r.status()}: ${r.url()}`) })
      const res = await page.goto(origin + route, { waitUntil: 'networkidle' })
      await page.evaluate(() => document.fonts.ready)
      // scroll through for lazy images
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise(r => setTimeout(r, 60)) } scrollTo(0, 0) })
      await page.waitForLoadState('networkidle')
      const d = await page.evaluate(() => ({
        text: document.body.innerText, title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
        h1: document.querySelectorAll('h1').length,
        headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.textContent.trim()),
        scrollW: document.documentElement.scrollWidth, innerW: innerWidth, docH: document.documentElement.scrollHeight,
        sections: [...document.querySelectorAll('main > section')].map(e => ({ id: e.id, cls: e.className, top: Math.round(e.getBoundingClientRect().top + scrollY), h: Math.round(e.getBoundingClientRect().height) })),
        imgs: [...document.querySelectorAll('img')].map(i => ({ src: i.currentSrc || i.src, alt: i.alt, ok: i.complete && i.naturalWidth > 0, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height) })),
        links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
        overflowers: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 5).map(e => e.tagName + '.' + e.className),
      }))
      d.status = res.status(); d.issues = issues
      const shot = `${out}/${device}-${route.replace(/\//g, '') || 'home'}-${label}.png`
      await page.screenshot({ path: shot, fullPage: true, animations: 'disabled' })
      snap[label] = { ...d, shot }
      if (label === 'target') d.links.forEach(l => linkSet.add(l))
      await page.close()
    }
    const a = snap.reference, b = snap.target
    const r = { device, route, status: b.status, h1: b.h1, textMatch: a.text === b.text, titleMatch: a.title === b.title, descMatch: a.description === b.description,
      headingsMatch: JSON.stringify(a.headings) === JSON.stringify(b.headings), sectionsMatch: JSON.stringify(a.sections) === JSON.stringify(b.sections),
      docH: [a.docH, b.docH], overflow: b.scrollW > b.innerW, overflowers: b.overflowers, imgCount: [a.imgs.length, b.imgs.length], brokenImgs: b.imgs.filter(i => !i.ok),
      imgBoxesMatch: JSON.stringify(a.imgs.map(i => [i.w, i.h, i.alt])) === JSON.stringify(b.imgs.map(i => [i.w, i.h, i.alt])),
      imgOrigins: [...new Set(b.imgs.map(i => new URL(i.src).origin))], linksMatch: JSON.stringify(a.links) === JSON.stringify(b.links), issues: b.issues, refIssues: a.issues }
    if (!r.textMatch) { // first differing line
      const x = a.text.split('\n'), y = b.text.split('\n'); const i = x.findIndex((l, k) => l !== y[k]); r.textDiff = { line: i, ref: x[i], target: y[i] }
    }
    if (!r.linksMatch) r.linkDiff = { refOnly: a.links.filter(l => !b.links.includes(l)), targetOnly: b.links.filter(l => !a.links.includes(l)) }
    if (!r.sectionsMatch) r.sectionDiff = { ref: a.sections, target: b.sections }
    try {
      const L = await sharp(a.shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), Rr = await sharp(b.shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      if (L.info.width === Rr.info.width && L.info.height === Rr.info.height) {
        let ch = 0; for (let o = 0; o < L.data.length; o += 4) if ([0, 1, 2].some(c => Math.abs(L.data[o + c] - Rr.data[o + c]) > 20)) ch++
        r.pixelDiffPct = +(100 * ch / (L.info.width * L.info.height)).toFixed(3)
      } else r.pixelDiffPct = `size mismatch ${L.info.width}x${L.info.height} vs ${Rr.info.width}x${Rr.info.height}`
    } catch (e) { r.pixelDiffPct = 'error ' + e.message }
    // keep folder small: convert to jpeg, drop png; keep tablet target only
    for (const s of [a.shot, b.shot]) { if (device !== 'tablet' || s === b.shot) await sharp(s).jpeg({ quality: 60 }).toFile(s.replace('.png', '.jpg')); fs.unlinkSync(s) }
    results.push(r)
    console.log(JSON.stringify(r))
  }
  // interaction checks on target
  const p = await ctx.newPage(); const inter = { device }
  await p.goto(T + '/website-design/')
  const toggle = p.locator('.mobile-toggle'); inter.toggleVisible = await toggle.isVisible()
  if (inter.toggleVisible) { await toggle.click(); await p.waitForTimeout(300); await p.screenshot({ path: `${out}/${device}-nav-open.png` }) }
  const services = p.getByRole('button', { name: /Services/ })
  await services.click(); inter.servicesExpanded = await services.getAttribute('aria-expanded')
  inter.dropdownLinks = await p.locator('header a:visible').evaluateAll(a => a.map(x => x.getAttribute('href')))
  await p.keyboard.press('Escape'); inter.afterEscape = await services.getAttribute('aria-expanded')
  inter.focusReturned = await services.evaluate(e => e === document.activeElement)
  const det = p.locator('main details'); inter.faqCount = await det.count()
  await det.first().locator('summary').click(); inter.faqOpens = await det.first().evaluate(e => e.open)
  // click each header nav link
  await p.goto(T + '/'); if (inter.toggleVisible) await toggle.click()
  await p.locator('header a[href="/contact/"]').first().click(); await p.waitForURL(/contact/); inter.navToContact = p.url()
  inter.skipLink = await p.locator('a.skip').getAttribute('href'); inter.mainId = await p.locator('#main').count()
  const nf = await p.goto(T + '/missing-page/'); inter.notFound = nf.status(); inter.notFoundText = (await p.locator('body').innerText()).slice(0, 200)
  await p.screenshot({ path: `${out}/${device}-404.png` })
  console.log('INTERACTION', JSON.stringify(inter)); results.push({ interaction: inter })
  await ctx.close()
}
// link check
const links = {}
for (const l of [...linkSet].sort()) {
  if (l.startsWith('#') || l.startsWith('tel:') || l.startsWith('mailto:')) { links[l] = 'non-http'; continue }
  const u = new URL(l, T + '/')
  if (u.origin !== T) { links[l] = 'external (not fetched)'; continue }
  const res = await fetch(u, { redirect: 'manual' }); let s = String(res.status)
  if (res.status >= 300 && res.status < 400) s += ' -> ' + res.headers.get('location')
  if (u.hash) { const html = await (await fetch(u)).text(); s += html.includes(`id="${u.hash.slice(1)}"`) ? ' anchor ok' : ' ANCHOR MISSING' }
  links[l] = s
}
console.log('LINKS', JSON.stringify(links, null, 1))
// no-slash variants
for (const r of routes.slice(1)) { const res = await fetch(T + r.replace(/\/$/, ''), { redirect: 'manual' }); console.log('noslash', r, res.status, res.headers.get('location')) }
fs.writeFileSync(out + '/results.json', JSON.stringify({ results, links }, null, 2))
await browser.close()
