# Dependency Upgrade Plan — `nuxt-app`

- **Started:** 2026-07-31
- **Driver:** Nuxt 3 reached **end-of-life on 2026-07-31**. No further security or bugfix
  releases after `3.21.10`.
- **Scope:** `nuxt-app/` only.

`directus-cms/` is **out of scope and blocked** as of 2026-07-31, pending a legal clarification of
our Directus license. The `directus` server package is not under an OSI licence (`"SEE LICENSE IN
license"`), so upgrading it is a licensing question before it is a technical one. Do not add
`directus-cms/**` to Renovate's `includePaths`, and do not open Directus server upgrade PRs, until
that clarification lands.

This matters more than a scoping note usually would: GitHub currently reports **172
vulnerabilities on `main`** (4 critical, 57 high) against the 23 measured in `nuxt-app`, so the
large majority sit in the blocked tree. That is a known, accepted exposure for the duration —
worth re-raising if the legal answer takes a long time.

**The `@directus/sdk` client in `nuxt-app` is not affected.** It is MIT-licensed at both 21.3.0
and 24.0.0 — a different package from the `directus` server. Phase 5 can proceed on licensing
grounds; see that phase for the compatibility constraint that does apply.

Work through the phases in order, **one PR per phase**. The whole point of the ordering is that
each phase leaves the app in a shippable state and can be reverted on its own.

---

## Status

| Phase | Goal | Status |
| ----- | ---- | ------ |
| 0 | Build a safety net so upgrades are *detectable* | ✅ Done (2026-07-31) |
| 1 | Delete dead dependencies | ⬜ Not started |
| 2 | Security patches + minors, no majors | ⬜ Not started |
| 3 | `@nuxt/image-edge` → `@nuxt/image@2` | ⬜ Not started |
| 4 | **Nuxt 3 → Nuxt 4** | ⬜ Not started |
| 5 | Ecosystem majors (Pinia, ESLint, Zod, Directus SDK, Stripe, DOMPurify) | ⬜ Not started |
| 6 | Deferred: Tailwind 4, Node 24 | ⬜ Deliberately deferred |

---

## Baseline (measured 2026-07-31)

| | |
| --- | --- |
| Runtime | Node 22.17.1, npm 10.9.2, `package-lock.json` v3 |
| Framework | Nuxt 3.21.4 (3.21.10 is final 3.x), Vue 3.5.33, Vite 7.3.2, Nitro 2.13.4 |
| Toolchain | TypeScript 5.9.3, Tailwind 3.4.19, ESLint 8.57.1, Vitest 4.1.10 |
| `npm audit` | **23 vulnerabilities — 2 critical, 14 high, 5 moderate, 2 low** |
| Tests | 7 files, ~52 assertions, all `environment: 'node'` |
| `vue-tsc` errors | **212** across 31 files (149 of them in `composables/useDirectus.ts`) |

Refresh these numbers at the start of each phase; they are the before/after evidence that a phase
did what it claimed.

### Why the safety net comes first

The dependency situation is ordinary. The *verification* situation is not:

- The test suite covers the newsletter routes and one podcast-player helper. **Nothing renders a
  page.** An upgrade that breaks SSR passes every test.
- CI ran `npm install`, not `npm ci` — the lockfile was not authoritative, so CI could resolve
  different versions than a developer.
- CI ran only Vitest for `nuxt-app` — no lint, no typecheck, no build. A change that fails to
  *compile* merged green.
- `routeRules: { '/**': { isr: 3600 } }` means a broken deploy is cached and served for an hour.

Phase 0 fixes the detection problem. Everything after it is comparatively mechanical.

---

## Ground rules

1. **One phase per PR.** Never combine the framework major with ecosystem majors — if something
   breaks you need to know which change did it.
2. **Every phase is revertable** by reverting one commit and running `npm ci`.
3. **Verify on the Vercel preview deploy**, not just locally. ISR means a bad production deploy
   stays bad for an hour.
