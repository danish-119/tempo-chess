/** Joins class names, skipping falsy values. Lives outside any "use client" file so server components can use it too. */
export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
