'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError('Invalid email or password');
      return;
    }
    router.push('/studio');
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm border border-white/10 bg-[#0a0a0a] rounded-xl p-8">
        <h1 className="text-xl font-bold mb-1">Log in</h1>
        <p className="text-white/40 text-sm mb-8">Access Naga Films Studio with your account.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-white/40 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#00ff88] text-black font-bold py-2.5 text-sm disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Log in'}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-white/35">
          No account?{' '}
          <Link href="/signup" className="text-[#00ff88]">
            Sign up
          </Link>
        </p>
        <p className="mt-2 text-center text-xs">
          <Link href="/" className="text-white/25 hover:text-white/50">
            ← Home
          </Link>
        </p>
      </div>
    </main>
  );
}
