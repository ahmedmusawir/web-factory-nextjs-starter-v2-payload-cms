import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor, EXPERIMENTAL_TableFeature } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { r2PublicURL } from './cms/r2'
import sharp from 'sharp'
import { readEnvironment } from './cms/environment'
import { Users, Pages, Posts, mediaCollection, SiteSettings } from './cms/collections'

const root = path.dirname(fileURLToPath(import.meta.url))
const env = readEnvironment()
export default buildConfig({
  secret: env.secret,
  // No mail service is configured for this POC; never log reset links/tokens.
  email: () => ({
    name: 'disabled-for-poc', defaultFromAddress: 'no-reply@example.invalid', defaultFromName: 'Stark POC',
    sendEmail: async () => { throw new Error('Email delivery is not configured for this POC') },
  }),
  admin: { user: 'users', importMap: { baseDir: root } },
  collections: [Users, Pages, Posts, mediaCollection(env.mediaDir, env.prefix, env.storage === 'r2')],
  globals: [SiteSettings],
  editor: lexicalEditor({ features: ({ defaultFeatures }) => [...defaultFeatures, EXPERIMENTAL_TableFeature()] }), sharp,
  db: sqliteAdapter({
    client: { url: env.url, authToken: env.kind === 'turso' ? process.env.DATABASE_AUTH_TOKEN : undefined },
    push: false, migrationDir: path.resolve(root, 'migrations'),
  }),
  upload: { limits: { fileSize: 3 * 1024 * 1024 }, abortOnLimit: true },
  plugins: [s3Storage({
    enabled: Boolean(env.r2),
    bucket: env.r2?.bucket || '',
    config: {
      region: 'auto', endpoint: env.r2?.endpoint, forcePathStyle: true,
      credentials: env.r2 ? { accessKeyId: env.r2.accessKeyId, secretAccessKey: env.r2.secretAccessKey } : undefined,
    },
    collections: { media: {
      prefix: env.prefix,
      // Keep Payload's file-route checks; public delivery is intentionally independent.
      generateFileURL: ({ filename, prefix }) => r2PublicURL(env.r2!.publicURL, prefix, filename),
    } },
    clientUploads: false,
  })],
  typescript: { outputFile: path.resolve(root, 'payload-types.ts') },
})
