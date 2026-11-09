# Contributing

Thanks for helping! By contributing you agree that your contributions are licensed under GPL-3.0-or-later.

1. `npm install`, then `npm run dev`. For accounts and saved data, also run the API: `cd server && npm install && npm run db:migrate:local && npm run dev`.
2. Keep TypeScript strict — no `any`; prefer small pure functions in `src/lib/**` with tests in `tests/unit`.
3. Before opening a PR run `npm run check` (typecheck, lint, tests, build). For UI changes also run `npm run build && npm run test:e2e`. For API changes run `cd server && npm run typecheck && npm test`, and `node scripts/smoke.mjs` and `node scripts/online-smoke.mjs` against a running local API. Database changes go through `npm run db:generate` (never edit applied migrations).
4. Never fabricate engine output. Every classification, evaluation and explanation must come from real engine data or chess rules.
5. Don't add Chess.com assets (icons, piece sets, sounds, colours) or copy other sites' branding.
6. If you change classification or explanation rules, bump `REVIEW_VERSION` in `src/lib/review/types.ts` (saved reviews are rebuilt from stored engine output) and update `/about#method`.
