import type {Metadata, Viewport} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';

import {Nav} from '@/components/nav';
import {THEME_SCRIPT} from '@/components/theme-toggle';

import './globals.css';

const geistSans = Geist({variable: '--font-geist-sans', subsets: ['latin']});
const geistMono = Geist_Mono({variable: '--font-geist-mono', subsets: ['latin']});

export const metadata: Metadata = {
  title: 'Jev Check',
  description: 'Visual checklists answered by Jev: is everything in the photo that should be?',
};

export const viewport: Viewport = {
  themeColor: [
    {media: '(prefers-color-scheme: light)', color: '#f4f4f5'},
    {media: '(prefers-color-scheme: dark)', color: '#09090b'},
  ],
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: THEME_SCRIPT}} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <Nav />
        <main className="mx-auto max-w-6xl px-4 pb-16 pt-6">{children}</main>
      </body>
    </html>
  );
}
