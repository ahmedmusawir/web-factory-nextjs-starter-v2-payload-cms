import type { Access, FieldAccess } from 'payload'

export const isAdmin: Access = ({ req }) => req.user?.role === 'admin'
export const isEditor = ({ req }: Parameters<Access>[0]) => req.user?.role === 'admin' || req.user?.role === 'editor'
export const adminField: FieldAccess = ({ req }) => req.user?.role === 'admin'
export const publishedOrEditor: Access = ({ req }) => req.user ? isEditor({ req }) : { _status: { equals: 'published' } }
export const publicMediaOrEditor: Access = ({ req }) => req.user ? isEditor({ req }) : { visibility: { equals: 'public' } }
