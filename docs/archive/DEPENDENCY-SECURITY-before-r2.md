# Mission 001 dependency review

Engineering review, not release certification. The complete machine findings are in `evidence/p1/audit-initial.json` and `audit.json`. Counts include parent packages marked through vulnerable dependencies; they are not counts of distinct exploitable bugs.

## High and critical findings

| Package and chain | Finding / exposure | Disposition |
| --- | --- | --- |
| `@payloadcms/next@3.93.0 → @payloadcms/ui@3.93.0 → @monaco-editor/react@4.7.0 → monaco-editor@0.57.0 → dompurify@3.4.15` | Production dependency. DOMPurify advisories include critical [GHSA-cg2g-xh64-v4q7](https://github.com/advisories/GHSA-cg2g-xh64-v4q7), high [GHSA-mrv2-3pqr-j5jr](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr), and low p98j-92pf-mc4p, 6688-9rhm-gjv2, c6gr-qvv4-5v3f (full URLs/ranges in audit). These involve specific sanitizer modes/hooks and HTML parsing. This app does not configure editor-facing Code/JSON fields or a Monaco editor (Payload has internal JSON fields in its hidden system collections); its public content renderer uses Lexical React nodes. No exploit path was demonstrated. This is not proof of absence of every path in the upstream admin bundle. | **UNRESOLVED; release blocker pending upstream repair or an independently reviewed bundled-code fix.** The latest Monaco 0.57.0 still embeds DOMPurify 3.4.15 in `esm/vs/base/browser/dompurify/dompurify.js`. A trial dependency override to 3.4.17 removed the npm finding but left that embedded code untouched; it was removed. Do not mistake an audit-only fix for a code fix. Keep local testing on loopback, use disposable data, and do not introduce Monaco fields/untrusted HTML. |
| `@payloadcms/richtext-lexical@3.93.0 → @lexical/headless@0.50.0 → happy-dom@20.14.6` | Production dependency, used by the optional `@lexical/headless/dom` entry point. High [GHSA-834v-8h66-3h79](https://github.com/advisories/GHSA-834v-8h66-3h79): ESM compiler code injection; high [GHSA-c8p4-j97h-3vg8](https://github.com/advisories/GHSA-c8p4-j97h-3vg8): iframe/stylesheet SSRF on untrusted HTML. Our application does not invoke this optional helper or server-side HTML import. Payload's inspected converters import the headless editor's root entry point, not `/dom`. | **Resolved in installed dependency tree:** scoped override only under `@lexical/headless@0.50.0` to Happy DOM **21.0.4**. Reviewed upstream breaking change: v21 disables external CSS/iframe loading by default. Our app needs neither behavior. The helper's `Window`, `DOMParser`, and close APIs remain compatible in the focused test. No global Happy DOM override, no Payload/Next upgrade, no forced fix. Revisit/remove override once Payload adopts a patched dependency. |

Sources: [Happy DOM v21 changes and patches](https://github.com/capricorn86/happy-dom/releases), [DOMPurify releases](https://github.com/cure53/DOMPurify/releases), [Lexical DOM helper](https://github.com/meta/lexical/blob/v0.50.0/packages/lexical-headless/src/dom.ts). Registry manifests and the actual installed source were inspected in addition to the advisories.

## Other remaining root findings

| Package | Exposure and mitigation | Why not force an update |
| --- | --- | --- |
| `deepmerge@4.3.1`, low, [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | Payload runtime/config dependency; prototype poisoning of returned objects. Configuration is developer-controlled, while upstream may merge other input. Exact exploitability through Payload was not established. Keep collection APIs authenticated for writes and review upstream repair before release. | Payload pins this version; do not silently override its merge behavior without a focused upstream-compatible repair. |
| `esbuild@0.18.20`, moderate, [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | SQLite adapter → Drizzle Kit → esbuild-kit migration tooling. Advisory requires esbuild's development server. This project invokes transforms/migrations, not that server. Next's loopback dev server is a different implementation. | Fix crosses the pinned old esbuild tooling range. No esbuild development server is started. |
| `minimatch@10.2.6`, moderate, [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | TypeScript ESLint tooling only; glob amplification DoS. Lint patterns are repository-controlled. Not part of application request handling. | A fixed major is outside the current transitive range. Keep untrusted generated glob expressions out of lint configuration. |
| `uuid@8.3.2` / `9.0.1`, moderate, [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | GCS SDK, teeny-request, gaxios. Runtime dependencies, but local mode performs no GCS operations. Advisory concerns v3/v5/v6 caller-provided buffers; inspected SDK call sites use v4. No affected call was found in application code. | Updating to ≥11.1.1 crosses dependency major/module boundaries. Await compatible SDK update; do not force replacement of CommonJS consumers. |

Remaining findings are tracked, not suppressed. The project is suitable for the scoped local proof only; it is not production-ready. Reassess the complete dependency audit, embedded copies, and cloud behavior before any release.

## Lint disposition

The three archived `QAM/evidence/qa-q2/20261028T081836Z/*.cjs` tools and their CommonJS imports already existed at baseline HEAD. `eslint.config.mjs` was also unchanged when the initial run produced 13 `no-require-imports` errors. A file-scoped exception now permits CommonJS imports **only** in `QAM/evidence/**/*.cjs`. All other rules continue to run; historical files are unmodified. Generated migration destructuring was trimmed to its used `db` argument; no rule was disabled for new application code.

## Retained investigation failures

- Initial lint: historical CommonJS import errors; later generated migration unused arguments. Both corrected as described.
- Initial typecheck: an access helper was typed too broadly for Payload's boolean admin-access API. Narrowed its return type without changing authorization behavior.
- An initial test combined DOMPurify with Happy DOM, which is not DOMPurify's supported browser environment. It failed sanitization and was discarded as an invalid combination, not weakened to pass. No application code combines them. The ineffective DOMPurify override was subsequently removed after the embedded-copy inspection.
- Sandboxed Turbopack build stalled and was stopped after checking the task-owned process identity; build retried outside the sandbox.

- Initial CMS browser runs exposed mismatched test labels (`Log in` vs `Login`, then `Publish` vs the actual publish action); application authentication succeeded after the login locator correction. Failure logs are retained.

- A subsequent browser assertion expected visible alt text on a media relationship; Payload displays the filename and uses alt text on the thumbnail. Corrected the test to assert the actual filename, image, and persisted relationship. Final CMS and restart tests passed.