4. **Refresh `npm audit` and the `vue-tsc` count** before and after each phase; record deltas in
   the phase's checklist.
5. Do **not** silently widen scope. If a phase turns up unrelated work, add it to the appendix as
   a follow-up rather than folding it in.

---

## Phase 0 — Safety net

**Goal:** make it possible to detect that an upgrade broke something. Upgrades *zero* dependency
versions — the only additions are two new tools, `vue-tsc` and `@playwright/test`.

- [x] CI uses `npm ci` instead of `npm install`, with npm caching enabled (both jobs)
- [x] CI runs a **lint check** for `nuxt-app` — the new `lint` script, because the existing
      `eslint` script runs `--fix` and so mutates instead of failing
- [x] CI runs a **production build** for `nuxt-app`
- [x] CI runs a **typecheck ratchet** (see below)
- [x] `overrides.vue` pinned to `^3.5.0`
- [x] Renovate configured (`.github/renovate.json`)
- [x] Route smoke tests against the Vercel preview deploy
      (`.github/workflows/smoke_tests.yml`)

### Enabling the lint gate required fixing 7 pre-existing errors

`npm run lint` was failing on the existing codebase, so the gate could not simply be switched on.
All 7 are fixed in this phase — small, but they are app-code changes rather than tooling:

| File | Error | Fix |
| --- | --- | --- |
| `components/PodcastTranscript.vue` | 3× `vue/require-v-for-key` | Added `:key` to the `<template v-for>` and the inner `<span v-for>` |
| `pages/konferenz/[slug]/index.vue` | `@typescript-eslint/consistent-type-imports` | See below |
| `pages/suche.vue` | `vue/no-unused-vars` | Dropped the unused `index` from a slot destructure |
| `public/sw.js` | 2× `no-unused-vars` | Dropped unused `e` parameters |

**Do not run `eslint --fix` on `pages/konferenz/[slug]/index.vue`.** `TalkItem` is *both* a type in
`~/types` and an auto-imported component (`components/TalkItem.vue`) used in that template. The
rule reads the template usage as a value reference and its autofix rewrites the type-only import
into a **value** import — which shadows the component with a type that does not exist at runtime
and breaks the conference page. The import is now aliased to `TalkItemType`, with a comment at the
site explaining why.

29 lint **warnings** remain (mostly unused variables). Warnings do not fail the build. Worth a
cleanup pass, but not a blocker:

- [ ] Clear the 29 remaining ESLint warnings, then consider `--max-warnings 0`

### Why the smoke tests do not run on pull requests

They run on `deployment_status` against the Vercel preview instead. Two reasons:

- The pages are server-rendered from live Directus content. Running them per-PR would turn every
  CMS hiccup into a red build, which trains people to ignore CI.
- The preview deployment is the real artefact — same Nitro preset, same ISR behaviour, same edge
  redirects from `vercel.json`. A local `nuxt preview` does not exercise any of that.

18 checks — 13 static routes plus a podcast detail page, a speaker detail page, the news RSS feed,
a 404, and a console-error check on the home page. All 18 pass against a production build locally
(13s). They assert structure (HTTP status, no error page, non-empty `<main>`) rather than copy, so
editor content changes will not break them. `components/PodcastPlayer.vue` gained a `data-testid` as a stable anchor — it mounts on
every page from `app.vue` and is the component most likely to break on a Vue or Pinia upgrade.

### Keeping the CI build hermetic

The `nitro:config` hook fetches live Directus data to discover prerender routes, and
`nitro.prerender.failOnError: true` means a CMS outage fails the build. That is correct for
deploys and wrong for a compile check, so the hook now honours
`SKIP_PRERENDER_ROUTE_DISCOVERY=true`, which CI sets. The bundle is still built in full; only
route discovery is skipped. Deploys never set it.

Measured: full build ≈ 4 min, hermetic build ≈ 3 min.

