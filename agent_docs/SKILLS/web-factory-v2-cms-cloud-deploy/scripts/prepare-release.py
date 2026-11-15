#!/usr/bin/env python3
"""Stage a Git working tree safely outside repo; output hash manifest OUTSIDE Cloud Build context."""
import argparse, hashlib, json, os, re, shutil, subprocess, sys
from pathlib import Path

BLOCKED_DIR={'.git','.ssh','.aws','.gnupg','.npm','.yarn','.vercel','node_modules','agent_docs','_SKILLS','__pycache__','.turbo','coverage','playwright-report','test-results','outputs'}
BLOCKED_RE=re.compile(r'(?:^|/)(?:\.env[^/]*|\.npmrc|\.pypirc|\.netrc|\.credentials|\.git-credentials|id_rsa|id_ed25519|[^/]*service[-_]?account[^/]*\.json|[^/]*credentials[^/]*\.json|[^/]*\.pem|[^/]*\.p12|[^/]*\.key|[^/]*\.db|[^/]*\.sqlite3?)(?:$|/)',re.I)

def git(repo,*args):
    p=subprocess.run(['git',*args],cwd=repo,capture_output=True,timeout=25)
    if p.returncode:raise RuntimeError('Git command failed; refusing staging: '+repr(args))
    return p.stdout

def blocked(name):
    parts=Path(name).parts
    return any(p in BLOCKED_DIR or p.startswith('.next') for p in parts) or bool(BLOCKED_RE.search(name))

def main():
    pa=argparse.ArgumentParser(description=__doc__)
    pa.add_argument('--repo',required=True);pa.add_argument('--stage',required=True);pa.add_argument('--manifest',required=True)
    pa.add_argument('--include-reviewed-working-tree',action='store_true')
    a=pa.parse_args();r=Path(a.repo).expanduser().resolve();stage=Path(a.stage).expanduser().resolve();manifest=Path(a.manifest).expanduser().resolve()
    if not git(r,'rev-parse','--is-inside-work-tree').decode().strip()=='true':sys.exit('BLOCKED: not a Git working tree')
    if not (r/'package.json').is_file():sys.exit('BLOCKED: package.json missing')
    if r==stage or r in stage.parents or stage in r.parents:sys.exit('BLOCKED: release stage must be OUTSIDE repository')
    if stage.exists():sys.exit('BLOCKED: stage already exists; choose new name')
    if manifest==stage or stage in manifest.parents or r in manifest.parents:sys.exit('BLOCKED: manifest must be outside BOTH source and stage')
    dirty=bool(git(r,'status','--porcelain=v1','-z'))
    if dirty and not a.include_reviewed_working_tree:sys.exit('BLOCKED: source dirty; explicit reviewed working-tree flag required')
    raw=git(r,'ls-files','--cached','--others','--exclude-standard','-z')
    names=sorted({x.decode('utf-8','surrogateescape') for x in raw.split(b'\0') if x})
    copied=[];excluded=[];breaches=[]
    for name in names:
        if blocked(name):
            excluded.append(name)
            if BLOCKED_RE.search(name) and not re.search(r'(?:^|/)\.env[^/]*\.(?:example|sample|template)$',name,re.I):breaches.append(name)
            continue
        src=r/name
        if not src.exists():continue
        if src.is_symlink():sys.exit('BLOCKED: symlink requires human review: '+name)
        if not src.is_file():continue
        if not src.resolve().is_relative_to(r):sys.exit('BLOCKED: path escapes repo: '+name)
        copied.append(name)
    if breaches:sys.exit('BLOCKED: sensitive paths tracked/untracked in source; review BEFORE packaging: '+', '.join(breaches[:25]))
    if not copied:sys.exit('BLOCKED: zero files selected')
    if not (r/'package.json').is_file():sys.exit('BLOCKED: package manifest absent')
    stage.mkdir(parents=True)
    hashes={}
    for name in copied:
        src=r/name; dest=stage/name
        dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,dest)
        hashes[name]=hashlib.sha256(dest.read_bytes()).hexdigest()
    head=git(r,'rev-parse','HEAD').decode().strip(); branch=git(r,'branch','--show-current').decode().strip()
    report={'repo':str(r),'stage':str(stage),'branch':branch,'head':head,'dirty':dirty,'reviewed_dirty_snapshot':dirty and a.include_reviewed_working_tree,'files':hashes,'excluded_non_secret_paths':excluded,'count':len(hashes)}
    manifest.parent.mkdir(parents=True,exist_ok=True)
    manifest.write_text(json.dumps(report,indent=2)+'\n');os.chmod(manifest,0o600)
    print('STAGED:',len(hashes),'files; DIRTY:',dirty,'HEAD:',head,'STAGE:',stage)
    print('MANIFEST:',manifest,'(outside upload)')
    print('NOTE: source content scanning and actual gcloud upload guard STILL REQUIRED')
if __name__=='__main__':main()
