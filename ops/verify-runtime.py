#!/usr/bin/env python3
"""Anonymous public-access verification for a deployed Web Factory website.

Every request is made as an ordinary visitor: no credentials of any kind are sent,
and this helper has no option to add them. It checks the Cloud Run service URL and
the custom domain, and it fails closed:

  exit 0  PUBLIC ACCESS VERIFIED      every check passed on every target
  exit 1  FAILED                      a check failed (a Cloud Run IAM denial is a deployment failure)
  exit 3  DEPLOYMENT INCOMPLETE       service URL passed, custom domain not serving valid HTTPS yet

Read-only except for the write probes, which POST an empty JSON object anonymously and
pass only when the APPLICATION rejects them with 401/403. It does not prove publish-driven
ISR, editorial workflows or browser rendering; those belong to independent Gate D.
"""
import argparse, json, re, socket, ssl, sys, urllib.error, urllib.parse, urllib.request

IAM_MARKERS = ('your client does not have permission', 'error: forbidden', 'error: unauthorized',
               '<title>403 forbidden</title>', '<title>401 unauthorized</title>')
IMG = re.compile(r'<img\b[^>]*?\bsrc="([^"]+)"', re.I)
ASSET = re.compile(r'(?:src|href)="(/_next/static/[^"]+)"', re.I)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


def classify_denial(status, headers, body):
    """Tell a platform (Cloud Run IAM) denial from an application-level denial."""
    if status not in (401, 403):
        return 'none'
    text = (body or '')[:4000].lower()
    ctype = (headers.get('Content-Type') or '').lower()
    if 'json' in ctype:
        try:
            data = json.loads(body)
            if isinstance(data, dict) and ('errors' in data or 'message' in data):
                return 'application'
        except ValueError:
            pass
    if any(m in text for m in IAM_MARKERS) or 'bearer' in (headers.get('WWW-Authenticate') or '').lower():
        return 'cloud-run-iam'
    return 'unclassified'


def fetch(url, timeout, method='GET', follow=True, data=None):
    """Anonymous request. Only fixed, credential-free headers are ever sent."""
    headers = {'User-Agent': 'web-factory-public-verify/1.1', 'Accept': '*/*'}
    if data is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(req, timeout=timeout) as r:
            return r.status, r.headers, r.read(600000).decode('utf-8', 'replace'), None
    except urllib.error.HTTPError as e:
        try:
            body = e.read(20000).decode('utf-8', 'replace')
        except Exception:
            body = ''
        return e.code, e.headers, body, None
    except Exception as e:  # DNS, TLS, timeout, refused
        reason = getattr(e, 'reason', e)
        kind = 'tls' if isinstance(reason, ssl.SSLError) else 'dns' if isinstance(reason, socket.gaierror) else 'network'
        return None, {}, '', kind + ':' + type(reason).__name__


def is_loopback(url):
    return url.startswith(('http://127.0.0.1:', 'http://localhost:'))


