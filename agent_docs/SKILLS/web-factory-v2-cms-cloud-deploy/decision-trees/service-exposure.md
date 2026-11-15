# Decision: how the website is made public

The website is public. That is settled doctrine, not a choice made here. This tree only decides **how** public invocation is configured, **whether exposure may proceed yet**, and how the custom domain is attached.

1. **Service name.** A first deployment uses a **new service name**. Confirm the GCP target and that the name is unused, or that updating it is expressly authorized. Existing services remain untouched.
2. **Security release gate, before exposure.** If independent QA has not passed, or a critical finding (for example a critical CMS editor dependency) has neither a verified fix nor a documented disposition approved by the Director, the deployment is **BLOCKED**. Report it and stop. Building and packaging may continue; exposure may not. The gate is cleared by a fix or by the Director's recorded decision, never silently, and never by deploying somewhere visitors cannot reach.
3. **Public-access mechanism.** Read the project's effective organization policy and how sibling services are exposed.
   - `allUsers` may hold `roles/run.invoker` → use `--allow-unauthenticated` (`public_access: allusers-invoker`).
   - Domain-restricted sharing forbids `allUsers` but the organization permits disabling the invoker check → use `--no-invoker-iam-check` (`public_access: invoker-iam-disabled`).
   - Neither is permitted → **STOP: BLOCKED by organization policy.** Report the constraint and who can change it. Do not weaken the policy without explicit Director authorization.
4. **Read it back.** After deploy, confirm the `allUsers` binding or the invoker-IAM-disabled annotation. A deploy command can exit 0 while the public setting was refused.
5. **Custom domain.** Create the Cloud Run domain mapping to the new service and compare its required records with live DNS. The operator edits records at the DNS provider. A CNAME that already exists proves nothing until the mapping is Ready and the certificate is issued.
6. **Verify anonymously on both URLs.** Until the custom domain serves the site over valid HTTPS the status is DEPLOYMENT INCOMPLETE.
7. Production on Vercel is a future adapter, not this skill's executor. It should consume the same remote Turso/R2 only when shared-content operational consequences are acceptable.

Public website access is not public administrative access: Payload admin and CMS writes stay protected by the application throughout.
