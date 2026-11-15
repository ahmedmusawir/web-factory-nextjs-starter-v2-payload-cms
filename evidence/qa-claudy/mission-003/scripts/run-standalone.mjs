// Starts the assembled runtime dir the way the Dockerfile runtime stage would: `node server.js`,
// config supplied ONLY through process env (no env file in the runtime dir). argv: <runtimeDir> <port> [noenv|badtoken]
import { spawn } from 'node:child_process'
import { env } from '../../scripts/lib.mjs'
const [dir, port, mode] = process.argv.slice(2)
const keys = ['APP_ENV', 'DATABASE_KIND', 'DATABASE_URL', 'DATABASE_AUTH_TOKEN', 'DATABASE_TARGET_HOST', 'PAYLOAD_SECRET', 'MEDIA_STORAGE', 'R2_BUCKET', 'R2_TARGET_BUCKET', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_URL', 'R2_PREFIX']
const runtime = mode === 'noenv' ? {} : Object.fromEntries(keys.map(k => [k, env[k]]))
if (mode === 'badtoken') runtime.DATABASE_AUTH_TOKEN = 'invalid-qa-token'
const child = spawn(process.execPath, ['server.js'], { cwd: dir, env: { PATH: process.env.PATH, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1', HOSTNAME: '127.0.0.1', PORT: port, ISR_DIAGNOSTICS: '1', ...runtime }, stdio: 'inherit' })
process.on('SIGTERM', () => child.kill('SIGTERM')); child.on('exit', c => process.exit(c ?? 0))
