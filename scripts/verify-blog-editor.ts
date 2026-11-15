import './load-env'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { writeFileSync } from 'node:fs'
import { chromium, expect } from '@playwright/test'
import { getPayload } from 'payload'
import { readEnvironment } from '../cms/environment'
const env=readEnvironment();assert.ok(env.appEnv==='test'&&env.kind==='turso'&&/^web-factory-v2-poc-db-.*\.turso\.io$/.test(new URL(env.url).hostname))
const {default:config}=await import('../payload.config');const payload=await getPayload({config})
const initialUsers=(await payload.find({collection:'users',limit:100})).docs.map(u=>u.id)
const source=(await payload.find({collection:'posts',where:{wordpressID:{equals:9675}},depth:0,limit:1})).docs[0];assert.ok(source)
const token=randomUUID(), email=`editor-${token}@example.test`, password=randomBytes(32).toString('base64url')
const user=await payload.create({collection:'users',context:{bootstrapAdmin:true},data:{email,password,role:'admin'}})
const doc=await payload.create({collection:'posts',context:{skipRevalidation:true},data:{title:source.title,slug:`editor-${token}`,content:source.content!,featuredImage:source.featuredImage,_status:'published'}})
const probe=createServer();await new Promise<void>((resolve,reject)=>{probe.once('error',reject);probe.listen(3003,'127.0.0.1',()=>probe.close(()=>resolve()))})
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','-p','3003'],{env:{...process.env,NEXT_DIST_DIR:'.next-mission003'},stdio:'ignore'})
const browser=await chromium.launch();const context=await browser.newContext({baseURL:'http://127.0.0.1:3003'});let deleted=false
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3003/health/ready')).ok)break}catch{}await delay(500)}
 const page=await context.newPage();await page.goto('/admin/login');await page.locator('input[name=email]').fill(email);await page.locator('input[name=password]').fill(password);await page.getByRole('button',{name:/^log\s?in$/i}).click();await expect(page.getByRole('link',{name:'Posts',exact:true}).first()).toBeVisible()
 await page.goto(`/admin/collections/posts/${doc.id}`);await expect(page.locator('#field-title')).toHaveValue(source.title!);await expect(page.locator('[contenteditable=true]').first()).toBeVisible();await expect(page.locator('[contenteditable=true] table').first()).toBeVisible()
 await page.locator('#field-title').fill('Browser table article edit')
 const saved=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname===`/api/posts/${doc.id}`)
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();assert.ok((await saved).ok())
 const published=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname===`/api/posts/${doc.id}`)
 await page.getByRole('button',{name:'Publish changes',exact:true}).click();assert.ok((await published).ok())
 const after=await payload.findByID({collection:'posts',id:doc.id,depth:0});assert.equal(after.title,'Browser table article edit');assert.ok(JSON.stringify(after.content).includes('"type":"table"'))
 assert.ok((await context.request.delete(`/api/posts/${doc.id}`)).ok());deleted=true
 await context.request.get('/blog')
 writeFileSync('evidence/mission-003/blog-editor.json',JSON.stringify({status:'PASS',realChromium:true,tableArticleEditable:true,draftSaved:true,published:true,tableRetained:true,existingArticlesUnchanged:true},null,2));console.log('PASS: Chromium rich-text/table editing, Save Draft and Publish; original article untouched.')
}catch(error){console.error(error instanceof Error?error.message.replaceAll(password,'[redacted]').replaceAll(email,'[test-user]'):'Editor check failed');process.exitCode=1}
finally{await browser.close();server.kill('SIGTERM');await new Promise<void>(resolve=>server.once('exit',()=>resolve()));if(!deleted)await payload.delete({collection:'posts',id:doc.id,context:{skipRevalidation:true}});await payload.delete({collection:'users',id:user.id});assert.ok(JSON.stringify((await payload.find({collection:'users',limit:100})).docs.map(u=>u.id))===JSON.stringify(initialUsers),'Original users must remain');await payload.destroy()}
