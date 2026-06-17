"use client";
// Logged-out landing — an Apple-style, cinematic marketing page (modelled on
// apple.com/mac). Monochrome black/white that supports BOTH light and dark mode:
// all colors come from the .lp CSS variables (see globals.css) which flip with the
// app's .dark theme. Animations use framer-motion: a load stagger, scroll-reveal
// sections, a parallax hero reveal, a pinned/scrubbed sticky showcase, count-up stats.
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform, useReducedMotion, type Variants } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Spinner } from "@/components/ui";
import { CountUp } from "@/components/motion";
import { StudyMateLogo, StudyMateMark } from "@/components/StudyMateLogo";
import { IconSun, IconMoon } from "@/components/icons";
import * as api from "@/lib/api";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* Fade + rise into view on scroll (Apple's signature reveal). */
function Rise({ children, y = 60, delay = 0, className = "", amount = 0.4 }: {
  children: ReactNode; y?: number; delay?: number; className?: string; amount?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── Mockups ─────────────────────────────────────────────────────────────── */

function GlassFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-[var(--lp-hair)] bg-[var(--lp-card)] shadow-[0_30px_90px_-30px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-1.5 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--lp-hair)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--lp-hair)]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--lp-hair)]" />
        <span className="ml-2 text-xs font-medium text-[var(--lp-muted)]">{label}</span>
      </div>
      <div className="border-t border-[var(--lp-hair)] bg-[var(--lp-card-2)] p-5">{children}</div>
    </div>
  );
}

function AnswerMockup() {
  return (
    <GlassFrame label="StudyMate · Operating Systems">
      <div className="space-y-4">
        <div className="flex justify-end">
          <div className="max-w-[78%] rounded-2xl rounded-br-md bg-[var(--lp-bubble)] px-4 py-2.5 text-[15px] text-[var(--lp-bubble-fg)] shadow-lg">
            What causes a deadlock, and how do I prevent one?
          </div>
        </div>
        <div className="max-w-[90%] space-y-3">
          <div className="rounded-2xl rounded-bl-md border border-[var(--lp-hair)] bg-[var(--lp-soft)] px-4 py-3 text-[15px] leading-relaxed text-[var(--lp-fg)]">
            A deadlock needs four conditions to hold at once — mutual exclusion, hold-and-wait, no
            preemption, and circular wait <span className="font-semibold">[S1]</span>. Break any one to
            prevent it: request all resources up front to kill hold-and-wait <span className="font-semibold">[S2]</span>.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--lp-soft)] px-2.5 py-1 text-xs text-[var(--lp-muted)] ring-1 ring-inset ring-[var(--lp-hair)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              Self-checked against sources
            </span>
            <span className="rounded-full bg-[var(--lp-soft)] px-2.5 py-1 text-xs text-[var(--lp-muted)] ring-1 ring-inset ring-[var(--lp-hair)]"><span className="font-semibold text-[var(--lp-fg)]">S1</span> os-notes.pdf · p12</span>
            <span className="rounded-full bg-[var(--lp-soft)] px-2.5 py-1 text-xs text-[var(--lp-muted)] ring-1 ring-inset ring-[var(--lp-hair)]"><span className="font-semibold text-[var(--lp-fg)]">S2</span> 2023-endsem.pdf · p3</span>
          </div>
        </div>
      </div>
    </GlassFrame>
  );
}

