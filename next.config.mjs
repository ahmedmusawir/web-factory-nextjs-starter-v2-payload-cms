import { withPayload } from '@payloadcms/next/withPayload'

// isrFlushToDisk: false keeps the ISR cache in the bounded in-memory store only (cacheMaxMemorySize, 50 MB default).
// On Cloud Run the filesystem is memory, so writing a cache file per requested URL (including 404s) would grow without limit.
export default withPayload({ output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined, distDir: process.env.NEXT_DIST_DIR || '.next', experimental: { isrFlushToDisk: false } })
