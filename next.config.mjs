import { withPayload } from '@payloadcms/next/withPayload'

export default withPayload({ output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined, distDir: process.env.NEXT_DIST_DIR || '.next' })