### The `overrides.vue` problem

`package.json` currently contains:

```json
"overrides": { "vue": "latest", "minimatch": "^9.0.7" }
```

`"latest"` is not a semver range — it resolves to whatever the registry's `latest` tag points at
when the lockfile is regenerated. Two consequences: resolution is not reproducible across time,
and **the day Vue 4 ships, a routine `npm install` pulls it in.** Pin it to `^3.5.0`.

### The typecheck ratchet

A blocking typecheck gate is not achievable today — there are 212 pre-existing errors. Ignoring
type errors entirely is also wrong, because a framework major is exactly the kind of change that
introduces new ones.

So: CI compares the error count against a committed baseline in `nuxt-app/.typecheck-baseline`
and **fails only if the count increases.** Existing debt is tolerated; new debt is not. When
errors get fixed, lower the baseline in the same PR.

This is the single most valuable check for Phase 4 — it will surface Nuxt 4's type changes as a
number instead of a surprise.

### Follow-up captured, not done here

- [ ] Burn down the 212 `vue-tsc` errors, starting with `composables/useDirectus.ts` (149 of
      them — almost certainly one or two bad generic signatures rather than 149 real problems)

---

## Phase 1 — Delete dead dependencies

**Goal:** shrink the surface that every later phase has to carry. No behaviour change.

- [ ] Remove `core-js` — **zero imports anywhere in the codebase**
- [ ] Remove `@vue/compiler-sfc` from `dependencies` — Vue ships it; listing it directly risks
      version skew against the `vue` the framework resolves
- [ ] Remove `smoothscroll-polyfill` + `@types/smoothscroll-polyfill` — polyfills
      `scroll-behavior`, supported by every browser the site targets. **5 call sites** need
      updating, so this one is a real (if small) change rather than a pure deletion.

Verify: build succeeds, smoke tests pass, scroll behaviour still works on the podcast and
conference pages.

---

## Phase 2 — Security patches and minors

**Goal:** clear the audit backlog without a single major bump.

- [ ] `npm update` (moves everything to the `wanted` column)
- [ ] `npm audit fix` (non-`--force` only)
- [ ] Nuxt `3.21.4` → `3.21.10` — the final 3.x, includes the `__nuxt_island` route-middleware
      bypass and shared-cache-poisoning fixes
- [ ] Nodemailer `8.0.7` → `8.0.11` — CRLF injection in `List-*` header comments
- [ ] Record the post-fix `npm audit` count here: `___`

Everything except the `sharp`/`ipx` chain is fixable at this phase. That one is Phase 3.

---

## Phase 3 — `@nuxt/image-edge` → `@nuxt/image@2`

**Goal:** get off an abandoned nightly and clear the remaining critical/high advisories.

The app depends on `@nuxt/image-edge@1.3.0-28468005.8ad772e` — a **nightly build from February
2024**, on a channel that no longer publishes. It pulls in the vulnerable `ipx` → `sharp` chain,
and it is the *only* advisory in the audit flagged `isSemVerMajor`, i.e. the only one
`npm audit fix` cannot resolve on its own.

- [ ] Swap the package: `@nuxt/image-edge` → `@nuxt/image@^2`
- [ ] Update the module name in `nuxt.config.ts` (`modules: ['@nuxt/image-edge']` → `'@nuxt/image'`)
- [ ] Confirm the `image.domains` and `image.alias.cms` config still applies in v2
- [ ] Verify Directus-hosted images actually render — cover images on `/podcast`, speaker
      portraits on `/hall-of-fame`, conference gallery
- [ ] Note `@nuxt/image@2` requires Node `^20.19.0 || >=22.3.0` — satisfied

---

## Phase 4 — Nuxt 3 → Nuxt 4

**Goal:** get onto a supported framework. Do this **alone**, with no other version changes in the
PR.

```bash
npx codemod@latest nuxt/4/migration-recipe
```

Measured migration surface — smaller than it looks:

