import './load-env'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { getPayload } from 'payload'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { readEnvironment } from '../cms/environment'
const env = readEnvironment(); assert.ok(env.appEnv === 'test' && env.kind === 'turso'); assert.equal(env.r2?.bucket, 'stark-web-factory-poc-media')
const r2=env.r2!, s3=new S3Client({region:'auto',endpoint:r2.endpoint,forcePathStyle:true,credentials:{accessKeyId:r2.accessKeyId,secretAccessKey:r2.secretAccessKey}})
const {default:config}=await import('../payload.config');const payload=await getPayload({config});const checks=[]
try {
 const media=(await payload.find({collection:'media',where:{prefix:{equals:`${env.prefix}/wordpress-blog`}},limit:100})).docs
 assert.ok(media.length>12)
 for(const doc of media){
  for(const [key,url]of [[doc.objectKey!,doc.url!],[`${doc.prefix}/${doc.sizes!.thumbnail!.filename}`,doc.sizes!.thumbnail!.url!]]){
   assert.equal(new URL(url).origin,r2.publicURL)
   const object=await s3.send(new GetObjectCommand({Bucket:r2.bucket,Key:key}),{abortSignal:AbortSignal.timeout(30000)})
   const bytes=Buffer.from(await object.Body!.transformToByteArray());const response=await fetch(url,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200)
   const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');assert.equal(hash(bytes),hash(Buffer.from(await response.arrayBuffer())))
   checks.push({mediaID:doc.id,key,bytes:bytes.length,sha256:hash(bytes),publicStatus:200})
  }
 }
 assert.equal((await payload.count({collection:'media',where:{sourceID:{contains:'web-factory-poc-site-1:media:'}}})).totalDocs,12)
 writeFileSync('evidence/mission-003/r2-verification.json',JSON.stringify({status:'PASS',blogMedia:media.length,checks,originalWebsiteMediaRetained:12},null,2));console.log(`PASS: ${media.length} blog originals and thumbnails verified in R2 and public delivery; original 12 website media retained.`)
}finally{await payload.destroy();s3.destroy()}
