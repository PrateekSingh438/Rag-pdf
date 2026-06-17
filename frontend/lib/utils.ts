// Tiny class-name joiner. Filters out falsy values and joins the rest with a
// space, so components can do `cn("base", condition && "extra", className)`.
// Dependency-free on purpose (the rest of the app avoids runtime helpers); if we
// ever need conflicting-class de-duplication, swap this for clsx + tailwind-merge.
export type ClassValue = string | number | false | null | undefined;

export function cn(...inputs: ClassValue[]): string {
  return inputs.filter(Boolean).join(" ");
}
