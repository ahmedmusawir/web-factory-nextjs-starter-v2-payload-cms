# HARD GATE — four files inside the website repository

No deployment may be called operationally complete until an agent can show:

```bash
cd /path/to/ACTUAL/website/repo
ls -l Dockerfile cloudbuild.yaml init-app.sh deploy.sh
git ls-files -- Dockerfile cloudbuild.yaml init-app.sh deploy.sh \n  stark-deploy.json .gcloudignore .dockerignore \n  ops/redeploy.py ops/check-upload.sh ops/verify-runtime.py
bash -n init-app.sh deploy.sh
./init-app.sh
./deploy.sh
```

`./init-app.sh` is a read-only initial inventory for an already provisioned target. On a brand-new service, first-time resources are created by a separately approved provisioning flow. Subsequent deployments need only `./deploy.sh`, which always builds current source, pushes by digest, updates the same Cloud Run service publicly and verifies anonymously. The website repo must keep all required files in Git after the Director authorizes commit.

**Important:** Do not execute `./deploy.sh` without the operator's authorization. It makes live cloud changes. The four historical examples under `examples/field-proven-four-files/` illustrate the proven user experience, not the valid Payload container settings.
