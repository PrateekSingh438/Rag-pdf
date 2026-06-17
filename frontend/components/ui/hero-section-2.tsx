"use client";
// Split hero: animated text/CTA column on the left, a clip-path image reveal on
// the right. Adapted from a 21st.dev (Magic MCP) component to this codebase —
// uses our `cn`, design tokens, next/link, and is reduced-motion aware. The
// original generic "contact info" row (website/phone/address) was replaced with
// a flexible `highlights` row that takes our own icon set.
import React from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

interface HeroAction {
  text: string;
  href: string;
}

interface HeroHighlight {
  icon: React.ReactNode;
  label: string;
}

interface HeroSectionProps {
  className?: string;
  logo?: {
    icon?: React.ReactNode;
    url?: string;
    alt?: string;
    text?: string;
  };
  slogan?: string;
  title: React.ReactNode;
  subtitle: string;
  callToAction: HeroAction;
  secondaryAction?: HeroAction;
  backgroundImage: string;
  highlights?: HeroHighlight[];
}

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const HeroSection = React.forwardRef<HTMLElement, HeroSectionProps>(
  (
    { className, logo, slogan, title, subtitle, callToAction, secondaryAction, backgroundImage, highlights },
    ref,
  ) => {
    const reduce = useReducedMotion();

    // Stagger the left-column children in; collapse to a no-op when the user
    // prefers reduced motion.
    const container: Variants = {
      hidden: { opacity: reduce ? 1 : 0 },
      visible: {
        opacity: 1,
        transition: { staggerChildren: reduce ? 0 : 0.15, delayChildren: reduce ? 0 : 0.2 },
      },
    };

    const item: Variants = {
      hidden: { y: reduce ? 0 : 20, opacity: reduce ? 1 : 0 },
      visible: { y: 0, opacity: 1, transition: { duration: reduce ? 0 : 0.5, ease: "easeOut" } },
    };

    return (
      <motion.section
        ref={ref}
        className={cn(
          "relative flex w-full flex-col overflow-hidden text-foreground md:flex-row",
          className,
        )}
        initial="hidden"
        animate="visible"
        variants={container}
      >
        {/* Left: content */}
        <div className="flex w-full flex-col justify-between gap-12 p-8 md:w-1/2 md:p-12 lg:w-3/5 lg:p-16">
          <div>
            <motion.header className="mb-10" variants={item}>
              {logo ? (
                <div className="flex items-center gap-3">
                  {logo.icon ? (
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-rose-600 via-rose-500 to-orange-500 text-white shadow-md shadow-rose-600/30 ring-1 ring-white/30">
                      {logo.icon}
                    </span>
                  ) : logo.url ? (
                    <img src={logo.url} alt={logo.alt ?? ""} className="h-8" />
                  ) : null}
                  <div>
                    {logo.text && <p className="font-display text-lg font-bold text-foreground">{logo.text}</p>}
                    {slogan && <p className="text-xs tracking-widest text-muted-foreground">{slogan}</p>}
                  </div>
                </div>
              ) : (
                slogan && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200/70 bg-white/60 px-3 py-1 text-xs font-semibold tracking-widest text-rose-700 shadow-sm backdrop-blur-sm dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                    {slogan}
                  </span>
                )
              )}
            </motion.header>

            <motion.div variants={container}>
              <motion.h1
                className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground md:text-5xl lg:text-6xl"
                variants={item}
              >
                {title}
              </motion.h1>
              <motion.div className="my-6 h-1 w-20 rounded-full bg-linear-to-r from-rose-600 to-orange-500" variants={item} />
              <motion.p className="mb-8 max-w-md text-base leading-relaxed text-muted-foreground" variants={item}>
                {subtitle}
              </motion.p>
              <motion.div className="flex flex-wrap items-center gap-3" variants={item}>
                <Link
                  href={callToAction.href}
                  className="inline-flex items-center gap-2 rounded-xl bg-linear-to-br from-rose-600 via-rose-500 to-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/25 transition-all hover:-translate-y-0.5 hover:brightness-105"
                >
                  {callToAction.text} <ArrowIcon />
                </Link>
                {secondaryAction && (
                  <Link
                    href={secondaryAction.href}
                    className="rounded-xl border border-slate-300/70 bg-white/60 px-6 py-3 text-sm font-semibold text-slate-700 backdrop-blur-sm transition-colors hover:bg-white dark:border-slate-600/70 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {secondaryAction.text}
                  </Link>
                )}
              </motion.div>
            </motion.div>
          </div>

          {highlights && highlights.length > 0 && (
            <motion.footer className="w-full" variants={item}>
              <div className="grid grid-cols-1 gap-5 text-sm text-muted-foreground sm:grid-cols-3">
                {highlights.map((h) => (
                  <div key={h.label} className="flex items-center gap-2.5">
                    <span className="shrink-0 text-primary">{h.icon}</span>
                    <span>{h.label}</span>
                  </div>
                ))}
              </div>
            </motion.footer>
          )}
        </div>

        {/* Right: image with a diagonal clip-path reveal */}
        <motion.div
          className="min-h-75 w-full bg-cover bg-center md:min-h-full md:w-1/2 lg:w-2/5"
          style={{ backgroundImage: `url(${backgroundImage})` }}
          initial={reduce ? false : { clipPath: "polygon(100% 0, 100% 0, 100% 100%, 100% 100%)" }}
          animate={{ clipPath: "polygon(25% 0, 100% 0, 100% 100%, 0% 100%)" }}
          transition={{ duration: reduce ? 0 : 1.2, ease: "circOut" }}
          aria-hidden="true"
        />
      </motion.section>
    );
  },
);

HeroSection.displayName = "HeroSection";

export { HeroSection };
