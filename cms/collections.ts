import { invalidatePublished, invalidateDeleted, invalidateSettings, invalidateMedia } from './revalidation'
import { websitePageFields, websiteSections, sourceFields } from './website-fields'
import { safeEditorialLink } from '../content/website'
import { assertPublicR2Media } from './r2'
import { randomUUID } from 'node:crypto'
import { APIError, type CollectionConfig, type Field, type GlobalConfig } from 'payload'
import { adminField, isAdmin, isEditor, publishedOrEditor, publicMediaOrEditor } from './access'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: { maxLoginAttempts: 5, lockTime: 600000 },
  admin: { useAsTitle: 'email' },
  access: {
    admin: isEditor,
    create: isAdmin,
    read: ({ req }) => req.user?.role === 'admin' ? true : req.user ? { id: { equals: req.user.id } } : false,
    update: isAdmin,
    delete: isAdmin,
  },
  hooks: { beforeChange: [({ req, data, operation }) => {
    // Payload's first-register endpoint bypasses collection create access.
    // Only the operator's local CLI may bootstrap an empty user collection.
    if (operation === 'create' && req.user?.role !== 'admin' && req.context.bootstrapAdmin !== true) {
      throw new APIError('User creation requires an administrator. Use the operator CLI for initial setup.', 403)
    }
    return data
  }] },
  fields: [{ name: 'role', type: 'select', required: true, defaultValue: 'editor', options: ['admin', 'editor'], access: { create: adminField, update: adminField } }],
}
const contentFields = (): Field[] => [
  { name: 'title', type: 'text', required: true },
  { name: 'slug', type: 'text', required: true, unique: true, index: true,
    validate: (value: unknown) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || 'Use lowercase words separated by hyphens.' },
]
const seoFields = (): Field[] => [
  { name: 'seoTitle', type: 'text', maxLength: 70 },
  { name: 'seoDescription', type: 'textarea', maxLength: 170 },
]
const contentAccess = { read: publishedOrEditor, create: isEditor, update: isEditor, delete: isAdmin, readVersions: isEditor }
export const Pages: CollectionConfig = {
  slug: 'pages', admin: { useAsTitle: 'title', preview: (data) => data.template ? `/preview/${encodeURIComponent(String(data.slug))}` : null }, access: contentAccess,
  versions: { drafts: true, maxPerDoc: 10 },
  hooks: { afterChange: [invalidatePublished], afterDelete: [invalidateDeleted] },
  fields: [...contentFields(), { name: 'content', type: 'richText', required: true, admin: { condition: (data) => !data.template } }, ...seoFields(), ...websitePageFields],
}
export const Posts: CollectionConfig = {
  slug: 'posts', admin: { useAsTitle: 'title', preview: data => `/preview/posts/${data.slug}` }, access: contentAccess,
  versions: { drafts: true, maxPerDoc: 10 },
  hooks: { afterChange: [invalidatePublished], afterDelete: [invalidateDeleted] },
  fields: [...contentFields(), { name: 'excerpt', type: 'textarea' }, { name: 'content', type: 'richText', required: true },
    { name: 'featuredImage', type: 'upload', relationTo: 'media' }, { name: 'publishedAt', type: 'date' }, ...sourceFields,
    { name: 'originalURL', type: 'text' }, { name: 'wordpressID', type: 'number', unique: true },
    { name: 'categories', type: 'text', hasMany: true }, ...seoFields()],
}
export function mediaCollection(mediaDir: string, prefix: string, publicR2 = false): CollectionConfig {
  return {
    slug: 'media',
    admin: { useAsTitle: 'alt', description: 'Local images may be private. Cloud images are public: explicitly select public before uploading. Private cloud images are not supported.' },
    access: { read: publicMediaOrEditor, create: isEditor, update: isEditor, delete: isAdmin },
    upload: {
      staticDir: mediaDir, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      imageSizes: [{ name: 'thumbnail', width: 400, height: 300, position: 'centre', withoutEnlargement: true }],
      adminThumbnail: 'thumbnail',
    },
    hooks: {
      afterChange: [invalidateMedia],
      beforeOperation: [({ req, operation }) => {
        if ((operation === 'create' || operation === 'update') && req.file) {
          const ext: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
          if (!ext[req.file.mimetype] || req.file.size > 3 * 1024 * 1024) throw new APIError('Upload a JPEG, PNG, or WebP image of at most 3 MB.', 400)
          req.file.name = `${randomUUID()}.${ext[req.file.mimetype]}`
        }
      }],
      beforeChange: [({ data, originalDoc, req }) => {
        if (publicR2) assertPublicR2Media(data.visibility ?? originalDoc?.visibility)
        data.prefix = originalDoc?.prefix || (req.context.blogImport === true ? `${prefix}/wordpress-blog` : req.context.websiteImport === true ? `${prefix}/web-factory-poc-site-1` : prefix)
        // Direct client uploads are disabled; clients cannot select another object's path.
        data._objectKey = originalDoc?._objectKey || null
        data.objectKey = `${data.prefix}/${data.filename || originalDoc?.filename}`
        return data
      }],
    },
    fields: [
      ...sourceFields,
      { name: 'alt', type: 'text', required: true }, { name: 'caption', type: 'textarea' },
      { name: 'visibility', type: 'select', required: true, defaultValue: 'private', options: ['private', 'public'] },
      { name: 'objectKey', type: 'text', admin: { readOnly: true }, access: { create: () => false, update: () => false } },
      { name: 'prefix', type: 'text', defaultValue: prefix, admin: { readOnly: true }, access: { create: () => false, update: () => false } },
      { name: '_objectKey', type: 'text', admin: { hidden: true, readOnly: true } },
    ],
  }
}
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings', hooks: { afterChange: [invalidateSettings] }, access: { read: () => true, update: isEditor },
  fields: [{ name: 'websiteName', type: 'text', required: true, defaultValue: 'Stark Web Factory' },
    { name: 'websiteDescription', type: 'textarea' }, { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'sourceID', type: 'text', admin: { readOnly: true }, access: { update: () => false } },
    { name: 'contactProvisional', type: 'checkbox', defaultValue: true },
    { name: 'contact', type: 'group', fields: ['phoneHref', 'phoneDisplay', 'addressLine1', 'addressCity'].map(name => ({ name, type: 'text', ...(name === 'phoneHref' ? { validate: (value: unknown) => safeEditorialLink(value) || 'Use a safe tel, HTTPS or relative link.' } : {}) })) },
    websiteSections(true)],
}
