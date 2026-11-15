import { db, q } from '../../scripts/lib.mjs'
const c = db()
console.log('locks', JSON.stringify(await q(c, 'select d.id,d.global_slug,d.updated_at,r.pages_id,r.posts_id,r.users_id from payload_locked_documents d left join payload_locked_documents_rels r on r.parent_id=d.id')))
console.log('prefs', JSON.stringify(await q(c, 'select p.id,p.key,p.updated_at,r.users_id from payload_preferences p left join payload_preferences_rels r on r.parent_id=p.id order by p.id')))
console.log('sessions', JSON.stringify(await q(c, 'select _parent_id,created_at,expires_at from users_sessions')))
