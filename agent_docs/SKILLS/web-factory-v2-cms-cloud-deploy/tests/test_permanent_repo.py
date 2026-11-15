"""Offline tests for Director's permanent four-file repository contract."""
import json,os,pathlib,subprocess,sys,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
class PermanentRepositoryTests(unittest.TestCase):
 def test_historical_four_verbatim_present(self):
  for folder,names in [('field-proven-four-files',('Dockerfile.txt','cloudbuild.yaml','init-app.sh','deploy.sh')),
                       ('app-skill-v1.3-proven',('Dockerfile','cloudbuild.yaml','init-app.sh','deploy.sh'))]:
   for name in names:self.assertTrue((ROOT/'examples'/folder/name).is_file(),(folder,name))
 def test_portable_entrypoints(self):
  for name in ('repository-deploy.sh','repository-init-app.sh'):
   r=subprocess.run(['bash','-n',str(ROOT/'templates'/name)],capture_output=True,text=True)
   self.assertEqual(r.returncode,0,r.stderr)
  for name in ('redeploy.py','install-repository-toolchain.py'):
   r=subprocess.run([sys.executable,'-m','py_compile',str(ROOT/'scripts'/name)],capture_output=True,text=True)
   self.assertEqual(r.returncode,0,r.stderr)
  t=(ROOT/'templates'/'repository-deploy.sh').read_text()
  self.assertIn('$ROOT/ops/redeploy.py',t)
  self.assertNotIn('/home/',t)
 def test_runner_mandates_four_and_public(self):
  t=(ROOT/'scripts'/'redeploy.py').read_text()
  for name in ('Dockerfile','cloudbuild.yaml','init-app.sh','deploy.sh','--allow-unauthenticated','PUBLIC DEPLOYMENT VERIFIED','verify-runtime.py','check-upload.sh'):
   self.assertIn(name,t if name in ('Dockerfile','cloudbuild.yaml','--allow-unauthenticated','PUBLIC DEPLOYMENT VERIFIED','verify-runtime.py','check-upload.sh') else (t+(ROOT/'scripts'/'install-repository-toolchain.py').read_text()))
 def test_example_env_corrected(self):
  self.assertEqual(json.loads((ROOT/'templates'/'deployment-config.example.json').read_text())['runtime_env']['APP_ENV'],'preview')
 def test_install_into_disposable_repo(self):
  with tempfile.TemporaryDirectory() as td:
   repo=pathlib.Path(td)/'app';repo.mkdir()
   subprocess.run(['git','init','-q',str(repo)],check=True)
   (repo/'package.json').write_text('{"name":"demo"}')
   docker=repo/'example.Dockerfile';docker.write_text('FROM node:22\nRUN --mount=type=secret,id=DATABASE_URL,required=true true\nCMD ["node","server.js"]\n')
   cloud=repo/'example.cloudbuild.yaml';cloud.write_text('steps:\n- name: example\n  secretEnv: ["X"]\n  args: ["DOCKER_BUILDKIT=1", "${_IMAGE}:${_PRODUCT_SHA}-$BUILD_ID"]\navailableSecrets: {}\n')
   from importlib.machinery import SourceFileLoader
   validate=SourceFileLoader('check',str(ROOT/'scripts'/'validate-config.py')).load_module()
   c={
    'app':{'name':'test-site','repository':str(repo),'next_dist_dir':'.next'},
    'gcp':{'project_id':'demo-project-123','region':'us-east1','service':'test-site','artifact_repository':'web-factory','expected_operator':'tester@example.org','runtime_service_account':'runtime@demo-project-123.iam.gserviceaccount.com','build_service_account':'build@demo-project-123.iam.gserviceaccount.com','public_access':'allusers-invoker','custom_domain':'demo.invalid','max_instances':1,'min_instances':0,'memory':'1Gi'},
    'runtime_env':{'APP_ENV':'preview','DATABASE_KIND':'turso','MEDIA_STORAGE':'r2','R2_BUCKET':'test-bucket'},
    'secret_bindings':{k:{'name':'demo-'+k.lower().replace('_','-'),'version':'1'} for k in ['DATABASE_URL','DATABASE_AUTH_TOKEN','PAYLOAD_SECRET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY']},
    'build':{'profile':'protected-buildkit'},
    'release':{'security_gate':{'status':'director-exception','reference':'Director decision WFV2-001','expires_on':'2099-12-31'}},
    'public_verification':{'paths':['/blog'],'article_path':'/blog/example','revalidate_seconds':30}}
   self.assertEqual(validate.validate(c)[0],[])
   cfg=pathlib.Path(td)/'config.json';cfg.write_text(json.dumps(c))
   cmd=[sys.executable,str(ROOT/'scripts'/'install-repository-toolchain.py'),'--repo',str(repo),'--config',str(cfg),'--dockerfile',str(docker),'--cloudbuild',str(cloud)]
   r=subprocess.run(cmd,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stdout+r.stderr)
   for name in ('Dockerfile','cloudbuild.yaml','init-app.sh','deploy.sh','stark-deploy.json','ops/redeploy.py','ops/check-upload.sh','ops/verify-runtime.py'):
    self.assertTrue((repo/name).is_file(),name)
   r=subprocess.run(cmd,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stdout+r.stderr)
   (repo/'Dockerfile').write_text('CHANGED')
   r=subprocess.run(cmd,capture_output=True,text=True);self.assertNotEqual(r.returncode,0)
if __name__=='__main__':unittest.main(verbosity=2)
