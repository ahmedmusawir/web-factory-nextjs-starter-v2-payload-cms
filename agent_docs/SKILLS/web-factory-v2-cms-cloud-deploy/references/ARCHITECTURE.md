# One frontend application — three locations — shared remote backends

```text
LOCAL DEV Next.js + Payload ------\
CLOUD RUN STAGING Next.js+Payload --+----> TURSO/libSQL DB (same schema/content)
VERCEL PRODUCTION Next.js+Payload -/ \---> CLOUDFLARE R2 bucket (same media)
```

No database copy on front-end host change. No bucket copy. Authentication lives in Payload/DB; each deployed instance runs compatible app code and has its own origin-specific runtime configuration. A schema migration means versioning/changing Turso tables to satisfy new Payload collection fields; it is unrelated to changing where Next.js runs. Do not run schema changes on startup, as multiple hosts may race to modify DB.

**Shared staging/prod DB warning:** publishing, deletions, content imports and schema changes from *any* environment hit the SAME data. Treat staging like production for data-write discipline if both share a DB. Different frontend origins require configured cookies, public origins, redirects and preview URLs. Publish invalidation triggered in one instance does not necessarily invalidate another host's local ISR cache; 30-second fallback provides eventual refresh on subsequent requests, not synchronized real-time freshness.

**Runtime:** the full Next + Payload application runs on Cloud Run or Vercel; Turso and R2 remain managed remote services. Hosting needs Node/Payload admin/API functionality, not a pure static HTML export. Public page cache and application data are distinct.
