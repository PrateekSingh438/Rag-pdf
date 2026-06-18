"use client";
// Logged-out landing — an Apple-style, cinematic marketing page (modelled on
// apple.com/mac). Monochrome black/white that supports BOTH light and dark mode:
// all colors come from the .lp CSS variables (see globals.css) which flip with the
// app's .dark theme. Animations use framer-motion: a load stagger, scroll-reveal
// sections, a parallax hero reveal, a pinned/scrubbed sticky showcase, count-up stats.
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform, useReducedMotion, useMotionValue, useSpring, type Variants } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Spinner } from "@/components/ui";
import { CountUp } from "@/components/motion";
import { StudyMateLogo, StudyMateMark } from "@/components/StudyMateLogo";
import {
  IconSun, IconMoon, IconMenu, IconX, IconUpload, IconCamera, IconFile,
  IconSparkles, IconTarget, IconShieldCheck, IconClipboard, IconCalendar,
} from "@/components/icons";
import * as api from "@/lib/api";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/* Editorial eyebrow label (uppercase, tracked) — used above every section title. */
const EYEBROW = "text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--lp-eyebrow)]";

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

/* Thin top scroll-progress bar (Apple-style). */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  return <motion.div aria-hidden className="fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-[var(--lp-fg)]" style={{ scaleX }} />;
}

