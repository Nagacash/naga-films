'use client';

import dynamic from 'next/dynamic';

/**
 * Client-only shell — avoids Next server/static worker from resolving axios vendor
 * chunks during RSC prerender (fixes missing ./vendor-chunks/axios.js on some builds).
 */
const StandaloneShell = dynamic(() => import('./StandaloneShell'), {
  ssr: false,
  loading: () => null,
});

export default StandaloneShell;
