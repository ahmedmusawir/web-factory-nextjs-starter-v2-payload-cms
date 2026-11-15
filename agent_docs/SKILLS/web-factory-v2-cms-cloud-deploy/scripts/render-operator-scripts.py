#!/usr/bin/env python3
"""Render verified CONFIG into operator-run shell scripts; no cloud writes.

The rendered deployment is always a PUBLIC website: deploy.sh configures public invocation,
reads it back and runs the anonymous verification. There is no private variant to render.
"""
import argparse, json, shlex, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def q(s):return shlex.quote(str(s))

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--config',required=True);p.add_argument('--stage',required=True);p.add_argument('--out',required=True)
    args=p.parse_args();conf=Path(args.config).resolve();stage=Path(args.stage).resolve();out=Path(args.out).resolve()
    r=subprocess.run([sys.executable,str(ROOT/'scripts'/'validate-config.py'),'--config',str(conf)],capture_output=True,text=True)
    if r.returncode:print(r.stdout);print('BLOCKED: invalid config; no scripts rendered');return 2
    if conf==stage or stage in conf.parents:
        print('BLOCKED: operator config must be OUTSIDE Cloud Build upload tree');return 2
    if not stage.is_dir() or not (stage/'Dockerfile').is_file() or not (stage/'cloudbuild.yaml').is_file():
        print('BLOCKED: stage missing reviewed Dockerfile or Cloud Build yaml');return 2
    if out.exists() or out==stage or out in stage.parents or stage in out.parents:
        print('BLOCKED: output must be a new separate directory outside stage');return 2
    c=json.loads(conf.read_text());g=c['gcp'];en=c['runtime_env'];sec=c['secret_bindings']
    gate=c['release']['security_gate'];ver=c.get('public_verification',{})
    docker=(stage/'Dockerfile').read_text(errors='replace')
    cloud=(stage/'cloudbuild.yaml').read_text(errors='replace')
    profile=c['build']['profile']
    if profile=='protected-buildkit':
        if not all(x in docker for x in ('--mount=type=secret','required=true')) or not all(x in cloud for x in ('availableSecrets','secretEnv','DOCKER_BUILDKIT=1')):
            print('BLOCKED: protected-buildkit profile requires vetted secret-mount Dockerfile and Cloud Build config');return 2
    elif '--mount=type=secret' in docker or 'secretEnv' in cloud:
        print('BLOCKED: runtime-only config conflicts with build-time secret templates');return 2
    dist=c['app']['next_dist_dir']
    if dist!='.next' and (dist+'/standalone' not in docker or dist+'/static' not in docker):
        print('BLOCKED: custom Next distDir is not reflected in Dockerfile COPY paths:',dist);return 2
    if any(',' in v or '=' in v or '\n' in v for v in en.values()):
        print('BLOCKED: comma/equals/multiline runtime values require special gcloud delimiter handling');return 2
    try:
        head=subprocess.run(['git','rev-parse','--short=12','HEAD'],cwd=c['app']['repository'],capture_output=True,text=True,check=True,timeout=15).stdout.strip()
    except (OSError,subprocess.SubprocessError):head='snapshottree'
    image=f"{g['region']}-docker.pkg.dev/{g['project_id']}/{g['artifact_repository']}/{g['service']}"
    secret_args=','.join(f"{k}={v['name']}:{v['version']}" for k,v in sorted(sec.items()))
    env_args=','.join(f'{k}={v}' for k,v in sorted(en.items()))
    # Public invocation is mandatory. Exactly two supported mechanisms; neither is a private mode.
    mech=g['public_access']
    public_flag={'allusers-invoker':'--allow-unauthenticated','invoker-iam-disabled':'--no-invoker-iam-check'}[mech]
    domain=g.get('custom_domain')
    verify_args=' '.join(['--path '+q(x) for x in ver.get('paths',[])]+(['--article-path '+q(ver['article_path'])] if ver.get('article_path') else [])+(['--expect-revalidate '+str(int(ver['revalidate_seconds']))] if ver.get('revalidate_seconds') else []))
    domain_arg=('--custom-domain-url '+q('https://'+domain)) if domain else '--no-custom-domain'
    extra=''
    if g.get('cpu_always_allocated'):extra+=' --no-cpu-throttling'
    if g.get('startup_probe_path'):extra+=' --startup-probe='+q('httpGet.path='+g['startup_probe_path']+',httpGet.port=8080,periodSeconds=5,failureThreshold=24,timeoutSeconds=4')
    header='#!/usr/bin/env bash\nset -euo pipefail\nset +x\n# GENERATED FROM OPERATOR-APPROVED CONFIG; HUMAN RUNS; NO SECRET PAYLOADS.\n'
    identity=f'''PROJECT={q(g['project_id'])}\nREGION={q(g['region'])}\nSERVICE={q(g['service'])}\nEXPECTED_ACCOUNT={q(g['expected_operator'])}\nACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)')"\nif [[ "$ACTIVE_ACCOUNT" != "$EXPECTED_ACCOUNT" ]]; then echo 'BLOCKED: active gcloud account does not match approved operator'; exit 2; fi\n'''
    verify_block=f'''VERIFY={q(ROOT/'scripts'/'verify-runtime.py')}
URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(status.url)')"
if [[ -z "$URL" ]]; then echo 'STATUS: FAILED — the service has no URL. Nothing is verified.'; exit 1; fi
echo "Anonymous verification of $URL{' and https://'+domain if domain else ''} (no credentials are sent):"
set +e
python3 "$VERIFY" --service-url "$URL" {domain_arg} {verify_args}
RC=$?
set -e
case "$RC" in
  0) echo 'DEPLOYMENT PUBLICLY VERIFIED. Hand over to independent Gate D.' ;;
  3) echo 'DEPLOYMENT INCOMPLETE: the service is public, the custom domain is not serving valid HTTPS yet.'
     echo 'Next: run map-domain.sh if the mapping does not exist, confirm the DNS record, wait for the certificate, then run verify-public.sh again.' ;;
  *) echo 'DEPLOYMENT FAILED OR BLOCKED: public access is not verified. The service and revision were left in place.'
     echo 'Do not report success. Do not test through an authenticated path instead. Do not redeploy privately.' ;;
esac
exit "$RC"
'''
    init=header+identity+f'''
echo 'ACTOR A and project:' "$ACTIVE_ACCOUNT" "$PROJECT"
gcloud projects describe "$PROJECT" --format='value(projectId,lifecycleState)'
gcloud services list --enabled --project "$PROJECT" --format='value(config.name)' | grep -E '^(run|cloudbuild|artifactregistry|secretmanager)\\.googleapis\\.com$' || true
if ! gcloud artifacts repositories describe {q(g['artifact_repository'])} --project "$PROJECT" --location "$REGION" --format='value(name)' >/dev/null; then echo 'BLOCKED: Artifact Registry repo unknown/inaccessible'; exit 2; fi
if ! gcloud iam service-accounts describe {q(g['runtime_service_account'])} --project "$PROJECT" --format='value(email)' >/dev/null; then echo 'BLOCKED: runtime service account unknown/inaccessible'; exit 2; fi
if ! gcloud iam service-accounts describe {q(g['build_service_account'])} --project "$PROJECT" --format='value(email)' >/dev/null; then echo 'BLOCKED: dedicated build service account unknown/inaccessible'; exit 2; fi
printf 'PROJECT DEFAULT BUILD IDENTITY (not used; builds run as the dedicated build account): '
gcloud builds get-default-service-account --project "$PROJECT" --region "$REGION" || echo 'UNKNOWN — verify manually'
'''
    for k,v in sorted(sec.items()):
        init+=f"gcloud secrets versions describe {q(v['version'])} --secret {q(v['name'])} --project \"$PROJECT\" --format='value(name,state)' >/dev/null || {{ echo 'BLOCKED: secret version missing/inaccessible: {k}'; exit 2; }}\n"
    init+=f'''
echo 'PUBLIC ACCESS PRECHECK (mechanism: {mech}). An organization policy that forbids it is a BLOCKER to report, never a reason to deploy privately:'
gcloud resource-manager org-policies describe constraints/iam.allowedPolicyMemberDomains --project "$PROJECT" --effective 2>/dev/null || echo 'UNKNOWN — organization policy not readable; confirm before deploying'
echo 'PREFLIGHT: target service (if exists; does not authorize updating):'
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(metadata.name,status.url)' || true
'''
    if domain:
        init+=f'''echo 'PREFLIGHT: custom domain mapping and DNS for {domain}:'
gcloud beta run domain-mappings describe --domain {q(domain)} --project "$PROJECT" --region "$REGION" --format='value(spec.routeName,status.conditions[0].type,status.conditions[0].status)' 2>/dev/null || echo 'No domain mapping yet (map-domain.sh creates it after deploy)'
'''
    init+="printf '%s\\n' 'READ-ONLY INVENTORY COMPLETE. IAM actor rights & QA/security MUST still be independently reviewed.'\n"
    build=header+identity+f'''STAGE={q(stage)}
IMAGE={q(image)}
SOURCE_TAG={q(head)}
BUILD_SA={q(g['build_service_account'])}
GUARD={q(ROOT/'scripts'/'check-upload.sh')}
if [[ ! -f "$STAGE/cloudbuild.yaml" || ! -f "$STAGE/Dockerfile" ]]; then echo 'BLOCKED: staging incomplete'; exit 2; fi
bash "$GUARD" "$STAGE"
printf '%s\\n' 'Operator checkpoint: confirm approved BUILD and reviewed staging source.'
read -r -p "Type BUILD $SERVICE to submit: " OK
if [[ "$OK" != "BUILD $SERVICE" ]]; then echo 'Cancelled'; exit 2; fi
gcloud builds submit "$STAGE" --project "$PROJECT" --region "$REGION" \\
  --config="$STAGE/cloudbuild.yaml" \\
  --service-account="projects/$PROJECT/serviceAccounts/$BUILD_SA" \\
  --substitutions="_IMAGE=$IMAGE,_PRODUCT_SHA=$SOURCE_TAG" \\
  --async --format='value(id)'
echo 'Build submitted; obtain build ID, wait for SUCCESS, verify image digest before deploy.'
'''
    if mech=='allusers-invoker':
        readback='''PUBLIC="$(gcloud run services get-iam-policy "$SERVICE" --project "$PROJECT" --region "$REGION" --flatten='bindings[].members' --filter='bindings.role=roles/run.invoker AND bindings.members=allUsers' --format='value(bindings.members)' || true)"
if [[ "$PUBLIC" != "allUsers" ]]; then PUBLIC_OK=0; else PUBLIC_OK=1; fi
'''
    else:
        readback='''PUBLIC="$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(metadata.annotations."run.googleapis.com/invoker-iam-disabled")' || true)"
if [[ "$PUBLIC" != "true" ]]; then PUBLIC_OK=0; else PUBLIC_OK=1; fi
'''
    deploy=header+identity+f'''IMAGE_REPO={q(image)}
RUNTIME_SA={q(g['runtime_service_account'])}
ENV_VARS={q(env_args)}
SECRETS={q(secret_args)}
PUBLIC_ACCESS_FLAG={q(public_flag)}
SECURITY_GATE={q(gate['status'])}
SECURITY_REFERENCE={q(gate.get('reference') or '')}
# Web Factory deployment = public website. This script has no private mode.
if [[ "$SECURITY_GATE" == 'blocked' ]]; then
  echo 'BLOCKED: the security release gate is not cleared, so this public deployment cannot proceed.'
  echo 'Required: a verified fix, or a Director-approved disposition recorded in the config (release.security_gate).'
  echo 'A private deployment is not a fallback and is not offered.'
  exit 2
fi
if [[ $# -lt 1 ]]; then echo 'Usage: deploy.sh IMAGE@sha256:<64 lowercase hex> [--approved-existing]'; exit 2; fi
IMAGE="$1"
if [[ ! "$IMAGE" =~ ^{image.replace('.',r'\.')}@sha256:[a-f0-9]{{64}}$ ]]; then echo 'BLOCKED: exact approved repository@sha256:digest required'; exit 2; fi
if gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='value(metadata.name)' >/dev/null 2>&1; then
  if [[ "${{2:-}}" != '--approved-existing' ]]; then echo 'BLOCKED: existing service requires explicitly approved update and pre-deploy traffic evidence'; exit 2; fi
  echo 'EXISTING SERVICE — confirm recorded previous traffic, identity and rollback BEFORE continuing.'
fi
echo "Security release gate: $SECURITY_GATE ($SECURITY_REFERENCE)"
printf '%s\\n' 'Operator checkpoint: this makes the website PUBLIC. Verify independent QA, the security gate record above and the exact Cloud Run target.'
read -r -p "Type DEPLOY PUBLIC $SERVICE to proceed: " OK
if [[ "$OK" != "DEPLOY PUBLIC $SERVICE" ]]; then echo 'Cancelled'; exit 2; fi
gcloud run deploy "$SERVICE" --project "$PROJECT" --region "$REGION" \\
  --image="$IMAGE" --platform=managed --service-account="$RUNTIME_SA" \\
  --port=8080 --memory={q(g['memory'])} --min-instances={int(g['min_instances'])} --max-instances={int(g['max_instances'])}{extra} \\
  "$PUBLIC_ACCESS_FLAG" --set-env-vars="$ENV_VARS" --set-secrets="$SECRETS"
echo 'Readback: runtime identity, revision, traffic and service URL:'
gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format='yaml(metadata.name,status.url,status.latestReadyRevisionName,status.traffic,spec.template.spec.serviceAccountName,spec.template.spec.containers[0].image)'
echo 'Readback: public invocation ({mech}) — never assumed from the deploy exit code:'
{readback}if [[ "$PUBLIC_OK" != 1 ]]; then
  echo 'STATUS: BLOCKED — public invocation is NOT in effect after deploy (an organization policy or missing permission may have refused it).'
  echo 'The service and revision were left in place. Report the blocker; do not weaken organization policy without Director authorization; do not continue as a private service.'
  exit 4
fi
echo 'Public invocation confirmed by readback.'
'''+verify_block
    verify=header+identity+'# Anonymous verification only. Safe to rerun; makes no cloud changes.\n'+verify_block
    scripts=[('init-app.sh',init),('build.sh',build),('deploy.sh',deploy),('verify-public.sh',verify)]
    if domain:
        mapd=header+identity+f'''DOMAIN={q(domain)}
# Maps the custom domain to the PUBLIC service. DNS records at the DNS provider are changed by the operator, not by this script.
if gcloud beta run domain-mappings describe --domain "$DOMAIN" --project "$PROJECT" --region "$REGION" --format='value(spec.routeName)' >/dev/null 2>&1; then
  echo 'Domain mapping already exists:'
else
  read -r -p "Type MAP $DOMAIN to map it to $SERVICE: " OK
  if [[ "$OK" != "MAP $DOMAIN" ]]; then echo 'Cancelled'; exit 2; fi
  gcloud beta run domain-mappings create --service "$SERVICE" --domain "$DOMAIN" --project "$PROJECT" --region "$REGION"
fi
gcloud beta run domain-mappings describe --domain "$DOMAIN" --project "$PROJECT" --region "$REGION" --format='yaml(spec.routeName,status.conditions,status.resourceRecords)'
echo 'Compare the resourceRecords above with the live DNS record. Certificate provisioning can take from minutes to hours.'
echo 'The deployment stays INCOMPLETE until verify-public.sh passes on the custom domain.'
'''
        scripts.append(('map-domain.sh',mapd))
    out.mkdir(parents=True)
    for name,body in scripts:
        (out/name).write_text(body)
        (out/name).chmod(0o750)
        test=subprocess.run(['bash','-n',str(out/name)],capture_output=True,text=True)
        if test.returncode:print('BLOCKED: generated shell syntax invalid',name,test.stderr);return 2
    print('RENDERED',len(scripts),'operator scripts OUTSIDE Cloud Build context:',out)
    print('init-app.sh: READ-ONLY resource inventory, including public-access and domain prechecks')
    print('build.sh: operator-confirmed Cloud Build submission as the dedicated build identity (uses upload guard)')
    print('deploy.sh: operator-confirmed immutable digest release as a PUBLIC service ('+mech+'), public readback, anonymous verification')
    if domain:print('map-domain.sh: operator-confirmed Cloud Run domain mapping for',domain)
    print('verify-public.sh: anonymous verification of the service URL'+(' and custom domain' if domain else ''))
    if gate['status']=='blocked':print('NOTE: security gate is BLOCKED — deploy.sh will refuse until the config records a fix or a Director-approved disposition.')
    print('NOT EXECUTED. Verify actual CLI flags, IAM, QA/security and app package before running.')
    return 0
if __name__=='__main__':sys.exit(main())
