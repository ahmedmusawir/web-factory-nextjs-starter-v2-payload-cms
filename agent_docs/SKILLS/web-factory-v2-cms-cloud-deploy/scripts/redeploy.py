#!/usr/bin/env python3
"""Portable, repo-local Cloud Run redeploy runner. No skill-folder dependency.

Installed in the WEBSITE repository as ops/redeploy.py and driven by ./deploy.sh and
./init-app.sh. Everything it needs is in the repository: stark-deploy.json (non-secret
settings), Dockerfile, cloudbuild.yaml, .gcloudignore, .dockerignore and ops/.

deploy: verify operator/project/service -> stage the CURRENT working tree outside the repo ->
upload guard -> Cloud Build (dedicated build identity) -> wait -> immutable digest ->
deploy the SAME public Cloud Run service by digest -> public-invocation readback ->
anonymous verification of the run.app URL and the custom domain.

Exit codes: 0 publicly verified | 1 failed | 2 blocked before any cloud change |
3 deployed and public, custom domain not serving valid HTTPS yet (incomplete).
This runner never reads or prints secret values.
"""
import argparse, datetime, json, pathlib, re, shutil, subprocess, sys, tempfile, time

RE_DIGEST = re.compile(r'^sha256:[a-f0-9]{64}$')
SENSITIVE = re.compile(r'(^|/)(\.env[^/]*|\.npmrc|\.netrc|\.ssh|\.aws|\.gnupg|\.git-credentials|id_rsa|id_ed25519|[^/]*credentials[^/]*\.json|[^/]*service[-_]?account[^/]*\.json)(/|$)|\.(?:pem|p12|pfx|key|db|sqlite|sqlite3)$',re.I)
# Documentation-only template; never staged or uploaded, but its presence in Git is not a leak.
SAFE_TEMPLATES = {'.env.example'}
SKIP_SEGMENTS={'.git','node_modules','agent_docs','_SKILLS','__pycache__','.turbo','coverage','playwright-report','test-results','.vercel'}
BUILD_TIMEOUT_SECONDS = 30*60
TERMINAL = {'SUCCESS','FAILURE','INTERNAL_ERROR','TIMEOUT','CANCELLED','EXPIRED'}

class Blocked(RuntimeError): pass
class Failed(RuntimeError): pass

def run(*args, cwd=None, out=False, check=True, show_error=False):
    p=subprocess.run(args,cwd=cwd,text=True,capture_output=True)
    if check and p.returncode:
        # gcloud output is not echoed by default: it could contain environment detail.
        detail=''
        if show_error:
            detail='\n'+'\n'.join(p.stderr.strip().splitlines()[-12:])
        raise Failed('Command failed (exit '+str(p.returncode)+'): '+' '.join(map(str,args[:4]))+detail)
    return p.stdout.strip() if out else p

def require(ok,msg):
    if not ok:raise Blocked('BLOCKED: '+msg)

def cfg(repo):
    path=repo/'stark-deploy.json'
    require(path.is_file(),'missing versioned stark-deploy.json')
    c=json.loads(path.read_text())
    g=c['gcp']; bind=c['secret_bindings']; env=c['runtime_env']; gate=c['release']['security_gate']
    for k in ('project_id','region','service','artifact_repository','expected_operator','build_service_account','runtime_service_account','public_access'):
        require(g.get(k),'missing gcp.'+k)
    require(g['public_access'] in ('allusers-invoker','invoker-iam-disabled'),'public access MUST be configured explicitly')
    require(g['build_service_account']!=g['runtime_service_account'],'separate build/runtime identities required')
    require(gate.get('status') in ('cleared','director-exception'),'public release security gate not cleared')
    require(len(gate.get('reference',''))>=8,'missing security decision reference')
    if gate['status']=='director-exception':
        expires=gate.get('expires_on')
        require(isinstance(expires,str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}',expires) is not None,
                'director exception requires YYYY-MM-DD expires_on')
        require(datetime.date.fromisoformat(expires)>=datetime.date.today(),
                'director security exception expired on '+expires+'; a renewed written decision must be recorded in stark-deploy.json (release.security_gate) before deploying')
    require(env.get('DATABASE_KIND')=='turso' and env.get('MEDIA_STORAGE')=='r2','remote Turso/R2 required')
    require(isinstance(bind,dict) and len(bind)>0,'required secret bindings missing')
    for k,v in bind.items():
        require(re.fullmatch(r'[A-Z][A-Z0-9_]*',k) is not None,'invalid secret var name')
        require(re.fullmatch(r'[1-9][0-9]*',str(v.get('version',''))) is not None,'secret version must be pinned numeric')
    for v in env.values():
        require(isinstance(v,str) and v and not any(x in v for x in ('\n','\r',',')),'unsafe runtime env value')
    for name in ('Dockerfile','cloudbuild.yaml','init-app.sh','deploy.sh'):
        require((repo/name).is_file(),'permanent deliverable missing from repository: '+name)
    require((repo/'.gcloudignore').is_file() and (repo/'.dockerignore').is_file(),'both ignore guards required')
    require((repo/'ops'/'verify-runtime.py').is_file() and (repo/'ops'/'check-upload.sh').is_file(),'missing repo-local verifier or upload guard')
    return c

