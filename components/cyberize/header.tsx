'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { destination } from '@/content/website';
import { Artwork } from './artwork';

export function Header({ copy }: { copy: Record<string, string> }) {
  const content = (_group: string, field: string) => copy[field] || '';
  const services = [3,4,5,6,7].map(number => [copy[`header.a_text_${number - 1}`], destination(copy[`header.a_href_${number}`])]);
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const header = useRef<HTMLElement>(null);
  const mobileButton = useRef<HTMLButtonElement>(null);
  const serviceButton = useRef<HTMLButtonElement>(null);
  const pathname = usePathname().replace(/\/$/, '') || '/';
  const active = (route: string) => pathname === (route.replace(/\/$/, '') || '/') ? 'page' as const : undefined;
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (open) { setOpen(false); serviceButton.current?.focus(); event.preventDefault(); }
      else if (mobile) { setMobile(false); mobileButton.current?.focus(); event.preventDefault(); }
    };
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) { setOpen(false); setMobile(false); }
    };
    const media = window.matchMedia('(max-width: 900px)');
    const reset = () => { setOpen(false); setMobile(false); };
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', outside); media.addEventListener('change', reset);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside); media.removeEventListener('change', reset); };
  }, [open, mobile]);
  const reset = () => { setOpen(false); setMobile(false); };
  return <header className="site-header" id="top" ref={header}><div className="wrap header-row">
    <Link className="brand" href={destination(copy["header.a_href_1"])} aria-label={copy["header.img_alt_1"]}><Artwork src={copy["header.img_src_1"]} width="260" height="84" alt={copy["header.img_alt_1"]} /></Link>
    <button ref={mobileButton} className="mobile-toggle" aria-controls="primary" aria-expanded={mobile} onClick={() => { setMobile(!mobile); setOpen(false); }}>{content('shared','header.button_text_1')} <span aria-hidden="true">{content('shared','header.span_text_1')}</span></button>
    <nav id="primary" className={`primary${mobile ? ' is-open' : ''}`} aria-label="Primary">
      <Link href={destination(copy["header.a_href_2"])} aria-current={active('/')} onClick={reset}>{copy["header.a_text_1"]}</Link>
      <Link href="/blog" onClick={reset}>Blog</Link><div className="service-menu"><button ref={serviceButton} className="services-toggle" aria-expanded={open} aria-controls="service-links" onClick={() => setOpen(!open)}>{copy["header.button_text_2"]} <span aria-hidden="true">{copy["header.span_text_2"]}</span></button>
        <div id="service-links" className="service-links" hidden={!open}>{services.map(([label, href]) => <a key={href} href={href} aria-current={active(href)} onClick={reset}>{label}</a>)}</div>
      </div>
      <a href={destination(copy["header.a_href_8"])} aria-current={active('/contact/')} onClick={reset}>{copy["header.a_text_7"]}</a>
    </nav><a className="button compact header-cta" href={destination(copy["header.a_href_9"])}>{copy["header.a_text_8"]} <span aria-hidden="true">{copy["header.span_text_3"]}</span></a>
  </div></header>;
}
