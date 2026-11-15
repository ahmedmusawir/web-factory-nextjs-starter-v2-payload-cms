import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

const read = file => readFileSync(file, 'utf8')
const staticFiles = readdirSync('.next/static', { recursive: true }).filter(file => file.endsWith('.js')).map(file => path.join('.next/static', file))
const matches = marker => staticFiles.filter(file => read(file).includes(marker))
const vendorPath = 'node_modules/monaco-editor/esm/vs/base/browser/dompurify/dompurify.js'
const vendor = read(vendorPath)
const wrapper = read('node_modules/monaco-editor/esm/vs/base/browser/domSanitize.js')
const traces = readdirSync('.next/server', { recursive: true }).filter(file => file.endsWith('.nft.json')).flatMap(file => {
  const full = path.join('.next/server', file)
  return JSON.parse(read(full)).files.filter(dependency => /monaco-editor|dompurify/.test(dependency)).map(dependency => ({ trace: full, dependency }))
})
const result = {
  installedMonaco: JSON.parse(read('node_modules/monaco-editor/package.json')).version,
  installedDOMPurify: JSON.parse(read('node_modules/monaco-editor/node_modules/dompurify/package.json')).version,
  vendorPath, vendorSHA256: createHash('sha256').update(vendor).digest('hex'),
  bundledVersion: vendor.match(/DOMPurify.version = '([^']+)'/)?.[1],
  inspectedProductionJSFiles: staticFiles.length,
  staticMatches: Object.fromEntries(['DOMPurify', 'SAFE_FOR_TEMPLATES', '3.4.15', 'cdn.jsdelivr.net/npm/monaco-editor@0.55.1'].map(marker => [marker, matches(marker)])),
  serverTraceMatches: traces,
  installedMonacoSanitizerEnablesSafeForTemplates: /SAFE_FOR_TEMPLATES\s*:/.test(wrapper),
  installedMonacoSanitizerEnablesInPlace: /IN_PLACE\s*:/.test(wrapper),
  loaderConfiguration: read('node_modules/@monaco-editor/loader/lib/es/config/index.js').trim(),
  limitations: 'Marker and trace inspection is build-specific, not an exploit test or proof of absence of every renamed implementation. Browser evidence separately records authenticated lazy loading with external requests blocked.',
}
writeFileSync('evidence/r2-001/monaco-bundle.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ installedMonaco: result.installedMonaco, bundledVersion: result.bundledVersion, scannedJSFiles: staticFiles.length, markerCounts: Object.fromEntries(Object.entries(result.staticMatches).map(([marker, files]) => [marker, files.length])), traceMatches: traces.length }, null, 2))