def actor(c):
    current=run('gcloud','auth','list','--filter=status:ACTIVE','--format=value(account)',out=True)
    require(current==c['gcp']['expected_operator'],'active gcloud account is "'+current+'", approved operator is "'+c['gcp']['expected_operator']+'" (gcloud auth login / gcloud config set account)')
    project=run('gcloud','config','get-value','project',out=True)
    require(project==c['gcp']['project_id'],'active gcloud project is "'+project+'"; run: gcloud config set project '+c['gcp']['project_id'])

def git(repo,*args):return run('git',*args,cwd=repo,out=True)

def ignored_top_level(repo):
    """Plain names in .gcloudignore (no glob, no slash) are never uploaded, so they are not staged either."""
    names=set()
    for line in (repo/'.gcloudignore').read_text().splitlines():
        line=line.strip()
        if line and not line.startswith(('#','!')) and re.fullmatch(r'[A-Za-z0-9._-]+',line):names.add(line)
    return names

def stage_source(repo,stage):
    # Source of truth: the current local tree (tracked + untracked, minus .gitignore),
    # never an older Git snapshot. Read-only Git commands only.
    require(git(repo,'rev-parse','--is-inside-work-tree')=='true','source not a git repo')
    paths=set(filter(None,git(repo,'ls-files','--cached','--others','--exclude-standard').splitlines()))
    require('package.json' in paths,'no package.json in tracked/untracked source')
    skip=SKIP_SEGMENTS|ignored_top_level(repo)
    count=0
    for path in sorted(paths):
        parts=pathlib.PurePosixPath(path).parts
        if any(part in skip or part.startswith('.next') for part in parts):continue
        if path in SAFE_TEMPLATES:continue
        # A secret-looking file in the source tree is a release BLOCKER, even if an ignore file would drop it later.
        if SENSITIVE.search(path):raise Blocked('BLOCKED: sensitive source path present: '+path)
        s=repo/path
        if s.is_symlink():raise Blocked('BLOCKED: source symlink not reviewed: '+path)
        if not s.is_file():continue
        d=stage/path;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(s,d);count+=1
    for needed in ('Dockerfile','cloudbuild.yaml','package.json','.gcloudignore','.dockerignore'):
        require((stage/needed).exists(),'missing staged '+needed)
    return git(repo,'rev-parse','--short=12','HEAD'),count

def upload_guard(repo,stage):
    # Fail closed on listing errors and effective Cloud Build upload breaches.
    r=subprocess.run(['bash',str(repo/'ops'/'check-upload.sh'),str(stage)])
    if r.returncode:raise Blocked('BLOCKED: upload guard refused the staged source (exit '+str(r.returncode)+'); nothing was submitted')

def gcloud_json(*args):
    raw=run('gcloud',*args,'--format=json',out=True)
    return json.loads(raw)

