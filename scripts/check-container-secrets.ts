import './load-env'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
const secrets = ['PAYLOAD_SECRET','DATABASE_AUTH_TOKEN','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'].map(k => process.env[k]).filter((v): v is string => Boolean(v))
function scan(directory: string) {
 for (const entry of readdirSync(directory, { withFileTypes: true })) {
  const file = path.join(directory, entry.name)
  if (entry.isDirectory()) scan(file)
  else if (entry.isFile() && secrets.some(secret => readFileSync(file).includes(Buffer.from(secret)))) throw new Error('Configured secret detected in container artifact; build refused')
 }
}
const dist = process.env.NEXT_DIST_DIR || '.next'
scan(path.join(dist, 'standalone')); scan(path.join(dist, 'static'))
console.log('Container artifacts contain no configured credential values.')
