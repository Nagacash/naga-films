import { Suspense } from 'react';
import CreditsClient from './CreditsClient';

export const metadata = {
  title: 'Credit packs — Naga Films Studio',
  description: 'Buy one-time credit packs for Naga Films Studio. No subscription.',
};

export default function CreditsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
          Loading…
        </main>
      }
    >
      <CreditsClient />
    </Suspense>
  );
}
