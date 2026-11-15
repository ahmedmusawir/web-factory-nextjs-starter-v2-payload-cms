#!/usr/bin/env python3
"""Offline regression for portable skill helpers; NEVER interacts with real Cloud services."""
import http.server,importlib.util,json,os,re,subprocess,sys,tempfile,threading,unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SCRIPTS=ROOT/'scripts'

def good_config(repo='/some/repo',**gcp):
    return {
      'app':{'name':'demo-payload','repository':str(repo),'next_dist_dir':'.next'},
      'gcp':{'project_id':'demo-website-001','region':'us-east1','service':'demo-site','artifact_repository':'website-images','expected_operator':'operator@example.org',
             'runtime_service_account':'site-runtime@demo-website-001.iam.gserviceaccount.com','build_service_account':'site-build@demo-website-001.iam.gserviceaccount.com',
             'public_access':'allusers-invoker','custom_domain':'www.demo-site.invalid','min_instances':0,'max_instances':1,'memory':'1Gi',**gcp},
      'runtime_env':{'APP_ENV':'staging','DATABASE_KIND':'turso','MEDIA_STORAGE':'r2','R2_BUCKET':'demo-bucket'},
      'secret_bindings':{k:{'name':'demo-'+k.lower().replace('_','-'),'version':'7'} for k in ['DATABASE_URL','DATABASE_AUTH_TOKEN','PAYLOAD_SECRET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY']},
      'release':{'security_gate':{'status':'cleared','reference':'QA report 12 and security review 7'}},
      'public_verification':{'paths':['/blog'],'article_path':'/blog/post','revalidate_seconds':30},
      'build':{'profile':'runtime-only'}}

IAM_BODY='<html><head><title>403 Forbidden</title></head><body><h1>Error: Forbidden</h1><h2>Your client does not have permission to get URL <code>/</code> from this server.</h2></body></html>'

def site(mode):
    """Local stand-in for a deployed site. mode: public | iam | open-admin. Records every request's headers."""
    seen=[]
    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self,*a):pass
        def send(self,code,body,ctype='text/html; charset=utf-8',extra=None):
            data=body.encode();self.send_response(code);self.send_header('Content-Type',ctype);self.send_header('Content-Length',str(len(data)))
            for k,v in (extra or {}).items():self.send_header(k,v)
            self.end_headers();self.wfile.write(data)
        def handle_any(self,method):
            seen.append((method,self.path,dict(self.headers)))
            if method=='POST':self.rfile.read(int(self.headers.get('Content-Length') or 0))
            if mode=='iam':return self.send(403,IAM_BODY)
            isr={'Cache-Control':'s-maxage=30, stale-while-revalidate=31535970','x-nextjs-cache':'HIT'}
            denied=json.dumps({'errors':[{'message':'You are not allowed to perform this action.'}]})
            if self.path=='/':return self.send(200,'<html><img src="/img.png"><script src="/_next/static/a.js"></script></html>',extra=isr)
            if self.path in('/blog','/blog/post'):return self.send(200,'<html>blog</html>',extra=isr)
            if self.path in('/img.png','/_next/static/a.js'):return self.send(200,'x','application/octet-stream')
            if self.path=='/admin/login':return self.send(200,'<html>login</html>',extra={'Cache-Control':'private, no-cache, no-store, max-age=0, must-revalidate'})
            if self.path=='/api/users':
                if mode=='open-admin':return self.send(201 if method=='POST' else 200,'{"docs":[]}','application/json')
                return self.send(403,denied,'application/json')
            return self.send(404,'not found')
        def do_GET(self):self.handle_any('GET')
        def do_POST(self):self.handle_any('POST')
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),H)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    return server,'http://127.0.0.1:%d'%server.server_address[1],seen

def run(*args,cwd=None,env=None):
    return subprocess.run(list(map(str,args)),cwd=cwd,env=env,text=True,capture_output=True,timeout=90)

class OfflineSkillTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.d=Path(self.tmp.name)
    def validate(self,config):
        path=self.d/'config.json';path.write_text(json.dumps(config))
        return run(sys.executable,SCRIPTS/'validate-config.py','--config',path)
    def test_config_good_and_secret_in_public_rejected(self):
        config=good_config()
        r=self.validate(config)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertIn('PUBLIC ACCESS: allusers-invoker',r.stdout)
        config['runtime_env']['PAYLOAD_SECRET']='SECRET_SHOULD_NOT_PASS'
        r=self.validate(config)
        self.assertNotEqual(r.returncode,0);self.assertNotIn('SECRET_SHOULD_NOT_PASS',r.stdout+r.stderr)
        self.assertIn('likely secret',r.stdout)
    def test_private_deployment_cannot_be_configured_or_defaulted(self):
        # no public_access -> blocked: public access is never implied and private is never the default
        c=good_config();del c['gcp']['public_access']
        r=self.validate(c);self.assertNotEqual(r.returncode,0);self.assertIn('public_access is required',r.stdout)
        for bad in ('private','none','internal',''):
            r=self.validate(good_config(public_access=bad));self.assertNotEqual(r.returncode,0,bad)
        # the v1.0 field can no longer select a private service
        r=self.validate(good_config(visibility='private'));self.assertNotEqual(r.returncode,0);self.assertIn('websites are public',r.stdout)
        c=good_config();c['gcp']['visibility']='private';del c['gcp']['public_access']
        self.assertNotEqual(self.validate(c).returncode,0)
        self.assertEqual(self.validate(good_config(public_access='invoker-iam-disabled')).returncode,0)
        # the shipped example must not carry a private setting or a silently usable default
        example=json.loads((ROOT/'templates'/'deployment-config.example.json').read_text())
        self.assertNotIn('visibility',example['gcp']);self.assertNotIn(example['gcp']['public_access'],('allusers-invoker','invoker-iam-disabled','private'))
        self.assertNotEqual(self.validate(example).returncode,0)
    def test_custom_domain_and_security_gate_are_required(self):
        c=good_config();del c['gcp']['custom_domain']
        r=self.validate(c);self.assertNotEqual(r.returncode,0);self.assertIn('custom_domain is required',r.stdout)
        for bad in ('https://www.demo-site.invalid','www.demo-site.invalid/path','localhost'):
            self.assertNotEqual(self.validate(good_config(custom_domain=bad)).returncode,0,bad)
        r=self.validate(good_config(custom_domain=None));self.assertEqual(r.returncode,0,r.stdout);self.assertIn('No custom domain configured',r.stdout)
        c=good_config();del c['release']
        r=self.validate(c);self.assertNotEqual(r.returncode,0);self.assertIn('security_gate',r.stdout)
        c=good_config();c['release']['security_gate']={'status':'director-exception','reference':''}
        self.assertNotEqual(self.validate(c).returncode,0)   # an exception needs its approval record
        c=good_config();c['release']['security_gate']={'status':'blocked'}
        r=self.validate(c);self.assertEqual(r.returncode,0,r.stdout);self.assertIn('BLOCKED',r.stdout);self.assertIn('not a substitute',r.stdout)
        same=good_config();same['gcp']['build_service_account']=same['gcp']['runtime_service_account']
        self.assertNotEqual(self.validate(same).returncode,0)
    def test_secret_helper_never_displays_secret_even_on_upload(self):
        envfile=self.d/'.env.local';envfile.write_text('DATABASE_AUTH_TOKEN="TOKEN_ALEX_123_SECRET"\nR2_SECRET_ACCESS_KEY=R2_SUPER_SECRET\n')
        mapping=self.d/'mapping.json';mapping.write_text(json.dumps({'bindings':[{'env':'DATABASE_AUTH_TOKEN','name':'demo-turso-token'},{'env':'R2_SECRET_ACCESS_KEY','name':'demo-r2-secret'}]}))
        binary=self.d/'bin';binary.mkdir();gcloud=binary/'gcloud'
        capture=self.d/'capture'
        gcloud.write_text('#!/bin/sh\ncat >> "'+str(capture)+'"\nprintf \'{"name":"projects/10/secrets/demo/versions/7"}\\n\'\n')
        gcloud.chmod(0o700)
        cmd=[sys.executable,str(SCRIPTS/'operator-upload-secrets.py'),'--project','demo-website-001','--env-file',str(envfile),'--mapping',str(mapping)]
        r=run(*cmd)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertFalse(capture.exists(),'Dry run must not call gcloud')
        testenv={**os.environ,'PATH':str(binary)+':'+os.environ.get('PATH','')}
        r=run(*cmd,'--execute',env=testenv)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertIn('TOKEN_ALEX_123_SECRET',capture.read_text())
        for secret in ['TOKEN_ALEX_123_SECRET','R2_SUPER_SECRET']:
            self.assertNotIn(secret,r.stdout+r.stderr)
        self.assertIn('version 7',r.stdout)
    def test_upload_guard_clean_forbidden_and_failure(self):
        fixture=self.d/'fixture';fixture.write_text('package.json\nsrc/app/page.tsx\n')
        r=run('bash',SCRIPTS/'check-upload.sh',self.d,'--fixture-file',fixture)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        for name in ['config/.env.production.local','credentials-key.json','deploy/.npmrc','db/cache.sqlite']:
            fixture.write_text('package.json\n'+name+'\n')
            r=run('bash',SCRIPTS/'check-upload.sh',self.d,'--fixture-file',fixture)
            self.assertEqual(r.returncode,3,name+' '+r.stdout+r.stderr)
        fixture.write_text('')
        r=run('bash',SCRIPTS/'check-upload.sh',self.d,'--fixture-file',fixture)
        self.assertEqual(r.returncode,2)
    def init_git(self):
        repo=self.d/'repo';repo.mkdir();(repo/'src').mkdir()
        (repo/'package.json').write_text('{"name":"test","scripts":{"build":"next build"}}')
        (repo/'src'/'page.ts').write_text('export default 123;')
        (repo/'.gitignore').write_text('.env*\n')
        for cmd in [['init'],['config','user.email','agent@example.org'],['config','user.name','Agent'],['add','.'],['commit','-m','baseline']]:
            r=run('git',*cmd,cwd=repo)
            self.assertEqual(r.returncode,0,r.stderr)
        return repo
    def test_stage_clean_dirty_and_sensitive_tracked(self):
        repo=self.init_git();stage=self.d/'stage';manifest=self.d/'manifest.json'
        cmd=[sys.executable,str(SCRIPTS/'prepare-release.py'),'--repo',str(repo),'--stage',str(stage),'--manifest',str(manifest)]
        r=run(*cmd)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertTrue((stage/'src'/'page.ts').is_file());self.assertTrue(manifest.is_file())
        self.assertFalse((stage/'.git').exists())
        (repo/'src'/'page.ts').write_text('changed;')
        r=run(sys.executable,SCRIPTS/'prepare-release.py','--repo',repo,'--stage',self.d/'stage2','--manifest',self.d/'manifest2.json')
        self.assertNotEqual(r.returncode,0)
        r=run(sys.executable,SCRIPTS/'prepare-release.py','--repo',repo,'--stage',self.d/'stage2','--manifest',self.d/'manifest2.json','--include-reviewed-working-tree')
        self.assertEqual(r.returncode,0,r.stderr)
        self.assertTrue(json.loads((self.d/'manifest2.json').read_text())['reviewed_dirty_snapshot'])
        (repo/'.env.private').write_text('FOO=TOKEN');r=run('git','add','-f','.env.private',cwd=repo);self.assertEqual(r.returncode,0)
        r=run(sys.executable,SCRIPTS/'prepare-release.py','--repo',repo,'--stage',self.d/'stage3','--manifest',self.d/'manifest3.json','--include-reviewed-working-tree')
        self.assertNotEqual(r.returncode,0);self.assertIn('sensitive paths',r.stdout+r.stderr)
    def test_inspect_keeps_values_private(self):
        repo=self.init_git();(repo/'.env.local').write_text('DATABASE_AUTH_TOKEN=TOKEN_PRIVATE\nR2_BUCKET=examplebucket\n')
        r=run(sys.executable,SCRIPTS/'inspect-repo.py','--repo',repo)
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertIn('DATABASE_AUTH_TOKEN',r.stdout)
        self.assertNotIn('TOKEN_PRIVATE',r.stdout)

    def render(self,config,name):
        stage=self.d/'stage'
        if not stage.exists():stage.mkdir();(stage/'Dockerfile').write_text('FROM scratch\n');(stage/'cloudbuild.yaml').write_text('steps: []\n')
        cfg=self.d/(name+'.json');cfg.write_text(json.dumps(config));ops=self.d/name
        return run(sys.executable,SCRIPTS/'render-operator-scripts.py','--config',cfg,'--stage',stage,'--out',ops),ops
    def test_script_renderer_portable_and_no_cloud_calls(self):
        repo=self.init_git()
        r,ops=self.render(good_config(repo),'ops')
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        self.assertEqual({x.name for x in ops.iterdir()},{'init-app.sh','build.sh','deploy.sh','map-domain.sh','verify-public.sh'})
        for f in ops.iterdir():
            self.assertEqual(run('bash','-n',f).returncode,0)
            self.assertNotIn('TOKEN_ALEX_123_SECRET',f.read_text())
        self.assertIn('UPLOAD', (ops/'build.sh').read_text().upper())
        self.assertIn('--service-account="projects/$PROJECT/serviceAccounts/$BUILD_SA"',(ops/'build.sh').read_text())
        self.assertIn('demo-database-auth-token:7',(ops/'deploy.sh').read_text())
        config=good_config(repo);config['build']['profile']='protected-buildkit'
        self.assertNotEqual(self.render(config,'ops2')[0].returncode,0)
        config=good_config(repo);config['app']['next_dist_dir']='.next-mission003'
        self.assertNotEqual(self.render(config,'ops3')[0].returncode,0)
    def test_generated_deploy_configures_and_reads_back_public_invocation(self):
        repo=self.init_git()
        r,ops=self.render(good_config(repo),'pub')
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        deploy=(ops/'deploy.sh').read_text()
        self.assertIn("PUBLIC_ACCESS_FLAG=--allow-unauthenticated",deploy)
        self.assertRegex(deploy,r'gcloud run deploy [^\n]*\\\n(?:[^\n]*\\\n)*\s*"\$PUBLIC_ACCESS_FLAG"')   # the flag is on the deploy command itself
        self.assertNotIn('--no-allow-unauthenticated',deploy)
        self.assertIn('get-iam-policy',deploy);self.assertIn('bindings.members=allUsers',deploy)          # independent readback
        self.assertIn('DEPLOY PUBLIC $SERVICE',deploy)
        for name in ('deploy.sh','verify-public.sh'):                                                      # anonymous verification of both URLs
            body=(ops/name).read_text()
            self.assertIn('verify-runtime.py',body);self.assertIn('--service-url "$URL"',body)
            self.assertIn('--custom-domain-url https://www.demo-site.invalid',body);self.assertIn('--expect-revalidate 30',body)
        self.assertIn('domain-mappings create --service "$SERVICE" --domain "$DOMAIN"',(ops/'map-domain.sh').read_text())
        r,ops=self.render(good_config(repo,public_access='invoker-iam-disabled'),'pub2')
        deploy=(ops/'deploy.sh').read_text()
        self.assertIn('PUBLIC_ACCESS_FLAG=--no-invoker-iam-check',deploy);self.assertIn('invoker-iam-disabled',deploy);self.assertNotIn('--no-allow-unauthenticated',deploy)
        r,ops=self.render(good_config(repo,custom_domain=None),'pub3')
        self.assertFalse((ops/'map-domain.sh').exists());self.assertIn('--no-custom-domain',(ops/'verify-public.sh').read_text())
        # a private deployment cannot be rendered at all
        self.assertNotEqual(self.render(good_config(repo,visibility='private'),'priv')[0].returncode,0);self.assertFalse((self.d/'priv').exists())
        bad=good_config(repo);del bad['gcp']['public_access']
        self.assertNotEqual(self.render(bad,'priv2')[0].returncode,0)
        # nothing generated may carry credentials into a public check
        for d in ('pub','pub2','pub3'):
            for f in (self.d/d).iterdir():
                self.assertNotRegex(f.read_text(),r'(?i)authorization:|print-identity-token|services proxy|--token')
    def fake_gcloud(self,public,url):
        """Stand-in gcloud: records calls, never touches a cloud. `public` controls what the invoker readback returns."""
        binary=self.d/'fakebin';binary.mkdir(exist_ok=True);log=self.d/'gcloud.log';marker=self.d/'deployed'
        (binary/'gcloud').write_text(f"""#!/bin/sh
echo "$*" >> "{log}"
case "$*" in
  "auth list"*) echo operator@example.org ;;
  "run deploy"*) touch "{marker}" ;;
  "run services get-iam-policy"*) printf '%s' "{public}" ;;
  "run services describe"*) [ -f "{marker}" ] || exit 1; case "$*" in *status.url*) echo "{url}" ;; *) echo ok ;; esac ;;
esac
""");(binary/'gcloud').chmod(0o700)
        return {**os.environ,'PATH':str(binary)+':'+os.environ.get('PATH','')},log
    def deploy(self,ops,env,answer='DEPLOY PUBLIC demo-site\n'):
        image='us-east1-docker.pkg.dev/demo-website-001/website-images/demo-site@sha256:'+'a'*64
        return subprocess.run(['bash',str(ops/'deploy.sh'),image],input=answer,env=env,text=True,capture_output=True,timeout=90)
    def test_blocked_security_gate_stops_public_deploy_without_private_fallback(self):
        config=good_config(self.init_git());config['release']['security_gate']={'status':'blocked'}
        r,ops=self.render(config,'gate');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        env,log=self.fake_gcloud('allUsers','http://127.0.0.1:9')
        r=self.deploy(ops,env)
        self.assertEqual(r.returncode,2,r.stdout+r.stderr);self.assertIn('BLOCKED',r.stdout);self.assertIn('not a fallback',r.stdout)
        self.assertNotIn('run deploy',log.read_text())                       # nothing was deployed, privately or otherwise
    def test_deploy_fails_closed_when_public_invocation_is_refused(self):
        server,url,_=site('public');self.addCleanup(server.server_close);self.addCleanup(server.shutdown)
        r,ops=self.render(good_config(self.init_git()),'refused');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        env,log=self.fake_gcloud('',url)                                   # e.g. organization policy refused allUsers; deploy still exited 0
        r=self.deploy(ops,env)
        self.assertEqual(r.returncode,4,r.stdout+r.stderr);self.assertIn('STATUS: BLOCKED',r.stdout)
        self.assertIn('run deploy',log.read_text());self.assertNotIn('PUBLICLY VERIFIED',r.stdout)
    def test_deploy_reports_incomplete_until_custom_domain_serves_https(self):
        server,url,seen=site('public');self.addCleanup(server.server_close);self.addCleanup(server.shutdown)
        r,ops=self.render(good_config(self.init_git()),'incomplete');self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        env,log=self.fake_gcloud('allUsers',url)
        r=self.deploy(ops,env)
        self.assertEqual(r.returncode,3,r.stdout+r.stderr)                    # service public and healthy, custom domain not serving yet
        self.assertIn('DEPLOYMENT INCOMPLETE',r.stdout);self.assertNotIn('DEPLOYMENT PUBLICLY VERIFIED',r.stdout)
        self.assertRegex(log.read_text(),r'run deploy [^\n]*--allow-unauthenticated')
        self.assertTrue(seen)
    # ---- anonymous public verification
    def verify(self,*args):
        return run(sys.executable,SCRIPTS/'verify-runtime.py',*args)
    def test_verify_passes_public_site_and_sends_no_credentials(self):
        server,url,seen=site('public');self.addCleanup(server.server_close);self.addCleanup(server.shutdown)
        env_backup=dict(os.environ);os.environ.update({'CLOUDSDK_AUTH_ACCESS_TOKEN':'TOKEN_MUST_NOT_BE_SENT','GOOGLE_ID_TOKEN':'TOKEN_MUST_NOT_BE_SENT'})
        self.addCleanup(lambda:(os.environ.clear(),os.environ.update(env_backup)))
        r=self.verify('--service-url',url,'--no-custom-domain','--path','/blog','--article-path','/blog/post','--expect-revalidate','30','--require-images')
        self.assertEqual(r.returncode,0,r.stdout+r.stderr)
        for needle in ('Homepage returns 200 anonymously','Public images load','Static assets load','Admin login page reachable','Admin login page is not publicly cached','Protected endpoint enforces application authentication','Unauthorized CMS write rejected by the application','30-second ISR headers'):
            self.assertRegex(r.stdout,r'PASS\s+'+re.escape(needle))
        self.assertNotIn('PUBLIC ACCESS VERIFIED',r.stdout)                  # loopback is never evidence about a deployment
        self.assertTrue(any(m=='POST' and p=='/api/users' for m,p,_ in seen))
        for method,path,headers in seen:
            lower={k.lower():v for k,v in headers.items()}
            for forbidden in ('authorization','cookie','proxy-authorization','x-serverless-authorization'):
                self.assertNotIn(forbidden,lower,path)
            self.assertNotIn('TOKEN_MUST_NOT_BE_SENT',json.dumps(headers))
    def test_cloud_run_iam_denial_is_a_deployment_failure(self):
        server,url,_=site('iam');self.addCleanup(server.server_close);self.addCleanup(server.shutdown)
        r=self.verify('--service-url',url,'--no-custom-domain')
        self.assertEqual(r.returncode,1,r.stdout+r.stderr)
        self.assertIn('CLOUD RUN IAM DENIAL',r.stdout);self.assertIn('DEPLOYMENT FAILURE',r.stdout);self.assertIn('STATUS: FAILED',r.stdout)
        self.assertIn('do not fall back to a private service',r.stdout);self.assertIn('Recovery:',r.stdout)
    def test_admin_and_api_authentication_must_remain_enforced(self):
        server,url,_=site('open-admin');self.addCleanup(server.server_close);self.addCleanup(server.shutdown)
        r=self.verify('--service-url',url,'--no-custom-domain')
        self.assertEqual(r.returncode,1,r.stdout+r.stderr)
        self.assertRegex(r.stdout,r'FAIL\s+Unauthorized CMS write rejected by the application');self.assertRegex(r.stdout,r'FAIL\s+Protected endpoint enforces application authentication')
        spec=importlib.util.spec_from_file_location('verify_runtime',SCRIPTS/'verify-runtime.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
        self.assertEqual(mod.classify_denial(403,{'Content-Type':'application/json'},'{"errors":[{"message":"no"}]}'),'application')   # expected for CMS writes
        self.assertEqual(mod.classify_denial(403,{'Content-Type':'text/html'},IAM_BODY),'cloud-run-iam')                                # deployment failure
        self.assertEqual(mod.classify_denial(401,{'Content-Type':'text/html','WWW-Authenticate':'Bearer error="invalid_token"'},''),'cloud-run-iam')
        self.assertEqual(mod.classify_denial(403,{'Content-Type':'text/plain'},'nope'),'unclassified')
    def test_custom_domain_https_is_checked_and_required(self):
        server,url,_=site('public');self.addCleanup(server.server_close);self.addCleanup(server.shutdown)
        r=self.verify('--service-url',url)                                   # the custom-domain decision cannot be skipped
        self.assertEqual(r.returncode,2);self.assertIn('--custom-domain-url',r.stderr)
        r=self.verify('--service-url',url,'--custom-domain-url','http://www.demo-site.invalid')
        self.assertEqual(r.returncode,2);self.assertIn('HTTPS',r.stderr)     # plain HTTP is not an acceptable public origin
        r=self.verify('--service-url',url,'--custom-domain-url','https://www.demo-site.invalid')
        self.assertEqual(r.returncode,3,r.stdout+r.stderr);self.assertIn('STATUS: DEPLOYMENT INCOMPLETE',r.stdout);self.assertIn('Do not report success',r.stdout)
        source=(SCRIPTS/'verify-runtime.py').read_text()
        self.assertIn('ssl.create_default_context()',source);self.assertIn('getpeercert',source)
    def test_verifier_has_no_authenticated_mode(self):
        server,url,_=site('public');self.addCleanup(server.server_close);self.addCleanup(server.shutdown)
        for flag in (['--token-env','X'],['--token','X'],['--header','Authorization: Bearer X'],['--identity-token','X']):
            r=self.verify('--service-url',url,'--no-custom-domain',*flag);self.assertEqual(r.returncode,2,flag)
        r=self.verify('--service-url','https://user:pw@example.invalid','--no-custom-domain');self.assertEqual(r.returncode,2)
        source=(SCRIPTS/'verify-runtime.py').read_text()
        for word in ('Authorization','Bearer \'','os.environ','getenv','Cookie'):
            self.assertNotIn(word,source,word)
    # ---- whole-skill audits
    def skill_files(self):
        return [f for f in ROOT.rglob('*') if f.is_file() and '__pycache__' not in f.parts and f.suffix in ('.md','.json','.yaml','.py','.sh','') and f.name!='PACKAGE_SHA256SUMS.txt']
    def test_no_obsolete_private_first_instructions_remain(self):
        obsolete=re.compile(r'(?i)--no-allow-unauthenticated|private[- ]first|private preview|private (cloud run )?(service|invoker|url|deployment)|preview service|services proxy|identity token|token-env|"visibility"\s*:\s*"private"|deploy(ed|ing)? privately')
        negation=re.compile(r"(?i)\b(never|not|no|cannot|without|revoked|removed|rejected|refuse[sd]?|isn't|don't|doesn't)\b")
        offenders=[]
        for f in self.skill_files():
            if f==Path(__file__).resolve():continue
            for n,line in enumerate(f.read_text(errors='replace').splitlines(),1):
                if obsolete.search(line) and not negation.search(line):offenders.append(f'{f.relative_to(ROOT)}:{n}: {line.strip()[:120]}')
        self.assertEqual(offenders,[],'\n'.join(offenders))
        self.assertNotIn('--no-allow-unauthenticated',''.join(f.read_text(errors='replace') for f in (ROOT/'scripts').iterdir() if f.is_file()))
    def test_entry_points_identical_and_state_public_doctrine(self):
        claude=(ROOT/'CLAUDE.md').read_text();self.assertEqual(claude,(ROOT/'AGENTS.md').read_text())
        for doc in (claude,(ROOT/'SKILL.md').read_text(),(ROOT/'README.md').read_text()):
            self.assertRegex(doc,r'(?i)public (website )?by default|deployment = public website')
            self.assertIn('PUBLIC-DEPLOYMENT-CONTRACT.md',doc)
        self.assertIn('v1.1',claude);self.assertRegex(claude,r'(?i)security release gate')
        contract=(ROOT/'references'/'PUBLIC-DEPLOYMENT-CONTRACT.md').read_text()
        for item in 'ABCDEFGHIJKL':self.assertRegex(contract,r'\n\| '+item+r' \|')
        for status in ('PUBLIC ACCESS VERIFIED','DEPLOYMENT INCOMPLETE','FAILED','BLOCKED'):self.assertIn(status,contract)
    def test_reusable_logic_is_location_independent(self):
        text=''.join(f.read_text(errors='replace') for d in ('scripts','templates') for f in (ROOT/d).iterdir() if f.is_file())
        for needle in ('cyberize','cyber-cms','/home/','moose'):
            self.assertNotIn(needle,text.lower().replace('.next-mission003',''),needle)
    def test_package_checksums_match(self):
        listed={}
        for line in (ROOT/'PACKAGE_SHA256SUMS.txt').read_text().splitlines():
            digest,name=line.split(None,1);listed[name.strip()]=digest
        import hashlib
        actual={str(f.relative_to(ROOT)):hashlib.sha256(f.read_bytes()).hexdigest() for f in ROOT.rglob('*') if f.is_file() and '__pycache__' not in f.parts and f.name!='PACKAGE_SHA256SUMS.txt'}
        self.assertEqual(listed,actual)

if __name__=='__main__':unittest.main(verbosity=2)
