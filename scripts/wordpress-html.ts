import sanitize from 'sanitize-html'
export function sanitizeWordPressHTML(html: string) {
 return sanitize(html.replace(/src=(["'])\/\//g, 'src=$1https://'), {
  allowedTags: ['p','h1','h2','h3','h4','h5','h6','ul','ol','li','strong','b','em','i','u','s','blockquote','a','br','hr','img','figure','figcaption','pre','code','table','thead','tbody','tr','td','th'],
  allowedAttributes: { a: ['href','title'], img: ['src','alt'], ol: ['start'], td: ['colspan','rowspan'], th: ['colspan','rowspan'] },
  allowedSchemes: ['https','http','mailto','tel'], allowProtocolRelative: false,
 })
}
