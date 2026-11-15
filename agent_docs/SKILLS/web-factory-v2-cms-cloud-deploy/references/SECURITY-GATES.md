# Release gating for public CMS websites

- **Gate Q / QA:** independent tests of website routes, images, admin auth, drafts/preview, publish, 30s ISR, build, regressions; exact source identity and verdict. An engineering PASS and a manual smoke are valuable but NOT independent QA.
- **Security:** dependency audit and severe/critical findings evaluated on their actual exposure and exploit path; known Monaco/DOMPurify critical from the Cyberize POC requires a verified compatible fix or an explicit documented security disposition approved by the Director **before the website is exposed**. Because every Web Factory deployment is public, an uncleared gate means the deployment is BLOCKED; it is recorded in `release.security_gate` and `deploy.sh` enforces it. Reducing who can reach the service is not a substitute for clearing the gate and is not offered as one.
- **Packaging:** prove no `.env`/credentials are in actual Cloud Build source or Docker context; inspect build output client bundles for accidental secret leaks. Block if any secret exposed.
- **IAM:** Actor A/B/C resolved and rights verified, secrets per-resource, minimize access, no public R2 secret keys, no broad wildcard grants for convenience.
- **Application:** no anonymous CMS mutations, draft leaks, first-user public registration, unsafe preview token exposure, accidental reset/seed or remote DB migration.
- **Traffic:** first deploy uses a NEW Cloud Run service; no replacement of an existing service and no Vercel changes without distinct approval. Public invocation and the custom-domain mapping are part of the deployment; records at the DNS provider are edited by the operator.
- **Public access:** configured explicitly, read back, and proven by anonymous requests to both URLs (`PUBLIC-DEPLOYMENT-CONTRACT.md`). An organization policy that forbids it is a reported blocker; it is not weakened without Director authorization.
- **Gate D:** once a service is operational, independent QA performs a deployed-environment check. DevOps startup PASS is not app acceptance.

A blocked result is successful risk management when evidence shows unresolved issues. Production QA/release waiver authority is distinct from a successful build; log any explicit Director-approved POC exception as an EXCEPTION, not as QA PASS.
