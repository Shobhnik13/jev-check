'use client';

import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Suspense, useEffect, useRef, useState} from 'react';

import {buttonClass, ErrorNote, Panel} from '@/components/ui';
import {api, errorText} from '@/lib/api';

export default function LinkPage() {
  return (
    <Suspense>
      <ClaimFromUrl />
    </Suspense>
  );
}

// Opened from the QR code: links this browser, then goes straight to the checks.
function ClaimFromUrl() {
  const code = useSearchParams().get('code') ?? '';
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Codes work once, so a second run of this effect (React dev mode) must not claim again.
    if (started.current) {
      return;
    }

    started.current = true;
    api.claimLink(code).then(
      () => window.location.replace('/checklists'),
      (err) => setError(errorText(err)),
    );
  }, [code]);

  return (
    <Panel className="mx-auto max-w-sm space-y-4 text-center">
      {error ? (
        <>
          <ErrorNote error={error} />
          <Link href="/checklists" className={buttonClass('ghost')}>
            Go to my checks
          </Link>
        </>
      ) : (
        <p className="text-zinc-400">Linking this device…</p>
      )}
    </Panel>
  );
}