/* Subtle magnetic + scale pull toward the cursor (off for reduced motion). */
function Magnetic({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 200, damping: 15, mass: 0.3 });
  const y = useSpring(my, { stiffness: 200, damping: 15, mass: 0.3 });
  return (
    <motion.div
      ref={ref}
      className={className}
      style={reduce ? undefined : { x, y }}
      onMouseMove={(e) => {
        if (reduce || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        mx.set((e.clientX - (r.left + r.width / 2)) * 0.35);
        my.set((e.clientY - (r.top + r.height / 2)) * 0.35);
      }}
      onMouseLeave={() => { mx.set(0); my.set(0); }}
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
  const reduce = useReducedMotion();
  return (
    <GlassFrame label="Scanned paper · OCR">
      <div className="flex items-center gap-5">
        <div className="relative h-40 w-32 shrink-0 overflow-hidden rounded-lg bg-[var(--lp-card-2)] ring-1 ring-[var(--lp-hair)]">
          <div className="space-y-2 p-3 opacity-50 blur-[1px]">
            {[90, 70, 80, 60, 75, 50].map((w, i) => <div key={i} className="h-1.5 rounded-full bg-[var(--lp-muted)]" style={{ width: `${w}%` }} />)}
          </div>
          <motion.div
            className="absolute inset-x-0 top-0 h-10"
            style={{ background: "linear-gradient(to bottom, transparent, var(--lp-scan), transparent)" }}
            animate={reduce ? undefined : { top: ["-10%", "100%"] }}
            transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
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
  const [open, setOpen] = useState(false);
  const links: [string, string][] = [
    ["#features", "Overview"],
    ["#how", "How it works"],
    ["#specs", "Specs"],
  ];
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
          {links.map(([h, l]) => (
            <a key={h} href={h} className="transition-opacity hover:opacity-60">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[13px] sm:gap-4">
          <button
            onClick={toggle}
            aria-label="Toggle light/dark mode"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-fg)]"
          >
            {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
          </button>
          <Link href="/login" className="hidden text-[var(--lp-muted)] transition-opacity hover:opacity-60 sm:inline">Sign in</Link>
          <Link href="/register" className="rounded-full bg-[var(--lp-btn)] px-3.5 py-1 font-medium text-[var(--lp-btn-fg)] transition-transform hover:scale-[1.03]">Get started</Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
            className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[var(--lp-fg)] sm:hidden"
          >
            {open ? <IconX size={18} /> : <IconMenu size={18} />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="border-t border-[var(--lp-hair)] px-5 py-2 sm:hidden">
          <div className="flex flex-col">
            {links.map(([h, l]) => (
              <a key={h} href={h} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-[15px] text-[var(--lp-fg)] transition-colors hover:bg-[var(--lp-soft)]">{l}</a>
            ))}
            <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-[15px] text-[var(--lp-fg)] transition-colors hover:bg-[var(--lp-soft)]">Sign in</Link>
          </div>
        </div>
      )}
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
        <motion.p variants={item} className={`mb-5 ${EYEBROW}`}>
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
        <motion.div variants={item} className="mt-8">
          <Link
            href="/benchmark"
            className="group inline-flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-full border border-[var(--lp-hair)] bg-[var(--lp-soft)] px-4 py-1.5 text-[13px] text-[var(--lp-muted)] transition-colors hover:text-[var(--lp-fg)]"
          >
            <span className="font-semibold text-[var(--lp-fg)]">98% hit@3</span>
            <span className="hidden h-3 w-px bg-[var(--lp-hair)] sm:inline-block" />
            <span className="font-semibold text-[var(--lp-fg)]">0.92 MRR</span>
            <span className="hidden sm:inline">· on a held-out test set</span>
            <span aria-hidden className="transition-transform group-hover:translate-x-0.5">›</span>
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
        <motion.div
          animate={reduce ? undefined : { y: [0, -10, 0] }}
          transition={reduce ? undefined : { repeat: Infinity, duration: 6, ease: "easeInOut" }}
        >
          <AnswerMockup />
        </motion.div>
        <div className="pointer-events-none absolute inset-x-0 -bottom-px h-28 bg-gradient-to-b from-transparent to-[var(--lp-bg)]" />
      </motion.div>
    </section>
  );
}

function Feature({ id, eyebrow, title, body, image, flip = false, children }: {
  id?: string; eyebrow?: string; title: ReactNode; body: string; image?: string; flip?: boolean; children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const titleCls = "text-[clamp(2.4rem,6vw,4.25rem)] font-semibold leading-[1.03] tracking-[-0.03em] text-[var(--lp-fg)]";
  return (
    <section id={id} className="mx-auto grid max-w-[1024px] items-center gap-10 px-5 py-[clamp(5.5rem,13vw,11rem)] md:grid-cols-2 md:gap-14">
      <Rise y={40} className={flip ? "md:order-2" : ""}>
        <div>
          {eyebrow && <p className={`mb-3 ${EYEBROW}`}>{eyebrow}</p>}
          <h2 className={titleCls}>{title}</h2>
          <p className="mt-5 max-w-md text-[21px] leading-relaxed text-[var(--lp-muted)]">{body}</p>
        </div>
      </Rise>
      <motion.div
        className={flip ? "md:order-1" : ""}
        initial={reduce ? false : { opacity: 0, x: flip ? -50 : 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        {image ? (
          <div
            className="relative overflow-hidden rounded-[28px] bg-cover bg-center shadow-[0_40px_120px_-30px_rgba(0,0,0,0.55)]"
            style={{ backgroundImage: `url(${image})` }}
          >
            <div className="bg-gradient-to-br from-black/45 to-black/25 p-6 sm:p-9">{children}</div>
          </div>
        ) : (
          children
        )}
      </motion.div>
    </section>
  );
}

/* "How it works" — the RAG pipeline, animating in step by step. */
function Pipeline() {
  const reduce = useReducedMotion();
  const steps = [
    { icon: <IconUpload size={22} />, t: "Upload", d: "Notes & past papers" },
    { icon: <IconCamera size={22} />, t: "OCR", d: "Read scanned pages" },
    { icon: <IconFile size={22} />, t: "Chunk", d: "Split into passages" },
    { icon: <IconSparkles size={22} />, t: "Embed", d: "Index for search" },
    { icon: <IconTarget size={22} />, t: "Rerank", d: "Surface the best sources" },
    { icon: <IconShieldCheck size={22} />, t: "Answer", d: "Cited & self-checked" },
  ];
  const container: Variants = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.12 } } };
  const node: Variants = { hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } };
  return (
    <section id="how" className="mx-auto max-w-[1024px] px-5 py-[clamp(6rem,14vw,12rem)]">
      <Rise className="mb-14 text-center">
        <p className={`mb-3 ${EYEBROW}`}>How it works</p>
        <h2 className="text-[clamp(2.2rem,5.5vw,3.75rem)] font-semibold tracking-[-0.03em] text-[var(--lp-fg)]">From PDF to cited answer.</h2>
        <p className="mx-auto mt-4 max-w-xl text-[19px] leading-relaxed text-[var(--lp-muted)]">A real retrieval pipeline — every step runs over your own material, end to end.</p>
      </Rise>
      <motion.ol
        variants={container}
        initial={reduce ? false : "hidden"}
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="flex flex-col gap-3 md:flex-row md:items-start md:gap-0"
      >
        {steps.map((s, i) => (
          <Fragment key={s.t}>
            <motion.li variants={node} className="flex items-center gap-4 md:flex-1 md:flex-col md:gap-3 md:text-center">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[var(--lp-hair)] bg-[var(--lp-soft)] text-[var(--lp-fg)]">
                {s.icon}
              </span>
              <div>
                <p className="text-[15px] font-semibold text-[var(--lp-fg)]">{s.t}</p>
                <p className="text-[13px] text-[var(--lp-muted)]">{s.d}</p>
              </div>
            </motion.li>
            {i < steps.length - 1 && (
              <motion.div variants={node} aria-hidden className="flex items-center text-[var(--lp-muted)] md:h-14 md:justify-center">
                <span className="ml-[27px] md:hidden">↓</span>
                <span className="hidden md:inline">→</span>
              </motion.div>
            )}
          </Fragment>
        ))}
      </motion.ol>
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
            <Magnetic className="inline-block">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-[17px] font-medium text-black transition-all hover:scale-[1.04] hover:shadow-[0_0_40px_-4px_rgba(255,255,255,0.4)]"
              >
                Get started free <span aria-hidden>›</span>
              </Link>
            </Magnetic>
          </div>
        </Rise>
      </div>
    </section>
  );
}

function Footer() {
  const reduce = useReducedMotion();
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
      {/* Unique oversized brand wordmark — wipes up into view, bleeds off the bottom. */}
      <div className="pointer-events-none mt-6 select-none overflow-hidden text-center">
        <motion.span
          aria-hidden
          className="block translate-y-[14%] bg-gradient-to-b from-[var(--lp-fg)] to-transparent bg-clip-text text-[clamp(4rem,24vw,17rem)] font-bold leading-[0.78] tracking-[-0.04em] text-transparent opacity-[0.07]"
          initial={reduce ? false : { y: "70%" }}
          whileInView={reduce ? undefined : { y: "14%" }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 1.1, ease: EASE }}
        >
          StudyMate
        </motion.span>
      </div>
    </footer>
  );
}

