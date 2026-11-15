# Payload and 30-second ISR deployment contract

### Public website

Public routes may use static generation/ISR with 30-second freshness fallback and on-demand publish invalidation. Inspect real Next version and app code, do not automatically modify Next cache configuration or treat `export const revalidate = 30` alone as proof. Confirm build output and measured runtime/cache reads. Stale-while-revalidate is request-driven; “30 seconds” does not mean a scheduled rebuild of every page or a strict maximum delay to visible edits.

### Protected CMS

Payload admin, API, authentication, media writes, preview and draft routes require Node runtime and server-side permissions. Never publicly cache drafts, personalized responses or auth results. Check Host/Origin, cookies and per-environment public URL variables. Existing admin user resides in Turso; deploying to a different host does not require recreating it.

### Media

R2 keeps original/thumbnail bytes; Turso holds Payload media metadata and relationships. Confirm R2 object key prefix, bucket, endpoint and public delivery URL; test actual bytes via HTTP. Local file-system media writes are not persistent on Cloud Run; fail if `MEDIA_STORAGE` silently falls back to local storage. Do not convert SVG/PNG for deployment.

### Cloud Run ISR caveat

The default Next filesystem cache in Cloud Run is instance-local and ephemeral. A `max-instances=1` pilot setting limits normal scaling but doesn't guarantee uninterrupted singularity nor synchronize with another frontend at Vercel. Multiple replicas or platforms need cache-handler/shared-invalidation strategy if strong cross-instance consistency is required. Writeability of ISR cache by non-root user matters. Verify cache behavior on the actual instance after cold start, 30+ second intervals and publish events. A separate platform’s cache will refresh on its own schedule; publication in staging may change the remote DB while Vercel still serves cached content.