def build_and_digest(c,stage,image,tag):
    g=c['gcp'];p=g['project_id'];r=g['region']
    bid=run('gcloud','builds','submit',str(stage),'--project='+p,'--region='+r,
            '--config='+str(stage/'cloudbuild.yaml'),
            '--service-account=projects/'+p+'/serviceAccounts/'+g['build_service_account'],
            '--substitutions=_IMAGE='+image+',_PRODUCT_SHA='+tag,
            '--async','--format=value(id)',out=True,show_error=True).splitlines()[-1].strip()
    require(re.fullmatch(r'[a-f0-9-]{36}',bid) is not None,'Cloud Build did not return a build ID')
    print('Cloud Build submitted:',bid)
    print('  Logs: https://console.cloud.google.com/cloud-build/builds;region='+r+'/'+bid+'?project='+p)
    start=time.time();last=''
    while True:
        bd=gcloud_json('builds','describe',bid,'--project='+p,'--region='+r)
        status=bd.get('status','UNKNOWN')
        if status!=last:print('  build status:',status,'(%ds)'%int(time.time()-start));last=status
        if status in TERMINAL:break
        if time.time()-start>BUILD_TIMEOUT_SECONDS:raise Failed('Cloud Build '+bid+' did not finish within '+str(BUILD_TIMEOUT_SECONDS//60)+' minutes; nothing was deployed')
        time.sleep(10)
    if status!='SUCCESS':raise Failed('Cloud Build '+bid+' ended with '+status+'; nothing was deployed. Open the log link above.')
    expected=image+':'+tag+'-'+bid
    digests=[i.get('digest') for i in bd.get('results',{}).get('images',[]) if i.get('name')==expected]
    require(len(digests)==1 and RE_DIGEST.fullmatch(str(digests[0])) is not None,'build result does not contain exactly one sha256 digest for '+expected)
    # Independent cross-check against Artifact Registry.
    data=gcloud_json('artifacts','docker','images','describe',image+'@'+digests[0])
    summary=data.get('image_summary') or data.get('imageSummary') or {}
    require(summary.get('digest')==digests[0],'Artifact Registry does not confirm the built digest')
    return bid,digests[0]

def public_readback(c):
    g=c['gcp'];prefix=['--project='+g['project_id'],'--region='+g['region']]
    if g['public_access']=='allusers-invoker':
        policy=gcloud_json('run','services','get-iam-policy',g['service'],*prefix)
        return any(x.get('role')=='roles/run.invoker' and 'allUsers' in x.get('members',[]) for x in policy.get('bindings',[]))
    service=gcloud_json('run','services','describe',g['service'],*prefix)
    return service.get('metadata',{}).get('annotations',{}).get('run.googleapis.com/invoker-iam-disabled')=='true'

def public_verify(repo,c,url):
    g=c['gcp']
    args=[sys.executable,str(repo/'ops'/'verify-runtime.py'),'--service-url',url]
    if g.get('custom_domain'):args+=['--custom-domain-url','https://'+g['custom_domain']]
    else:args+=['--no-custom-domain']
    v=c.get('public_verification',{})
    for path in v.get('paths',[]):args+=['--path',path]
    if v.get('article_path'):args+=['--article-path',v['article_path']]
    if v.get('revalidate_seconds'):args+=['--expect-revalidate',str(v['revalidate_seconds'])]
    sys.stdout.flush()
    return subprocess.run(args).returncode

def init(repo,c):
    actor(c);g=c['gcp'];p=g['project_id'];r=g['region']
    print('READ-ONLY INFRASTRUCTURE VERIFICATION:',p,r,g['service'])
    missing=[]
    def check(label,*args):
        ok=run(*args,check=False).returncode==0
        print(('  OK       ' if ok else '  MISSING  ')+label)
        if not ok:missing.append(label)
    for api in ('run','cloudbuild','artifactregistry','secretmanager'):
        enabled=run('gcloud','services','list','--enabled','--project='+p,'--filter=config.name='+api+'.googleapis.com','--format=value(config.name)',out=True,check=False)
        print(('  OK       ' if enabled else '  MISSING  ')+'API '+api+'.googleapis.com')
        if not enabled:missing.append('API '+api)
    check('Artifact Registry repository '+g['artifact_repository'],'gcloud','artifacts','repositories','describe',g['artifact_repository'],'--location='+r,'--project='+p)
    check('build identity '+g['build_service_account'],'gcloud','iam','service-accounts','describe',g['build_service_account'],'--project='+p)
    check('runtime identity '+g['runtime_service_account'],'gcloud','iam','service-accounts','describe',g['runtime_service_account'],'--project='+p)
    for key,secret in sorted(c['secret_bindings'].items()):
        check('secret '+secret['name']+' version '+str(secret['version'])+' ('+key+')','gcloud','secrets','versions','describe',str(secret['version']),'--secret='+secret['name'],'--project='+p)
    check('Cloud Run service '+g['service'],'gcloud','run','services','describe',g['service'],'--project='+p,'--region='+r)
    if g.get('custom_domain'):
        check('domain mapping '+g['custom_domain'],'gcloud','beta','run','domain-mappings','describe','--domain='+g['custom_domain'],'--project='+p,'--region='+r)
    gate=c['release']['security_gate']
    print('  Security gate:',gate['status'],'-',gate['reference'],('(expires '+gate['expires_on']+')') if gate.get('expires_on') else '')
    if missing:
        print('\nINIT INCOMPLETE:',len(missing),'required resource(s) missing. Nothing was created or changed.')
        print('First-time provisioning (service accounts, secrets, IAM grants, first deploy, domain mapping) is a')
        print('separately approved one-time setup; see docs/DEPLOYMENT.md. Routine releases never need it.')
        return 2
    print('\nINIT PASS: everything ./deploy.sh needs already exists. Nothing was created or changed.')
    print('Next step: ./deploy.sh')
    return 0

def deploy(repo,c,assume_yes=False):
    actor(c);g=c['gcp'];p=g['project_id'];r=g['region'];service=g['service']
    # Routine redeploy only: the approved service must already exist. Never creates a surprise service.
    probe=run('gcloud','run','services','describe',service,'--project='+p,'--region='+r,'--format=json',check=False)
    require(probe.returncode==0,'Cloud Run service '+service+' not found in '+p+'/'+r+'; first-time provisioning is a separately approved setup (run ./init-app.sh)')
    previous=json.loads(probe.stdout)
    prev_rev=previous.get('status',{}).get('latestReadyRevisionName','unknown')
    print('==================================================')
    print('Stark Web Factory V2: PUBLIC redeploy')
    print('  Project: ',p,'| Region:',r)
    print('  Service: ',service)
    print('  Domain:  ',g.get('custom_domain') or '(none)')
    print('  Current revision (rollback target):',prev_rev)
    print('  Security decision:',c['release']['security_gate']['reference'])
    print('==================================================')
    dirty=git(repo,'status','--porcelain')
    if dirty:
        print('Uncommitted local changes WILL be included in this release:')
        for line in dirty.splitlines()[:25]:print('   ',line)
        if len(dirty.splitlines())>25:print('    ... and',len(dirty.splitlines())-25,'more')
    else:print('Working tree is clean: deploying commit',git(repo,'rev-parse','--short=12','HEAD'))
    if not assume_yes:
        try:answer=input('Type DEPLOY PUBLIC '+service+' to build the CURRENT repository and redeploy: ').strip()
        except EOFError:answer=''
        require(answer=='DEPLOY PUBLIC '+service,'operator did not approve redeployment; nothing was changed')
    with tempfile.TemporaryDirectory(prefix='stark-wfv2-release-') as work:
        stage=pathlib.Path(work)/'stage';stage.mkdir()
        head,count=stage_source(repo,stage)
        print('Staged',count,'source files from the current working tree.')
        upload_guard(repo,stage)
        image=f"{r}-docker.pkg.dev/{p}/{g['artifact_repository']}/{service}"
        tag=f'{head}-{int(time.time())}'
        bid,dig=build_and_digest(c,stage,image,tag)
    print('Immutable image:',image+'@'+dig)
    env=','.join(k+'='+v for k,v in sorted(c['runtime_env'].items()))
    secrets=','.join(k+'='+v['name']+':'+str(v['version']) for k,v in sorted(c['secret_bindings'].items()))
    require(all('=' not in v for v in c['runtime_env'].values()),'unsafe env comma/equals escaping; review')
    mech='--allow-unauthenticated' if g['public_access']=='allusers-invoker' else '--no-invoker-iam-check'
    flags=['--image='+image+'@'+dig,'--project='+p,'--region='+r,'--platform=managed',mech,
           '--service-account='+g['runtime_service_account'],'--port=8080','--memory='+g.get('memory','1Gi'),
           '--min-instances='+str(g.get('min_instances',0)),'--max-instances='+str(g.get('max_instances',1)),
           '--set-env-vars='+env,'--set-secrets='+secrets,'--quiet']
    if g.get('cpu_always_allocated'):flags+=['--no-cpu-throttling']
    if g.get('startup_probe_path'):flags+=['--startup-probe=httpGet.path='+g['startup_probe_path']+',httpGet.port=8080,periodSeconds=5,failureThreshold=24,timeoutSeconds=4']
    print('Deploying new revision to',service,'...')
    run('gcloud','run','deploy',service,*flags,show_error=True)
    # If traffic was pinned by an earlier rollback, a new revision would otherwise receive 0%.
    run('gcloud','run','services','update-traffic',service,'--project='+p,'--region='+r,'--to-latest','--quiet',show_error=True)
    after=gcloud_json('run','services','describe',service,'--project='+p,'--region='+r)
    new_rev=after.get('status',{}).get('latestReadyRevisionName','unknown')
    url=after.get('status',{}).get('url','')
    serving=[t.get('revisionName') for t in after.get('status',{}).get('traffic',[]) if t.get('percent')==100]
    rollback='gcloud run services update-traffic '+service+' --project='+p+' --region='+r+' --to-revisions='+prev_rev+'=100'
    def summary(status):
        print('==================================================')
        print('STATUS:',status)
        print('  Cloud Build ID: ',bid)
        print('  Image digest:   ',dig)
        print('  Revision:       ',new_rev,'(previous: '+prev_rev+')')
        print('  Cloud Run URL:  ',url)
        if g.get('custom_domain'):print('  Public URL:      https://'+g['custom_domain'])
        print('  Rollback:       ',rollback)
        print('  (the next ./deploy.sh sends traffic to its new revision again)')
        print('==================================================')
    if not url.startswith('https://') or serving!=[new_rev]:
        summary('FAILED - the new revision is not serving 100% of traffic');return 1
    if not public_readback(c):
        summary('FAILED - Cloud Run public invocation is NOT in effect (organization policy or permission). Service left in place; do not treat as deployed.');return 1
    print('Cloud Run public invocation readback: PASS')
    rc=public_verify(repo,c,url)
    if rc==0:summary('PUBLIC DEPLOYMENT VERIFIED');return 0
    if rc==3:summary('DEPLOYMENT INCOMPLETE - service is public and healthy, custom domain is not serving valid HTTPS yet. Re-check the domain mapping/certificate, then run ./deploy.sh --verify-only');return 3
    summary('FAILED - anonymous public verification did not pass (see checks above). The new revision is live; roll back with the command below if needed.');return 1

def verify_only(repo,c):
    actor(c);g=c['gcp']
    url=run('gcloud','run','services','describe',g['service'],'--project='+g['project_id'],'--region='+g['region'],'--format=value(status.url)',out=True)
    require(url.startswith('https://'),'public run.app URL missing')
    require(public_readback(c),'Cloud Run public invocation is not in effect')
    rc=public_verify(repo,c,url)
    print('STATUS:',{0:'PUBLIC DEPLOYMENT VERIFIED',3:'DEPLOYMENT INCOMPLETE (custom domain HTTPS)'}.get(rc,'FAILED'))
    return rc if rc in (0,3) else 1

def main():
    ap=argparse.ArgumentParser(description='Repo-local public Cloud Run redeploy runner')
    ap.add_argument('action',choices=['init','deploy']);ap.add_argument('--repo',required=True)
    ap.add_argument('--yes',action='store_true',help='skip the typed confirmation (unattended use)')
    ap.add_argument('--verify-only',action='store_true',help='no build or deploy: rerun the anonymous public verification only')
    args=ap.parse_args();repo=pathlib.Path(args.repo).resolve()
    try:
        c=cfg(repo)
        if args.action=='init':return init(repo,c)
        if args.verify_only:return verify_only(repo,c)
        return deploy(repo,c,args.yes)
    except Blocked as e:
        print(str(e),file=sys.stderr);return 2
    except (Failed,ValueError,KeyError,subprocess.CalledProcessError) as e:
        print('STATUS: FAILED -',str(e),file=sys.stderr);return 1
    except KeyboardInterrupt:
        print('\nInterrupted. If a build was already submitted it continues in Cloud Build but is NOT deployed.',file=sys.stderr);return 1
if __name__=='__main__':sys.exit(main())
