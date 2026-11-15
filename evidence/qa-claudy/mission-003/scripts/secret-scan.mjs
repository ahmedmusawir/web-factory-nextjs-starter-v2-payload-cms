// Scans files for configured secret VALUES (never prints them). Reports only variable names + paths.
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'
import { env, R } from '../../scripts/lib.mjs'
const needles = { PAYLOAD_SECRET: env.PAYLOAD_SECRET, DATABASE_AUTH_TOKEN: env.DATABASE_AUTH_TOKEN, R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY, 'R2 account endpoint host': new URL(env.R2_ENDPOINT).hostname, 'Turso hostname': new URL(env.DATABASE_URL).hostname }
const hits = {}; let files = 0
const scanFile = f => { let b; try { const s = fs.statSync(f); if (!s.isFile() || s.size > 60e6) return; b = fs.readFileSync(f) } catch { return } files++; for (const [k, v] of Object.entries(needles)) if (v && b.includes(Buffer.from(v))) (hits[k] ||= []).push(path.relative(R, f)) }
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules' || d.includes('standalone')) walk(f) } else scanFile(f) } }
const target = process.argv[2]
if (target === 'git') for (const f of execSync('git ls-files -co --exclude-standard', { cwd: R, maxBuffer: 1e8 }).toString().split('\n').filter(Boolean)) scanFile(path.join(R, f))
else walk(path.join(R, target))
console.log(target, 'files scanned', files, JSON.stringify(Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, { count: v.length, sample: v.slice(0, 6) }]))))
