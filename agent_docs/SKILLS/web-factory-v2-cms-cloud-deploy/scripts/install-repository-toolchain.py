#!/usr/bin/env python3
"""Install the four persistent deployment deliverables into a *website repo*.

Operator-reviewed Dockerfile, cloudbuild.yaml, and project JSON are REQUIRED:
we do not invent a CMS Dockerfile from an unrelated example. No cloud actions.
Existing files are preserved unless --replace-reviewed is explicitly specified.
"""
import argparse,hashlib,json,os,pathlib,shutil,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--repo',required=True)
    p.add_argument('--config',required=True,help='approved project-specific deployment JSON (no secret values)')
    p.add_argument('--dockerfile',required=True,help='reviewed CMS Dockerfile, can be existing repo file')
    p.add_argument('--cloudbuild',required=True,help='reviewed protected-build Cloud Build YAML')
    p.add_argument('--replace-reviewed',action='store_true',help='explicitly replace existing reviewed artifact files')
    a=p.parse_args()
    repo=pathlib.Path(a.repo).resolve();require=lambda b,s: b or sys.exit('BLOCKED: '+s)
    require((repo/'.git').exists(),'target must be Git checkout containing .git')
    require((repo/'package.json').exists(),'target lacks package.json')
    conf=pathlib.Path(a.config).resolve();docker=pathlib.Path(a.dockerfile).resolve();cloud=pathlib.Path(a.cloudbuild).resolve()
    for f in (conf,docker,cloud):require(f.is_file(),'missing approved input '+str(f))
    result=subprocess.run([sys.executable,str(ROOT/'scripts'/'validate-config.py'),'--config',str(conf)],capture_output=True,text=True)
    require(result.returncode==0,'config invalid; see validate-config.py (do not install)')
    c=json.loads(conf.read_text());require(pathlib.Path(c['app']['repository']).resolve()==repo,'config.app.repository must identify actual repo')
    dt=docker.read_text();ct=cloud.read_text()
    require('FROM ' in dt and ('server.js' in dt or 'next start' in dt),'Dockerfile requires reviewed server runtime')
    if c['build']['profile']=='protected-buildkit':
        require('--mount=type=secret' in dt and 'required=true' in dt,'protected Dockerfile lacks required secret mount')
        require('availableSecrets' in ct and 'secretEnv' in ct and 'DOCKER_BUILDKIT=1' in ct,'protected cloudbuild missing secret handling')
    require('_IMAGE' in ct and '_PRODUCT_SHA' in ct,'cloudbuild must support immutable tagged build for repo-local runner')
    require('$BUILD_ID' in ct,'cloudbuild must tag with $BUILD_ID for immutable digest lookup')
    require('gcloud run deploy' not in ct and 'run", "deploy' not in ct,'Cloud Build must only BUILD/PUSH; deployment is operator-run')
    # Do not place accepted values in an unreviewed env or write secrets.
    files={
       'Dockerfile':docker.read_bytes(),
       'cloudbuild.yaml':cloud.read_bytes(),
       'stark-deploy.json':conf.read_bytes(),
       'init-app.sh':(ROOT/'templates'/'repository-init-app.sh').read_bytes(),
       'deploy.sh':(ROOT/'templates'/'repository-deploy.sh').read_bytes(),
       '.dockerignore':(repo/'.dockerignore').read_bytes() if (repo/'.dockerignore').exists() else (ROOT/'templates'/'.dockerignore').read_bytes(),
       '.gcloudignore':(repo/'.gcloudignore').read_bytes() if (repo/'.gcloudignore').exists() else (ROOT/'templates'/'.gcloudignore').read_bytes(),
       'ops/redeploy.py':(ROOT/'scripts'/'redeploy.py').read_bytes(),
       'ops/check-upload.sh':(ROOT/'scripts'/'check-upload.sh').read_bytes(),
       'ops/verify-runtime.py':(ROOT/'scripts'/'verify-runtime.py').read_bytes(),
    }
    needs=[name for name,data in files.items() if not (repo/name).exists() or (repo/name).read_bytes()!=data]
    conflicts=[name for name in needs if (repo/name).exists()]
    if conflicts and not a.replace_reviewed:
        print('BLOCKED: existing artifacts differ; inspect and pass --replace-reviewed explicitly:',', '.join(conflicts));return 2
    for name in needs:
        dest=repo/name;dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(files[name])
        if name.endswith('.sh') or name=='ops/redeploy.py':dest.chmod(0o750)
    for name in ('Dockerfile','cloudbuild.yaml','init-app.sh','deploy.sh'):
        require((repo/name).is_file(),'missing permanent deliverable '+name)
    for name in ('init-app.sh','deploy.sh','ops/check-upload.sh'):
        t=subprocess.run(['bash','-n',str(repo/name)],capture_output=True,text=True)
        require(t.returncode==0,'invalid shell syntax: '+name)
    print('INSTALLED/VERIFIED:',len(files),'repo-local artifacts; changed:',len(needs))
    print('PERMANENT FOUR:',', '.join(('Dockerfile','cloudbuild.yaml','init-app.sh','deploy.sh')))
    print('SOURCE CONTROL REQUIRED: review git diff; commit all non-secret deployment files after tests.')
    print('OPERATOR REDEPLOY: after cloud setup, run ./deploy.sh from this repo (no skill folder required).')
    print('NO CLOUD WRITES PERFORMED.')
    return 0
if __name__=='__main__':sys.exit(main())
