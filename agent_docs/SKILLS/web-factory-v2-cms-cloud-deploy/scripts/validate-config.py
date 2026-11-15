#!/usr/bin/env python3
"""Validate deployment config without cloud/network access or secret values."""
import argparse, json, re, sys
from pathlib import Path

DNS=r'[a-z][a-z0-9-]*[a-z0-9]'
KEY=re.compile(r'^[A-Z][A-Z0-9_]*$')
PROJECT=re.compile(r'^[a-z][a-z0-9-]{4,61}[a-z0-9]$')
REGION=re.compile(r'^[a-z]+-[a-z]+\d+$')
SERVICE=re.compile(r'^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$')
SECRET=re.compile(r'^[A-Za-z0-9_-]{1,255}$')
EMAIL=re.compile(r'^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+$')
PRIVATE=re.compile(r'(TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE_KEY|CREDENTIAL|DATABASE_URL|R2_ACCESS_KEY)',re.I)
HOST=re.compile(r'^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$')
PUBLIC_MECHANISMS=('allusers-invoker','invoker-iam-disabled')
GATE_STATES=('cleared','director-exception','blocked')
PLACEHOLDER=re.compile(r'(?:REPLACE|CHANGE[_-]?ME|PLACEHOLDER|FIXME|TODO|INVALID://|<[^>]+>|example\.com|your[_-])',re.I)

