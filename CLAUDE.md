# Agent guide — graphisme-generatif

SPEC.md is the source of truth. Read it fully before changing code. If an implementation detail is ambiguous, choose the simplest deterministic option, document it in SPEC.md under the relevant section, and mention it in your report. Never silently diverge from the spec.

## Hard rules

- Determinism: no `Math.random`, `Date`, locale formatting, or unordered iteration in `src/core`, `src/notation`, `src/render`. All randomness goes through `src/core/prng.ts` streams (SPEC §7).
- Zero runtime dependencies. Dev dependencies only as listed in SPEC §12.
- The two stages stay separate: `src/core` produces data only; `src/render` makes no decisions.
- Never add images of Vasarely's works to the repository (not in tests, fixtures, docs or examples).
- Never create presets, examples, tests or names that target or are named after a specific artwork or series (e.g. no "vega", "cta", "arny" presets). Use the neutral profile names from SPEC §6.6.
- Golden snapshots are the output contract. If a change alters them, say so explicitly and add a CHANGELOG entry explaining why.

## Conventions

- TypeScript strict, ESM, Node ≥ 20. Biome for lint/format.
- Domain identifiers use the French terms from SPEC §2 without diacritics (`etage`, `parcours`, `aleatoire`). Comments and docs in English.
- Small pure functions, exhaustive `switch` on unions with `never` checks.
- Public API exactly as in SPEC §11.

## Commands

- `npm run build` — tsup bundle (ESM + d.ts)
- `npm test` — vitest
- `npm run lint` — biome check
- `npm run typecheck` — tsc --noEmit
- `npm run palette` — regenerate `src/palette/alphabet-6x12.json`
- `npm run examples` — regenerate `examples/out/*`
