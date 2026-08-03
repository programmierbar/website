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
| 1 | Delete dead dependencies | ✅ Done (2026-07-31) |
| 2 | Security patches + minors, no majors | ✅ Done (2026-07-31) |
| — | TypeScript 5.9 → 6.0.3 (interstitial, own PR) | ✅ Done (2026-07-31) |
| 3 | `@nuxt/image-edge` → `@nuxt/image@2` | ✅ Done (2026-07-31) |
| 4 | **Nuxt 3 → Nuxt 4** | ✅ Done (2026-08-03) |
| 5 | Ecosystem majors (Pinia, ESLint, Zod, Directus SDK, Stripe, DOMPurify) | 🔄 In progress — 3 of 7 (`nodemailer`, Pinia, ESLint; **audit at zero**) |
| 6 | Deferred: Tailwind 4, Node 24 | ⬜ Deliberately deferred |
| — | [After the plan — follow-up backlog](#after-the-plan--follow-up-backlog) | 📋 Consolidated, unscheduled |

Each phase's own write-up ends with what it deliberately left behind. Those are also gathered into
the **follow-up backlog** above, which is the list to read if you are looking for work rather than
history. Two things in it are worth knowing about even if you never pick them up: the Renovate app
was configured in Phase 0 and **still is not installed**, and `tailwind.config.js` has content globs
that match almost nothing, which becomes dangerous at Tailwind 4.

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
- [x] **Smoke-test flakiness under parallel load — fixed in Phase 3.** First seen as a single
      flake during the TypeScript 6 step, then reproduced hard in Phase 3: six workers gave **six**
      spurious failures, including blank pages and a "Hydration completed but contains mismatches"
      console error, while the same pages were perfect in isolation. Root cause was local resource
      contention, not the app — a single `nuxt preview` process cannot serve SSR *and* resize 99
      images through sharp/libvips while six Chromium workers hammer it. Confirmed by worker count:
      6 → 6 failures, 2 → 1-in-3 flake, 1 → 18/18. Fixed by running **serial locally and parallel
      in CI** (`workers: process.env.CI ? undefined : 1`), since in CI the target is the Vercel
      preview, which scales horizontally, plus raising the expect timeout 10s → 15s and the test
      timeout 30s → 45s to suit pages that legitimately fetch live CMS data. Four consecutive
      serial runs then gave 18/18.

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

> The count above is what Phase 0 measured; it is **263** as of Phase 4, and the errors are now two
> distinct groups. See [the follow-up backlog](#after-the-plan--follow-up-backlog), which is the
> live version of this item.

---

## Phase 1 — Delete dead dependencies

**Goal:** shrink the surface that every later phase has to carry. No behaviour change.

- [x] Remove `core-js` — **zero imports anywhere in the codebase**, only a `package.json` entry
- [x] Remove `@vue/compiler-sfc` from `dependencies` — Vue ships it; listing it directly risks
      version skew against the `vue` the framework resolves. Confirmed it remains available as a
      transitive of `vue` at 3.5.33, so nothing loses the capability.
- [x] Remove `smoothscroll-polyfill` + `@types/smoothscroll-polyfill` — **5 call sites**, so a
      real (if small) change rather than a pure deletion.

### On dropping the smooth-scroll polyfill

Every call site followed the same shape — an `import smoothscroll from 'smoothscroll-polyfill'`
plus `onMounted(smoothscroll.polyfill)` — in `PodcastSlider`, `ConferenceSpeakersSlider`,
`TestimonialSlider`, `ConferenceGallery` and `ScrollDownMouse`. Only `ScrollDownMouse` used
`onMounted` *solely* for the polyfill, so it also lost that import.

What the polyfill provided was `behavior: 'smooth'` for `scrollTo` / `scrollIntoView`. That is
native everywhere now — Chrome since 61, Firefox since 36, and **Safari since 15.4 (March 2022)**,
which was the last holdout. There is no `browserslist` config pinning anything older.

The strongest argument for removing it was already in the codebase: `ConferenceAgenda.vue:80`
calls `scrollIntoView({ behavior: 'smooth' })` and **never imported the polyfill**, so the app
already depended on native support in one place.

**Explicitly accepted:** this drops smooth-scroll animation for Safari < 15.4. Those browsers
still scroll, just instantly — the call is a no-op fallback, not an error.

### Verification

- `npm run lint` → 0 errors · `npm test` → 52/52 · ratchet → steady at 212 · build → exit 0
- Smoke suite → 18/18
- **Scroll behaviour verified directly**, since the smoke tests only check rendering: clicking
  "Scroll right" on both home-page sliders moved `scrollLeft` 0 → 560, which is exactly the
  `innerWidth * 0.4` the component computes. Native smooth scrolling confirmed active in the
  engine under test.

---

## Phase 2 — Security patches and minors

**Goal:** clear the audit backlog without a single major bump.

- [x] `npm update` (moves everything to the `wanted` column)
- [x] `npm audit fix` (non-`--force` only) — only restructured `commander`; every remaining fix is
      semver-major, so there was nothing else for it to do
- [x] Nuxt `3.21.4` → `3.21.10` — the final 3.x, includes the `__nuxt_island` route-middleware
      bypass and shared-cache-poisoning fixes
- [x] Nodemailer `8.0.7` → `8.0.11` — clears both *moderate* advisories, but see the caveat below
- [x] TypeScript pinned to `^5.9.3` in `overrides` — see below

### Read the audit result correctly: 49 → 3, not 23 → 33

`npm audit`'s headline total counts **affected packages**, not distinct problems, so it is
actively misleading here:

| | Before | After |
| --- | --- | --- |
| Reported total | 23 | **33** |
| Critical / high / moderate / low | 2 / 14 / 5 / 2 | 0 / 33 / 0 / 0 |
| **Distinct root advisories** | **49** | **3** |
| …of which critical | 2 | **0** |

Forty-nine distinct advisories became three. The reported total *rose* only because the surviving
`brace-expansion` advisory is counted once per dependent package, and the tree has many.

Both criticals are gone (`tar`, `shell-quote`), along with every moderate and low. Notable
version moves: `tar` 7.5.14 → 7.5.22, `ws` 8.20.0 → 8.21.1, `dompurify` 3.4.2 → 3.4.12,
`postcss` 8.5.14 → 8.5.25, `vue` 3.5.33 → 3.5.40, plus `axios`, `form-data`, `js-yaml`, `devalue`,
`svgo`, `qs` and `launch-editor`.

**The three survivors, and why each has to wait:**

1. `brace-expansion <=5.0.7` (high, ~29 of the 33 entries). We are on 2.1.4, already the tip of
   the `maintenance-v2` line. Escaping needs brace-expansion 5, which needs `minimatch` to depend
   on `^5` — a three-major transitive jump. Not a Phase 2 move. May resolve on its own in Phase 5
   when ESLint 9 brings a newer `minimatch`.
2. `nodemailer <=9.0.0` (high). **Requires the v9 major, so 8.0.11 does not fully clear it.** This
   is the one with genuine production exposure — `nodemailer` is production-flagged and used to
   send mail. Moved to Phase 5.
3. `sharp <0.35.0` (high). Phase 3 removes `@nuxt/image-edge`. Note `sharp` resolves as
   **dev-only** in the lockfile, which lowers its practical severity.

### Two majors tried to sneak in

This phase is the first real test of the Phase 0 gates, and they caught something.

**TypeScript 5.9.3 → 7.0.2 — blocked.** `npm update` pulled the TypeScript *native rewrite* in as
a transitive, because several packages declare wide-open ranges (`vue: *`,
`vite-plugin-checker: *`, `vue-tsc: >=5.0.0`) — even though `@nuxt/eslint-config` explicitly asks
for `^5.2.2`. It broke immediately and loudly: `ts-api-utils` reads `ts.TypeFlags.Intrinsic` off
the default export, TS 7 changed the module shape, and **`npm run lint` died with exit 2**. Pinned
back with `"typescript": "^5.9.3"` in `overrides`. TypeScript 7 deserves its own evaluation, not a
drive-by inside a patch phase — added to Phase 6.

**Vite 7.3.2 → 8.2.0 — accepted, and not what it looks like.** `@nuxt/vite-builder@3.21.10`
declares `vite: ^7.3.6` as a real dependency, so npm nested `vite@7.3.6` for it. The hoisted
`vite@8.2.0` belongs to **vitest**, whose peer range allows `^8`. So the Nuxt build moved 7.3.2 →
7.3.6 (a patch) and vite 8 is confined to the test toolchain. Verified via the install topology,
not assumed.

### Verification

- `npm run lint` → 0 errors (after the TypeScript pin; **exit 2 before it**)
- `npm test` → 52/52
- Ratchet → **210 errors, down from 212.** Baseline lowered to 210 in this phase, as the ratchet
  instructs. First time it has tightened.
- Build → exit 0
- Smoke suite → 18/18

---

## Interstitial — TypeScript 5.9.3 → 6.0.3

Not a numbered phase. Phase 2 pinned TypeScript to `^5.9.3` to stop `npm update` dragging in the
7.x native rewrite, and `^5.9.3` was a conservative default rather than a considered choice — 6.x
is the release actually designed as the stepping stone.

**Why 6.x is the right rung.** TypeScript 6 is the last release built on the classic JavaScript
compiler; 7.x is the Go-based native rewrite. 6.0 exists to align behaviour with 7 and surface its
deprecations *while still on the old compiler*. Taking it now shrinks the eventual 7.x jump to a
tooling question rather than a code question.

**Measured as a complete no-op on this codebase:**

| Gate | TS 5.9.3 | TS 6.0.3 |
| --- | --- | --- |
| `npm run lint` | 0 errors, 29 warnings | 0 errors, 29 warnings |
| `npm test` | 52/52 | 52/52 |
| Typecheck ratchet | 210 | **210 — identical** |
| Build | exit 0, 30.8 MB | exit 0, 30.8 MB |
| Smoke | 18/18 | 18/18 |

The error count not moving by even one is the strongest evidence. `ts-api-utils@1.4.3` works fine
against 6.x, so the thing that broke on 7.x does not break here — `@nuxt/eslint-config`'s
`^5.2.2` peer is simply over-tight, not a real constraint.

**Zero deprecation warnings.** Checked explicitly, since flagging TS 7 deprecations is 6.0's whole
job. The single grep hit was a pre-existing error whose *type name* contains "Deprecated"
(`DeprecatedResolvesDuplicates`, from unhead), not a compiler warning.

**Deliberately kept out of Phase 2.** 5.9 → 6.0 is a major, and Phase 2's contract was patches and
minors. Shipping it separately keeps that contract honest and gives TypeScript its own revert point
if deprecation noise appears later. Both the `devDependencies` entry and the `overrides` pin moved
together.

---

## Phase 3 — `@nuxt/image-edge` → `@nuxt/image@2`

**Goal:** get off an abandoned nightly and clear the remaining critical/high advisories.

The app depends on `@nuxt/image-edge@1.3.0-28468005.8ad772e` — a **nightly build from February
2024**, on a channel that no longer publishes. It pulls in the vulnerable `ipx` → `sharp` chain,
and it is the *only* advisory in the audit flagged `isSemVerMajor`, i.e. the only one
`npm audit fix` cannot resolve on its own.

- [x] Swap the package: `@nuxt/image-edge` → `@nuxt/image@^2` (resolved 2.1.0)
- [x] Update the module name in `nuxt.config.ts`
- [x] Confirm `image.domains` / `image.screens` still apply in v2 — both remain valid options and
      are demonstrably in effect. `image.alias` was removed: it never worked (see below).
- [x] Verify Directus-hosted images actually render
- [x] Node `^20.19.0 || >=22.3.0` — satisfied

**Advisories: 3 → 2.** The `sharp` chain is cleared. Only `brace-expansion` and `nodemailer`
remain, both awaiting Phase 5.

### Only v2 clears `sharp` — 1.x cannot

Worth recording, because "move to the latest stable 1.x instead" looks like the safer option and
is not:

| Package | ipx | sharp | Advisory (`sharp <0.35.0`) |
| --- | --- | --- | --- |
| `@nuxt/image-edge` (Feb 2024 nightly) | 2.1.1 | 0.32.6 | vulnerable |
| `@nuxt/image@1.11.0` (latest 1.x) | `^2.1.1` | 0.32.6 | **still vulnerable** |
| — | 3.1.1 | 0.34.3 | still vulnerable |
| `@nuxt/image@2.1.0` | 4.0.0-beta.1 | **0.35.3** | **fixed** |

So v2 is the only route to a patched `sharp`. Note `ipx@4.0.0-beta.1` is a **prerelease**, pinned
exactly as an `optionalDependency` by `@nuxt/image` itself — upstream's choice, not a resolution
accident. It is dev-flagged and only backs the local ipx provider.

`@nuxt/image@2.1.0` declares `compatibility: { nuxt: ">=3.1.0" }` and depends on `@nuxt/kit ^4.5.1`
while the app is on Nuxt 3.21.10; npm nests kit 4.5.1 for the module. That combination builds and
runs correctly — verified, not assumed.

### Images verified directly, because the smoke tests cannot see them

The smoke suite asserts page *structure*; a page whose images all 404 would still pass all 18
checks. So image resolution was checked explicitly across `/`, `/podcast`, `/hall-of-fame`,
`/ueber-uns` and `/pick-of-the-day`:

- **99 `<img>` elements** rendered, 30 sampled and fetched, **zero failures** (all HTTP 200 with an
  `image/*` content type)
- every URL served through `/_ipx/…` with format conversion and sizing applied
  (`f_jpeg`/`f_png`, `q_80`, `fit_cover`), at widths matching the custom `image.screens`
  breakpoints — so `domains` and `screens` are both demonstrably in effect

### `image.alias.cms` removed — it never worked

The config carried `alias: { cms: '<cms>/assets' }`, intended so `src="/cms/<file-id>"` would
expand to the Directus asset URL. It was **non-functional**, for three independent reasons:

1. **Nothing referenced it.** The only occurrence of `cms:` in the whole source was the
   declaration itself. Image URLs come from `helpers/getAssetUrl.ts`, which already builds absolute
   Directus URLs, and Algolia results carry absolute URLs too.
2. **The key was missing its leading slash, so it could not match.** v2 resolves with
   `input = hasProtocol(input) ? input : withLeadingSlash(input)` and then
   `input.startsWith(base)`. Because a relative src is always given a leading `/`,
   `startsWith('cms')` is never true. Verified against the real `ufo` helpers:

   | `src` | key `cms` (as configured) | key `/cms` (documented) |
   | --- | --- | --- |
   | `/cms/abc123` | `/cms/abc123` — unchanged | `https://…/assets/abc123` ✓ |
   | `cms:abc123` | `https://…/assets/:abc123` — stray colon | `cms:abc123` |

3. **Decisively, the branch never executed.** Alias resolution is guarded by
   `if (!provider.supportsAlias)`, and both ipx providers declare `supportsAlias: true`. This app
   uses ipx, so client-side alias resolution was skipped regardless of spelling.

Removed rather than fixed, because nothing needs it. This was initially logged as a harmless
follow-up; that was wrong. A config line that looks like a working shorthand but silently is not
is a **trap** — the next person to write `src="/cms/<id>"` would get a 404 and go debugging Directus
or `domains` instead of suspecting config that never functioned. The `nuxt.config.ts` comment
records the working form (`alias: { '/cms': … }`) should anyone want it later.

Verified as a no-op by re-running the image check after removal.

### Image usage is well centralised

Only two components call the image component directly: `components/DirectusImage.vue` (fronting
**18** consumers) and `components/SearchResultCard.vue`. That is why a module swap of this size
needed no component changes at all.

---

## Phase 4 — Nuxt 3 → Nuxt 4

**Goal:** get onto a supported framework. Done **alone**, with no other version changes in the PR.

`nuxt 3.21.10 → 4.5.1`. Two source files changed, plus one Tailwind config fix and one test-harness
fix. No directory move, no codemod output.

### The codemod does nothing here — verified, not assumed

The command in the original plan was stale: the CLI now needs `codemod run <package>`, and the
`migration-recipe` bundles `nuxt/4/file-structure`, which performs the `app/` directory move we
explicitly do *not* want. Its deselect prompt is interactive, so the five relevant codemods were run
individually. All five reported **"No changes were made"**.

That silence is not evidence on its own — [nuxt#32627][codemod-issue] records these codemods
no-opping spuriously. A manual sweep was run first and independently reached the same answer:

[codemod-issue]: https://github.com/nuxt/nuxt/issues/32627

| Nuxt 4 breaking change | Measured exposure |
| --- | --- |
| `app/` becomes default `srcDir` | **None required.** Nuxt 4 auto-detects the v3 layout — confirmed empirically, not from docs: after `nuxt prepare`, `.nuxt/types/components.d.ts` resolves components to `../../components/…`, i.e. the project root. |
| `noUncheckedIndexedAccess` now defaults to `true` | **The whole ratchet delta.** See below. |
| Shared refs for identical `useAsyncData` keys | **None.** The earlier claim of "only one explicit key" was wrong — there are **10**: `'news-list'` plus nine `route.fullPath`. Harmless, because a collision needs two *live* calls sharing a key, and one page component renders per route. |
| `data`/`error` default to `undefined`, not `null` | **None.** No `=== null`/`!== null` compares a fetch result; the nine hits are interval handles, store fields and `resolveNewsLink`. |
| `data` is now a `shallowRef` | **One site, safe.** `pages/api/cocktails.vue:23` mutates `cocktails.value.menu`, but synchronously in setup, before first paint — nothing re-renders afterward, so no notification is needed. Verified: that route is byte-identical on 3 and 4. |
| `builder:watch` relative paths | **None** — no references. |
| `dedupe: boolean` → `'cancel'`/`'defer'` | **None** — the only `dedupe` in the tree is a comment about a DB unique constraint. |
| `window.__NUXT__` removed | **None** — no references. |
| Top-level `generate` config removed | **None** — already `nitro.prerender`. |
| Page component names now match route names | **None** — no `<KeepAlive>`, no `route.meta.name`. |
| Removed `experimental.*` flags | **None** — no `experimental` block at all. |
| `.server.vue` islands, EJS templates | **None** — and no `modules/`, `layouts/` or `middleware/` directory. |

### Module compatibility was a smaller risk than it looked

The concern was that three modules still declare `@nuxt/kit ^3`. Two things defused it. First, the
premise was partly wrong: `nuxt-jsonld` declares **no** `@nuxt/kit` dependency at all (only `pathe`
and `schema-dts`) and resolves it by hoisting. Second, kit 3 and kit 4 were *already* coexisting on
Nuxt 3 — `@nuxt/image@2`, `@nuxt/devtools` and `@dxup/nuxt` all pulled kit 4.5.1.

Static analysis of what each module actually imports found only long-stable kit APIs
(`defineNuxtModule`, `addPlugin`, `addImports`, `addImportsDir`, `createResolver`, `addTemplate`,
`addTypeTemplate`, `installModule`, `addServerHandler`, `useNuxt`). Two apparent red flags —
`@nuxtjs/tailwindcss` touching `nuxt.options.serverMiddleware` and `@nuxtjs/algolia` touching
`publicRuntimeConfig` — are both inside Nuxt **2** branches (`!isNuxtMajorVersion(2)` and
`isNuxt2()`). No module declares a `nuxt` peer range, so there was no `ERESOLVE` to resolve either.

Each was then verified *functionally*, since booting is not working:

- **`@nuxtjs/tailwindcss` 6.14.0** — our config is genuinely consumed: the custom `3xl: 2000px`
  breakpoint appears in the emitted CSS, and all three brand colours (`#CFFF00`, `#00A1FF`,
  `#E92980`) compute on real elements.
- **`@nuxtjs/algolia` 1.11.2** — a live query for "typescript" returned **20 hits** and 11 result
  links, with the URL and title updating.
- **`nuxt-jsonld` 2.2.1** — emits a valid `PodcastSeries` block on the home page.
- **`@pinia/nuxt` 0.5.5 / Pinia 2.3.1** — the `ticketCheckout` store hydrates into the payload.
  (The "Preise konnten nicht geladen werden" message on that page is pre-existing — a past
  conference — and identical on Nuxt 3.)

### The typecheck ratchet: 209 → 263, and why that is fine

`noUncheckedIndexedAccess` is `true` by default in Nuxt 4. The delta was decomposed rather than
accepted wholesale, by re-running with only that flag flipped off:

| | errors |
| --- | --- |
| Nuxt 3 baseline | 209 |
| Nuxt 4, `noUncheckedIndexedAccess: false` | 212 |
| Nuxt 4, as shipped | 267 → **263** after fixes |

So **+55 come purely from the new flag** and only **+3 net from Nuxt 4 itself**. Diffing the two
error sets showed most apparent changes were TypeScript reordering union members inside its own
messages; the genuine delta was 4 new errors and 1 subsumed, in two files, both fixed here:

- **`error.vue:87`** — dropped `hid: 'description'`. `hid` is a vue-meta/Nuxt 2 key that has done
  nothing since Nuxt 3 (unhead dedupes by `name`), and the new unhead typing turned it from one
  error into two.
- **`pages/login-callback.vue:28`** — `ref(null)` infers `Ref<null>`, so the assignment was
  unassignable and `clientSideUser.id` narrowed to `never` in the template. Now typed off
  `getCurrentUser`'s return.

**`noUncheckedIndexedAccess` was deliberately left on.** Turning it off in the root `tsconfig.json`
would have held the baseline near 209, but those 55 errors are real latent null-safety gaps that the
flag *reveals* rather than causes — unchecked indexing in `helpers/parseCmsDate.ts` (12),
`helpers/ipProcessing.ts` (5), `components/Pagination.vue`, and others. Suppressing the framework
default to keep a number small would discard genuine signal and contradicts "use the framework's
configuration system". They are logged as a follow-up instead.

### Two real defects found, neither of them Nuxt 4's fault

**1. `tailwind.config.js` emitted invalid CSS — this one blocked the build.**

`theme.container.screens` entries are used as *both* the media condition and the max-width, so
`sm: '100%'` produced `@media (min-width: 100%)`. A percentage is not a valid media-query length, so
per spec every browser has been evaluating it as `not all` and discarding the block — and its only
declaration, `max-width: 100%`, was a no-op anyway against the `width: 100%` the container already
has. Five such entries collapsed into one dead rule.

It surfaced now because **Vite 8 minifies the *server* build with lightningcss** — its config
resolution reads `cssMinify: merged.cssMinify ?? (consumer === "server" ? "lightningcss" : …)` — and
lightningcss errors where the previous esbuild-based minifier passed the bad query through. Nuxt 3
built fine.

Listing only `'2xl': '1536px'` was verified behaviour-neutral by generating the container CSS both
ways through postcss and diffing: the output is identical minus the dead block. Worth noting the
first candidate fix (keeping `DEFAULT: '100%'`) produced *byte-identical* CSS to the original and
would not have fixed anything — Tailwind dedupes the five `100%` entries, and `DEFAULT` is not
special-cased.

**1b. …and lightningcss then quietly narrowed browser support.** Found only by diffing the deployed
CSS against production, because every gate passed either way.

With the container fixed, the Vite 8 → lightningcss default rewrote **every** media query to Media
Queries Level 4 range syntax:

| | Nuxt 3 (production) | Nuxt 4 (before this fix) |
| --- | --- | --- |
| syntax | `@media(min-width:1024px)` | `@media (width>=1024px)` |
| breakpoints emitted | 520/640/768/1024/1280/1536/2000 | same — all intact |
| invalid `min-width:100%` | **1 (live today)** | 0 |

The breakpoints were all correct, so nothing looked wrong. But range syntax requires **Safari 16.4+
(March 2023)** where `min-width` is universal, and with no `browserslist` in the repo lightningcss
assumes modern targets and picks the shorter form. On Safari 16.0–16.3 every breakpoint stops
matching *at once*, so the entire responsive layout would be dropped rather than degrading.

Fixed by pinning `vite.build.cssMinify: 'esbuild'`, which restores the exact `@media(min-width:…)`
output the app shipped on Nuxt 3. Verified: classic syntax for all seven breakpoints, container down
to its two effective rules, zero invalid queries, and measured live — at a 1700px viewport
`.container` caps at 1536px and centres; at 1100px it is full width.

Note this is *not* an argument that lightningcss is wrong — it is faster and its output is valid. It
should be adopted deliberately, with explicit `css.lightningcss.targets`, alongside Tailwind 4 in
Phase 6. Taking it as a silent side effect of a framework bump is what made it a problem.

**2. The blank-render smoke assertion never retried.**

`expectPageRendered` awaited `innerText()` once and asserted on the resulting number, so it could not
poll. `<main>` becomes visible before the page component has necessarily painted, so this raced. It
failed on a podcast detail page whose SSR response was then verified complete (1.09 MB in `<main>`,
HTTP 200, no server error, and the page rendering fine on direct navigation).

This is the same failure Phase 3 attributed to local CPU contention. That identified the *trigger*
but not the defect, and capping workers to 1 masked it. With the assertion switched to
`expect.poll`, **6 workers pass repeatedly** — and finish in ~14s against ~23s serial — so the
worker cap was removed and the misleading comment corrected. This also retires the
`|| process.env.SMOKE_BASE_URL` special case added by a Copilot Autofix commit in #227.

### Pre-existing: a full local build with route discovery is broken on `main`

`npm run build` *without* `SKIP_PRERENDER_ROUTE_DISCOVERY` fails, and **it fails identically before
this phase**:

| | Nuxt 3 (`main`) | Nuxt 4 |
| --- | --- | --- |
| `_ipx` prerender entries | 1515 | 1521 |
| `_ipx` 500s | 150 | 162 |
| non-`_ipx` failures | **0** | **0** |
| exit code | **1** | **1** |

The prerender crawler follows `<img src="/_ipx/…">` — those URLs end in a bare asset UUID, so nitro's
"no extension" rule admits them — and tries to prerender ~1500 image transforms, exhausting
connections to the CMS (`fetch failed`, plus some upstream 503s). Every one of the 87 pages and
their payloads prerender fine on both versions.

This is invisible in normal operation: CI sets `SKIP_PRERENDER_ROUTE_DISCOVERY=true`, and the Vercel
build does not prerender either — it completes in ~58s and emits a `__fallback.func`, because the
ISR `routeRules` make routes on-demand functions. Left alone deliberately, as out of scope for a
framework upgrade. See the follow-up.

### Verification

Both sides of every comparison were built the same way (`SKIP_PRERENDER_ROUTE_DISCOVERY=true`), from
a `git worktree` at `main` with its own `npm ci`.

| gate | Nuxt 3.21.10 | Nuxt 4.5.1 |
| --- | --- | --- |
| `lint` | 0 errors, 29 warnings | 0 errors, 29 warnings |
| `test` | 52/52 | 52/52 |
| ratchet | 209 | 263 (accepted — see above) |
| `build` | exit 0, 30.8 MB | exit 0, 30.9 MB, zero warnings |
| smoke | 18/18 | 18/18 (×5 runs, serial and at 6 workers) |

Beyond the gates, **10 routes the smoke suite does not cover were A/B'd against a Nuxt 3 server
running side by side** — `/api/cocktails`, the conference tickets page, both portals, `/news`,
`/feed/news.xml`, `/pick-of-the-day`, `/gewinnspiel`, `/agb`, `/app`. Every one returned the **same
status and the same `<main>` text length on both**, down to the byte. `/app`'s 404 is pre-existing.
Images: 11/11 still served via `/_ipx/`, zero broken.

One small improvement: on the conference tickets page Nuxt 3 logs a client-side 500 fetching
`/konferenz/…/_payload.json`; Nuxt 4 does not.

**Advisories: 2 → 1** (headline total 33 → 1), leaving only `nodemailer`, which Phase 5 owns.
Do not credit this phase with the `brace-expansion` half: that package is **still 2.1.4**, exactly
as before, and is simply no longer being flagged — the advisory data changed, not our tree. Worth
re-checking rather than assuming it is settled.

### Node floor moved

Nuxt 4.5.1 requires `node ^22.19.0 || ^24.11.0 || >=26.0.0`, so `engines.node` went from `^22.12.0`
to match. CI (`node-version: 22`) resolves to a satisfying 22.x. **Local development on Node 22.17.1
is now below the floor** — it works, but it is unsupported and warns on install; anyone on 22.1x
should upgrade.

### Follow-up captured, not done here

All four are carried into [the follow-up backlog](#after-the-plan--follow-up-backlog) with the
detail needed to act on them; kept here as the record of what this phase chose not to do.

- [ ] Burn down the 263 `vue-tsc` errors. Now two distinct groups: ~208 pre-existing (149 in
      `composables/useDirectus.ts`) and **55 newly surfaced `noUncheckedIndexedAccess` violations**,
      which are the more interesting set — each is a real unchecked index.
- [ ] Stop the prerender crawler walking image URLs, so a full local build works:
      `nitro: { prerender: { ignore: ['/_ipx'] } }`. Pre-existing on `main`; affects only local
      full builds, since CI skips discovery and Vercel does not prerender.
- [ ] `tailwind.config.js` `content` globs are `'./pages/**/*.{html,js}'` and
      `'./components/**/*.{html,js}'` — **no `.vue`**. The site is styled only because
      `@nuxtjs/tailwindcss` injects its own defaults over the top. Worth fixing before Tailwind 4
      (Phase 6), which changes content detection.
- [ ] The `app/` directory migration remains a **separate** later PR (Phase 6).

---

## Phase 5 — Ecosystem majors

**Goal:** catch the rest up. One PR each — they are independent, so they can be done in any
order, or in parallel by different people.

- [x] **Pinia 2.3.1 → 4.0.2** (+ `@pinia/nuxt` 0.5.5 → 1.0.1) — ✅ done 2026-08-03. Required a
      documented one-line nitro workaround for an **upstream Pinia 4 packaging bug that breaks SSR
      in production only**. Details below.
- [x] **ESLint 8.57.1 → 10.8.0** with flat config — ✅ done 2026-08-03. Retired
      `eslint-plugin-nuxt` (last published **August 2023**) and `@nuxt/eslint-config@0.2`, plus the
      direct `eslint-plugin-vue` pin. `.eslintrc.js` → `eslint.config.mjs`.

      **Went to 10, not 9.** This phase's original note said "target **9**, not 10, until the Nuxt
      module ecosystem catches up" — that was written 2026-07-31 and is **stale**. It has caught up:
      `@nuxt/eslint-config@1.16.0` *depends* on `@eslint/js ^10.0.1`, so 10 is its primary target,
      and `@nuxt/eslint`, `@typescript-eslint` 8.65 and `eslint-plugin-vue` 10.10 all peer
      `^9 || ^10`. Choosing 9 would now be the *less* aligned option. Details below.
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
- [x] **`nodemailer` 8.0.11 → 9.0.3** — ✅ done 2026-08-03. **`npm audit` now reports
      `found 0 vulnerabilities`**, closing the backlog that started at 49 distinct advisories.
      Details below.
- [ ] **`stripe` 20.4.1 → 22.4.0** — 7 files. Check the pinned API version and the webhook
      signature-verification API.
- [ ] **`isomorphic-dompurify` 2.20.0 → 3.x** — 2 files. Note it is currently pinned with `~`.
      The note that this "has been holding back the DOMPurify XSS advisories" is **no longer
      current**: Phase 2 moved `dompurify` 3.4.2 → 3.4.12 transitively and those advisories are
      gone, so this is now a staleness item rather than a security one. Reprioritise accordingly.

### Progress: 3 of 7 done

| item | status |
| --- | --- |
| `nodemailer` → 9.0.3 | ✅ done 2026-08-03 — audit reached zero |
| Pinia → 4.0.2 | ✅ done 2026-08-03 — needed a nitro workaround |
| ESLint → **10** + flat config | ✅ done 2026-08-03 — see the version note below |
| Zod → 4, drop `h3-zod` | ⬜ |
| `@directus/sdk` → 24 | ⬜ blocked on verifying against Directus 11.x |
| `stripe` → 22.4.0 | ⬜ |
| `isomorphic-dompurify` → 3.x | ⬜ no longer security-driven, see above |

### `nodemailer` 8.0.11 → 9.0.3

**The audit backlog is now empty:** `found 0 vulnerabilities`, down from 49 distinct root advisories
at the start of this work. One file changed (`server/utils/sendEmail.ts` was not even edited — only
the manifest), plus `@types/nodemailer` 6.4.24 → 8.0.1.

**The advisory that drove this was not actually reachable here.** GHSA-p6gq-j5cr-w38f is about the
message-level `raw` option bypassing `disableFileAccess`/`disableUrlAccess`. This codebase never
passes `raw` and never sets either flag — `sendEmail` sends `from`/`to`/`subject`/`html`/
`attachments` and nothing else. Worth recording plainly: the upgrade was still right (it clears the
advisory and takes four releases of SMTP hardening) but the "high severity" label overstated the
real exposure, and nobody should conclude from this phase that a *reachable* high was outstanding
for a week.

**The real breaking change is TLS, and it was verified against the actual host.** v9.0.0 validates
TLS certificates by default when fetching remote content, and 9.0.2/9.0.3 hardened STARTTLS and
secure-socket handling. Our transport targets `smtp.gmail.com:465` with `secure: true`, so the
question was whether the handshake still succeeds. Tested with `transporter.verify()` using
deliberately fake credentials, because `verify()` completes the TCP connect and TLS handshake
*before* authenticating — so the failure stage is the answer:

```
code   : EAUTH
stage  : AUTH PLAIN
RESULT : TLS handshake OK — failure is at authentication, which is expected
```

Failing at `AUTH PLAIN` rather than with a certificate error proves the v9 TLS change does not affect
this host. **The one residual risk** is a deployed environment that overrides
`NUXT_EMAIL_SMTP_HOST` to a server with a self-signed or expired certificate — that would now fail
where it previously worked, and the opt-out is `tls.rejectUnauthorized: false`. Nothing in the repo
sets that override.

**Types.** nodemailer still ships no bundled typings, and DefinitelyTyped has no `@types/nodemailer@9`
— the newest major is 8. Moved 6.4.24 → 8.0.1 anyway: three majors behind a v9 library is worse than
one, and it is the types package *for* the package being upgraded rather than unrelated scope.
Confirmed the types are actually enforced rather than silently degrading to `any`, by checking that a
deliberately wrong `port: 'not-a-number'` and `filename: 123` are both rejected (`TS2769`) — the same
trap that makes `getMetaInfo`'s unresolvable import invisible.

**Verified the deployed artifact, not just the source.** Nitro treats nodemailer as external and
vendors it into `.output/server/node_modules/nodemailer` at **9.0.3**; importing *that* copy yields a
working default export and constructs a `Mail` transporter. This is the check that catches a major
whose ESM/CJS shape breaks only once bundled.

**Not exercised:** an end-to-end send. `/api/email` runs the Gemini spam filter and then mails
`podcast@programmier.bar`, so triggering it would send real mail to a real inbox. The TLS probe and
the vendored-module check cover the upgrade surface without that.

| gate | before | after |
| --- | --- | --- |
| `npm audit` | 1 high (nodemailer) | **0 vulnerabilities** |
| `lint` | 0 errors, 29 warnings | 0 errors, 29 warnings |
| `test` | 52/52 | 52/52 |
| ratchet | 263 | 263 |
| `build` | exit 0, 30.9 MB | exit 0, 30.9 MB |
| smoke | 18/18 | 18/18 |

### Pinia 2.3.1 → 4.0.2 (+ `@pinia/nuxt` 0.5.5 → 1.0.1)

Two majors of Pinia at once, taken as the natural follow-on to Phase 4: `@pinia/nuxt@0.5.5` still
declared `@nuxt/kit ^3` on a Nuxt 4 app, and `1.x` is the kit-4 line. No store code changed.

**Migration surface was nil.** Both stores are options-style with string ids, so Pinia 3's removal of
the `defineStore({ id })` object form does not apply. The whole API surface is `defineStore` (×4),
`storeToRefs` (×6), `$state` (×1) and `$reset()` (×2) — and `$reset` is the *options*-store API,
which still exists; it is setup stores that lost it. Nothing used `PiniaStorePlugin`, `mapState`,
`mapActions`, `setActivePinia` or `createPinia` directly.

**A tidiness win:** this collapses a duplicate. `vue-router@5` (nested under Nuxt 4) declares
`pinia ^3.0.4 || ^4.0.2` as an *optional* peer, so npm had installed a second copy at
`node_modules/nuxt/node_modules/pinia@4.0.2` alongside our 2.3.1. It was inert — vue-router does not
import pinia in its `dist` — but after this upgrade there is exactly one `node_modules/pinia`.

#### The upstream bug: Pinia 4 breaks SSR in production, and only in production

Every route returned **HTTP 500**:

```
ReferenceError: __VUE_PROD_DEVTOOLS__ is not defined
  at createPinia (.output/server/node_modules/pinia/dist/pinia.js:847)
```

Pinia 4 exports a single **unconditional** entry, `"." : "./dist/pinia.js"`. That file is the
*bundler* build and references Vue's compile-time feature flags raw, expecting a bundler to
substitute them — it contains five such references, while the `esm-browser` and `iife` builds it also
ships contain zero. Nitro externalises dependencies into `.output/server/node_modules`, so nothing
substitutes anything and the flag is simply an undefined global at runtime. Vue itself avoids this by
shipping a `node` conditional export to a CJS build that branches on `process.env.NODE_ENV`; Pinia 4
has no such condition.

It is production-only because the guard reads
`process.env.NODE_ENV !== 'production' || __VUE_PROD_DEVTOOLS__`. In development the first clause
short-circuits and the flag is never evaluated. **This is why it is dangerous:**

| how you run it | result |
| --- | --- |
| `nuxt dev` | fine |
| `node .output/server/index.mjs` (no `NODE_ENV`) | fine — **200** |
| `NODE_ENV=production node .output/server/index.mjs` | **500 on every route** |
| `nuxt preview`, and any real deploy | **500 on every route** |

`npm run build` exits 0. `lint`, `test` and the typecheck ratchet all pass. Nothing in the PR gate
sees it. **The smoke suite caught it** — which is precisely the failure mode Phase 0 was built for,
and the first time it has earned its keep on a defect rather than on its own flakiness.

Diagnosis was worth the detour: the first symptom pointed at the wrong place. The stack trace blamed
`@pinia/nuxt`'s `app:rendered` hook reading `nuxtApp.$pinia.state.value`, and [a Pinia
discussion][pinia-3067] recommends pinning back to `@pinia/nuxt@0.11.0`. That is treating the
symptom: `$pinia` was undefined only because the plugin's `setup()` had already thrown, and the
plugin error was being swallowed. Instrumenting the built bundle step by step found the real
`ReferenceError` inside `createPinia`.

[pinia-3067]: https://github.com/vuejs/pinia/discussions/3067

**Fix:** `nitro.externals.inline: ['pinia']`, which routes pinia through rollup so the flags are
substituted. Verified rather than assumed — zero unreplaced flag references in the output, and
exactly **one** `createPinia` definition, so inlining a state library has not created a second module
instance with its own store registry.

This is a workaround for someone else's packaging bug and should be removed when Pinia ships a
node-safe build. Logged in the follow-up backlog so it does not become permanent dead config of the
kind Phases 3 and 4 spent time deleting.

#### Verified functionally, under `NODE_ENV=production`

A state library that renders is not a state library that works, so the ticket checkout store was
exercised in a real browser against the production-mode server:

| behaviour | result |
| --- | --- |
| reactivity — two `+` clicks | `ticketCount` 3 → 5 |
| action side effect | `attendees` array synced 3 → 5 |
| `localStorage` persistence | `ticket-checkout-<slug>` written with `ticketCount: 5` |
| `$reset()` via the store's `reset()` action | 5 → 1, and storage cleared |
| SSR payload + hydration | `payload.pinia` present server-side, `$pinia` present client-side |

| gate | before | after |
| --- | --- | --- |
| `npm audit` | 0 | 0 |
| `lint` | 0 errors, 29 warnings | 0 errors, 29 warnings |
| `test` | 52/52 | 52/52 |
| ratchet | 263 | 263 |
| `build` | exit 0, 30.9 MB | exit 0, 30.9 MB |
| smoke | 18/18 | 18/18 (×2) |
| `NODE_ENV=production` SSR | **500 on every route** | 200 on 7 routes, 0 errors |

### ESLint 8.57.1 → 10.8.0, `.eslintrc.js` → flat config

Zero runtime blast radius, which is why it was taken directly after two upgrades that broke runtime
behaviour: the worst case is that linting breaks, not the site. Confirmed — build output is
byte-identical at 30.9 MB and **no eslint package appears in `.output/server`**, since `@nuxt/eslint`
is dev-time only.

Retired three packages: `eslint-plugin-nuxt` (last publish August 2023), `@nuxt/eslint-config@0.2`,
and the direct `eslint-plugin-vue` pin. That last one is why the first install attempt hit
`ERESOLVE`: `eslint-plugin-vue@9.33.0` peers `eslint ^6.2 || ^7 || ^8 || ^9` — no 10 — and it was
declared directly even though `@nuxt/eslint-config` owns it. Dropping the direct pin resolved it, the
same "stop declaring what the framework owns" cleanup as `@vue/compiler-sfc` in Phase 1.

#### The new config is far stricter — 0 errors became 121

`@nuxt/eslint-config@1` reports much more than `0.2` did. Straight swap, no rule changes:

| | before | after swap |
| --- | --- | --- |
| errors | 0 | **121** |
| warnings | 29 | 19 |

Decomposed rather than bulk-suppressed:

| rule | count | what changed |
| --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | 103 | **newly enabled** — not in the `0.2` rule set at all |
| `@typescript-eslint/no-unused-vars` | 15 | already reported, but as a **warning** under `0.2` |
| `no-useless-assignment` | 1 | newly enabled |
| `@typescript-eslint/no-wrapper-object-types` | 1 | newly enabled |
| `@typescript-eslint/no-empty-object-type` | 1 | newly enabled |

**The three singletons were fixed, not suppressed** — each was a real, small defect:

- `helpers/getAssetUrl.ts` — `let id = ''` was dead, immediately reassigned in both branches of the
  following `if`/`else`. Now a single `const` ternary. Provably equivalent: the function returns early
  on any falsy `file`, so both branches always ran.
- `components/ConferenceTickets.vue` — `ticketsOnSale: Boolean` used the wrapper object type instead
  of `boolean`. Safe to change because **that component is never rendered anywhere**, and the prop is
  never passed and never read. Worth knowing before touching it: in `defineProps<T>()` Vue derives
  the *runtime* prop type from the TS type, so `Boolean` vs `boolean` is not purely cosmetic.
- `composables/useFlashMessage.ts` — `payload: { }` accepts any non-nullish value including `0` and
  `""`. Now `Record<string, unknown>`.

**The two bulk rules were demoted to warnings**, deliberately, to keep this a tooling change. Fixing
103 `any`s is a typing project that belongs with the `vue-tsc` burn-down — same class of problem,
overlapping files — and it would have buried a config swap in a few hundred lines of unrelated diff.
Demoting preserves the gate Phase 0 chose on purpose: fail on errors, leave pre-existing warnings
ungated rather than block on unrelated cleanup. For `no-unused-vars` that is *literally* its previous
behaviour.

Final: **0 errors, 134 warnings** (103 `no-explicit-any`, 15 `no-unused-vars`, 19 `vue/*`).

Also removed three `eslint-disable` directives that this change made dead — `no-redeclare` in
`composables/useEventListener.ts`, `no-use-before-define` in `types/directus.ts` and
`types/items.ts`. The new config uses the `@typescript-eslint` variants of those rules, which
understand TS overloads and interdependent type declarations, so the base rules no longer fire and the
directives were being reported as unused. Removing them is in scope precisely because this change
created the problem.

#### A new dependency: linting now needs `nuxt prepare`

`eslint.config.mjs` extends `.nuxt/eslint.config.mjs`, which the module generates from
`nuxt.config.ts`. If `nuxt prepare` has not run, linting fails with:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../.nuxt/eslint.config.mjs'
    imported from .../eslint.config.mjs
```

Verified by moving `.nuxt` aside. This is fine in CI — `npm ci` runs the `postinstall` script, which
is `nuxt prepare`, before the lint step — but it is a new coupling, and it would break under
`npm ci --ignore-scripts`.

Addressing review, the import is now dynamic so this case reports something actionable instead of a
bare `ERR_MODULE_NOT_FOUND`. The translation is deliberately narrow, and **decided on the filesystem
rather than by matching the error message**: Node phrases the failure as
`Cannot find module 'X' imported from Y`, so a missing *transitive* import still names the generated
config as `Y`. A message check therefore keys off the importer and mistakes a broken dependency for a
missing config — which the first attempt at this did, caught by testing it. Four paths are covered:

| situation | what you get |
| --- | --- |
| generated config present | normal lint run |
| `.nuxt` absent | "run `npm run postinstall` (nuxt prepare)" |
| syntax error *inside* the generated config | the `SyntaxError` itself |
| module the generated config imports is missing | `ERR_MODULE_NOT_FOUND` naming *that* module |

This is the one deliberate deviation from the config `@nuxt/eslint` scaffolds, which uses a static
import.

#### `--fix` is safe again

`npm run eslint` runs `eslint --fix`, and Phase 0 recorded that it must never be run on
`pages/konferenz/[slug]/index.vue`, where it converted a `TalkItem` type import into a value import
and broke the conference page. **That hazard is gone**: checked with `--fix-dry-run`, which now
reports no rewrite for that file, because the Phase 0 fix (`TalkItem as TalkItemType`) made the import
unambiguous. `--fix` would still reformat two files for `vue/first-attribute-linebreak` and
`vue/attributes-order`; both are pre-existing warnings and were left alone, since those two rules are
formatting concerns Prettier does not disable and applying them invites churn.

#### Smoke timeout raised, on measurement

One podcast-detail-page failure appeared during verification and was **not** a regression — SSR was
verified complete (84k characters in `<main>`, HTTP 200, no server error) and the page rendered fine
on direct navigation. It also was not the Phase 4 non-retrying-assertion bug: the poll waited its full
15s.

A first hypothesis — that polling `innerText` forces layout and is expensive on a large DOM — was
measured and **wrong**: 1.2ms versus 0.4ms for `textContent` across 13,795 nodes. The real cause is
plain contention headroom:

| load | time until `<main>` reports visible text |
| --- | --- |
| page loading alone | 1.3–1.6s |
| six pages loading concurrently | 2.8–**8.7s** |

Against a 15s assertion timeout that is under 2x headroom, and it always rendered eventually — zero
timeouts across 12 measured concurrent loads. So `expect.timeout` went to 30s, which costs nothing
when things are fast (web-first assertions resolve as soon as the condition holds) and masks nothing
(a page that never renders still fails). 18/18 four times after the change, still 12–13.5s per run.
Local is the worst case: `_ipx` resizes through sharp on first request, while CI hits the Vercel
preview where images are cached.

| gate | before | after |
| --- | --- | --- |
| `lint` | 0 errors, 29 warnings | **0 errors**, 134 warnings |
| `test` | 52/52 | 52/52 |
| ratchet | 263 | 263 |
| `build` | exit 0, 30.9 MB | exit 0, 30.9 MB |
| smoke | 18/18 | 18/18 (x4) |
| `npm audit` | 0 | 0 |

---

## Phase 6 — Deliberately deferred

Not blocked by EOL. Do **not** fold these into the phases above.

- [ ] **Tailwind 3.4 → 4.x.** This is a config-format rewrite (JS config → CSS-first `@theme`),
      and `@nuxtjs/tailwindcss@6` hard-pins `tailwindcss ~3.4.17`, so it also means moving to
      `@tailwindcss/vite`. `tailwind.config.js` carries a substantial custom theme (brand colours,
      seven custom breakpoints). Its own project.
- [ ] **Node 22 → 24.** Verify Vercel's supported runtimes first. Update `engines.node`, `.nvmrc`,
      and the `node-version` in every workflow together.
- [ ] **TypeScript 6.0.3 → 7.x.** Only the 7.x jump remains — **6.0.3 landed separately after
      Phase 2** (see below). TS 7 is the Go-based native rewrite, and the open question is no
      longer "will our code cope" but "do the tools support it": TS 7 broke `ts-api-utils` (it
      reads `ts.TypeFlags.Intrinsic` off the default export, and TS 7 changed the module shape),
      which means `@typescript-eslint` and therefore `npm run lint`. Evaluate `vue-tsc` and
      `@typescript-eslint` support first; the code itself is already clean. Drop the override when
      tackling it, and expect the ratchet baseline to move.
- [ ] **Nuxt 4 `app/` directory migration.** Cosmetic; do it when the team wants it, not as part
      of the framework upgrade.

---

## After the plan — follow-up backlog

Collected here so the phase write-ups stay a record of what each phase *did*, while the work each
one deliberately left behind stays findable in one place. **Nothing here blocks the EOL work**, and
nothing here needs doing before Phase 6 lands. Items marked ⚠️ were found by accident and would not
be caught by any current gate, which is the argument for writing them down rather than trusting
someone to rediscover them.

### 1. Install the Renovate GitHub App — highest value item here

`.github/renovate.json` was added in Phase 0 and **has never run.** Verified 2026-08-03: the repo has
no Dependency Dashboard issue and no Renovate PRs, so the config is inert.

This is first on the list because it is the only item that changes the *trajectory* rather than the
current state. Phases 0–6 pay off a backlog once; Renovate is what stops it re-accumulating, and
every phase so far has been manual work that Renovate would have surfaced as it happened. The config
is already written and already scoped (`includePaths: ["nuxt-app/**"]`, majors behind
`dependencyDashboardApproval`, `directus-cms/**` deliberately excluded for the licence block).

### 2. The 263 `vue-tsc` errors, which are two unrelated problems

Phase 4 moved the ratchet 209 → 263 and the two halves want different treatment:

| group | count | character |
| --- | --- | --- |
| Pre-existing | ~208 | **149 in `composables/useDirectus.ts` alone** — almost certainly a couple of bad generic signatures rather than 149 distinct problems, so likely a small fix with a large number attached. |
| `noUncheckedIndexedAccess` | 55 | Newly surfaced by Nuxt 4's default. **Each one is a real unchecked index**, not a typing artefact. |

The 55 are the more interesting set and the better starting point — they are individually small,
individually real, and concentrated: `helpers/parseCmsDate.ts` (12, indexing
`Intl.DateTimeFormat().formatToParts()` results), `components/MemberCard.vue` (8),
`helpers/ipProcessing.ts` (5, splitting an address and indexing), `components/PodcastRating.vue` (5),
`components/Pagination.vue`, `composables/useTagFilter*.ts`.

Two of the *original* 212 are worth fixing early, because both are imports of things that **do not
exist** — verified 2026-08-03:

- `helpers/getMetaInfo.ts:1` imports `MetaInfo` from `vue-meta/types/vue-meta`. `vue-meta` is a
  Nuxt 2 package and is **not a dependency and not installed at all**.
- `pages/podcast/index.vue:77` imports a `LatestPodcasts` type from `~/composables/useDirectus`,
  which never declares or exports it (only the `getLatestPodcasts` function exists).

Neither has broken anything because both are `import type`, so they are erased before runtime. The
cost is silent: an unresolvable type behaves like `any`, so the return type of `getMetaInfo` — the
helper every page's `useHead` call goes through — is effectively unchecked, as is the `podcasts`
computed on the podcast index. Fixing two lines restores type checking to a lot of call sites.

### 3. Build and tooling correctness

- [ ] ⚠️ **Remove `nitro.externals.inline: ['pinia']`.** Waiting on an upstream Pinia fix — see
      [Waiting on upstream: the Pinia 4 export map](#waiting-on-upstream-the-pinia-4-export-map)
      below for exactly what to watch for and how to check.
- [ ] **Make a full local `npm run build` work again.** Currently fails, and fails identically on
      `main` — the prerender crawler walks ~1500 `/_ipx/` image URLs and exhausts connections to the
      CMS. One line: `nitro: { prerender: { ignore: ['/_ipx'] } }`. Invisible in CI (which sets
      `SKIP_PRERENDER_ROUTE_DISCOVERY=true`) and on Vercel (which does not prerender at all), so the
      only person it hurts is a developer running a real build locally.
- [ ] ⚠️ **`tailwind.config.js` `content` globs do not include `.vue`.** They are
      `'./pages/**/*.{html,js}'` and `'./components/**/*.{html,js}'`, so they match essentially
      nothing; styling works only because `@nuxtjs/tailwindcss` injects its own defaults on top.
      **Fix this before Tailwind 4** (Phase 6), which changes content detection — a latent
      misconfiguration plus a detection rewrite is how you get a site that loses half its CSS with
      no error.
- [ ] **`vitest.config.ts` is loaded as CommonJS while using ESM syntax.** `npm test` warns that
      `configLoader: 'native'` "is planned to become the default in a future major version of Vite",
      at which point this breaks. Prefer **renaming to `vitest.config.mts`** over adding
      `"type": "module"` to `package.json` — the latter would reinterpret every `.js` file in the
      package, including `tailwind.config.js`, which uses `require()`.
- [ ] **Clear the ESLint warnings, then consider `--max-warnings 0`.** Now **134**, not the 29 Phase 0
      recorded — Phase 5's ESLint 10 swap surfaced far more. Two of the three groups are demoted
      rules that should go back to `'error'` once their count is zero (see `eslint.config.mjs`):

      | rule | count | note |
      | --- | --- | --- |
      | `@typescript-eslint/no-explicit-any` | 103 | Do this **with** the `vue-tsc` burn-down above — same class of problem, overlapping files. |
      | `@typescript-eslint/no-unused-vars` | 15 | Dead code; was a warning before ESLint 10 too. |
      | `vue/*` | 16 | 9 `no-v-html`, 4 `require-default-prop`, plus 3 singletons. `no-v-html` deserves its own look: each site is a real XSS surface fed by CMS content. |

### 4. Decide a browser-target policy, then revisit the CSS minifier

Phase 4 pinned `vite.build.cssMinify: 'esbuild'` because Vite 8's lightningcss default silently
rewrote every media query to Level 4 range syntax (`(width>=1024px)`), which needs Safari 16.4+.

The underlying gap is that **the repo has no `browserslist` and no explicit CSS target at all**, so
every tool guesses — and they guess differently. That is what made a minifier swap a
browser-support decision nobody made.

- [ ] Agree the actual support floor (Phase 1 already accepted dropping smooth-scroll animation
      below Safari 15.4, so a floor exists in practice — it is just unwritten).
- [ ] Record it once as `browserslist`, and derive the minifier target from it rather than
      hardcoding either choice.
- [ ] Then adopt lightningcss deliberately with explicit `css.lightningcss.targets`, ideally
      **alongside Tailwind 4** since that phase is already a CSS-pipeline project. lightningcss is
      faster and its output is valid; the problem was inheriting it as a side effect.

### 5. Small, verified, uncontroversial

- [ ] ⚠️ **`components/ConferenceTickets.vue` appears to be entirely unused.** Nothing renders it,
      and none of its three props is read inside it — `ticketsOnSale` is neither passed by any caller
      nor referenced in the component. Found while fixing a lint error in it. Either wire it up or
      delete it; a component nothing renders is a component nobody notices is broken.
- [ ] ⚠️ **The podcast rating flash-message payload is always empty.** `components/PodcastRating.vue`
      reads `message.value?.payload?.id` into `ratingId`, but both `setMessage(...)` call sites in that
      same file pass `{}`. So `payload.id` is always `undefined` and `ratingId` is always `''`. Either
      the id should be passed or the read should go, but as written one of the two is dead. Found while
      fixing the `{}` type on `setMessage` in Phase 5.
- [ ] ⚠️ **The local `.env` sets an email variable that nothing reads.** `nuxt-app/.env` provides
      exactly one email var, `NUXT_EMAIL_PASSWORD`, and **no code reads it** — `runtimeConfig`
      declares `emailSmtpPass`, which Nuxt populates from `NUXT_EMAIL_SMTP_PASS`. So locally
      `emailSmtpPass` is empty and `sendEmail` throws "SMTP host, user, or password not configured"
      before it ever reaches SMTP; the contact form cannot work on a dev machine. Found while
      verifying the nodemailer 9 upgrade. **This says nothing about production** — the deployed
      environment variables are not readable from the repo, and it may well set the correct names.
      Worth checking that it does, and either renaming the local var or deleting it, because a
      credential-shaped variable that is silently ignored is how a real outage gets misdiagnosed.
- [ ] ⚠️ **Auth-path `console.log`s leak into the browser console.**
      `composables/useDirectus.ts:897` logs `await directus.refresh()` — i.e. the **token refresh
      response** — plus the full user object at `:900`, and `pages/login-callback.vue:46` logs the
      user again. `getCurrentUser()` is called from `onMounted`, so this is client-side console
      output. Not currently reachable in production (login is behind `FLAG_SHOW_LOGIN`), which is
      exactly why it should be cleaned up *before* that flag is ever turned on.
- [ ] **`error.vue` ships an empty meta description** — `{ name: 'description', content: '' }`.
      Either give the 404 page a real description or drop the tag; an empty one is worse than
      absent. (Phase 4 removed the dead `hid` key from this same entry but deliberately left the
      empty `content` alone as out of scope.)
- [ ] **Drop `@ubclaunchpad/vue-fathom`** (last publish April 2022, 1 usage). Fathom's own snippet
      is a few lines — inlining it removes a dependency entirely. See Appendix A.
- [ ] **Re-check the `brace-expansion` advisory.** It stopped being reported during Phase 4, but
      the package is **still 2.1.4, unchanged** — the advisory data moved, not our tree. Treat it as
      unresolved rather than fixed.
- [ ] **Add a `.nvmrc`.** None exists, and Phase 4 raised `engines.node` to
      `^22.19.0 || ^24.11.0 || >=26.0.0` — ahead of at least one developer's local Node. Pairs
      naturally with Phase 6's Node 24 item, which already says to move `engines`, `.nvmrc` and
      every workflow's `node-version` together.
- [ ] **Remove or justify `nuxt-app/.npmrc`.** `shamefully-hoist` and `strict-peer-dependencies`
      are pnpm options and no-ops under npm (Appendix B) — they read as protection that is not
      there.

### 6. Standing items, not one-off tasks

- **Re-raise the Directus licence block if it persists.** It is the gate on `directus-cms/`, and
  the majority of the repo's reported vulnerabilities sit in that blocked tree. A block that is
  accepted for a quarter is very different from one accepted for a week.
- **`@nuxtjs/algolia` is the module most likely to need attention at Nuxt 5** (Appendix A). Nothing
  to do now; worth remembering when Nuxt 5 appears, since Nuxt 3's EOL is the precedent for how
  quickly that becomes urgent.

### Waiting on upstream: the Pinia 4 export map

**Status as of 2026-08-03: not fixed, and no upstream issue exists.** `pinia@4.0.2` is the newest
release (only 4.0.0, 4.0.1 and 4.0.2 have been published) and still carries the defect.

This section exists because `nitro.externals.inline: ['pinia']` in `nuxt.config.ts` is a workaround
for someone else's packaging bug, and workarounds with nothing concrete to watch for are how
temporary config becomes permanent. Phases 3 and 4 each spent time deleting exactly that kind of
fossil — `image.alias.cms`, `theme.container.screens` — so this one gets an explicit exit condition.

#### What regressed

Pinia 2 and 3 shipped a conditional export that resolved Node + production to a **pre-built CJS
file** with the Vue feature flags already substituted. Pinia 4 deleted the whole condition:

| version | `exports["."]` |
| --- | --- |
| `2.3.1` | conditional — `node` → `production` → `./dist/pinia.prod.cjs` |
| `3.0.4` | conditional — same `node` / `production` condition |
| **`4.0.0`** | `"./dist/pinia.mjs"` — **unconditional** |
| **`4.0.2`** | `"./dist/pinia.js"` — **unconditional** |

`dist/pinia.js` is the bundler build. It contains **five raw `__VUE_*` references**; the
`esm-browser` and `iife` builds Pinia also ships contain zero. So any consumer that does not put
pinia through a bundler — i.e. anything that externalises it, which is Nitro's default — gets an
undefined global and throws in `createPinia`, but only when `NODE_ENV=production`.

#### The fix we are waiting for

Either of these upstream changes is sufficient:

1. **Restore a `node` (or `production`) condition** in `exports["."]` pointing at a build with the
   flags already substituted — i.e. what 2.x and 3.x did. This is the more likely fix, since it is a
   reversion rather than new work.
2. **Guard the flag reads**, e.g. `typeof __VUE_PROD_DEVTOOLS__ !== 'undefined' && __VUE_PROD_DEVTOOLS__`,
   which is what makes Vue's own builds safe outside a bundler.

#### How to check, without a full upgrade cycle

```bash
npm view pinia exports --json
```

If `"."` is still a bare string, nothing has changed — stop there. If it has become an object with a
`node` condition, it is worth trying: drop the `inline` line, rebuild, and run the retest below.

#### How to retest — this is the part that matters

**`npm run build` passes either way, and so do `lint`, `test` and the typecheck ratchet.** Do not
treat a green build as evidence. The only checks that see this defect are the smoke suite and a
production-mode server:

```bash
SKIP_PRERENDER_ROUTE_DISCOVERY=true npm run build
cd .output && NODE_ENV=production node server/index.mjs   # NODE_ENV is the whole point
curl -o /dev/null -w '%{http_code}\n' http://localhost:3000/
```

`200` means fixed. `500` means put the line back.

**Do not go looking for `__VUE_PROD_DEVTOOLS__` in the server log — it is not there.** The
`ReferenceError` is thrown inside the Pinia plugin's `setup()` and swallowed; the only thing logged is
a misleading downstream symptom:

```
TypeError: Cannot read properties of undefined (reading 'state')
  at app:rendered (.output/server/chunks/virtual/entry.mjs)
```

That message is a red herring — it is `nuxtApp.$pinia` being undefined *because* setup already died.
Verified by re-running this exact procedure with the workaround removed. It is also why the community
answer blames `@pinia/nuxt` and recommends a downgrade. If you need to see the real error, instrument
the built `entry.mjs` and wrap the Pinia plugin's `setup` body in a `try/catch` that logs.

#### If it stays unfixed

No upstream issue tracks this. [vuejs/pinia#3067][pinia-3067] describes the *symptom*
(`$pinia` undefined at `app:rendered`) and its accepted answer — pin `@pinia/nuxt` back to `0.11.0` —
treats the symptom rather than the cause, so it is unlikely to lead to a real fix on its own.
**Someone should file the packaging regression upstream**, quoting the export-map table above, the
five raw flag references in `dist/pinia.js`, and the `NODE_ENV=production` reproduction. Until that
happens the workaround has no exit condition, and this note is the only thing standing between it and
permanence.

---

## Appendix A — Unmaintained or stale dependencies

Tracked so nobody has to rediscover them. None are urgent on their own.

| Package | Last publish | Note |
| --- | --- | --- |
| `@nuxt/image-edge` | Feb 2024 (nightly) | Phase 3 removes it |
| `h3-zod` | Jan 2024 | Phase 5 removes it |
| `eslint-plugin-nuxt` | Aug 2023 | ✅ removed in Phase 5 (ESLint 10) |
| `@ubclaunchpad/vue-fathom` | Apr 2022 | 1 usage. Fathom's own snippet is a few lines — consider inlining and dropping the dependency. |
| `smoothscroll-polyfill` | Aug 2022 | ✅ removed in Phase 1 |
| `rss` | Sep 2023 | Still works, no replacement needed. Watch it. |
| `@nuxtjs/algolia` | Nov 2025 | Fine, but it is the module most likely to need attention at Nuxt 5. |

## Appendix B — Notes and small findings

- `nuxt-app/.npmrc` sets `shamefully-hoist=true` and `strict-peer-dependencies=false`. **Both are
  pnpm options and are no-ops under npm.** They are not protecting anything today. Left in place
  rather than removed, in case the repo ever moves to pnpm — but do not rely on them.
- The `nitro:config` hook fetches live Directus data during build with
  `nitro.prerender.failOnError: true`. A CMS outage therefore fails the build. Acceptable for
  deploys; the reason CI's build step is run with route discovery disabled.
- **A full local `npm run build` (route discovery enabled) currently fails, and has done since
  before Phase 4.** The prerender crawler follows `/_ipx/…` image URLs and tries to prerender ~1500
  image transforms, which exhausts connections to the CMS. Measured identically on Nuxt 3 and Nuxt
  4; no page or payload fails, only image transforms. Neither CI nor Vercel is affected — CI skips
  discovery, and the Vercel build does not prerender at all (ISR `routeRules` make routes on-demand
  functions, and the build emits a `__fallback.func` in ~58s). To build fully offline-safe locally,
  either set `SKIP_PRERENDER_ROUTE_DISCOVERY=true` or add `nitro.prerender.ignore: ['/_ipx']`.
- **`tailwind.config.js` `content` globs do not include `.vue`** — they are
  `'./pages/**/*.{html,js}'` and `'./components/**/*.{html,js}'`. Nothing is broken today only
  because `@nuxtjs/tailwindcss` supplies its own default globs on top. A consequence worth knowing
  while debugging: a class that exists in no source file will not be generated, so probing Tailwind
  by injecting a class at runtime always reports "not applied" regardless of configuration.
- `DIRECTUS_CMS_URL` falls back to `https://admin.programmier.bar` (production) when unset.
- `overrides` in `nuxt-app/package.json` now holds three deliberate pins, each with a reason:
  `vue: ^3.5.0` (was the non-reproducible `"latest"`), `minimatch: ^9.0.7` (pre-existing), and
  `typescript: ^6.0.3` (holds back the TS 7 native rewrite — see Phase 6). Removing any of them
  without reading the relevant phase will reintroduce a known problem.

  **`package.json` is the authority on these values, not this document.** Where a phase write-up
  quotes an older number (Phase 2 records `typescript: ^5.9.3`, for instance) that is a dated
  record of what the phase did, not current state. Check the manifest before acting on any version
  in here.
- **`typescript` is also declared as a direct `devDependency`**, not only pinned in `overrides`.
  The distinction matters: an override forces a version but declares no intent, and **Renovate
  only manages packages that appear in `package.json`** — so an override-only pin is invisible to
  it and would never be proposed for upgrade. Being undeclared is also what caused the TS 7
  incident in the first place: with nothing declaring TypeScript, npm resolved it from a soup of
  loose transitive ranges and picked the newest. The devDependency states that this project uses
  TypeScript directly (`npm run typecheck`, `tsconfig.json`); the override remains as the guard
  against a transitive pulling something newer.
- `vue` is still override-only, deliberately. Unlike TypeScript, Nuxt owns `vue` as its own
  dependency, and declaring it directly in a Nuxt app invites duplicate-Vue resolution problems.
  The trade-off is accepted: it stays invisible to Renovate, and Nuxt upgrades carry it.

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
| 2026-07-31 | Phase 3 takes `@nuxt/image@2` even though it depends on `@nuxt/kit ^4` while the app is on Nuxt 3. It declares `nuxt: ">=3.1.0"`, builds, and serves images correctly. **Only v2 reaches a patched `sharp`** — `@nuxt/image@1.11.0` still pulls `sharp 0.32.6`, so staying on 1.x would not have cleared the advisory. |
| 2026-07-31 | ~~Smoke tests run **serial locally, parallel in CI**. The local target is one Node process doing SSR *and* image resizing, so parallelism measures the harness rather than the app.~~ **Superseded 2026-08-03** — the real cause was a non-retrying assertion, not saturation. Now parallel everywhere. |
| 2026-07-31 | TypeScript taken to **6.0.3** as its own PR straight after Phase 2, rather than folded into it. 5.9 → 6.0 is a major and Phase 2's contract was patches-and-minors; a separate PR keeps that honest and gives TypeScript an independent revert point. Verified as a measurable no-op (identical 210-error count, all gates green, zero deprecation warnings). |
| 2026-07-31 | Phase 2 pins `typescript` to `^5.9.3` via `overrides`. `npm update` resolved TS 7.0.2 through wide-open transitive ranges and broke `npm run lint` outright. TS 7 is the native rewrite and needs its own evaluation (Phase 6), not a drive-by in a patch phase. |
| 2026-07-31 | Phase 2 accepts `vite@8.2.0` in the tree. It serves **vitest** only; `@nuxt/vite-builder` gets a nested `vite@7.3.6` per its own dependency, so the Nuxt build moved 7.3.2 → 7.3.6, a patch. |
| 2026-07-31 | Judge audit progress by **distinct root advisories**, not npm's headline total. Phase 2 went 49 → 3 advisories while the reported total rose 23 → 33, because one surviving advisory is counted once per dependent package. |
| 2026-07-31 | Phase 1 drops smooth-scroll animation for Safari < 15.4. Accepted: those browsers still scroll, just instantly, and `ConferenceAgenda.vue` already relied on native support without the polyfill. |
| 2026-07-31 | `directus-cms/` upgrades **blocked** pending legal clarification of the Directus licence. Nuxt work continues independently. `@directus/sdk` (MIT) is unaffected by the block, but Phase 5's SDK jump is constrained by the server staying on 11.x. |
| 2026-08-03 | Phase 4 keeps `noUncheckedIndexedAccess` at Nuxt 4's new default of `true` and moves the ratchet 209 → 263, rather than disabling the flag to hold the number down. The +55 are latent unchecked-index bugs the flag *reveals*; suppressing a framework default to protect a metric would discard real signal. |
| 2026-08-03 | Phase 4 does **not** move to the `app/` directory. Nuxt 4 auto-detects the v3 layout (verified via generated types), so the move is optional, mechanical, and touches every source path — it belongs in its own PR where the diff is reviewable. |
| 2026-08-03 | Phase 4 runs the Nuxt 4 codemods **individually rather than via `migration-recipe`**, because the recipe bundles `file-structure` (the `app/` move) and its opt-out is interactive. A manual breaking-change sweep was done first and treated as the real evidence, since the codemods are known to no-op spuriously. |
| 2026-08-03 | Fixed `theme.container.screens` in `tailwind.config.js`, which emitted the invalid `@media (min-width: 100%)`. Required, not opportunistic: Vite 8 minifies the server build with lightningcss, which rejects it and fails the build. Verified behaviour-neutral by diffing generated CSS — browsers were already discarding the rule as `not all`. |
| 2026-08-03 | Pinned `vite.build.cssMinify: 'esbuild'`. Vite 8's lightningcss default rewrote every media query to Level 4 range syntax (`(width>=1024px)`), which needs Safari 16.4+ and would drop the *entire* responsive layout at once on 16.0–16.3 — there is no browserslist to constrain it. Every gate passed either way; found only by diffing deployed CSS against production. lightningcss should be adopted deliberately with explicit targets in Phase 6, not inherited as a side effect. |
| 2026-08-03 | The blank-render smoke assertion now uses `expect.poll`. The Phase 3 "CPU contention" diagnosis found the trigger but not the defect: `innerText()` was read once with no retry. Fixing it let the local worker cap be removed (6 workers pass, ~14s vs ~23s) and retires the `SMOKE_BASE_URL` special case from #227. |
| 2026-08-03 | The pre-existing `/_ipx` prerender-crawl failure is left **unfixed** in Phase 4 and logged as a follow-up. It is identical on Nuxt 3, affects only full local builds, and fixing it would mean shipping an unrelated nitro config change inside a framework major. |
| 2026-08-03 | Phase 5 starts with `nodemailer`, per its own priority note, and takes `@types/nodemailer` 6.4.24 → 8.0.1 with it. DefinitelyTyped has no `@types/nodemailer@9`, so a mismatch is unavoidable; one major behind beats three, and the types belong to the package being upgraded rather than being unrelated scope. Verified the types are enforced rather than degrading to `any`. |
| 2026-08-03 | Recorded that GHSA-p6gq-j5cr-w38f was **not reachable** in this codebase — it needs the `raw` message option, which `sendEmail` never uses. The upgrade still stands, but the "high severity" label overstated real exposure, and the plan should not imply a reachable high sat open. |
| 2026-08-03 | Pinia 4 shipped with `nitro.externals.inline: ['pinia']` rather than holding Pinia back. Pinia 4 exports only its bundler build, so externalising it throws `__VUE_PROD_DEVTOOLS__ is not defined` in production only. Inlining is a workaround for an upstream packaging bug, accepted because it is one line, verified (zero unreplaced flags, exactly one `createPinia`), and the alternative left `@pinia/nuxt@0.5.5` declaring `@nuxt/kit ^3` on a Nuxt 4 app. Logged for removal. |
| 2026-08-03 | Rejected the community fix for the Pinia SSR crash — pinning `@pinia/nuxt` back to 0.11.0. The `$pinia is undefined` error at `app:rendered` is a *symptom*: the plugin's `setup()` had already thrown and the error was swallowed. Instrumenting the built bundle found the real `ReferenceError` inside `createPinia`, which pinning would have hidden rather than fixed. |
| 2026-08-03 | ESLint taken to **10**, not the 9 this phase originally specified. That note predated `@nuxt/eslint-config@1.16.0`, which *depends* on `@eslint/js ^10.0.1` — 10 is its primary target, and `@typescript-eslint` 8.65 and `eslint-plugin-vue` 10.10 both peer `^9 || ^10`. Picking 9 would now be the less aligned choice. TypeScript 6.0.3 sits inside `@typescript-eslint`'s `>=4.8.4 <6.1.0`. |
| 2026-08-03 | `no-explicit-any` (103) and `no-unused-vars` (15) demoted to warnings in `eslint.config.mjs` rather than fixed or disabled. `@nuxt/eslint-config@1` is much stricter than `0.2`, and enabling it as-is turned 0 errors into 121. Fixing 103 `any`s is a typing project belonging with the vue-tsc burn-down, not a lint upgrade; demoting keeps the signal while preserving Phase 0's gate-on-errors choice. The three singleton errors were fixed rather than suppressed. |
| 2026-08-03 | Smoke `expect.timeout` raised 15s → 30s, sized from measurement: the heaviest page reports visible text in 1.3–1.6s alone but 2.8–8.7s with six loading concurrently, and never failed to render in 12 concurrent loads. A first hypothesis (polling `innerText` forces expensive layout) was measured and disproved at 1.2ms. Raising the budget masks nothing — a page that never renders still fails. |
