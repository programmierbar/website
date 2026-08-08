# Testing `directus-extension-programmierbar-bundle`

## Running the suite

```bash
npm test          # run once
npm run test:watch
```

The full CI gate, in the order `.github/workflows/run_tests.yml` runs it:

```bash
npm run prettier:check   # formatting — fails, never rewrites
npm run lint             # ESLint over .ts and the one .vue file
npm test                 # Jest
npm run build            # directus-extension build
```

There is deliberately no typecheck step yet. `tsc` cannot currently run on this tree at all — see
[the tooling plan](../../../docs/directus-extension-tooling-plan.md), Phase 1.

## Framework

Jest with `ts-jest`. Tests live in `__tests__/` directories beside the code they cover and are named
`*.test.ts`; `jest.config.ts` matches `**/__tests__/**/*.test.ts` and nothing else.

**The suite runs as CommonJS, not ESM** — despite `jest.config.ts` asking for ESM. This is not a
detail you can ignore when writing tests, and
[ADR 0001](../../../_ADRs/0001-jest-runs-in-cjs-mode.md) explains why it is that way and what it
costs. In short: `jest.unstable_mockModule` and top-level `await` do not work, and an ESM-only
dependency anywhere in a tested import chain has to be stubbed before it can be imported.

## How to write a test here

**Prefer extracting pure functions.** The established pattern is to move business logic into a
`util/` module with no framework imports and unit-test that directly — no mocks, no module-format
problems. Five extensions already do this (`set-slug`, `member-matching`, `cascade-publish`,
`create-news`, `fetch-open-graph`), and it is the approach that will survive the move off Jest.

**When a hook's entry file must be tested directly**, use hoisted `jest.mock(...)` and stub the
ESM-only framework dependencies:

```ts
// The real `defineHook` just returns its callback, so this stub exercises the real hook logic
// without loading the untranspiled package.
jest.mock('@directus/extensions-sdk', () => ({
    defineHook: (callback: unknown) => callback,
}))
```

See `cascade-publish/__tests__/index.test.ts` for the full pattern. Also mock anything that reaches
the network — `postSlackMessage`, `email-service`, `axios` — so tests stay offline.

**Two things worth testing in every hook**, both from
[the Directus conventions](../../../.claude/rules/directus-conventions.md):

1. Does it behave correctly when an item is **created** already in the triggering state, not just
   when one is updated into it?
2. Is there a guard that stops it firing repeatedly — a status field or equivalent?

## Current coverage

**205 assertions across 15 files, covering 9 of the bundle's 26 entries.**

| Covered                                                                                              | Test files |
| ---------------------------------------------------------------------------------------------------- | ---------- |
| `shared` (`isPublishable`, `safeHook`, `settings`)                                                   | 3          |
| `fetch-open-graph` (incl. `openGraph`, `urlSafety`)                                                  | 3          |
| `cascade-publish`                                                                                    | 2          |
| `create-news` (incl. `newsTarget`)                                                                   | 2          |
| `member-matching`, `newsletter-double-opt-in`, `post-to-discord`, `schedule-publication`, `set-slug` | 1 each     |

The other 17 entries have no tests, including the four largest modules in the bundle
(`algolia-index` at 1333 LOC, `buzzsprout`, `asset-generation`, `social-media-publish`). Closing that
gap is Phase 5 of [the tooling plan](../../../docs/directus-extension-tooling-plan.md), which ranks
them by size and blast radius.
