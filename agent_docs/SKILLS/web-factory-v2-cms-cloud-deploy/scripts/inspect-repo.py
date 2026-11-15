#!/usr/bin/env python3
"""Read-only portable repo reconnaissance. NEVER outputs .env values."""
import argparse, json, os, re, subprocess
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit

SKIP={'.git','node_modules','.next','dist','build','.vercel','.turbo','.cache','playwright-report','test-results','coverage'}
KEY=re.compile(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=')

def git(repo,*args):
    try:
        p=subprocess.run(['git',*args],cwd=repo,capture_output=True,text=True,timeout=15)
        return p.stdout.strip() if p.returncode==0 else 'UNAVAILABLE'
    except (OSError,subprocess.TimeoutExpired): return 'UNAVAILABLE'

def env_paths(repo):
    matches=[]
    for root, dirs, files in os.walk(repo):
        depth=len(Path(root).relative_to(repo).parts)
        dirs[:]=[x for x in dirs if x not in SKIP and not x.startswith('.next')]
        if depth>=3: dirs.clear()
        for name in files:
            if name.startswith('.env'):
                path=Path(root)/name
                if path.is_file() and not path.is_symlink(): matches.append(path)
    return sorted(matches)

def get_keys(path):
    keys=set()
    try:
        with path.open('r',encoding='utf-8') as f:
            for line in f:
                m=KEY.match(line)
                if m: keys.add(m.group(1))
    except (OSError,UnicodeError): return ['UNREADABLE']
    return sorted(keys)

def main():
    a=argparse.ArgumentParser(description=__doc__);a.add_argument('--repo',default='.')
    args=a.parse_args();repo=Path(args.repo).expanduser().resolve()
    if not repo.is_dir():a.error('Repository directory not found')
    try:
        pkg=json.loads((repo/'package.json').read_text())
    except (OSError,ValueError):pkg={}
    print('REPO:',repo)
    print('GIT HEAD:',git(repo,'rev-parse','HEAD'))
    print('GIT BRANCH:',git(repo,'branch','--show-current'))
    remote=git(repo,'remote','get-url','origin')
    if remote.startswith(('http://','https://')):
        parts=urlsplit(remote)
        remote=urlunsplit((parts.scheme,parts.netloc.rsplit('@',1)[-1],parts.path,parts.query,parts.fragment))
    print('GIT REMOTE:',remote)
    status=git(repo,'status','--short','--branch')
    print('GIT STATUS:\n'+status[:5000])
    deps={**pkg.get('dependencies',{}),**pkg.get('devDependencies',{})}
    print('APP:',pkg.get('name','NOT FOUND'))
    print('DEPENDENCIES:',', '.join(f'{name}={deps[name]}' for name in ['next','payload','@payloadcms/db-sqlite','@payloadcms/storage-s3'] if name in deps))
    print('SCRIPTS:',', '.join(sorted(pkg.get('scripts',{}))))
    print('NODE ENGINE:',pkg.get('engines',{}).get('node','UNSPECIFIED'))
    print('LOCKFILE:',', '.join(x for x in ['package-lock.json','pnpm-lock.yaml','yarn.lock','bun.lockb','bun.lock'] if (repo/x).is_file()) or 'NOT FOUND')
    confs=[p for pat in ['next.config.js','next.config.mjs','next.config.ts','next.config.cjs'] for p in repo.glob(pat)]
    for conf in confs:
        txt=conf.read_text(errors='replace'); m=re.search(r'\bdistDir\s*:\s*[\'\"]([^\'\"]+)',txt)
        print('NEXT CONFIG:',conf.name,'standalone='+str(bool(re.search(r'output\s*:\s*[\'\"]standalone',txt))),'distDir='+(m.group(1) if m else 'NOT STATICALLY DETECTED'))
    print('DEPLOY FILES:',', '.join(x for x in ['Dockerfile','cloudbuild.yaml','.dockerignore','.gcloudignore','deploy.sh','init-app.sh'] if (repo/x).exists()) or 'NONE')
    for env in env_paths(repo):
        print('ENV FILE:',env.relative_to(repo),'KEY NAMES:', ', '.join(get_keys(env)))
    print('NOTE: Environment secret values were NOT displayed; inspected only KEY NAMES.')
if __name__=='__main__':main()
