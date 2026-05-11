"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FaTerminal, FaCode, FaPlay, FaDownload, FaMagic } from "react-icons/fa";
import { useShallow } from "zustand/react/shallow";
import { useHyperframeStudioStore } from "../stores/hyperframeStudioStore";
// ─── Constants ──────────────────────────────────────────────────────────────

const STUDENT_KIT_URL =
  "https://github.com/nateherkai/hyperframes-student-kit";

/** Full HTML compose pass — aligns with HeyGen Hyperframes / student-kit conventions */
const SYSTEM_PROMPT_COMPOSE = `You are the Hyperframe Video Engineer — cinematic motion in plain HTML + GSAP.

Composer rules:
1. Prefer patterns compatible with HeyGen Hyperframes and the Nate Herk "Hyperframes Student Kit" scaffold: timelines registered on window.__timelines (paused where appropriate), GSAP loaded via CDN script before your IIFE, sensible data-* storyboard timing where it helps — so work can drop into hyperframes.json / meta.json projects and survive npx hyperframes lint.
2. One complete self-contained HTML document unless the user asked for snippets only.
3. Deterministic, scrubbable timelines; minimal magic numbers without comments.
4. Remotion ports: mechanical HTML/GSAP equivalents.
5. "Video-ify" sites: transitions + GSAP.

Kit reference for structure, MOTION_PHILOSOPHY, and local MP4 renders (hyperframes lint → preview → render): ${STUDENT_KIT_URL}

OUTPUT: Explain briefly, then one fenced \`\`\`html block with the entire file — no stray unclosed fences.`;

/** First pass — user sees intent before bandwidth-heavy HTML generation */
const SYSTEM_PROMPT_PLAN = `You are the Hyperframe Video Engineer-planning assistant (HTML + GSAP / Hyperframes student-kit worldview). Kit & CLI loop reference: ${STUDENT_KIT_URL}

Planning-only response (approval gate before coding):
• Use markdown headings + bullets. Sections: Goal · Scene/shot beats (approx seconds) · Visual/motion intent (titles, overlays, pacing) · Technical approach (timeline structure, GSAP primitives, risky bits) · Assumptions & open questions.
• Stay under ~350 words unless the user asked for deep detail.
• Do NOT write HTML, CSS, GSAP snippets, pseudocode fences, triple-backticks, or partial documents.
• Mention if the shot list should live in explicit data-* timings for Hyperframes lint.`;


const TEMPLATES = [
  { id: 'cinematic-title', label: 'Cinematic Title', prompt: 'Create a cinematic title sequence with a glowing dark background and a slow scale-in animation.' },
  { id: 'product-reveal', label: 'Product Reveal', prompt: 'Build a product reveal composition for a high-end watch. Use radial gradients and elegant typography.' },
  { id: 'social-ad', label: 'Social Ad', prompt: 'Generate a 15-second social media ad for a tech brand. Fast-paced, high energy, with text-tracking animations.' },
];

// ─── Components ─────────────────────────────────────────────────────────────

function SkillBadge({ label }) {
  return (
    <span className="px-2 py-0.5 rounded-full bg-[#d9ff00]/10 border border-[#d9ff00]/20 text-[10px] font-bold text-[#d9ff00] uppercase tracking-wider">
      {label}
    </span>
  );
}

