// StudyMate brand mark: a minimal open-book glyph with a small spark (the "AI
// answer"). Single-color via currentColor so it tints cleanly on any surface.
import { SVGProps } from "react";

export function StudyMateMark({ size = 28, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path
        d="M16 9.4C13 7.5 8.3 7.5 5.6 8.8V24.4c2.7-1.3 7.4-1.3 10.4.6 3-1.9 7.7-1.9 10.4-.6V8.8C24.7 7.5 19 7.5 16 9.4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M16 9.4V25" stroke="currentColor" strokeWidth="2" />
      <path d="M25.4 2.6l.92 2.48L28.8 6l-2.48.92-.92 2.48-.92-2.48L22 6l2.48-.92z" fill="currentColor" />
    </svg>
  );
}

export function StudyMateLogo({
  className = "",
  textClassName = "",
  size = 26,
}: {
  className?: string;
  textClassName?: string;
  size?: number;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <StudyMateMark size={size} />
      <span className={`text-[17px] font-semibold tracking-[-0.02em] ${textClassName}`}>StudyMate</span>
    </span>
  );
}
