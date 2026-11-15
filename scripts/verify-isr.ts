import './load-env'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium, request, expect, type APIRequestContext } from '@playwright/test'
import { getPayload } from 'payload'
import { readEnvironment } from '../cms/environment'
const env = readEnvironment()
assert.ok(env.kind === 'turso' && env.appEnv === 'test' && /^web-factory-v2-poc-db-.*\.turso\.io$/.test(new URL(env.url).hostname)); assert.equal(env.r2?.bucket, 'stark-web-factory-poc-media')
const { default: config } = await import('../payload.config')
const payload = await getPayload({ config })
const id = randomUUID(), slug = `isr-${id}`, email = `${id}@example.test`, password = randomBytes(32).toString('base64url')
const dir = `evidence/mission-003/live-${id}`; mkdirSync(dir, { recursive: true })
const baseURL = 'http://127.0.0.1:3003'
let server: ChildProcess | undefined, reads = 0
let authenticated: APIRequestContext | undefined
const results: Record<string, unknown> = {}, stages: string[] = []
const pass = (s: string) => { stages.push(s); console.log('PASS:', s) }
const before = await payload.find({ collection: 'users', limit: 100 })
const owned: { collection: 'pages' | 'posts' | 'users'; id: number }[] = []
const browser = await chromium.launch({ headless: true })
const anonymous = await request.newContext({ baseURL })
const log = createWriteStream(`${dir}/render-counts.log`)
async function stop() { if (server?.pid && server.exitCode === null) { server.kill('SIGTERM'); await new Promise<void>(resolve => server!.once('exit', () => resolve())) } }
async function start() {
 const probe=createServer(); await new Promise<void>((resolve,reject)=>{probe.once('error',reject);probe.listen(3003,'127.0.0.1',()=>probe.close(()=>resolve()))})
 server = spawn(process.execPath, ['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p','3003'], { env: { ...process.env, NEXT_DIST_DIR: '.next-mission003', ISR_DIAGNOSTICS: '1' }, stdio: ['ignore','pipe','ignore'] })
 server.stdout!.on('data', chunk => { for (const line of String(chunk).split('\n')) if (line.includes('CMS_READ')) { reads++; log.write(line + '\n') } })
 for (let i=0;i<60;i++) { try { if ((await fetch(baseURL+'/health/ready')).ok) return } catch {} await delay(500) }
 throw new Error('Server readiness failed')
}
try {
 assert.ok(before.totalDocs >= 1)
 const editor = await payload.create({ collection: 'users', context: { bootstrapAdmin: true }, data: { email, password, role: 'admin' } }); owned.push({collection:'users',id:editor.id})
 const original = (await payload.find({collection:'pages',where:{slug:{equals:'home'}},depth:0})).docs[0]
 const sections = original.sections!.map(row => { const { id: ignored, ...copy } = row; void ignored; return copy })
 const pageDoc = await payload.create({collection:'pages',context:{skipRevalidation:true},data:{title:'ISR fixture',slug,template:'home',sections,content:original.content!,_status:'published'}}); owned.unshift({collection:'pages',id:pageDoc.id})
 const sourcePost = (await payload.find({collection:'posts',where:{sourceID:{contains:'wordpress:post:'}},depth:0,limit:1})).docs[0]
 const post = await payload.create({collection:'posts',context:{skipRevalidation:true},data:{title:'ISR article fixture',slug,content:sourcePost.content!,_status:'published'}}); owned.unshift({collection:'posts',id:post.id})
 await start()
 const context = await browser.newContext({baseURL}); const page = await context.newPage()
 await page.goto('/admin/login'); await page.locator('input[name=email]').fill(email); await page.locator('input[name=password]').fill(password); await page.getByRole('button',{name:/^log\s?in$/i}).click(); await expect(page.getByRole('link',{name:'Pages',exact:true}).first()).toBeVisible()
 authenticated = context.request
 pass('Chromium temporary administrator login; Tony administrator untouched')
 const routes=['/','/seo-services','/ppc','/website-design','/web-development','/website-support','/contact','/blog',`/blog/${sourcePost.slug}`]
 for (const route of routes) {
  await anonymous.get(route); await delay(500)
  let response=await anonymous.get(route)
  if (response.headers()['x-nextjs-cache']==='STALE') { await delay(1500); response=await anonymous.get(route) }
  assert.equal(response.status(),200); assert.equal(response.headers()['x-nextjs-cache'],'HIT',route)
 }
 pass('seven original pages, blog listing and article return full-route cache HIT')
 const observations=[]
 for (const [collection,doc,url,preview] of [['pages',pageDoc,`/${slug}`,`/preview/${slug}`],['posts',post,`/blog/${slug}`,`/preview/posts/${slug}`]] as const) {
  const first=await anonymous.get(url); await delay(300); const count=reads; const second=await anonymous.get(url)
  assert.equal(second.headers()['x-nextjs-cache'],'HIT'); await delay(200); assert.equal(reads,count,'Cache hit must not query CMS')
  const timed=`Timed regeneration ${id}`
  await payload.update({collection,id:doc.id,context:{skipRevalidation:true},data:collection==='pages'?{sections:sections.map((s,i)=>i===0?{...s,heroHeading:timed}:s),_status:'published'}:{title:timed,_status:'published'}})
  assert.ok(!(await (await anonymous.get(url)).text()).includes(timed))
  await delay(31000); const stale=await anonymous.get(url); assert.equal(stale.headers()['x-nextjs-cache'],'STALE')
  await expect.poll(async()=> (await (await anonymous.get(url)).text()).includes(timed),{timeout:20000}).toBe(true)
  assert.ok(reads>count)
  const draft=`Private draft ${id}`
  const draftData=collection==='pages'?{sections:sections.map((s,i)=>i===0?{...s,heroHeading:draft}:s)}:{title:draft}
  assert.ok((await context.request.patch(`/api/${collection}/${doc.id}?draft=true`,{data:{...draftData,_status:'draft'}})).ok())
  assert.ok(!(await (await anonymous.get(url)).text()).includes(draft)); assert.equal((await anonymous.get(preview)).status(),404)
  await page.goto(preview); await expect(page.locator('h1').first()).toContainText(draft)
  assert.ok((await context.request.patch(`/api/${collection}/${doc.id}`,{data:{...draftData,_status:'published'}})).ok())
  await expect.poll(async()=> (await (await anonymous.get(url)).text()).includes(draft),{timeout:10000}).toBe(true)
  assert.equal((await anonymous.patch(`/api/${collection}/${doc.id}`,{data:{title:'Denied'}})).status(),403)
  observations.push({collection,firstCache:first.headers()['x-nextjs-cache'],repeatCache:'HIT',cmsReadsDuringHit:0,timedRegeneration:true,draftPrivate:true,previewAuthenticated:true,publishInvalidated:true})
 }
 results.isr=observations; pass('page/article cache hits, 30-second regeneration, draft isolation, preview and publish invalidation')
 const articles=(await payload.find({collection:'posts',where:{sourceID:{contains:'wordpress:post:'}},limit:100})).docs; assert.equal(articles.length,12)
 for (const [device,width] of [['desktop',1440],['mobile',375]] as const) {
  const visual=await browser.newPage({viewport:{width,height:900}})
  for (const article of articles) {
   assert.equal((await visual.goto(baseURL+`/blog/${article.slug}`))!.status(),200)
   await visual.locator('img').evaluateAll(images=>Promise.all(images.map(image=>(image as HTMLImageElement).decode())))
   assert.ok(await visual.locator('.payload-richtext').innerText().then(t=>t.length>1000))
   assert.ok(await visual.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  }
  await visual.goto(baseURL+'/blog'); await visual.screenshot({path:`${dir}/blog-${device}.png`,fullPage:true}); await visual.close()
 }
 pass('12 full articles and inline/featured images render in desktop/mobile Chromium')
 await stop(); await start(); assert.equal((await anonymous.get(`/blog/${sourcePost.slug}`)).status(),200)
 assert.equal((await payload.count({collection:'posts',where:{sourceID:{contains:'wordpress:post:'}}})).totalDocs,12)
 pass('published articles survive fresh-server restart')
 results.status='PASS'
} catch(error) { results.status='FAIL'; results.error=error instanceof Error?error.message.replaceAll(password,'[redacted]').replaceAll(email,'[test-user]').slice(0,500):'unknown'; console.error('Verification failed:',results.error); process.exitCode=1 }
finally {
 for (const doc of owned) {
  if (doc.collection !== 'users' && authenticated && server?.exitCode === null) assert.ok((await authenticated.delete(`/api/${doc.collection}/${doc.id}`)).ok(), 'Owned fixture cleanup denied')
  else await payload.delete({collection:doc.collection,id:doc.id,context:{skipRevalidation:true}})
 }
 await anonymous.get('/blog')
 await browser.close(); await anonymous.dispose(); await stop(); log.end()
 const after=await payload.find({collection:'users',limit:100}); assert.deepEqual(after.docs.map(u=>[u.id,u.email,u.role]),before.docs.map(u=>[u.id,u.email,u.role]))
 results.originalUsersPreserved=true; await payload.destroy(); writeFileSync(`${dir}/results.json`,JSON.stringify({...results,stages},null,2)); console.log('Evidence:',dir)
}
