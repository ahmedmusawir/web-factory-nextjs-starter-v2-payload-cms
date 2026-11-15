// Public blog frontend checks in Chromium (read-only)
import fs from 'node:fs'
import { R, require, env } from '../../scripts/lib.mjs'
const { chromium } = require('@playwright/test')
const T = 'http://127.0.0.1:3001', out = R + '/evidence/qa-claudy/mission-003/blog'
const turso = JSON.parse(fs.readFileSync(R + '/evidence/qa-claudy/mission-003/turso-before.json', 'utf8'))
const cmp = JSON.parse(fs.readFileSync(R + '/evidence/qa-claudy/mission-003/wordpress/compare.json', 'utf8'))
const pubOrigin = new URL(env.R2_PUBLIC_URL).origin
const browser = await chromium.launch(); const results = { listing: [], articles: [] }
const watch = (page, issues) => {
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(`console.${m.type()}: ${m.text().slice(0, 200)}`) })
  page.on('pageerror', e => issues.push(`pageerror: ${String(e).slice(0, 200)}`))
  page.on('requestfailed', r => issues.push(`requestfailed: ${r.url().slice(0, 120)} ${r.failure()?.errorText}`))
  page.on('response', r => { if (r.status() >= 400) issues.push(`http ${r.status()}: ${r.url().slice(0, 120)}`) })
}
const settle = async page => { await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 50)) } scrollTo(0, 0) }); await page.waitForLoadState('networkidle') }
for (const [device, width, height] of [['desktop', 1440, 900], ['tablet', 768, 1024], ['mobile', 375, 812]]) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: device === 'mobile', hasTouch: device === 'mobile' })
  const page = await ctx.newPage(); const issues = []; watch(page, issues)
  const res = await page.goto(T + '/blog', { waitUntil: 'networkidle' }); await settle(page)
  const d = await page.evaluate(() => ({ title: document.title, desc: document.querySelector('meta[name=description]')?.content, h1: [...document.querySelectorAll('h1')].map(e => e.innerText),
    cards: [...document.querySelectorAll('.blog-grid article')].map(a => ({ href: a.querySelector('a')?.getAttribute('href'), title: a.querySelector('h2')?.innerText, small: a.querySelector('small')?.innerText, excerpt: (a.querySelector('p')?.innerText || '').length, img: (i => i ? { ok: i.complete && i.naturalWidth > 0, src: i.currentSrc || i.src, alt: i.alt, w: Math.round(i.getBoundingClientRect().width), h: Math.round(i.getBoundingClientRect().height), nat: i.naturalWidth + 'x' + i.naturalHeight, loading: i.loading } : null)(a.querySelector('img')) })),
    overflow: document.documentElement.scrollWidth > innerWidth, header: !!document.querySelector('header'), footer: !!document.querySelector('footer'), activeNav: [...document.querySelectorAll('header a')].map(a => a.getAttribute('href')) }))
  await page.screenshot({ path: `${out}/${device}-blog.jpg`, fullPage: true, type: 'jpeg', quality: 55 })
  const expected = [...turso.posts].sort((a, b) => b.published_at.localeCompare(a.published_at))
  results.listing.push({ device, status: res.status(), title: d.title, desc: d.desc, h1: d.h1, cards: d.cards.length, orderNewestFirst: JSON.stringify(d.cards.map(c => c.href)) === JSON.stringify(expected.map(p => '/blog/' + p.slug)),
    titlesMatch: d.cards.every((c, i) => c.title === expected[i].title), datesMatch: d.cards.every((c, i) => c.small.startsWith(expected[i].published_at.slice(0, 10))), smallSample: d.cards[0]?.small,
    imagesOK: d.cards.filter(c => c.img?.ok).length, imgOrigins: [...new Set(d.cards.map(c => c.img && new URL(c.img.src).origin === pubOrigin ? 'r2-public' : c.img?.src))], imgSample: d.cards[0]?.img && { ...d.cards[0].img, src: undefined }, emptyExcerpts: d.cards.filter(c => !c.excerpt).length, overflow: d.overflow, header: d.header, footer: d.footer, issues })
  // click-through from the first card
  await page.locator('.blog-grid article a').first().click(); await page.waitForURL(/\/blog\/.+/); results.listing.at(-1).clickThrough = new URL(page.url()).pathname
  await page.close()
  if (device === 'tablet') { await ctx.close(); continue }
  for (const post of turso.posts) {
    const p = await ctx.newPage(); const iss = []; watch(p, iss)
    const r = await p.goto(T + '/blog/' + post.slug, { waitUntil: 'networkidle' }); await settle(p)
    const a = await p.evaluate(() => ({ title: document.title, desc: document.querySelector('meta[name=description]')?.content, canonical: document.querySelector('link[rel=canonical]')?.href, og: [...document.querySelectorAll('meta[property^="og:"]')].map(m => m.getAttribute('property')), robots: document.querySelector('meta[name=robots]')?.content, jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
      h1: [...document.querySelectorAll('h1')].map(e => e.innerText), time: document.querySelector('time')?.getAttribute('datetime'), timeText: document.querySelector('time')?.innerText, eyebrow: document.querySelector('.eyebrow')?.innerText,
      bodyText: (document.querySelector('.payload-richtext')?.innerText || ''), counts: Object.fromEntries(['h2', 'h3', 'p', 'li', 'table', 'blockquote', 'img', 'a'].map(s => [s, document.querySelectorAll('.payload-richtext ' + s).length])),
      imgs: [...document.querySelectorAll('main img')].map(i => ({ ok: i.complete && i.naturalWidth > 0, src: i.currentSrc || i.src, alt: i.alt, w: Math.round(i.getBoundingClientRect().width), nat: i.naturalWidth, right: Math.round(i.getBoundingClientRect().right) })),
      overflow: document.documentElement.scrollWidth > innerWidth, scrollW: document.documentElement.scrollWidth, innerW: innerWidth,
      wide: [...document.querySelectorAll('main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 4).map(e => e.tagName + '.' + e.className + ' right=' + Math.round(e.getBoundingClientRect().right)),
      tableScroll: [...document.querySelectorAll('.payload-richtext table')].map(t => ({ w: Math.round(t.getBoundingClientRect().width), parentW: Math.round(t.parentElement.getBoundingClientRect().width), parentOverflow: getComputedStyle(t.parentElement).overflowX })) }))
    const c = cmp.find(x => x.wp === post.wordpress_i_d); const norm = s => s.normalize('NFKC').replace(/[\s ​]+/g, '')
    const row = { device, slug: post.slug, status: r.status(), docTitle: a.title, titleOK: a.title.startsWith(post.seo_title || post.title), descOK: a.desc === post.seo_description, canonical: a.canonical, og: a.og.length, jsonld: a.jsonld, robots: a.robots, h1: a.h1.length, h1Same: a.h1[0] === post.title, dateOK: a.time === post.published_at && a.timeText === post.published_at.slice(0, 10), eyebrow: a.eyebrow,
      renderedChars: norm(a.bodyText).length, cmsChars: c.textChars.cms, counts: a.counts, imgs: a.imgs.length, imgsOK: a.imgs.filter(i => i.ok).length, expectedImgs: 1 + Number(c.structure.img.split('/')[1]), allR2: a.imgs.every(i => new URL(i.src).origin === pubOrigin), emptyAlt: a.imgs.filter(i => !i.alt).length, overflow: a.overflow, wide: a.wide, tables: a.tableScroll, issues: iss }
    results.articles.push(row); console.log(JSON.stringify(row))
    if ([9675, 9645].includes(post.wordpress_i_d)) await p.screenshot({ path: `${out}/${device}-article-${post.wordpress_i_d}.jpg`, fullPage: true, type: 'jpeg', quality: 50 })
    await p.close()
  }
  await ctx.close()
}
for (const l of results.listing) console.log('LISTING', JSON.stringify(l))
fs.writeFileSync(out + '/results.json', JSON.stringify(results, null, 1)); await browser.close()