function ScanMockup() {
  return (
    <GlassFrame label="Scanned paper · OCR">
      <div className="flex items-center gap-5">
        <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-lg bg-[var(--lp-card-2)] ring-1 ring-[var(--lp-hair)]">
          <div className="space-y-2 p-3 opacity-50 blur-[1px]">
            {[90, 70, 80, 60, 75, 50].map((w, i) => <div key={i} className="h-1.5 rounded-full bg-[var(--lp-muted)]" style={{ width: `${w}%` }} />)}
          </div>
          <motion.div
            className="absolute inset-x-0 h-10"
            style={{ background: "linear-gradient(to bottom, transparent, var(--lp-scan), transparent)" }}
            animate={{ top: ["-10%", "100%"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="space-y-2">
          {["“circular wait”", "“mutual exclusion”", "“no preemption”"].map((t) => (
            <div key={t} className="flex items-center gap-2 text-[15px] text-[var(--lp-fg)]">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--lp-fg)] text-[11px] font-bold text-[var(--lp-bg)]">✓</span>
              {t} <span className="text-[var(--lp-muted)]">now searchable</span>
            </div>
          ))}
        </div>
      </div>
    </GlassFrame>
  );
}

function PlanMockup() {
  const days = [
    { d: "Mon", t: "Processes & threads", done: true },
    { d: "Tue", t: "Scheduling algorithms", done: true },
    { d: "Wed", t: "Deadlocks — practice quiz", done: false },
    { d: "Thu", t: "Memory & paging", done: false },
  ];
  return (
    <GlassFrame label="Your 7-day plan · OS endsem">
      <div className="space-y-2.5">
        {days.map((x) => (
          <div key={x.d} className="flex items-center gap-3 rounded-xl border border-[var(--lp-hair)] bg-[var(--lp-soft)] px-3 py-2.5">
            <span className="w-9 text-xs font-semibold text-[var(--lp-muted)]">{x.d}</span>
            <span className="flex-1 text-[15px] text-[var(--lp-fg)]">{x.t}</span>
            <span className="h-4 w-4 rounded-full ring-1 ring-inset ring-[var(--lp-hair)]" style={x.done ? { background: "var(--lp-fg)" } : undefined} />
          </div>
        ))}
      </div>
    </GlassFrame>
  );
}

/* ── Sections ────────────────────────────────────────────────────────────── */

function Nav() {
  const reduce = useReducedMotion();
  const { theme, toggle } = useTheme();
  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 border-b border-[var(--lp-hair)] bg-[var(--lp-nav)] backdrop-blur-xl backdrop-saturate-150"
      initial={reduce ? false : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <nav className="mx-auto flex h-12 max-w-[1024px] items-center justify-between px-5 text-[var(--lp-fg)]">
        <StudyMateLogo size={22} className="transition-opacity hover:opacity-70" />
        <div className="hidden items-center gap-8 text-[13px] text-[var(--lp-muted)] sm:flex">
          <a href="#features" className="transition-opacity hover:opacity-60">Overview</a>
          <a href="#showcase" className="transition-opacity hover:opacity-60">Features</a>
          <a href="#specs" className="transition-opacity hover:opacity-60">Specs</a>
        </div>
        <div className="flex items-center gap-4 text-[13px]">
          <button
            onClick={toggle}
            aria-label="Toggle light/dark mode"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-fg)]"
          >
            {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>
          <Link href="/login" className="text-[var(--lp-muted)] transition-opacity hover:opacity-60">Sign in</Link>
          <Link href="/register" className="rounded-full bg-[var(--lp-btn)] px-3.5 py-1 font-medium text-[var(--lp-btn-fg)] transition-transform hover:scale-[1.03]">Get started</Link>
        </div>
      </nav>
    </motion.header>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const stagger: Variants = { show: { transition: { staggerChildren: 0.16, delayChildren: 0.1 } } };
  const item: Variants = { hidden: { opacity: 0, y: 28 }, show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } } };

  return (
    <section ref={ref} className="relative flex min-h-screen flex-col items-center justify-center px-5 pt-20 text-center">
      <motion.div variants={stagger} initial={reduce ? false : "hidden"} animate="show" style={reduce ? undefined : { y, opacity: fade }} className="flex flex-col items-center">
        <motion.p variants={item} className="mb-5 text-[15px] font-medium tracking-wide text-[var(--lp-eyebrow)]">
          AI study companion
        </motion.p>
        <motion.h1 variants={item} className="text-[clamp(3.25rem,12vw,7.5rem)] font-semibold leading-[0.95] tracking-[-0.04em] text-[var(--lp-fg)]">
          StudyMate
        </motion.h1>
        <motion.p variants={item} className="mt-6 max-w-[640px] text-[clamp(1.3rem,3vw,1.9rem)] font-medium leading-snug text-[var(--lp-fg)]">
          Answers from your notes.<br className="hidden sm:block" /> Nothing made up.
        </motion.p>
        <motion.div variants={item} className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-[17px]">
          <a href="#features" className="inline-flex items-center gap-1 text-[var(--lp-fg)] transition-opacity hover:opacity-70">
            Learn more <span aria-hidden>›</span>
          </a>
          <Link href="/register" className="inline-flex items-center gap-1 text-[var(--lp-fg)] transition-opacity hover:opacity-70">
            Get started <span aria-hidden>›</span>
          </Link>
        </motion.div>
      </motion.div>

      {/* Hero mockup emerging from darkness */}
      <motion.div
        className="relative mt-16 w-full max-w-3xl"
        initial={reduce ? false : { opacity: 0, scale: 0.92, filter: "blur(14px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.1, ease: EASE, delay: 0.9 }}
      >
        <div className="pointer-events-none absolute -inset-x-16 -top-16 bottom-0 -z-10 blur-3xl" style={{ background: "radial-gradient(55% 45% at 50% 35%, var(--lp-glow), transparent 70%)" }} />
        <AnswerMockup />
        <div className="pointer-events-none absolute inset-x-0 -bottom-px h-28 bg-gradient-to-b from-transparent to-[var(--lp-bg)]" />
      </motion.div>
    </section>
  );
}

function Feature({ id, eyebrow, title, body, children, layout = "center" }: {
  id?: string; eyebrow?: string; title: ReactNode; body: string; children: ReactNode;
  layout?: "center" | "split";
}) {
  const reduce = useReducedMotion();
  const titleCls = "text-[clamp(2.4rem,6vw,4.25rem)] font-semibold leading-[1.03] tracking-[-0.03em] text-[var(--lp-fg)]";
  if (layout === "split") {
    return (
      <section id={id} className="mx-auto grid max-w-[1024px] items-center gap-12 px-5 py-[clamp(7rem,18vw,15rem)] md:grid-cols-2">
        <Rise y={40}>
          <div>
            {eyebrow && <p className="mb-3 text-[15px] font-medium text-[var(--lp-eyebrow)]">{eyebrow}</p>}
            <h2 className={titleCls}>{title}</h2>
            <p className="mt-5 max-w-md text-[21px] leading-relaxed text-[var(--lp-muted)]">{body}</p>
          </div>
        </Rise>
        <motion.div
          initial={reduce ? false : { opacity: 0, x: 60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          {children}
        </motion.div>
      </section>
    );
  }
  return (
    <section id={id} className="mx-auto max-w-[1024px] px-5 py-[clamp(7rem,18vw,15rem)] text-center">
      <Rise>
        {eyebrow && <p className="mb-3 text-[15px] font-medium text-[var(--lp-eyebrow)]">{eyebrow}</p>}
        <h2 className={titleCls}>{title}</h2>
        <p className="mx-auto mt-5 max-w-xl text-[21px] leading-relaxed text-[var(--lp-muted)]">{body}</p>
      </Rise>
      <Rise y={50} delay={0.1} className="mt-14">
        <div className="mx-auto max-w-2xl">{children}</div>
      </Rise>
    </section>
  );
}

/* Apple-style pinned scrub: visual stays put while three captions crossfade. */
function StickyShowcase() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const slides = [
    { k: "Ask in plain English.", s: "No prompt engineering. Just type your question like you'd ask a friend." },
    { k: "Get a cited answer.", s: "Pulled only from your notes and past papers — with the exact page attached." },
    { k: "Trust every claim.", s: "An agent re-checks each statement against your sources before you ever see it." },
  ];
  const o0 = useTransform(scrollYProgress, [0.0, 0.06, 0.28, 0.34], [0, 1, 1, 0]);
  const o1 = useTransform(scrollYProgress, [0.34, 0.40, 0.60, 0.66], [0, 1, 1, 0]);
  const o2 = useTransform(scrollYProgress, [0.66, 0.72, 0.95, 1], [0, 1, 1, 0]);
  const ops = [o0, o1, o2];
  const glow = useTransform(scrollYProgress, [0, 0.5, 1], [0.05, 0.12, 0.05]);

  if (reduce) {
    return (
      <section id="showcase" className="mx-auto max-w-[1024px] space-y-24 px-5 py-32 text-center">
        {slides.map((sl) => (
          <div key={sl.k}>
            <h2 className="text-[clamp(2rem,5vw,3.5rem)] font-semibold tracking-[-0.03em] text-[var(--lp-fg)]">{sl.k}</h2>
            <p className="mx-auto mt-4 max-w-lg text-[21px] text-[var(--lp-muted)]">{sl.s}</p>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section id="showcase" ref={ref} className="relative h-[320vh] bg-[var(--lp-bg-alt)]">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-5">
        <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1600&q=70)" }} />
        <div aria-hidden className="absolute inset-0 bg-[var(--lp-bg)]/85" />
        <motion.div className="pointer-events-none absolute h-[420px] w-[420px] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, var(--lp-glow-solid), transparent 65%)", opacity: glow }} />
        <div className="relative z-10 h-44 w-full max-w-2xl">
          {slides.map((sl, i) => (
            <motion.div key={sl.k} className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ opacity: ops[i] }}>
              <h2 className="text-[clamp(2rem,5.5vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--lp-fg)]">{sl.k}</h2>
              <p className="mx-auto mt-4 max-w-lg text-[clamp(1rem,2.5vw,1.35rem)] leading-relaxed text-[var(--lp-muted)]">{sl.s}</p>
            </motion.div>
          ))}
        </div>
        <div className="relative z-10 mt-10 grid h-12 place-items-center text-[var(--lp-fg)]">
          <StudyMateMark size={40} />
        </div>
      </div>
    </section>
  );
}

/* Full-bleed cinematic photo with a subtle parallax — breaks up the page. */
function ImageBand() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-14%", "14%"]);
  return (
    <section ref={ref} className="relative h-[78vh] w-full overflow-hidden">
      <motion.div
        aria-hidden
        className="absolute inset-0 scale-125 bg-cover bg-center"
        style={{ y, backgroundImage: "url(https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1600&q=70)" }}
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/75" />
      <div className="relative z-10 mx-auto flex h-full max-w-[1024px] flex-col items-center justify-center px-5 text-center">
        <Rise>
          <h2 className="text-[clamp(2.4rem,6vw,4.5rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-white">
            Made for how you<br className="hidden sm:block" /> actually study.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[21px] leading-relaxed text-white/80">
            Notes, slides, scanned past papers — bring it all. StudyMate turns your pile of PDFs into answers you can trust.
          </p>
        </Rise>
      </div>
    </section>
  );
}