/** MM:SS.ms from milliseconds (clock display, not countdown). */
function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, "0")}` : `${s}s`;
}

/**
 * Smooth “activity” curve (not true server %) — asymptotic toward floor until the request finishes.
 */
function estimateDisplayPercent(elapsedMs) {
  const sec = elapsedMs / 1000;
  return Math.min(93, Math.floor((1 - Math.exp(-sec / 18)) * 100));
}

function compositionFence(lang, raw) {
  const code = String(raw).trim();
  const l = String(lang ?? "").toLowerCase();
  if (l === "html" || l === "htm") return true;
  if (!l && /^<!DOCTYPE|^<html[\s>/]/i.test(code)) return true;
  return false;
}

/** Renders markdown in chat; HTML composition fences become a compact chip instead of huge raw blocks */
function ChatMessageMarkdown({ role, content }) {
  const dark = role === "assistant";

  const linkClass = dark
    ? "text-[#d9ff00] underline underline-offset-2 hover:text-[#e8ff47]"
    : "text-black/90 underline underline-offset-2 font-bold";

  return (
    <div className="text-[13px] leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            return <p className={`mb-3 last:mb-0 ${dark ? "text-white/88" : "text-black font-bold"}`}>{children}</p>;
          },
          ul({ children }) {
            return <ul className={`mb-3 pl-5 list-disc space-y-1 ${dark ? "text-white/82" : "text-black font-bold"}`}>{children}</ul>;
          },
          ol({ children }) {
            return <ol className={`mb-3 pl-5 list-decimal space-y-1 ${dark ? "text-white/82" : "text-black font-bold"}`}>{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-snug">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote
                className={`my-3 border-l-2 pl-3 italic ${dark ? "border-white/20 text-white/60" : "border-black/25 text-black/75"}`}
              >
                {children}
              </blockquote>
            );
          },
          h1({ children }) {
            return <h1 className={`text-base font-black mb-2 mt-4 first:mt-0 ${dark ? "text-white" : "text-black"}`}>{children}</h1>;
          },
          h2({ children }) {
            return <h2 className={`text-sm font-black mb-2 mt-4 first:mt-0 ${dark ? "text-white/95" : "text-black"}`}>{children}</h2>;
          },
          h3({ children }) {
            return <h3 className={`text-[13px] font-bold mb-2 mt-3 first:mt-0 ${dark ? "text-white/92" : "text-black"}`}>{children}</h3>;
          },
          hr() {
            return <hr className={`my-4 border-0 border-t ${dark ? "border-white/12" : "border-black/15"}`} />;
          },
          a({ href, children }) {
            return (
              <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full text-left text-[12px]">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-black/40 text-white/80">{children}</thead>;
          },
          th({ children }) {
            return <th className="px-2 py-1.5 font-bold border-b border-white/10">{children}</th>;
          },
          td({ children }) {
            return <td className={`px-2 py-1.5 border-t ${dark ? "border-white/[0.08] text-white/75" : "border-black/10 text-black"}`}>{children}</td>;
          },
          code({ inline, className, children }) {
            if (inline) {
              return (
                <code
                  className={
                    dark
                      ? "rounded px-1 py-0.5 bg-black/45 text-[#d9ff00]/95 font-mono text-[11px]"
                      : "rounded px-1 py-0.5 bg-black/10 font-mono text-[11px] text-black font-bold"
                  }
                >
                  {children}
                </code>
              );
            }
            const match = /language-(\w+)/.exec(className || "");
            const lang = match?.[1];
            const body = String(children).replace(/\n$/, "");
            if (compositionFence(lang, body)) {
              return (
                <div className="my-4 p-2.5 bg-black/40 rounded-lg border border-[#d9ff00]/20 flex items-center gap-2 text-[10px] font-black text-[#d9ff00] uppercase tracking-wide">
                  <FaCode className="shrink-0" />
                  <span>Composition in right panel — open Composition code / Browser preview</span>
                </div>
              );
            }
            return (
              <pre className={`my-3 p-3 rounded-xl overflow-x-auto text-[11px] font-mono border ${dark ? "bg-black/50 border-white/10 text-white/85" : "bg-black/[0.08] border-black/15 text-black"}`}>
                <code>{children}</code>
              </pre>
            );
          },
          strong({ children }) {
            return <strong className={dark ? "text-white font-bold" : "text-black"}>{children}</strong>;
          },
          em({ children }) {
            return <em className={dark ? "text-white/80" : "text-black/80"}>{children}</em>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function HyperframeStudio({ apiKey }) {
  const {
    messages,
    setMessages,
    generatedCode,
    setGeneratedCode,
    showCode,
    setShowCode,
    planFirst,
    setPlanFirst,
    rightTab,
    setRightTab,
    resetWorkspace,
  } = useHyperframeStudioStore(
    useShallow((s) => ({
      messages: s.messages,
      setMessages: s.setMessages,
      generatedCode: s.generatedCode,
      setGeneratedCode: s.setGeneratedCode,
      showCode: s.showCode,
      setShowCode: s.setShowCode,
      planFirst: s.planFirst,
      setPlanFirst: s.setPlanFirst,
      rightTab: s.rightTab,
      setRightTab: s.setRightTab,
      resetWorkspace: s.resetWorkspace,
    })),
  );

  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [generationKind, setGenerationKind] = useState(null); // 'plan' | 'compose' | null
  const [awaitingPlanApproval, setAwaitingPlanApproval] = useState(false);
  const [generationClock, setGenerationClock] = useState({ elapsedMs: 0, displayPct: 0 });
  const [previewNonce, setPreviewNonce] = useState(0);

  const scrollRef = useRef(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  function extractCompositionHtml(content) {
    let codeMatch = content.match(/```html\s*([\s\S]*?)```/i);
    if (!codeMatch) {
      const generic = content.match(/```\s*([\s\S]*?)```/);
      if (generic) {
        const inner = generic[1].trim();
        if (/^<!DOCTYPE|^<html[\s>/]/i.test(inner)) codeMatch = generic;
      }
    }
    return codeMatch ? codeMatch[1].trim() : null;
  }

  /** Pass full transcript including newest user bubble; appends assistant message on success */
  async function sendChat(thread, generationMode, { suppressHtmlExtract = false } = {}) {
    setIsProcessing(true);
    setGenerationKind(generationMode);
    try {
      const response = await fetch('/api/hyperframes/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {}) },
        body: JSON.stringify({
          messages: thread,
          system_prompt: generationMode === 'plan' ? SYSTEM_PROMPT_PLAN : SYSTEM_PROMPT_COMPOSE,
          skill: 'hyperframes',
          generation_mode: generationMode,
        })
      });

      const data = await response.json().catch(() => ({}));

      if (data.error && !data.content) {
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      }

      if (data.content) {
        const assistantMsg = { role: 'assistant', content: data.content };
        const nextThread = [...thread, assistantMsg];
        setMessages(nextThread);

        if (!suppressHtmlExtract && generationMode === 'compose') {
          const html = extractCompositionHtml(data.content);
          if (html) {
            setGeneratedCode(html);
            setPreviewNonce((n) => n + 1);
            setRightTab("preview");
            setShowCode(true);
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      const fail = [...thread, {
        role: 'assistant',
        content: `Error: ${detail.includes('Failed to fetch') ? 'Failed to connect to the Hyperframe chat service.' : detail}`,
      }];
      setMessages(fail);
      return false;
    } finally {
      setIsProcessing(false);
      setGenerationKind(null);
    }
    return true;
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!isProcessing) {
      setGenerationClock({ elapsedMs: 0, displayPct: 0 });
      return undefined;
    }
    const t0 = Date.now();
    const tick = () => {
      const elapsedMs = Date.now() - t0;
      setGenerationClock({
        elapsedMs,
        displayPct: estimateDisplayPercent(elapsedMs),
      });
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [isProcessing]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMsg = { role: 'user', content: input.trim() };
    const thread = [...messages, userMsg];
    setMessages(thread);
    setInput("");
    setAwaitingPlanApproval(false);

    if (planFirst) {
      const ok = await sendChat(thread, 'plan');
      if (ok) setAwaitingPlanApproval(true);
    } else {
      await sendChat(thread, 'compose');
    }
  };

  const handleApprovePlanBuild = () => {
    if (isProcessing) return;
    const approval = {
      role: 'user',
      content:
        'Plan approved. Generate the complete self-contained HTML composition implementing the plan above. Follow Hyperframes/student-kit-friendly GSAP patterns (e.g. window.__timelines), load GSAP from CDN, and output exactly one ```html fenced block with the full document.',
    };
    const thread = [...messagesRef.current, approval];
    setMessages(thread);
    setAwaitingPlanApproval(false);
    void sendChat(thread, 'compose');
  };

  const handleDiscardPlanGate = () => {
    setAwaitingPlanApproval(false);
  };

  const handleTemplateClick = (prompt) => {
    setInput(prompt);
  };

  const handleDownloadHtml = () => {
    if (!generatedCode.trim()) return;
    const blob = new Blob([generatedCode], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hyperframe-composition-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setRightTab(id)}
      className={`text-[10px] font-black uppercase tracking-widest h-12 border-b-2 transition-colors ${
        rightTab === id
          ? "text-[#d9ff00] border-[#d9ff00]"
          : "text-white/40 hover:text-white border-transparent"
      }`}
    >
      {label}
    </button>
  );

  const handleClosePanel = () => {
    setShowCode(false);
    setRightTab("code");
  };

  return (
    <div className="h-full flex flex-col bg-[#030303] text-white">
      {/* Header */}
      <div className="flex-shrink-0 h-16 border-b border-white/5 flex items-center justify-between px-8 bg-black/40">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#d9ff00]/10 flex items-center justify-center text-[#d9ff00] border border-[#d9ff00]/20">
            <FaTerminal className="text-sm" />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">
              Hyperframe <span className="text-[#d9ff00]">Studio</span>
            </h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">AI Video Engineering</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            title="Clear chat and preview (local)"
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm("Reset Hyperframe Studio locally? Messages and preview will be cleared.")
              )
                return;
              resetWorkspace();
              setAwaitingPlanApproval(false);
              setPreviewNonce(0);
            }}
            className="text-[10px] font-black uppercase tracking-widest text-white/35 hover:text-white border border-transparent hover:border-white/15 px-3 py-1.5 rounded-lg"
          >
            Reset
          </button>
          <div className="flex items-center gap-3">
            <SkillBadge label="Interactive" />
            <SkillBadge label="Remotion Port" />
            <SkillBadge label="Dynamic Data" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        
        {/* Chat Side */}
        <div className={`flex-1 flex flex-col border-r border-white/5 transition-all duration-500 ${showCode ? 'max-w-[40%]' : 'max-w-full'}`}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl p-4 ${
                    m.role === "user"
                      ? "bg-[#d9ff00]"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  <ChatMessageMarkdown role={m.role} content={m.content} />
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="max-w-[85%] rounded-2xl border border-[#d9ff00]/25 bg-black/35 p-4 space-y-2">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-[#d9ff00]">
                    <div className="w-2 h-2 rounded-full bg-[#d9ff00] animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                      {generationKind === 'plan' ? 'Drafting creative plan' : 'Generating HTML composition'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-white/70">
                    {formatElapsed(generationClock.elapsedMs)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#d9ff00]/90 rounded-full transition-[width] duration-300 ease-out"
                    style={{ width: `${generationClock.displayPct}%` }}
                  />
                </div>
                <p className="text-[10px] text-white/45 leading-snug">
                  Activity ~{generationClock.displayPct}% (time-based — not streamed from model).
                  {generationKind === 'plan'
                    ? ' Plans are short — usually finishes in a few tens of seconds.'
                    : ' HTML passes may take ~15–90s.'}
                </p>
                <p className="text-[10px] text-white/50 leading-snug border-t border-white/5 pt-2">
                  When the reply includes a fenced{' '}
                  <code className="rounded bg-black/40 px-1 font-mono text-[#d9ff00]/90">{'`'.repeat(3)}html</code>
                  {' '}code block — or unprompted fenced HTML — the full file opens automatically in{' '}
                  <span className="text-[#d9ff00] font-bold">Composition Code</span> on the right (chat stays on the left).
                </p>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-8 border-t border-white/5 bg-black/20 space-y-3">
            {awaitingPlanApproval && !isProcessing && (
              <div className="rounded-2xl border border-[#d9ff00]/35 bg-[#d9ff00]/[0.06] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-[11px] text-white/70 leading-snug">
                  <span className="font-black uppercase tracking-wider text-[#d9ff00] text-[10px]">Plan ready.</span>{' '}
                  Read it above, then approve to generate full HTML — or send a revision in the prompt.
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleApprovePlanBuild}
                    className="px-4 py-2 rounded-xl bg-[#d9ff00] text-black text-[10px] font-black uppercase tracking-wider hover:opacity-95"
                  >
                    Build composition
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardPlanGate}
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider text-white/65 hover:bg-white/10"
                  >
                    Dismiss banner
                  </button>
                </div>
              </div>
            )}
            {messages.length === 1 && (
                <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
                    {TEMPLATES.map(t => (
                        <button 
                            key={t.id}
                            onClick={() => handleTemplateClick(t.prompt)}
                            className="whitespace-nowrap px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 hover:border-[#d9ff00]/20 transition-all"
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}
            <label className="flex items-center gap-2 text-[10px] text-white/45 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={planFirst}
                onChange={(e) => {
                  setPlanFirst(e.target.checked);
                  if (!e.target.checked) setAwaitingPlanApproval(false);
                }}
                className="rounded border-white/20 bg-white/5 text-[#d9ff00] focus:ring-[#d9ff00]/40"
              />
              Review plan first (no HTML until you click &quot;Build composition&quot;)
            </label>
            <p className="text-[10px] text-white/30">
              MP4 exports: use{' '}
              <a
                href={STUDENT_KIT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#d9ff00]/80 underline underline-offset-2 hover:text-[#d9ff00]"
              >
                hyperframes-student-kit
              </a>{' '}
              locally (<code className="text-white/40">hyperframes render</code>).
            </p>
            <div className="relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                placeholder="Describe your video or paste code to port..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-[13px] text-white focus:outline-none focus:border-[#d9ff00]/50 min-h-[100px] resize-none pr-16"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isProcessing}
                className="absolute bottom-4 right-4 w-10 h-10 rounded-xl bg-[#d9ff00] text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
              >
                <FaMagic />
              </button>
            </div>
          </div>
        </div>

        {/* Code / Preview Side */}
        {showCode && (
          <div className="flex-1 flex flex-col bg-[#050505] animate-fade-in-right min-h-0">
            <div className="flex-shrink-0 border-b border-white/5 px-6 py-2 bg-black/40 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-4">
                  {tabBtn("code", "Composition code")}
                  {tabBtn("preview", "Browser preview")}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    title="Download HTML file (open in Chrome to play)"
                    onClick={handleDownloadHtml}
                    className="p-2 text-white/50 hover:text-[#d9ff00] transition-colors rounded-lg hover:bg-white/5"
                  >
                    <FaDownload size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={handleClosePanel}
                    className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white px-3 py-2"
                  >
                    Close
                  </button>
                </div>
              </div>
              <p className="text-[10px] text-white/38 leading-snug pb-1 max-w-[48rem]">
                This studio does <span className="text-white/55">not</span> output an MP4. You get{' '}
                <span className="text-[#d9ff00]/90">interactive HTML/GSAP</span> — preview it here,{' '}
                <button
                  type="button"
                  onClick={handleDownloadHtml}
                  className="text-[#d9ff00] underline underline-offset-2 hover:text-[#e8ff47]"
                >
                  download .html
                </button>
                , then open in a browser or screen-record playback to make a clip.
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {rightTab === "code" ? (
                <pre className="flex-1 overflow-auto p-6 text-[12px] font-mono text-white/65 selection:bg-[#d9ff00]/25 custom-scrollbar">
                  <code>{generatedCode}</code>
                </pre>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setPreviewNonce((n) => n + 1)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#d9ff00] text-black text-[10px] font-black uppercase tracking-widest hover:opacity-95"
                    >
                      <FaPlay className="text-[11px]" />
                      Reload preview
                    </button>
                  </div>
                  <div className="flex-1 min-h-[200px] rounded-xl border border-white/10 bg-black overflow-hidden">
                    {/* Model-generated HTML: allow-scripts needed for GSAP; isolated via sandbox */}
                    <iframe
                      title="Hyperframe preview"
                      key={previewNonce}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      referrerPolicy="no-referrer"
                      className="w-full h-full min-h-[420px] border-0 bg-white"
                      srcDoc={generatedCode}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!showCode && isProcessing && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-[#050505] border-l border-[#d9ff00]/15">
                <div className="w-20 h-20 rounded-[1.75rem] bg-[#d9ff00]/5 border border-[#d9ff00]/25 flex items-center justify-center mb-6 animate-pulse">
                    <FaCode className="text-[#d9ff00]/50" size={36} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.25em] text-[#d9ff00]/90 mb-3">
                  {generationKind === 'plan' ? 'Outlining composition' : 'Awaiting composition'}
                </h3>
                <p className="text-white/55 text-[13px] max-w-xs leading-relaxed mb-4">
                  {generationKind === 'plan'
                    ? 'Plans land in chat only. After you approve, HTML + preview open on the right.'
                    : 'When ready, open Browser preview on the right; download .html as needed.'}
                </p>
                <p className="text-[11px] text-white/35 font-mono tabular-nums">
                  Running {formatElapsed(generationClock.elapsedMs)}
                </p>
            </div>
        )}

        {!showCode && !isProcessing && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-20 bg-[radial-gradient(circle_at_center,rgba(217,255,0,0.03)_0%,transparent_70%)]">
                <div className="w-24 h-24 rounded-[2rem] bg-white/[0.02] border border-white/10 flex items-center justify-center text-white/10 mb-8">
                    <FaCode size={40} />
                </div>
                <h3 className="text-xl font-bold mb-4 tracking-tight">Code-First Video Studio</h3>
                <p className="text-white/40 text-sm max-w-md leading-relaxed">
                    You get a living <span className="text-white/60">HTML composition</span>, not an automatic MP4. After generation: watch it in{' '}
                    <span className="text-white/55">Browser preview</span>, or download the <span className="text-white/55">.html</span> file and open it in Chrome —
                    then screen-record or export with your own render pipeline if you need a clip file.
                </p>
                <div className="grid grid-cols-2 gap-4 mt-12 w-full max-w-xl">
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-left">
                        <h4 className="text-[#d9ff00] text-[10px] font-black uppercase mb-2">Mechanical Porting</h4>
                        <p className="text-xs text-white/60">Convert React video components into high-performance HTML/GSAP.</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 text-left">
                        <h4 className="text-[#d9ff00] text-[10px] font-black uppercase mb-2">Deterministic Motion</h4>
                        <p className="text-xs text-white/60">Pixel-perfect timing that renders identically across any hardware.</p>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}