| Nuxt 4 breaking change | Exposure in this codebase |
| --- | --- |
| `app/` becomes default `srcDir` | **None required** — Nuxt auto-detects the v3 layout. Do *not* move directories in this PR. |
| Shared refs for identical `useAsyncData` keys | **Low** — 27 call sites, but only **one** (`'news-list'`) uses an explicit key. Conflicts only arise between identical explicit keys. |
| `data`/`error` default to `undefined`, not `null` | **Low** — no `=== null` / `!== null` comparisons found against fetch results. |
| `window.__NUXT__` removed | **None** — no references. |
| `dedupe: boolean` → `'cancel'`/`'defer'` | Check `refresh()` call sites. |
| Top-level `generate` config removed | **None** — already using `nitro.prerender`. |
| `.server.vue` islands | **None** — no island components. |

- [ ] Run the codemod, review every hunk
- [ ] Module compatibility — all three still declare `@nuxt/kit ^3`, so verify each boots:
  - [ ] `@nuxtjs/tailwindcss` (6.14.0)
  - [ ] `@nuxtjs/algolia` (1.11.2)
  - [ ] `nuxt-jsonld` (2.2.1)
- [ ] Typecheck ratchet: record the new error count and consciously accept or fix the delta
- [ ] Verify the `nitro:config` prerender hook still discovers routes
- [ ] Full smoke pass on the Vercel preview
- [ ] Leave the `app/` directory migration for a **separate** later PR

---

## Phase 5 — Ecosystem majors

**Goal:** catch the rest up. One PR each — they are independent, so they can be done in any
order, or in parallel by different people.

- [ ] **Pinia 2.3.1 → 4.0.2** (+ `@pinia/nuxt` 0.5.5 → 1.0.1, which peer-requires `pinia ^4`).
      Only **2 stores**: `useProfileCreationStore.ts`, `useTicketCheckoutStore.ts`.
- [ ] **ESLint 8.57.1 → 9.x** with flat config. This retires two stale packages at once:
      `eslint-plugin-nuxt` (last published **August 2023**, eslintrc-only) and
      `@nuxt/eslint-config@0.2`. Replace with the `@nuxt/eslint` module (1.16.0), which generates
      the flat config from `nuxt.config.ts`. Note `@nuxt/eslint-config@1` peers `eslint
      ^9.0.0 || ^10.0.0` — target **9**, not 10, until the Nuxt module ecosystem catches up.
      Delete `.eslintrc.js`, add `eslint.config.mjs`.
- [ ] **Zod 3.25.76 → 4.x** and **drop `h3-zod`**. `h3-zod` is unmaintained (last publish January
      2024) and expects Zod 3, so it blocks the upgrade. Only **1 usage** — replace with direct
      `zod` parsing. Zod is imported in 4 files total.
- [ ] **`@directus/sdk` 21.3.0 → 24.0.0.** Largest blast radius of this phase — 4 files, but one
      of them is the 884-line `useDirectus.ts`. Check the v22/23/24 changelogs for query-builder
      and type-inference changes. Requires Node `>=22` — satisfied.

      **Constraint from the Directus licence block.** The SDK is MIT, so licensing does not stop
      this. But the *server* is frozen at `directus@^11.17.4` until legal clarifies, so a three-
      major SDK jump has to be verified against **that** server version rather than the latest.
      Three majors of a REST/GraphQL client can drop support for older server APIs. Confirm SDK 24
      still targets Directus 11 before starting; if it does not, hold at the highest SDK major
      that does and note it here. This is the one phase whose scope depends on the legal outcome.
- [ ] **`stripe` 20.4.1 → 22.4.0** — 7 files. Check the pinned API version and the webhook
      signature-verification API.
- [ ] **`isomorphic-dompurify` 2.20.0 → 3.x** — 2 files. Note it is currently pinned with `~`,
      which is what has been holding back the DOMPurify XSS advisories.

---