function Stats({ site }: { site: api.SiteStats | null }) {
  const numeric: { value: number; suffix: string; label: string }[] = site
    ? [
        { value: site.total_users, suffix: "+", label: "learners" },
        { value: site.total_questions, suffix: "+", label: "questions answered" },
      ]
    : [];
  const text: { value: string; label: string }[] = [
    { value: "100%", label: "grounded in your material" },
    { value: "[S1]", label: "every claim cited to a page" },
    ...(site ? [] : [{ value: "OCR", label: "reads scanned PDFs" }, { value: "24/7", label: "always on, on the free tier" }]),
  ];

  return (
    <section id="specs" className="mx-auto max-w-[1024px] px-5 py-[clamp(6rem,14vw,12rem)]">
      <Rise className="mb-16 text-center">
        <h2 className="text-[clamp(2.2rem,5.5vw,3.75rem)] font-semibold tracking-[-0.03em] text-[var(--lp-fg)]">Built to be believed.</h2>
        <p className="mx-auto mt-4 max-w-lg text-[21px] text-[var(--lp-muted)]">Quality you can measure — not vibes.</p>
      </Rise>
      <div className="grid grid-cols-2 gap-x-6 gap-y-14 text-center md:grid-cols-4">
        {numeric.map((s, i) => (
          <Rise key={s.label} delay={i * 0.12}>
            <div className="text-[clamp(2.5rem,6vw,3.75rem)] font-semibold tracking-[-0.03em] text-[var(--lp-fg)]">
              <CountUp value={s.value} />{s.suffix}
            </div>
            <p className="mt-2 text-[15px] text-[var(--lp-muted)]">{s.label}</p>
          </Rise>
        ))}
        {text.map((s, i) => (
          <Rise key={s.label} delay={(numeric.length + i) * 0.12}>
            <div className="text-[clamp(2.5rem,6vw,3.75rem)] font-semibold tracking-[-0.03em] text-[var(--lp-fg)]">{s.value}</div>
            <p className="mt-2 text-[15px] text-[var(--lp-muted)]">{s.label}</p>
          </Rise>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="relative w-full overflow-hidden">
      <div aria-hidden className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1600&q=70)" }} />
      <div aria-hidden className="absolute inset-0 bg-black/72" />
      <div className="relative z-10 mx-auto max-w-[1024px] px-5 py-[clamp(7rem,16vw,13rem)] text-center">
        <Rise>
          <h2 className="text-[clamp(2.8rem,8vw,5.5rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-white">StudyMate</h2>
          <p className="mt-4 text-[clamp(1.4rem,3.5vw,2.2rem)] font-medium text-white/75">Study smarter, starting today.</p>
          <div className="mt-9">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[17px] font-medium text-black transition-all hover:scale-[1.03] hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.4)]"
            >
              Get started free <span aria-hidden>›</span>
            </Link>
          </div>
        </Rise>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    { h: "Product", links: ["Overview", "Features", "Specs", "Benchmark"] },
    { h: "Learn", links: ["Upload notes", "Ask questions", "Quizzes", "Study plans"] },
    { h: "Account", links: ["Sign in", "Create account", "Dashboard"] },
    { h: "About", links: ["How it works", "Privacy", "Grounded by design"] },
  ];
  return (
    <footer className="relative overflow-hidden border-t border-[var(--lp-hair)] bg-[var(--lp-bg)] px-5 pt-16">
      <div className="mx-auto grid max-w-[1024px] grid-cols-2 gap-10 md:grid-cols-4">
        {cols.map((c) => (
          <div key={c.h}>
            <h3 className="mb-3 text-[13px] font-semibold text-[var(--lp-fg)]">{c.h}</h3>
            <ul className="space-y-2.5">
              {c.links.map((l) => <li key={l}><span className="text-[13px] text-[var(--lp-muted)]">{l}</span></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-[1024px] items-center gap-2 border-t border-[var(--lp-hair)] pt-6 text-[12px] text-[var(--lp-muted)]">
        <StudyMateMark size={15} />
        StudyMate — grounded answers from your own notes and past papers.
      </div>
      {/* Unique oversized brand wordmark bleeding off the bottom edge. */}
      <Rise className="pointer-events-none mt-6 select-none text-center" y={40}>
        <span
          aria-hidden
          className="block translate-y-[14%] bg-gradient-to-b from-[var(--lp-fg)] to-transparent bg-clip-text text-[clamp(4rem,24vw,17rem)] font-bold leading-[0.78] tracking-[-0.04em] text-transparent opacity-[0.07]"
        >
          StudyMate
        </span>
      </Rise>
    </footer>
  );
}

export default function Landing() {
  const auth = useAuth();
  const router = useRouter();
  const [site, setSite] = useState<api.SiteStats | null>(null);

  useEffect(() => {
    if (!auth.loading && auth.token) router.replace("/dashboard");
  }, [auth.loading, auth.token, router]);

  useEffect(() => {
    api.recordVisit().then(setSite).catch(() => {});
  }, []);

  if (auth.loading || auth.token) {
    return (
      <div className="lp grid min-h-screen place-items-center bg-[var(--lp-bg)]">
        <Spinner />
      </div>
    );
  }

  return (
    <main className="lp relative min-h-screen bg-[var(--lp-bg)] text-[var(--lp-fg)]">
      {/* Mask the global layout aurora/coral background — this page is its own
          monochrome theme. Fixed so it covers the viewport at every scroll
          position; sits above the aurora (z -10) but behind all page content. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-[5] bg-[var(--lp-bg)]" />
      <Nav />
      <Hero />
      <Feature
        id="features"
        eyebrow="Grounded answers"
        title={<>Grounded in truth.</>}
        body="Every answer is pulled only from your uploaded notes and papers — with clickable [S1] citations to the exact page. If it isn't in your material, StudyMate says so."
      >
        <AnswerMockup />
      </Feature>
      <Feature
        id="f2"
        eyebrow="Built-in OCR"
        title={<>Reads anything.</>}
        body="Most exam papers are scans. StudyMate runs OCR on image-only PDFs so every word becomes searchable, quotable, and citable."
      >
        <ScanMockup />
      </Feature>
      <Feature
        id="f3"
        eyebrow="Plan & practise"
        title={<>Know what<br />to study.</>}
        body="Exam-insight analysis surfaces the highest-yield topics. Then generate scored quizzes and a day-by-day revision plan tailored to your course."
        layout="split"
      >
        <PlanMockup />
      </Feature>
      <StickyShowcase />
      <ImageBand />
      <Stats site={site} />
      <CTA />
      <Footer />
    </main>
  );
}