def validate(c):
    errs=[];warnings=[]
    def error(s): errs.append(s)
    def field(o,key,kind=str):
        v=o.get(key)
        if not isinstance(v,kind) or (kind is str and not v.strip()):error('Missing/invalid '+key)
        return v
    if not isinstance(c,dict):return ['Config root must be object'],[]
    app=c.get('app',{});g=c.get('gcp',{});env=c.get('runtime_env',{});binding=c.get('secret_bindings',{});build=c.get('build',{})
    release=c.get('release',{});verify=c.get('public_verification',{})
    if not all(isinstance(x,dict) for x in (app,g,env,binding,build,release,verify)):return ['Sections app,gcp,runtime_env,secret_bindings,build,release,public_verification must be objects'],[]
    field(app,'name');repo=field(app,'repository');dist=field(app,'next_dist_dir')
    if isinstance(dist,str) and (dist.startswith('/') or '..' in Path(dist).parts or dist in ('.','')):error('next_dist_dir must be safe relative subpath')
    for name,regex in [('project_id',PROJECT),('region',REGION),('service',SERVICE),('artifact_repository',SERVICE)]:
        value=field(g,name)
        if isinstance(value,str) and not regex.fullmatch(value):error('Invalid gcp.'+name)
    for name in ['expected_operator','runtime_service_account','build_service_account']:
        value=field(g,name)
        if isinstance(value,str) and not EMAIL.fullmatch(value):error('Invalid gcp.'+name)
    # Web Factory websites are public. There is no private target and no private fallback.
    if 'visibility' in g and g.get('visibility')!='public':error('gcp.visibility='+str(g.get('visibility'))+' is not a Web Factory deployment target: websites are public. Remove it and set gcp.public_access')
    mech=g.get('public_access')
    if mech not in PUBLIC_MECHANISMS:error('gcp.public_access is required and must be one of: '+', '.join(PUBLIC_MECHANISMS)+' (no default; no private option)')
    if g.get('runtime_service_account') and g.get('runtime_service_account')==g.get('build_service_account'):error('Build and runtime service accounts must be different identities')
    if 'custom_domain' not in g:error('gcp.custom_domain is required: the public hostname, or null only when the approved plan has no custom domain')
    elif g['custom_domain'] is None:warnings.append('No custom domain configured: success-contract items I and J do not apply only because the operator approved a deployment without one.')
    elif not isinstance(g['custom_domain'],str) or not HOST.fullmatch(g['custom_domain']):error('gcp.custom_domain must be a bare lowercase hostname (no scheme, path or port)')
    gate=release.get('security_gate',{})
    if not isinstance(gate,dict) or gate.get('status') not in GATE_STATES:error('release.security_gate.status is required: '+' / '.join(GATE_STATES))
    else:
        ref=gate.get('reference')
        if gate['status']!='blocked' and (not isinstance(ref,str) or len(ref.strip())<8 or PLACEHOLDER.search(ref)):error('release.security_gate.reference must cite the evidence or the Director approval record')
        if gate['status']=='blocked':warnings.append('Security release gate is BLOCKED: deploy.sh will refuse to run. Public exposure waits for a verified fix or a Director-approved disposition; a private deployment is not a substitute.')
        if gate['status']=='director-exception':warnings.append('Public exposure proceeds under a recorded Director exception, not a security PASS. Carry it into the run record.')
    paths=verify.get('paths',[]);article=verify.get('article_path')
    if not isinstance(paths,list) or any(not isinstance(x,str) or not x.startswith('/') or x.startswith('//') for x in paths):error('public_verification.paths must be root-relative paths')
    if article is not None and (not isinstance(article,str) or not article.startswith('/') or article.startswith('//')):error('public_verification.article_path must be a root-relative path')
    rv=verify.get('revalidate_seconds',0)
    if not isinstance(rv,int) or isinstance(rv,bool) or rv<0 or rv>86400:error('public_verification.revalidate_seconds must be a whole number of seconds')
    probe=g.get('startup_probe_path')
    if probe is not None and (not isinstance(probe,str) or not re.fullmatch(r'/[A-Za-z0-9/_.-]*',probe)):error('gcp.startup_probe_path must be a simple root-relative path')
    if 'cpu_always_allocated' in g and not isinstance(g['cpu_always_allocated'],bool):error('gcp.cpu_always_allocated must be true/false')
    for name in ['max_instances','min_instances']:
        v=field(g,name,int)
        if isinstance(v,int) and (isinstance(v,bool) or v<0 or v>1000):error('Invalid '+name)
    if isinstance(g.get('max_instances'),int) and isinstance(g.get('min_instances'),int) and g['min_instances']>g['max_instances']:error('min_instances > max_instances')
    field(g,'memory')
    for k,v in env.items():
        if not KEY.fullmatch(k):error('Invalid runtime env name '+str(k))
        if PRIVATE.search(k):error('Runtime env contains likely secret '+k+'; use secret_bindings')
        if not isinstance(v,str) or not v or PLACEHOLDER.search(v):error('Invalid/placeholder runtime env '+k)
        if '\n' in v or '\r' in v:error('Multiline runtime env '+k)
    if env.get('DATABASE_KIND')!='turso':error('DATABASE_KIND=turso required')
    if env.get('MEDIA_STORAGE')!='r2':error('MEDIA_STORAGE=r2 required')
    if env.get('APP_ENV') in (None,'test','development'):error('APP_ENV must be non-test for Cloud Run staging/production')
    if any('localhost' in v or '127.0.0.1' in v for v in env.values()):error('Loopback host in runtime config')
    for k,entry in binding.items():
        if not KEY.fullmatch(k):error('Invalid secret env name '+str(k))
        if not isinstance(entry,dict):error('Invalid secret binding '+k);continue
        name=entry.get('name');vers=entry.get('version')
        if not isinstance(name,str) or not SECRET.fullmatch(name):error('Invalid secret resource name '+k)
        if not isinstance(vers,str) or not re.fullmatch(r'[1-9][0-9]*',vers):error('Secret version must be pinned numeric '+k)
        if k in env:error('Env name in both runtime_env and secret_bindings: '+k)
    for k in ['DATABASE_URL','DATABASE_AUTH_TOKEN','PAYLOAD_SECRET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY']:
        if k not in binding:error('Expected binding absent: '+k+' (adjust only with evidence from app source)')
    if build.get('profile') not in ('runtime-only','protected-buildkit'):error('build.profile invalid')
    if build.get('profile')=='protected-buildkit':warnings.append('BuildKit secret profile requires separate reviewed/approved Dockerfile+Cloud Build implementation.')
    if isinstance(repo,str) and PLACEHOLDER.search(repo):error('Placeholder repo path')
    if isinstance(app.get('name'),str) and not SERVICE.fullmatch(app['name']):error('Invalid app.name')
    return errs,warnings

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--config',required=True);args=p.parse_args()
    try:c=json.loads(Path(args.config).read_text())
    except (OSError,ValueError) as e:print('INVALID CONFIG:',str(e));return 2
    errs,warns=validate(c)
    for x in warns:print('WARNING:',x)
    for x in errs:print('BLOCKED:',x)
    if errs:return 2
    print('CONFIG STRUCTURE PASS. This does NOT prove cloud resources, secret values or deployment authorization.')
    print('TARGET:',c['gcp']['project_id'],c['gcp']['region'],c['gcp']['service'])
    print('PUBLIC ACCESS:',c['gcp']['public_access'],'| CUSTOM DOMAIN:',c['gcp']['custom_domain'] or 'none (operator-approved)','| SECURITY GATE:',c['release']['security_gate']['status'])
    print('BINDINGS:',', '.join(sorted(c['secret_bindings']))+' (NAMES ONLY)')
    return 0
if __name__=='__main__':sys.exit(main())