/* Bento grid (Samsung/Apple-style): the whole toolkit as variable-size tiles —
   one image-first hero tile, icon cards, and a wide benchmark bar. Monochrome,
   with a subtle lift + image-zoom on hover. */
function BentoTile({ icon, title, body, className = "" }: {
  icon: ReactNode; title: string; body: string; className?: string;
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-[24px] border border-[var(--lp-hair)] bg-[var(--lp-card)] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--lp-fg)]/20 hover:shadow-[0_28px_70px_-32px_rgba(0,0,0,0.55)] ${className}`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {/* Cursor-follow spotlight (about.google-style) — a soft glow that tracks the pointer. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(260px circle at var(--mx, 50%) var(--my, 50%), var(--lp-glow), transparent 70%)" }}
      />
      <span className="relative z-10 grid h-11 w-11 place-items-center rounded-2xl border border-[var(--lp-hair)] bg-[var(--lp-soft)] text-[var(--lp-fg)] transition-transform duration-300 group-hover:scale-110">
        {icon}
      </span>
      <h3 className="relative z-10 mt-5 text-[19px] font-semibold tracking-[-0.01em] text-[var(--lp-fg)]">{title}</h3>
      <p className="relative z-10 mt-2 text-[15px] leading-relaxed text-[var(--lp-muted)]">{body}</p>
    </div>
  );
}

function BentoGrid() {
  return (
    <section id="toolkit" className="mx-auto max-w-[1024px] px-5 py-[clamp(5rem,12vw,10rem)]">
      <Rise className="mb-12 text-center">
        <p className={`mb-3 ${EYEBROW}`}>Everything in one place</p>
        <h2 className="text-[clamp(2.2rem,5.5vw,3.75rem)] font-semibold tracking-[-0.03em] text-[var(--lp-fg)]">
          One workspace for the whole exam.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[19px] leading-relaxed text-[var(--lp-muted)]">
          From the first upload to the night before the paper — every tool reads only your material.
        </p>
      </Rise>

      <div className="grid grid-cols-1 gap-4 md:auto-rows-[208px] md:grid-cols-3">
        {/* Hero tile — image-first (Samsung/Google) */}
        <Link
          href="/register"
          className="group relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-[24px] border border-[var(--lp-hair)] bg-[var(--lp-card)] md:col-span-2 md:row-span-2 md:min-h-0"
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
            style={{ backgroundImage: "url(https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1200&q=70)" }}
          />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />
          <div className="relative z-10 p-7">
            <div className="mb-4 inline-flex flex-wrap items-center gap-2 text-[12px]">
              <span className="rounded-full bg-white/15 px-2.5 py-1 font-medium text-white ring-1 ring-inset ring-white/25 backdrop-blur-sm">Grounded answer</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-white/90 ring-1 ring-inset ring-white/25 backdrop-blur-sm"><span className="font-semibold">S1</span> os-notes.pdf · p12</span>
            </div>
            <h3 className="text-[clamp(1.6rem,3.5vw,2.4rem)] font-semibold leading-[1.08] tracking-[-0.02em] text-white">
              Cited answers from your own notes.
            </h3>
            <p className="mt-3 max-w-md text-[16px] leading-relaxed text-white/75">
              Ask in plain English. Every claim links back to the exact page — and if it isn&apos;t in your material, StudyMate says so.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-medium text-white">
              Start free <span aria-hidden className="transition-transform group-hover:translate-x-1">›</span>
            </span>
          </div>
        </Link>

        <BentoTile icon={<IconCamera size={22} />} title="Reads scanned papers" body="Built-in OCR turns image-only PDFs into text you can search, quote and cite." />
        <BentoTile icon={<IconShieldCheck size={22} />} title="Self-checked" body="An agent verifies every claim against your sources, and revises before you see it." />
        <BentoTile icon={<IconTarget size={22} />} title="Exam insights" body="Mines your past papers for the highest-yield topics, so you study what's tested." />
        <BentoTile icon={<IconClipboard size={22} />} title="Scored quizzes" body="Generate practice questions from your notes and get graded instantly." />
        <BentoTile icon={<IconCalendar size={22} />} title="Day-by-day plans" body="A revision schedule built around your syllabus and exam date." />

        {/* Wide benchmark bar — dual-CTA pattern (Samsung) */}
        <Link
          href="/benchmark"
          className="group flex flex-col items-start justify-center gap-4 rounded-[24px] border border-[var(--lp-hair)] bg-[var(--lp-card)] p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--lp-fg)]/20 hover:shadow-[0_28px_70px_-32px_rgba(0,0,0,0.55)] sm:flex-row sm:items-center sm:justify-between md:col-span-3"
        >
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-[clamp(2rem,5vw,3rem)] font-semibold tracking-[-0.03em] text-[var(--lp-fg)]">
              <CountUp value={98} />%<span className="ml-1.5 align-middle text-[15px] font-medium text-[var(--lp-muted)]">hit@3</span>
            </span>
            <span className="text-[clamp(2rem,5vw,3rem)] font-semibold tracking-[-0.03em] text-[var(--lp-fg)]">
              0.92<span className="ml-1.5 align-middle text-[15px] font-medium text-[var(--lp-muted)]">MRR</span>
            </span>
            <span className="text-[15px] text-[var(--lp-muted)]">measured on a held-out test set</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--lp-hair)] bg-[var(--lp-soft)] px-4 py-2 text-[14px] font-medium text-[var(--lp-fg)] transition-colors group-hover:bg-[var(--lp-bubble)] group-hover:text-[var(--lp-bubble-fg)]">
            See the benchmark <span aria-hidden className="transition-transform group-hover:translate-x-1">›</span>
          </span>
        </Link>
      </div>
    </section>
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
      <ScrollProgress />
      <Nav />
      <Hero />
      <Feature
        id="features"
        eyebrow="Grounded answers"
        title={<>Grounded in truth.</>}
        body="Every answer is pulled only from your uploaded notes and papers — with clickable [S1] citations to the exact page. If it isn't in your material, StudyMate says so."
        image="https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&w=1200&q=70"
      >
        <AnswerMockup />
      </Feature>
      <Feature
        id="f2"
        eyebrow="Built-in OCR"
        title={<>Reads anything.</>}
        body="Most exam papers are scans. StudyMate runs OCR on image-only PDFs so every word becomes searchable, quotable, and citable."
        image="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=1200&q=70"
        flip
      >
        <ScanMockup />
      </Feature>
      <Feature
        id="f3"
        eyebrow="Plan & practise"
        title={<>Know what<br />to study.</>}
        body="Exam-insight analysis surfaces the highest-yield topics. Then generate scored quizzes and a day-by-day revision plan tailored to your course."
        image="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=70"
      >
        <PlanMockup />
      </Feature>
      <BentoGrid />
      <Pipeline />
      <StickyShowcase />
      <ImageBand />
      <Stats site={site} />
      <CTA />
      <Footer />
    </main>
  );
}
