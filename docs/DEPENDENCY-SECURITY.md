# R2-001 dependency security assessment

Reviewed 2026-11-14. **Critical finding unresolved; release hold remains.** Isolated local engineering can continue. No independent security certification or deployment approval is implied.

Live resume update: the approved disposable Turso/R2 browser, upload, restart and cleanup workflow passed. This does **not** close the security finding or authorize deployment. The [live audit](../evidence/live-integration/audit.json) still reports 1 critical, 0 high, 12 moderate and 10 low findings; no dependency remediation was claimed during live testing.

The new [audit](../evidence/r2-001/audit.json) reports **1 critical, 0 high, 12 moderate, 10 low** package findings (23 total, including propagated parent-package findings). The previous P1 audit had 28. Removing GCS removed its vulnerable UUID chains; it did not fix Monaco. Historical assessment: [pre-amendment report](archive/DEPENDENCY-SECURITY-before-r2.md).

## Monaco / DOMPurify: exact finding and disposition

Production dependency chain: `@payloadcms/next@3.93.0 → @payloadcms/ui@3.93.0 → @monaco-editor/react@4.7.0 → monaco-editor@0.57.0 → dompurify@3.4.15`. Monaco also embeds **3.4.15** directly in `esm/vs/base/browser/dompurify/dompurify.js`; changing the declared dependency cannot repair that file. Its SHA-256 and inspected wrapper/build facts are in [monaco-bundle.json](../evidence/r2-001/monaco-bundle.json).

Critical [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7) affects 3.4.4–3.4.16; 3.4.17 is patched. Exploitation requires template sanitization enabled, DOM output/in-place processing involving attached shadow-root content, and downstream template evaluation. The inspected Monaco sanitizer wrapper does not enable `SAFE_FOR_TEMPLATES` or `IN_PLACE`; application code adds neither mode. The same installed package also has [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr), involving in-place sanitization plus a mutation hook, and lower-severity findings listed in the audit. A package's highest severity determines its audit bucket, explaining zero separately counted high packages.

| Question | Evidence and limits |
| --- | --- |
| Is the vulnerable implementation installed? | **Yes**, both the dependency and vendored 3.4.15 copy. This is a production dependency, not merely a development test dependency. |
| Is that copy emitted in this production build? | Scan of 69 static JS files found no `DOMPurify`, `SAFE_FOR_TEMPLATES`, or `3.4.15` marker. Server dependency traces contained no Monaco/DOMPurify files. This narrows this build's exposure; marker/trace checks cannot prove absence of every renamed implementation, and a deployment copying all node_modules would still include it. |
| What editor loader is shipped? | A static chunk contains `@monaco-editor/loader@1.7.0`'s default lazy CDN target: `https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs`. This differs from the installed 0.57.0. Inspection of the official 0.55.1 npm artifact found vendored **DOMPurify 3.2.7**. That is outside this exact critical advisory range but is older and affected by other advisories; it is not a blanket safe alternative. [Artifact evidence](../evidence/r2-001/monaco-loader-target.json). |
| Is the editor reachable in current workflows? | Real authenticated Chromium visited Page and Media creation; no Monaco/CDN request occurred. The hidden system-preferences creation route returned the admin 404, with zero editor elements. All external requests were intercepted before network access. [Browser observations](../evidence/r2-001/monaco-browser.json). Current editor-facing fields use Lexical, not Code/JSON. These bounded observations are not exhaustive reachability analysis. |
| Does untrusted input reach the vulnerable mode? | No such path demonstrated. No Monaco editor loaded in the tested workflows and the inspected wrapper lacks the critical mode. Future Code/JSON fields or upstream changes could expose editor-controlled input; authentication alone would not make that input trusted. Public content uses Lexical React rendering. |
| Is a compatible supported upstream fix available? | No fixed stable Monaco release was found. Registry/latest and GitHub latest stable were **0.57.0**; the 0.58 releases inspected were development prereleases. [Registry evidence](../evidence/r2-001/monaco-registry.json), [stable release evidence](../evidence/r2-001/monaco-upstream-release.json), [upstream releases](https://github.com/microsoft/monaco-editor/releases). Monaco's [published security advisory page](https://github.com/microsoft/monaco-editor/security/advisories) listed no advisories; that is not proof of safety. |
| Has it been remediated? | **No.** No bundle patch, postinstall rewrite, unsupported prerelease upgrade, or DOMPurify override was applied. The previous ineffective override was removed. Neither overriding the declared dependency nor pointing at a different CDN version proves that both vendored/runtime copies are fixed. |

Current mitigation is limited to loopback local testing with disposable data and authorized editors; retain the current field set and do not add Monaco-based or arbitrary HTML/template processing without review. This reduces observed exposure, not the severity of the upstream finding. **Release stays blocked pending a supported patch or separately approved, reviewed mitigation.** There is no demonstrated active critical exploit in this application and no claim that the dependency is safe.

Closure evidence must include: a compatible stable editor/loader selection; inspection proving the patched DOMPurify implementation in both installed and actually loaded artifacts; build/trace inspection; browser testing of all reachable editor paths; relevant regression/advisory tests; and a fresh audit. Avoid an audit-only closure.

## Other findings and retained remediation

| Package | Exposure / disposition |
| --- | --- |
| Happy DOM **21.0.4** | Previous high findings were repaired with the retained scoped override under `@lexical/headless@0.50.0`. The optional DOM helper's APIs pass the focused test. V21 disables external iframe/CSS loading by default; no app feature depends on that behavior. Revisit when Payload adopts a patched version. [Upstream releases](https://github.com/capricorn86/happy-dom/releases). |
| `deepmerge@4.3.1`, low | Payload runtime/config merge dependency; prototype poisoning advisory [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4). Developer-controlled configuration reduces that path; upstream request-input reachability was not exhaustively established. No unsupported merge-behavior override. |
| `esbuild@0.18.20`, moderate | SQLite adapter → Drizzle migration tooling. [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) concerns esbuild's development server, which this app does not run. The dependency resides under a production adapter but this feature is tooling, not application request handling. |
| `minimatch@10.2.6`, moderate | ESLint tooling and repository-controlled glob patterns; [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Not used in CMS request handling. Fixed major is outside the transitive range; no blind override. |
| GCS UUID findings | Removed with the GCS adapter dependency chain. Official S3 adapter **3.93.0** matches all other Payload packages. No forced audit fix or lockfile deletion. |

## Lint and retained failures

Lint passes with zero warnings. P1's narrow CommonJS exception for `QAM/evidence/**/*.cjs` remains; historical QA files and behavior are unchanged. No new lint suppression was introduced for R2.

R2 investigation logs preserve the initially stale generated import map and the failed browser run that overlapped logins against one test administrator. CMS suites now use one worker; a fresh isolated run passed. The Monaco probe records actual results rather than assuming hidden preferences expose an editor. P1 failures/evidence remain in their original directory; see the archived report for historical details.
