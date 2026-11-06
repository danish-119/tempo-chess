/**
 * Facts and copy for the landing page. The numbers are real: tests/unit/landing-facts.test.ts compares each one with the
 * data it describes, so the page can never promise more than the app contains.
 */
export const FACTS = {
  bots: 10,
  puzzles: 10_000,
  endgames: 18,
  openings: 22,
  tactics: 27,
  glossaryTerms: 116,
} as const;