class Target:
    def __init__(self, label, base, a):
        self.label, self.base, self.a = label, base.rstrip('/'), a
        self.fails, self.iam, self.transport = [], False, None

    def out(self, ok, name, detail=''):
        print(f"  {'PASS' if ok else 'FAIL'}  {name}{(' — ' + detail) if detail else ''}")
        if not ok:
            self.fails.append(name)

    def public_get(self, path, name):
        status, headers, body, err = fetch(self.base + path, self.a.timeout)
        if err:
            self.transport = self.transport or err
            self.out(False, name, f'{path} unreachable ({err})')
            return None, headers, body
        kind = classify_denial(status, headers, body)
        if kind == 'cloud-run-iam':
            self.iam = True
            self.out(False, name, f'{path} HTTP {status}: CLOUD RUN IAM DENIAL — the service is NOT public. This is a DEPLOYMENT FAILURE.')
        elif status != 200:
            self.out(False, name, f'{path} HTTP {status}' + (' (login/auth required for a public page)' if status in (401, 403) else ''))
        else:
            self.out(True, name, f'{path} HTTP 200')
        return status, headers, body

    def run(self):
        a = self.a
        print(f'\n== {self.label}: {self.base}')
        host = urllib.parse.urlsplit(self.base).hostname
        if not is_loopback(self.base):
            try:
                socket.getaddrinfo(host, 443)
                self.out(True, 'DNS resolves', host)
            except socket.gaierror:
                self.transport = 'dns:gaierror'
                self.out(False, 'DNS resolves', host + ' does not resolve')
                return
            try:
                ctx = ssl.create_default_context()
                with socket.create_connection((host, 443), timeout=a.timeout) as raw, ctx.wrap_socket(raw, server_hostname=host) as tls:
                    cert = tls.getpeercert()
                self.out(True, 'HTTPS certificate valid for host', 'expires ' + str(cert.get('notAfter')))
            except Exception as e:
                self.transport = 'tls:' + type(e).__name__
                self.out(False, 'HTTPS certificate valid for host', type(e).__name__ + ' (certificate missing, mismatched or still provisioning)')
                return
        else:
            print('  NOTE  loopback test target: DNS and certificate checks do not apply and nothing here certifies a real deployment')

        status, headers, home = self.public_get('/', 'Homepage returns 200 anonymously')
        if status is None or self.iam:
            return
        pages = {}
        for path in a.path:
            s, h, b = self.public_get(path, 'Public route')
            pages[path] = (s, h, b)
        if a.article_path:
            s, h, b = self.public_get(a.article_path, 'Representative article')
            pages[a.article_path] = (s, h, b)

        # images and static assets referenced by the public pages
        html = (home or '') + ''.join(b or '' for _, _, b in pages.values())
        images = list(dict.fromkeys(IMG.findall(html)))[: a.max_assets]
        assets = list(dict.fromkeys(ASSET.findall(html)))[: a.max_assets]
        for label, items, required in (('Public images load', images, a.require_images), ('Static assets load', assets, True)):
            bad = []
            for ref in items:
                url = urllib.parse.urljoin(self.base + '/', ref)
                if not url.startswith('https://') and not is_loopback(url):
                    bad.append(ref[:80] + ' (not HTTPS)')
                    continue
                s, h, _, err = fetch(url, a.timeout)
                if err or s != 200:
                    bad.append(f'{ref[:80]} ({err or s})')
            if not items:
                self.out(not required, label, 'none found on the checked pages')
            else:
                self.out(not bad, label, f'{len(items) - len(bad)}/{len(items)} OK' + ('; ' + '; '.join(bad[:3]) if bad else ''))

        # ISR evidence on public pages (header-level only)
        if a.expect_revalidate:
            target = a.path[0] if a.path else '/'
            fetch(self.base + target, a.timeout)
            s, h, _, _ = fetch(self.base + target, a.timeout)
            cc = (h.get('Cache-Control') or '') if s == 200 else ''
            cache = h.get('x-nextjs-cache') if s == 200 else None
            self.out(f's-maxage={a.expect_revalidate}' in cc and cache in ('HIT', 'STALE'), f'{a.expect_revalidate}-second ISR headers on {target}', f'cache-control="{cc}" x-nextjs-cache={cache}')

        # admin: reachable, never cached, and enforcing application authentication
        s, h, b, err = fetch(self.base + a.admin_login_path, a.timeout)
        kind = classify_denial(s, h, b) if s else 'none'
        if kind == 'cloud-run-iam':
            self.iam = True
        cc = (h.get('Cache-Control') or '').lower() if s else ''
        self.out(s == 200 and 'html' in (h.get('Content-Type') or '').lower(), 'Admin login page reachable', f'{a.admin_login_path} HTTP {s or err}')
        self.out(s == 200 and h.get('x-nextjs-cache') is None and ('no-store' in cc or 'private' in cc), 'Admin login page is not publicly cached', f'cache-control="{cc}"')
        for path in a.protected_path:
            s, h, b, err = fetch(self.base + path, a.timeout, follow=False)
            kind = classify_denial(s, h, b) if s else 'none'
            if kind == 'cloud-run-iam':
                self.iam = True
            ok = (s in (401, 403) and kind == 'application') or (s in (301, 302, 303, 307, 308) and 'login' in (h.get('Location') or ''))
            self.out(ok, 'Protected endpoint enforces application authentication', f'{path} HTTP {s or err} ({kind})')
        for path in a.write_probe_path:
            s, h, b, err = fetch(self.base + path, a.timeout, method='POST', follow=False, data=b'{}')
            kind = classify_denial(s, h, b) if s else 'none'
            if kind == 'cloud-run-iam':
                self.iam = True
            self.out(s in (401, 403) and kind == 'application', 'Unauthorized CMS write rejected by the application', f'POST {path} HTTP {s or err} ({kind})')


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--service-url', required=True, help='Cloud Run service URL (https://…run.app)')
    p.add_argument('--custom-domain-url', help='Intended public origin, e.g. https://www.example.org')
    p.add_argument('--no-custom-domain', action='store_true', help='Only for a deployment whose approved config has no custom domain')
    p.add_argument('--path', action='append', default=[], help='Public page; repeat. Default: /blog')
    p.add_argument('--article-path', help='A representative article path')
    p.add_argument('--admin-login-path', default='/admin/login')
    p.add_argument('--protected-path', action='append', default=[], help='GET must be denied by the app. Default: /api/users')
    p.add_argument('--write-probe-path', action='append', default=[], help='Anonymous POST {} must be denied by the app. Default: /api/users')
    p.add_argument('--expect-revalidate', type=int, default=0, help='Expected ISR seconds, e.g. 30; 0 skips the header check')
    p.add_argument('--require-images', action='store_true', help='Fail when the checked pages reference no images')
    p.add_argument('--max-assets', type=int, default=8)
    p.add_argument('--timeout', type=float, default=15)
    a = p.parse_args(argv)
    a.path = list(dict.fromkeys(a.path or ['/blog']))
    a.protected_path = a.protected_path or ['/api/users']
    a.write_probe_path = a.write_probe_path or ['/api/users']
    for path in a.path + a.protected_path + a.write_probe_path + [a.admin_login_path] + ([a.article_path] if a.article_path else []):
        if not path.startswith('/') or path.startswith('//'):
            p.error('Paths must be root-relative')
    for url in filter(None, [a.service_url, a.custom_domain_url]):
        if not url.startswith('https://') and not is_loopback(url):
            p.error('Only HTTPS URLs are accepted (loopback HTTP is for offline tests only)')
        if urllib.parse.urlsplit(url).username or '@' in urllib.parse.urlsplit(url).netloc:
            p.error('URLs must not carry credentials')
    if bool(a.custom_domain_url) == bool(a.no_custom_domain):
        p.error('Give --custom-domain-url, or --no-custom-domain when the approved config has none')

    print('ANONYMOUS PUBLIC-ACCESS VERIFICATION — no credentials are sent on any request')
    service = Target('CLOUD RUN SERVICE URL', a.service_url, a)
    service.run()
    domain = None
    if a.custom_domain_url:
        domain = Target('CUSTOM DOMAIN', a.custom_domain_url, a)
        domain.run()

    print()
    if service.iam or (domain and domain.iam):
        print('STATUS: FAILED — Cloud Run IAM is rejecting anonymous visitors. Public invocation is not in effect.')
        print('Do not report this deployment complete, do not substitute an authenticated test, and do not fall back to a private service.')
        print('Recovery: leave the service and its revision in place; read back the invoker policy / invoker IAM check and any organization policy; fix the public access setting; rerun this check.')
        return 1
    if service.fails:
        print('STATUS: FAILED — the Cloud Run service URL did not pass: ' + '; '.join(dict.fromkeys(service.fails)))
        print('Recovery: leave the service in place; inspect revision readiness and logs; correct the cause; rerun this check.')
        return 1
    if domain and domain.fails:
        if domain.transport and domain.transport.split(':')[0] in ('dns', 'tls'):
            print('STATUS: DEPLOYMENT INCOMPLETE — the service URL is public and healthy, but the custom domain is not serving valid HTTPS yet (' + domain.transport + ').')
            print('Check the domain mapping status and the DNS record, wait for certificate provisioning, then rerun. Do not report success before this passes.')
            return 3
        print('STATUS: FAILED — the custom domain did not pass: ' + '; '.join(dict.fromkeys(domain.fails)))
        return 1
    if any(is_loopback(u) for u in filter(None, [a.service_url, a.custom_domain_url])):
        print('STATUS: OFFLINE TEST PASS — loopback targets only; this is not evidence about any deployment.')
        return 0
    print('STATUS: PUBLIC ACCESS VERIFIED' + (' on the service URL and the custom domain.' if domain else ' on the service URL (no custom domain in the approved config).'))
    print('Not covered here: publish-driven ISR, editorial workflows and browser rendering — independent Gate D.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
