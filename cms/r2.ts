import { APIError } from 'payload'

// r2.dev makes the entire bucket public, regardless of Payload read access.
// Run before the storage plugin's afterChange upload hook; retain local privacy.
export function assertPublicR2Media(visibility: unknown) {
  if (visibility !== 'public') throw new APIError('This R2 bucket is public. Explicitly choose public visibility; private uploads and making published objects private are not supported.', 400)
}

export function r2PublicURL(origin: string, prefix: string | undefined, filename: string) {
  return `${origin}/${[...(prefix ? prefix.split('/') : []), filename].map(encodeURIComponent).join('/')}`
}
