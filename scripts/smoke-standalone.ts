import './load-env'
import { cpSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import assert from 'node:assert/strict'
const root='.next-mission003/standalone'
cpSync('public',`${root}/public`,{recursive:true})
cpSync('.next-mission003/static',`${root}/.next-mission003/static`,{recursive:true})
const probe=createServer();await new Promise<void>((resolve,reject)=>{probe.once('error',reject);probe.listen(3005,'127.0.0.1',()=>probe.close(()=>resolve()))})
const child=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,HOSTNAME:'127.0.0.1',PORT:'3005'},stdio:'ignore'})
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:3005/health/ready')).ok)break}catch{}await delay(500)}
 const results=[]
 for(const path of ['/health/ready','/admin/login','/api/posts?limit=1','/blog','/cyberize/assets/Manrope.ttf']){
  const response=await fetch('http://127.0.0.1:3005'+path);assert.equal(response.status,200);results.push({path,status:response.status})
 }
 writeFileSync('evidence/mission-003/standalone-smoke.json',JSON.stringify({status:'PASS',node:process.version,bind:'127.0.0.1:3005',results,dockerImageBuilt:false},null,2));console.log('PASS: standalone server readiness, admin login page, API, blog and fonts.')
}finally{child.kill('SIGTERM');await new Promise<void>(resolve=>child.once('exit',()=>resolve()))}