## Phase 6 — Deliberately deferred

Not blocked by EOL. Do **not** fold these into the phases above.

- [ ] **Tailwind 3.4 → 4.x.** This is a config-format rewrite (JS config → CSS-first `@theme`),
      and `@nuxtjs/tailwindcss@6` hard-pins `tailwindcss ~3.4.17`, so it also means moving to
      `@tailwindcss/vite`. `tailwind.config.js` carries a substantial custom theme (brand colours,
      seven custom breakpoints). Its own project.
- [ ] **Node 22 → 24.** Verify Vercel's supported runtimes first. Update `engines.node`, `.nvmrc`,
      and the `node-version` in every workflow together.
- [ ] **Nuxt 4 `app/` directory migration.** Cosmetic; do it when the team wants it, not as part
      of the framework upgrade.

---

## Appendix A — Unmaintained or stale dependencies

Tracked so nobody has to rediscover them. None are urgent on their own.

| Package | Last publish | Note |
| --- | --- | --- |
| `@nuxt/image-edge` | Feb 2024 (nightly) | Phase 3 removes it |
| `h3-zod` | Jan 2024 | Phase 5 removes it |
| `eslint-plugin-nuxt` | Aug 2023 | Phase 5 removes it |
| `@ubclaunchpad/vue-fathom` | Apr 2022 | 1 usage. Fathom's own snippet is a few lines — consider inlining and dropping the dependency. |
| `smoothscroll-polyfill` | Aug 2022 | Phase 1 removes it |
| `rss` | Sep 2023 | Still works, no replacement needed. Watch it. |
| `@nuxtjs/algolia` | Nov 2025 | Fine, but it is the module most likely to need attention at Nuxt 5. |

## Appendix B — Notes and small findings

- `nuxt-app/.npmrc` sets `shamefully-hoist=true` and `strict-peer-dependencies=false`. **Both are
  pnpm options and are no-ops under npm.** They are not protecting anything today. Left in place
  rather than removed, in case the repo ever moves to pnpm — but do not rely on them.
- The `nitro:config` hook fetches live Directus data during build with
  `nitro.prerender.failOnError: true`. A CMS outage therefore fails the build. Acceptable for
  deploys; the reason CI's build step is run with route discovery disabled.
- `DIRECTUS_CMS_URL` falls back to `https://admin.programmier.bar` (production) when unset.

## Appendix C — Decision log

| Date | Decision |
| --- | --- |
| 2026-07-31 | Typecheck enforced as a **ratchet** against a committed baseline rather than a blocking gate — 212 pre-existing errors make a hard gate unachievable, and a non-blocking warning would be ignored. |
| 2026-07-31 | Nuxt 4 (Phase 4) sequenced **before** the ecosystem majors (Phase 5) so the framework is the only variable when something breaks. |
| 2026-07-31 | Tailwind 4 explicitly excluded from the EOL work — unrelated to it, and a config-format rewrite. |
| 2026-07-31 | Smoke tests run on `deployment_status` against the Vercel preview, **not** in the PR gate — the pages depend on live CMS content, and a per-PR run would make CI fail on CMS blips. |
| 2026-07-31 | CI's build step sets `SKIP_PRERENDER_ROUTE_DISCOVERY=true` so a compile check does not depend on production Directus being reachable. |
| 2026-07-31 | ESLint gates on **errors only**; the 29 pre-existing warnings are left ungated rather than blocking Phase 0 on an unrelated cleanup. |
| 2026-07-31 | The three files touched for lint fixes were already Prettier-non-conforming, and Prettier is not in CI. Left unformatted deliberately — reformatting would bury a 2-line fix in a 200-line diff. |
| 2026-07-31 | `directus-cms/` upgrades **blocked** pending legal clarification of the Directus licence. Nuxt work continues independently. `@directus/sdk` (MIT) is unaffected by the block, but Phase 5's SDK jump is constrained by the server staying on 11.x. |
