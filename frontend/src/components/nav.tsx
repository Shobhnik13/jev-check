'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

import {DeviceLink} from '@/components/device-link';
import {ThemeToggle} from '@/components/theme-toggle';

const LINKS = [
  {href: '/checklists', label: 'My checks', tour: 'nav-checks'},
  {href: '/objects', label: 'My items', tour: 'nav-items'},
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-fg/5 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-lime-400 text-xs font-bold text-black">✓</span>
          Jev Check
        </Link>
        <nav className="flex gap-1">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} data-tour={link.tour} className={`rounded-lg px-3 py-1.5 text-sm transition ${pathname.startsWith(link.href) ? 'bg-zinc-800 text-fg' : 'text-zinc-400 hover:text-zinc-100'}`}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <DeviceLink />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
