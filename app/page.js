import Link from 'next/link';

export const metadata = {
  title: 'Naga Films Studio — Generative Production Stack',
  description:
    'A self-hostable generative production stack for image, video, cinema and lip sync. 200+ models, unrestricted, bring your own key. Built by Naga Films, Hamburg.',
};

const STUDIOS = [
  { name: 'Image Studio', desc: 'Text-to-image and image-to-image across 100+ models, up to 14 reference images per request.' },
  { name: 'Video Studio', desc: 'Text-to-video and image-to-video — Kling, Veo, Sora, Runway, Seedance, Hailuo, Wan.' },
  { name: 'Cinema Studio', desc: 'Shot-level control: camera moves, lens language and framing for sequences that cut together.' },
  { name: 'Lip Sync', desc: 'Nine models for portrait and video lip sync — performance from a still or an existing take.' },
  { name: 'Workflows', desc: 'Chain models into repeatable multi-step pipelines instead of re-prompting by hand.' },
  { name: 'Agents', desc: 'Drive the studio programmatically and let agents run generation end to end.' },
];

const STATS = [
  { figure: '200+', label: 'Models' },
  { figure: '9', label: 'Lip sync engines' },
  { figure: '14', label: 'Reference images per call' },
  { figure: '100%', label: 'Self-hostable' },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505] text-white antialiased overflow-x-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[#00ff88]/[0.07] blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[520px] rounded-full bg-[#00ff88]/[0.03] blur-[120px]" />
      </div>

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img src="/naga-mark.svg" alt="Naga Films" width={36} height={36} className="h-9 w-9" />
          <span className="text-sm font-bold tracking-tight">
            NAGA FILMS <span className="font-medium text-white/40">Studio</span>
          </span>
        </div>
        <Link
          href="/studio"
          className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-[13px] font-semibold text-white/80 transition-colors hover:border-[#00ff88]/40 hover:bg-white/10 hover:text-white"
        >
          Log in
        </Link>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-28">
        <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#00ff88]/70">
          Hamburg · Generative Production Stack
        </p>
        <h1 className="max-w-4xl text-5xl font-black leading-[1.03] tracking-tight md:text-7xl">
          Every model.
          <br />
          <span className="text-white/35">No gatekeeper.</span>
        </h1>
        <p className="mt-8 max-w-xl text-[15px] leading-relaxed text-white/50">
          A production-grade studio for image, video, cinema and lip sync — over 200 models behind one
          interface. Self-hostable, unrestricted, and yours to run. Bring your own key and start creating.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/studio"
            className="group inline-flex items-center gap-2 rounded-md bg-[#00ff88] px-7 py-3.5 text-sm font-bold text-black shadow-lg shadow-[#00ff88]/10 transition-all hover:bg-[#33ffa3] hover:shadow-[#00ff88]/25"
          >
            Enter the Studio
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <a
            href="#capabilities"
            className="rounded-md border border-white/10 px-7 py-3.5 text-sm font-semibold text-white/60 transition-colors hover:border-white/25 hover:text-white"
          >
            What's inside
          </a>
        </div>

        {/* stats */}
        <dl className="mt-24 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03] md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-[#080808] px-6 py-7">
              <dt className="text-3xl font-black tracking-tight text-[#00ff88]">{s.figure}</dt>
              <dd className="mt-1 text-[12px] font-medium uppercase tracking-wider text-white/35">{s.label}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* capabilities */}
      <section id="capabilities" className="relative z-10 border-t border-white/[0.06] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Six studios, one key</h2>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/45">
            Built for real production work — concept art, pre-visualisation, motion tests and finished shots.
          </p>

          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.05] md:grid-cols-2 lg:grid-cols-3">
            {STUDIOS.map((s) => (
              <div key={s.name} className="group bg-[#080808] p-8 transition-colors hover:bg-[#0c0c0c]">
                <div className="mb-4 h-[2px] w-8 rounded-full bg-[#00ff88]/50 transition-all group-hover:w-14 group-hover:bg-[#00ff88]" />
                <h3 className="text-[15px] font-bold tracking-tight">{s.name}</h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-white/40">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* why */}
      <section className="relative z-10 border-t border-white/[0.06] py-24">
        <div className="mx-auto grid max-w-6xl gap-16 px-6 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Built for a film pipeline</h2>
            <p className="mt-5 text-[15px] leading-relaxed text-white/45">
              Naga Films is a Hamburg production company. This studio exists because generative tooling
              inside a real production has requirements hosted platforms don't meet — period subject matter
              that consumer filters reject, unreleased material that shouldn't sit in someone else's account,
              and enough model breadth to pick the right one per shot.
            </p>
          </div>
          <ul className="space-y-6">
            {[
              ['Unrestricted', 'No content filters standing between you and legitimate work.'],
              ['Self-hosted', 'Run it on your own infrastructure. Your material stays yours.'],
              ['Bring your own key', 'No subscription, no seat pricing. You pay the model provider directly.'],
              ['Open source', 'MIT licensed and fully hackable — extend it to fit your pipeline.'],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-4 border-b border-white/[0.06] pb-6 last:border-0">
                <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#00ff88]" />
                <div>
                  <h3 className="text-[14px] font-bold">{title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/40">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* cta */}
      <section className="relative z-10 border-t border-white/[0.06] py-28">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <img src="/naga-mark.svg" alt="" width={56} height={56} className="mx-auto mb-8 h-14 w-14 opacity-90" />
          <h2 className="mx-auto max-w-xl text-3xl font-black leading-tight tracking-tight md:text-4xl">
            Start with the shot you can't get anywhere else.
          </h2>
          <Link
            href="/studio"
            className="mt-10 inline-flex items-center gap-2 rounded-md bg-[#00ff88] px-8 py-4 text-sm font-bold text-black transition-all hover:bg-[#33ffa3]"
          >
            Enter the Studio →
          </Link>
          <p className="mt-5 text-[12px] text-white/25">
            Need a key?{' '}
            <a
              href="https://muapi.ai/access-keys"
              target="_blank"
              rel="noreferrer"
              className="text-white/40 underline-offset-4 transition-colors hover:text-[#00ff88]"
            >
              Get one free
            </a>
          </p>
        </div>
      </section>

      {/* footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-[12px] text-white/30 md:flex-row">
          <span>
            © {new Date().getFullYear()} Naga Films · Hamburg — engineering by{' '}
            <a
              href="https://nagacodex.cloud"
              target="_blank"
              rel="noreferrer"
              className="text-white/50 transition-colors hover:text-[#00ff88]"
            >
              Naga Codex
            </a>
          </span>
          <span>
            Built on{' '}
            <a
              href="https://github.com/Anil-matcha/Open-Generative-AI"
              target="_blank"
              rel="noreferrer"
              className="text-white/50 transition-colors hover:text-[#00ff88]"
            >
              Open Generative AI
            </a>{' '}
            · MIT
          </span>
        </div>
      </footer>
    </main>
  );
}
