import { redirect } from 'next/navigation';

/** Avoid static prerender of a redirect-only route (fixes occasional webpack-runtime errors on `next build`). */
export const dynamic = 'force-dynamic';

export default function Home() {
  redirect('/studio');
}
