import { getPayload } from 'payload'
import config from '@payload-config'
export const dynamic = 'force-dynamic'
export async function GET() {
 try { await (await getPayload({ config })).count({ collection: 'pages', overrideAccess: false }); return Response.json({ status: 'ready' }) }
 catch { return Response.json({ status: 'unavailable' }, { status: 503 }) }
}
