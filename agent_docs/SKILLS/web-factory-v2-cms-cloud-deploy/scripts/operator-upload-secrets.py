#!/usr/bin/env python3
"""Operator-local dotenv -> GCP Secret Manager via stdin, never exposing values to the agent."""
import argparse,json,os,re,subprocess,sys
from pathlib import Path

LINE=re.compile(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$')
NAME=re.compile(r'^[A-Za-z0-9_-]{1,255}$')
KEY=re.compile(r'^[A-Z][A-Z0-9_]*$')
PROJECT=re.compile(r'^[a-z][a-z0-9-]{4,61}[a-z0-9]$')
BAD=re.compile(r'(REPLACE|CHANGE[-_]?ME|PLACEHOLDER|INVALID://|FIXME|TODO|^your[_-])',re.I)

def parse_env(path):
    d={}
    for line_number,line in enumerate(path.read_text(encoding='utf-8').splitlines(),1):
        if not line.strip() or line.lstrip().startswith('#'):continue
        m=LINE.match(line)
        if not m: raise ValueError(f'Unsupported dotenv syntax at line {line_number}')
        key,val=m.group(1),m.group(2).strip()
        if key in d:raise ValueError(f'Duplicate key {key} at line {line_number}')
        if val.startswith('"'):
            try:
                value,end=json.JSONDecoder().raw_decode(val)
                if not isinstance(value,str):raise ValueError('not string')
                if val[end:].strip() and not val[end:].lstrip().startswith('#'):raise ValueError('trailing text')
            except (ValueError,json.JSONDecodeError): raise ValueError(f'Invalid quoted value for {key} (no value shown)')
        elif val.startswith("'"):
            end=val.find("'",1)
            if end<0 or (val[end+1:].strip() and not val[end+1:].lstrip().startswith('#')):raise ValueError(f'Invalid quote for {key}')
            value=val[1:end]
        else:
            value=re.split(r'\s+#',val,maxsplit=1)[0].rstrip()
        if '\n' in value or '\r' in value:raise ValueError(f'Multiline values unsupported: {key}')
        d[key]=value
    return d

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--project',required=True);p.add_argument('--env-file',required=True);p.add_argument('--mapping',required=True)
    p.add_argument('--execute',action='store_true',help='Actually write Secret Manager versions (operator approval required).')
    p.add_argument('--receipt',help='Write names/versions only outside source repo, optional')
    a=p.parse_args()
    if not PROJECT.fullmatch(a.project):p.error('Invalid project ID')
    ep=Path(a.env_file).expanduser();mp=Path(a.mapping).expanduser()
    if not ep.is_file() or ep.is_symlink():p.error('Private dotenv path missing/symlink')
    try:
        env=parse_env(ep)
        doc=json.loads(mp.read_text())
    except (OSError,UnicodeError,ValueError) as e:
        print('BLOCKED: input parsing failed:',str(e),file=sys.stderr);return 2
    arr=doc.get('bindings') if isinstance(doc,dict) else None
    if not isinstance(arr,list) or not arr:print('BLOCKED: mapping.bindings must be nonempty list');return 2
    checked=[];fail=0
    for e in arr:
        if not isinstance(e,dict):print('BLOCKED: malformed mapping');return 2
        k,n=e.get('env'),e.get('name')
        if not isinstance(k,str) or not KEY.fullmatch(k) or not isinstance(n,str) or not NAME.fullmatch(n):
            print('BLOCKED: invalid binding name');return 2
        if not env.get(k) or BAD.search(env[k]):
            print('BLOCKED:',k,'missing/empty/placeholder; value NOT printed');fail+=1
        checked.append((k,n))
    if len({k for k,_ in checked})!=len(checked) or len({n for _,n in checked})!=len(checked):
        print('BLOCKED: duplicate source key or secret resource');return 2
    if fail:return 2
    print('SOURCE:',ep,'KEYS PRESENT:',len(checked),'PROJECT:',a.project)
    if not a.execute:
        print('DRY RUN ONLY. No values printed, no Cloud writes. Run with --execute after explicit operator approval.')
        for k,n in checked:print('PLAN:',k,'->',n)
        return 0
    completed=[]
    for k,n in checked:
        try:
            r=subprocess.run(['gcloud','secrets','versions','add',n,'--data-file=-','--project',a.project,'--format=json','--quiet'],input=env[k].encode('utf-8'),capture_output=True,timeout=120)
        except (OSError,subprocess.TimeoutExpired):
            print('FAILED:',k,'->',n,'(gcloud execution error; details suppressed)');return 3
        if r.returncode:
            print('FAILED:',k,'->',n,'(gcloud exit',r.returncode,'; stderr suppressed)');return 3
        try:
            out=json.loads(r.stdout.decode('utf-8'))
            version=str(out['name']).rsplit('/versions/',1)[1]
            if not version.isdigit():version='UNKNOWN'
        except (ValueError,KeyError,UnicodeError,IndexError):version='UNKNOWN'
        completed.append({'env':k,'name':n,'version':version})
        print('UPLOADED:',k,'->',n,'version',version)
    if a.receipt:
        rp=Path(a.receipt).expanduser()
        if rp.resolve()==ep.resolve() or rp.resolve()==mp.resolve():print('WARNING: receipt path collides with input; no receipt written')
        else:
            rp.parent.mkdir(parents=True,exist_ok=True)
            rp.write_text(json.dumps({'project':a.project,'bindings':completed},indent=2)+'\n',encoding='utf-8');os.chmod(rp,0o600)
            print('RECEIPT:',rp,'(contains NAMES+VERSIONS ONLY; keep outside upload tree)')
    print('UPLOAD COMPLETED. Verify Secret Manager IAM/versions before Cloud Run deployment.')
    return 0
if __name__=='__main__':sys.exit(main())
