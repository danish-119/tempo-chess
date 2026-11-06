/**
 * The Opera Game (Paul Morphy vs. the Duke of Brunswick and Count Isouard, Paris, 1858): a public-domain
 * game, used on the landing page. The review that goes with it (src/content/opera-review.json) is produced by
 * Tempo's own review pipeline and the real Stockfish build; regenerate it with
 *   GEN_LANDING=1 npx vitest run tests/integration/landing-fixture.test.ts
 */
export const OPERA_GAME = {
  title: "The Opera Game",
  white: "Paul Morphy",
  black: "Duke of Brunswick & Count Isouard",
  where: "Paris, 1858",
  pgn: `[Event "Paris Opera"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke of Brunswick and Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`,
} as const;
