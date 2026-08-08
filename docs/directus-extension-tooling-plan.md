# Directus Extension Tooling & Upgrade Plan — `directus-extension-programmierbar-bundle`

- **Started:** 2026-08-05
- **Scope:** `directus-cms/extensions/directus-extension-programmierbar-bundle/` only, plus the CI
  workflow and `Dockerfile.directus` steps that build and test it.
- **Driver:** the extension bundle never received the treatment `nuxt-app` got in
  [the dependency upgrade plan](dependency-upgrade-plan.md). It has no format gate, no build gate,
  and **no typecheck at all** — `tsc` cannot even start on this tree. Its dependencies are a year
  behind and it carries one critical and seven high advisories.

## Why this is not blocked by the Directus licence question

[The `nuxt-app` plan](dependency-upgrade-plan.md) declares `directus-cms/` out of scope and blocked
pending a legal clarification of the Directus licence. That block is narrower than its wording
suggests, and this plan lives inside it deliberately.

**Verified 2026-08-05 — every `@directus/*` package this bundle depends on is MIT:**

| Package | Installed | Latest | Licence |
| --- | --- | --- | --- |
| `@directus/extensions-sdk` | 17.1.4 | 18.0.2 | MIT (both versions) |
| `@directus/errors` | 2.3.1 | 2.5.0 | MIT (both versions) |
| `@directus/sdk` | 21.3.0 | 24.0.0 | MIT (both versions) |

The non-OSI package is `directus` itself (`"SEE LICENSE IN license"`), and it is a dependency of
`directus-cms/package.json` — **not** of this bundle. Nothing in this plan touches it.

**The constraint that does apply is compatibility, not licensing.** The licence block freezes the
server at **Directus 11.17.4**, and whatever this bundle builds has to load into that server. That
is what makes `@directus/extensions-sdk` 17 → 18 the riskiest item here (Phase 6), and it is why
that upgrade is last rather than first even though it is the only thing that clears the final two
advisories.

**Action required elsewhere:** `.github/renovate.json` has `includePaths: ["nuxt-app/**"]` and a
description telling future readers not to add `directus-cms`. Both need correcting once this plan
lands — see Phase 7. Leaving them as-is means every dependency in this tree stays invisible to
Renovate forever, which is how it got a year behind in the first place.

---

## Status

| Phase | Goal | Status |
| ----- | ---- | ------ |
| 0 | Make the existing gates honest — format, build, Node, hermetic image | ✅ Done (2026-08-05) |
| 1 | Turn on typechecking, ratcheted | ⬜ Not started |
| 2 | Jest → Vitest; supersede ADR 0001 | ⬜ Not started |
| — | Carve-out: the `sanitize-html` critical, may ship any time | ⬜ Not started |
| 3 | **Hook contract tests (Tier 2)** — the safety net for everything after it | ⬜ Not started |
| 4 | Security fixes and minors, no majors | ⬜ Not started |
| 5 | **E2E harness against a real Directus (Tier 3)** | ⬜ Not started |
| 6 | Majors, one PR each (7 items) | ⬜ Not started |
| 7 | Bring the bundle under Renovate | ⬜ Not started |
| — | [Deliberately deferred](#deliberately-deferred) | ⬜ |

**Test coverage moved from last to third — deliberately, and this plan was wrong the first time.**
The original ordering put coverage after the upgrades, inherited from the `nuxt-app` plan's shape
without re-deriving it. It does not survive contact with this codebase: see
[why the tests come before the upgrades](#why-the-tests-come-before-the-upgrades). The upgrade phases
are what the tests exist to protect, so they now sit after them.

---

## Baseline (measured 2026-08-05)

| | |
| --- | --- |
| Runtime (CI + image) | Node 22 — CI pins `node-version: 22`, `Dockerfile.directus` is `FROM node:22` |
| Runtime (local dev) | Node 24.19.0, npm 11.17.0 — **already drifted from CI** |
| Lockfile | `package-lock.json` v3 |
| Toolchain | TypeScript 5.9.3, ESLint 9.39.4, Prettier 3.8.3, Jest 29.7.0 + ts-jest 29.4.9 |
| `npm audit` | **19 vulnerabilities — 1 critical, 7 high, 8 moderate, 3 low** |
| Tests | 15 files, **205 assertions, all passing**, 0.9 s |
| Test coverage | **9 of 26** bundle entries have any test |
| `npm run lint` | ✅ passes, 0 errors |
| `npm run build` | ✅ passes |
| `prettier --check` | ❌ **64 files** unformatted |
| `tsc --noEmit` | ❌ **does not run** — dies on `TS5110` before checking anything |

Refresh these numbers at the start of each phase. They are the before/after evidence that a phase
did what it claimed.

### Gate comparison against `nuxt-app`

This is the gap the first two phases close:

| Gate | `nuxt-app` | this bundle (baseline) | after Phase 0 |
| --- | --- | --- | --- |
| `npm ci` in CI (lockfile authoritative) | ✅ | ✅ | ✅ |
| `npm ci` in the **production image** | n/a (Vercel) | ❌ `npm install` | ✅ |
| Formatting checked | ✅ `prettier:check` | ❌ nothing | ✅ |
| ESLint | ✅ | ✅ (but not the `.vue` file) | ✅ incl. `.vue` |
| Tests | ✅ Vitest 4 | ✅ Jest 29 | ✅ Jest 29 (Phase 2) |
| Typecheck | ✅ ratcheted | ❌ **impossible today** | ⬜ Phase 1 |
| Production build | ✅ | ❌ nothing | ✅ |
| Node version declared in one place | ✅ `.nvmrc` | ❌ hardcoded in 2 places | ✅ `.nvmrc` |
| CI triggers on `shared-code/` changes | n/a | ❌ | ✅ |

---

## The four findings that shape this plan

### 1. `tsc` has never run on this codebase

```
$ npx tsc --noEmit
tsconfig.json(2,5): error TS5110: Option 'module' must be set to 'NodeNext'
                                 when option 'moduleResolution' is set to 'NodeNext'.
```

The config is invalid for typechecking and always has been. This went unnoticed because
`directus-extension build` uses its own Rollup/esbuild pipeline that never consults `tsc` — so the
build is green while the type checker cannot start.

Behind that one config error, measured with `module: NodeNext` forced:

| | |
| --- | --- |
| Errors | **124** across **32 files** |
| Worst file | `algolia-index/index.ts` (24) |
| In test files | ~38 (`post-to-discord` 15, `member-matching` 13, `fetch-open-graph` 10) |
| Top codes | `TS2532` possibly-undefined (39), `TS2345` bad argument (18), `TS7006`/`TS7008` implicit any (29) |

A second structural problem sits underneath: `rootDir: "./src"` conflicts with the seven
`shared-code/` imports, producing `TS6059`. Widening `rootDir` and including `shared-code` in the
program resolves all seven — that is the difference between the 131 errors a naive run reports and
the 124 real ones.

### 2. Jest is configured for ESM and runs as CommonJS anyway

`jest.config.ts` sets `preset: 'ts-jest/presets/js-with-ts-esm'`, `extensionsToTreatAsEsm: ['.ts']`
and `useESM: true`. None of it takes effect. Probed directly inside a test:

```
typeof module:  object
typeof exports: object     ← CommonJS
```

[ADR 0001](../_ADRs/0001-jest-runs-in-cjs-mode.md) documented this in June and deferred the fix, but
it named the trigger to act on: *"the number of ESM-stub workarounds grows beyond a couple of
files."*

**That trigger has fired.** Counted 2026-08-05:

- **5 files** stub `@directus/extensions-sdk` purely because it is ESM-only —
  `cascade-publish`, `create-news`, `fetch-open-graph`, `newsletter-double-opt-in`,
  `schedule-publication`
- **3 files** stub `shared/errors.ts` for the same reason, testing nothing about it

Eight stubs that exist only to work around the module format. ADR 0001 also pre-picked the
destination — *"Vitest … likely the lower-friction destination"* — and `nuxt-app` is already on
Vitest 4, so migrating also collapses two test runners into one. Phase 2 acts on this and supersedes
ADR 0001 with a new ADR.

### 3. Read the audit correctly: the critical is the only runtime issue

19 vulnerabilities is a misleading headline. Split by what actually ships into the running CMS:

**Runtime — shipped into the Directus process. Fixable now, no majors:**

| Severity | Package | Advisory | Fix |
| --- | --- | --- | --- |
| **CRITICAL** | `sanitize-html` 2.17.3 | XSS via `xmp` raw-text passthrough | → 2.17.6 (patch) |
| HIGH | `axios` 1.16.0 | DoS via recursion in `formDataToJSON` | → 1.19.0 (minor) |
| HIGH | `form-data` | CRLF injection via unescaped field names | `npm audit fix` |
| HIGH | `brace-expansion` | DoS, `max` protection defeated | `npm audit fix` |

**Build-time only — `@directus/extensions-sdk`'s own toolchain, never loaded by Directus:**

| Severity | Package | Reaches us via | Fix |
| --- | --- | --- | --- |
| HIGH | `vite` 7.3.2 | `@vitejs/plugin-vue` ← extensions-sdk | **extensions-sdk 18 (major)** |
| HIGH | `js-yaml` | `@directus/utils`, `cosmiconfig` ← extensions-sdk | **extensions-sdk 18 (major)** |
| HIGH | `postcss` | `cssnano` ← `rollup-plugin-styler` ← extensions-sdk | `npm audit fix` |
| HIGH | `svgo` | extensions-sdk | `npm audit fix` |

Two consequences worth stating plainly:

- **`npm audit fix --force` is the wrong move.** It resolves exactly two highs — `vite` and
  `js-yaml` — by installing `@directus/extensions-sdk@18`, a Directus-12-era build tool, against a
  server frozen at 11.17.4. Both are developer-machine build-time issues. Do not trade a
  production-compat risk for them; that upgrade gets its own PR and its own verification in Phase 6.
- **The critical is less urgent than its rating, and should still be fixed first** because it is
  free. `algolia-index/util/sanitizer.ts` calls `sanitizeHtml` with a strict allowlist
  (`['a','p','ul','li']`, or `[]`), and its input is CMS content written by trusted editors, not
  public submissions. Exploiting it needs a compromised editor account. It is a one-line patch bump,
  so it ships as a carve-out ahead of Phase 3 rather than waiting for a phase.

The existing `"overrides": { "axios": "$axios" }` means the direct `axios` bump fixes every axios
copy in the tree at once — a single-point fix, not a hunt.

### 4. The production image build ignores the lockfile

`Dockerfile.directus` runs `npm install` — twice, once for `directus-cms` and once for this bundle —
not `npm ci`. The image can therefore resolve different versions than CI tested and than the
lockfile records. This is the same class of defect that Phase 0 of the `nuxt-app` plan fixed in CI,
still live in the path that actually builds production.

It is also the file that pins Node: `FROM node:22`. Together with the CI workflow's hardcoded
`node-version: 22`, the Node version is stated in two places and in neither of them is it a
single source of truth — meanwhile local development is already on 24.19.0.

---

## The testing strategy

Three tiers. The middle one is the gap, and it is the one that closes the bugs this codebase has
actually shipped. Recorded as
[ADR 0003](../_ADRs/0003-three-tier-extension-testing.md), which complements rather than supersedes
ADR 0001 — the `util/`-extraction guidance there is still Tier 1.

| Tier | What it runs | Where | Speed |
| --- | --- | --- | --- |
| **1 — unit** | Pure functions extracted into `util/`, no framework imports | Existing suite | ms |
| **2 — hook contract** | The **real hook module** against a **fake Directus context** | Existing suite | ms |
| **3 — E2E** | The **built bundle** inside a **real Directus 11.17.4** | Own workflow | ~2 min |

### What Tier 1 structurally cannot see

The current convention — extract logic to `util/`, unit-test it — covers **decisions and payload
shapes**. `post-to-discord` is the model: it tests `buildNewsEmbed` for URL building, brand colour
and slug fallback, and never touches the hook registration or the HTTP call.

Every bug this bundle is known to have shipped lives in the part that leaves uncovered:

- **[ADR 0002](../_ADRs/0002-batch-updates-use-updateone.md):** `updateMany` fires one action carrying
  `metadata.keys[]`; downstream hooks read `keys[0]`; every cascaded item but the first silently never
  reaches Algolia. Nothing errors.
- **The buzzsprout-class crash** ADR 0001 refers to: an un-awaited promise in a hook handler.
- The two traps [the conventions doc](../.claude/rules/directus-conventions.md) names: does the hook
  fire when an item is *created* already in the triggering state, and is there a guard against firing
  twice?

None are reachable from a pure function. All are reachable from Tier 2. So the real gap is not "17
entries have no tests" — it is that **nothing tests the hook-to-Directus contract, including for the
9 entries that are tested.**

### Tier 2 needs no Directus, and already has five precedents here

Drive the registered `action`/`filter` callbacks directly, passing a hand-built context —
`{ services: { ItemsService }, getSchema, env, logger }`. Assert on what the hook *did*: that
`updateOne` was called three times rather than `updateMany` once, that a second invocation is a
no-op, that the create path behaves like the update path.

The five files that stub `@directus/extensions-sdk` (`cascade-publish`, `create-news`,
`fetch-open-graph`, `newsletter-double-opt-in`, `schedule-publication`) are already doing exactly
this. The pattern is proven in-tree; it is simply not applied to the other 18. **Phase 2 makes it
cheaper**, because native ESM removes the stubs those five need today.

### Tier 3 exists for what Tier 2 fakes — so keep it thin

Roughly five scenarios, not twenty-six. Its unique value is proving the wiring Tier 2 assumes: that
the built bundle **loads** into 11.17.4 at all, that hooks register against real event names, that a
real `ItemsService.updateOne` triggers the real action. That is also the only thing that can validate
`@directus/extensions-sdk` 18 in Phase 6 — which is why Tier 3 comes first.

Feasibility is better than it looks: `DB_CLIENT="sqlite3"` means **no service containers**,
`schema.json` plus `directus schema apply` gives the real schema (and
`directus_schema_snapshot.yml` already keeps it fresh), and `setup.sh` already does bootstrap with
`--no-data` and `--reset`.

### External services in E2E: redirect, do not mock

In Tier 3 the hook runs inside a separate Directus process, so module mocking is unavailable — there
is no `vi.mock` across a process boundary. The only lever is **configuration**: point every base URL
at one local stub server. Audited 2026-08-05, all 11 outbound integrations:

| Already redirectable via env | Hardcoded — needs a code change first |
| --- | --- |
| Buzzsprout (`BUZZSPROUT_API_URL`) | **Gemini** — `GEMINI_API_BASE` module const |
| Browserless (`BROWSERLESS_API_URL`) | **Bluesky** — `BSKY_SERVICE = 'https://bsky.social'` |
| Deepgram (`DEEPGRAM_API_URL`) | **Slack** — `new WebClient(token)` at module load, defaults to slack.com |
| Discord (`DISCORD_WEBHOOK_URL`) | **Algolia** — host derived from `ALGOLIA_APP_ID` |
| Vercel (`VERCEL_DEPLOY_WEBHOOK_URL`) | **Wallet** — `walletobjects.`/`oauth2.googleapis.com` |
| Mastodon (`MASTODON_INSTANCE_URL`) | |

**6 of 11 already work.** The other 5 violate a rule this repo already has — AGENTS.md, *"No
hardcoded defaults buried in business logic (prompts, URLs, feature flags). If it affects behavior,
it must be visible and configurable."* That refactor is justified on its own terms; Tier 3 only makes
it urgent. Slack is the worst case: the client is built at import time from `process.env`, which is
why five test files mock `postSlackMessage` wholesale instead of configuring it.

**Fail closed.** Run the E2E job with **no secrets in the environment at all** — not fake-but-plausible
values. A missed redirect then dies on a connection error instead of posting to the production Slack.

**Deliberately excluded:** hitting real third-party APIs, even sandboxes. That imports their uptime
into CI. If you want to know Buzzsprout's contract still holds, that is a scheduled canary against
staging, not a PR gate.

---

## Why the tests come before the upgrades

The first version of this plan put coverage in Phase 5, after the upgrades. That was wrong, and the
reason is specific to this codebase rather than a matter of taste: **the dependencies being upgraded
are consumed almost entirely by the modules that have no tests.**

Measured 2026-08-05 — every file the planned bumps touch:

| Dependency | Phase | Consuming file | Covered? |
| --- | --- | --- | --- |
| `sanitize-html` **(CRITICAL)** | 4 | `algolia-index/util/sanitizer.ts` | ❌ |
| `algoliasearch` | 4 | `algolia-index/index.ts` | ❌ |
| `axios` (HIGH) | 4 | `screenshot`, `buzzsprout`, `deploy-website`, `podcast-transcript` | ❌ ×4 |
| `axios` (HIGH) | 4 | `post-to-discord/discord.ts`, `fetch-open-graph/index.ts` | ✅ ×2 |
| `@slack/web-api` | 4, 6 | `shared/postSlackMessage.ts` | ❌ |
| `pdfkit` | 6 | `shared/invoice-generator.ts` | ❌ |
| `@directus/sdk` | 6 | `algolia-index/{util/pagination,cli/rebuild,cli/repair}` | ❌ ×3 |
| `meow` | 6 | `algolia-index/cli/{rebuild,repair}` | ❌ ×2 |
| `node-html-parser` | 6 | `fetch-open-graph/util/openGraph.ts` | ✅ |
| `@directus/extensions-sdk` | 6 | every hook's `defineHook` | Tier 3 only |

**3 of 16 covered.** And `algolia-index` — the largest module in the bundle, zero tests — is hit by
**four separate bumps**: the `sanitize-html` critical, `algoliasearch`, `@directus/sdk` and `meow`.

The original Phase 3 even contained the tell: *"Verify the Algolia indexer specifically … a broken
indexer fails silently."* A hand-verification step written into an upgrade phase is an admission that
the automated check should have existed first.

**One carve-out.** The `sanitize-html` critical does **not** wait for Phase 3. Holding a security
patch behind a multi-PR test-writing phase is the wrong trade, and a sanitizer is the easiest thing in
the codebase to test — pure string in, string out. Ship it whenever, with unit tests for
`sanitizer.ts` in the same PR. That is the risk-driven principle in miniature: test what the bump
touches, in the PR that bumps it.

---

## Ground rules

Carried over from the `nuxt-app` plan, which they served well:

1. **One phase per PR.** Phase 6 is one PR *per major*, not one PR for the phase.
2. **Every phase is revertable** by reverting one commit and running `npm ci`.
3. **Refresh `npm audit` and the typecheck count** before and after each phase; record the deltas.
4. **The 205 passing tests are the contract.** Any phase that ends with fewer than 205 passing
   assertions has broken something, most especially Phase 2.
5. Do **not** silently widen scope. Unrelated work found along the way goes in the follow-up list,
   not into the phase.
6. **Never touch `directus-cms/package.json`'s `directus` dependency.** That is the blocked one.

---

## Phase 0 — Make the existing gates honest — done 2026-08-05

**Goal:** every gate `nuxt-app` has, this tree has too. **Zero dependency version changes** — the
only dependency touched is a new one (`eslint-plugin-vue`), on the same footing as `nuxt-app`'s
Phase 0 adding `vue-tsc` and `@playwright/test`.

- [x] Added a `prettier:check` script and wired it into CI **before** the lint step. Uses
      `prettier:check`, never `prettier` — the latter writes, so it would pass by mutating.
- [x] Reformatted the **64 unformatted files**, kept separate from the config changes so the
      reviewable diff and the mechanical diff do not mix. Verification below.
- [x] Added a **build** step to the bundle's CI job. Lint and tests both passed previously while
      nothing confirmed `directus-extension build` still produced a loadable bundle.
- [x] Removed the deprecated `jsxBracketSameLine` key from `.prettierrc`, which warned on every run.
      Confirmed it changed no output: still exactly 64 files unformatted afterwards. The config now
      matches `nuxt-app/.prettierrc` exactly, minus the Tailwind plugin.
- [x] Removed the dead `**/podcast-transcription/**` entry from `eslint.config.js` — the directory is
      `podcast-transcript`, so the ignore had never matched anything.
- [x] Added `.nvmrc` (`22`) and `engines.node` (`>=22`, matching what Directus 11.17.4 itself
      declares), and pointed CI at `node-version-file:` instead of a hardcoded `22`.
- [x] Changed both `npm install` calls in `Dockerfile.directus` to `npm ci`. Verified first that both
      lockfiles are actually in sync (`npm ci --dry-run` exits 0 in `directus-cms` and in the bundle)
      — otherwise this would have handed over a broken image build.
- [x] **ESLint now covers the Vue SFC.** See below — the file is 76 lines, not the 20 this plan
      originally guessed, and it had two real errors.
- [x] Rewrote `TESTING.md`, which claimed exactly one function was tested.
- [x] **Added `shared-code/**` to the workflow's `paths` filter.** Not in the original checklist: the
      bundle imports from `shared-code/`, so a change there could break its build or tests while
      skipping the gate entirely.
- [x] `directus:extension.host` — **verified, and correctly left alone.** See below.

### `host: "^10.10.0"` is correct, and this plan was wrong to suspect it

The original checklist assumed `^10.10.0` was stale because the server runs 11.17.4. It is not.
Read from the installed packages:

- `@directus/extensions-sdk/dist/constants/last-breaking.js` exports
  `LAST_BREAKING_RELEASE = '10.10.0'`, and `directus-extension create` scaffolds `host` as
  `` `^${LAST_BREAKING_RELEASE}` ``. So `^10.10.0` is **exactly what the SDK generates.** The field
  declares which version of the *extensions API contract* the extension targets — the last release
  that broke it — not which server version it runs on.
- At load time Directus does not check it against the running server at all:
  `@directus/extensions/dist/index.js` types it as plain `z.string()`. The only validation anywhere
  is `check-directus-config.js` asserting `semver.validRange(host)`, which `^10.10.0` satisfies.

Changing it to `^11.0.0` would have narrowed the declared compatibility for no reason and diverged
from what the tooling produces. **Do not "fix" this field.** Revisit only in Phase 6, where
`extensions-sdk` 18 may ship a different `LAST_BREAKING_RELEASE`.

### Enabling the Vue gate found dead config, then two real errors

`eslint-plugin-vue`'s recommended set was added — and immediately produced 2 errors plus **20
warnings**, all of the latter being formatting rules fighting Prettier (`vue/html-indent` wants
2-space indentation; `.prettierrc` says 4).

The cause was a second, separate gap: **`eslint-config-prettier` was already a dependency but the
config had never applied it.** Harmless while the config was TypeScript-only and enabled no
stylistic rules, and immediately load-bearing the moment a plugin with formatting rules arrives.
Applying it last — later flat-config objects win — took the 20 warnings to 0.

That left 2 genuine errors, both unused `watch` callback parameters in
`publishable/presentation-publishable.vue`, now removed. The gate was then confirmed to actually
fire, by injecting an unused variable and watching ESLint fail on it.

**Found but deliberately not fixed:** the same file declares `ref<Boolean | null>` with the boxed
`Boolean` object type rather than `boolean`. Nothing catches it — ESLint has no opinion, and `tsc`
never reads `.vue` files, so even Phase 1's typecheck gate will not see it. Logged in the follow-up
list rather than fixed here, since it is app code in a tooling phase.

### Verifying a 64-file reformat, when the tests cover a third of it

The four gates pass, which proves little: a formatter change is invisible to lint, test and build by
construction, and 17 of 26 entries have no tests at all. So the reformat was verified against **the
artefact Directus actually loads** — build before, build after, compare.

Checked first, because it is the one way a reformat can genuinely break something: the
`@ianvs/prettier-plugin-sort-imports` plugin reorders imports, which matters if any import has a
load-time side effect. Two exist — `import 'dotenv/config'` in the Algolia CLI scripts. Both are
safe: the plugin keeps the side-effect import in the same slot (after third-party, before local),
and the only `process.env` reads in those files sit below the whole import block.

| | before | after |
| --- | --- | --- |
| `dist/app.js` | 2780 bytes | 2777 bytes |
| `dist/api.js` | 1009375 bytes | 1009379 bytes |

Neither is byte-identical, so both were reduced to whether anything *semantic* moved:

- **`app.js` — fully accounted for.** All 43 string literals identical. Normalising every identifier
  to a placeholder leaves exactly **one** structural difference, `(X,X)` → `()`: the two unused
  parameters removed above. The rest of the raw diff was the minifier reallocating single-letter
  names as a knock-on.
- **`api.js` — import-order churn, no content change.** Same 18 imported module specifiers, same
  counts, same top-level order. 10,554 of 10,583 literals byte-identical; the 29 that differ are
  minified lazy-init blobs from the `entities` package whose only variation is Rollup's internal
  module variable names (`Sg`→`kg`, `Tg`→`Ig`, …) and how the minifier grouped `var` declarators —
  both knock-ons of modules being emitted in a different order.

Static normalisation could not push `api.js` past "almost certainly equivalent", so the decisive
check was a **runtime one**: import both builds in Node and compare the registry they hand Directus.

| | before | after |
| --- | --- | --- |
| exports | `endpoints`, `hooks`, `operations` | identical |
| hooks | 23, in order | **identical** |
| endpoints | 2 (`conference`, `ticket-wallet`) | **identical** |
| operations | 0 | identical |

23 hooks + 2 endpoints + 1 interface = the 26 declared entries. Deep-equal across both builds.

**Blind spot, stated plainly.** This compares the registry's *shape* — names, order, key types — not
the behaviour of the 23 handler functions, which cannot be invoked without a Directus host. A
formatter cannot rewrite a function body, and the literal comparison above would have caught any
changed string, URL or config value, but "the bundle registers the same 23 hooks" is not the same
claim as "all 23 still behave identically".

**Verification:** `prettier:check`, `lint`, `test` (205/205), `build` all green; `npm audit` unchanged
at 19; built registry deep-equal to pre-reformat.

## Phase 1 — Turn on typechecking, ratcheted

**Goal:** a typecheck gate that fails on *new* type debt. Again **zero dependency changes and zero
source changes** — 124 pre-existing errors are baselined, not fixed.

- [ ] Add `tsconfig.typecheck.json` extending the base config with `module: "NodeNext"`,
      `noEmit: true`, `rootDir: "../../.."`, and `shared-code/**/*.ts` in `include`.
- [ ] Add `typecheck` and `typecheck:ratchet` scripts. Copy
      `nuxt-app/scripts/typecheck-ratchet.mjs` — it already handles the one trap here, that a type
      checker exiting non-zero on diagnostics must be distinguished from one that failed to run
      (swallowing the latter yields empty output, which parses as zero errors and reports green).
- [ ] Commit `.typecheck-baseline` at **124** and add the CI step.
- [ ] Fix the two `noUnusedLocals` errors (`TS6133`/`TS6138`) if they are trivial, or leave them in
      the baseline. Do not start on the other 122 in this phase.

### Why a second tsconfig instead of fixing the first one

The obvious move — set `module: "NodeNext"` in `tsconfig.json` and be done — breaks the test suite.
ts-jest reads that field to decide its emit format. Setting it to `NodeNext` makes ts-jest emit ESM
into a Jest runtime that is running as CommonJS without `--experimental-vm-modules`, and all 17
`jest.mock` calls stop working. ADR 0001 records hitting exactly this.

So the base config stays untouched until Jest is gone. **Verified 2026-08-05:** with
`tsconfig.typecheck.json` present, `tsc` reports 124 errors across 32 files and all 205 tests still
pass. The extra file is temporary and Phase 2 deletes it.

### This baseline will move in Phase 2, and that is fine

Roughly 38 of the 124 errors are in Jest test files, largely `jest.mocked` typing noise. Phase 2
rewrites those files, so the count will drop and the baseline gets re-cut downward — a normal
ratchet operation. Setting the gate up now rather than waiting is deliberate: it is cheap, it is
independent of the runner, and it covers the 17 extensions that have no tests at all, which is
precisely where the runner migration gives no protection.

**Verification:** `npm run typecheck:ratchet` green at 124; deliberately raise an error locally and
confirm CI fails; 205 tests still passing.

## Phase 2 — Jest → Vitest, and supersede ADR 0001

**Goal:** the test runner matches the source's module format and `nuxt-app`'s runner. The success
criterion is exact: **205 assertions across 15 files, still passing.**

- [ ] Write **ADR 0004**, superseding ADR 0001, recording that the trigger conditions fired (8
      module-format stubs) and that Vitest was the destination ADR 0001 already chose. Mark ADR 0001
      `Superseded by 0004`. AGENTS.md requires an ADR before build/test tooling changes.
      (0003 is taken — it is the [three-tier testing decision](../_ADRs/0003-three-tier-extension-testing.md),
      which *complements* ADR 0001's `util/`-extraction guidance rather than replacing it. Only the
      module-format half of ADR 0001 gets superseded.)
- [ ] Add `vitest.config.ts` modelled on `nuxt-app/vitest.config.ts` (`environment: 'node'`).
- [ ] Migrate 15 files: `@jest/globals` → `vitest`, `jest.fn` → `vi.fn` (57 sites), `jest.mock` →
      `vi.mock` (17 sites), `jest.mocked` → `vi.mocked` (8), `jest.clearAllMocks` (2), `jest.Mock` (1).
- [ ] **Delete the 8 module-format stubs.** Under native ESM, `@directus/extensions-sdk` and
      `shared/errors.ts` import directly and need no stubbing. Keep the stubs that exist for
      behaviour — `postSlackMessage` (5), `email-service`, `settings`, `axios`, `urlSafety` — those
      keep tests offline and are load-bearing.
- [ ] Remove `jest`, `ts-jest`, `jest-environment-node`, `@types/jest`, `@jest/globals`, and
      `ts-node` (only ever needed to load `jest.config.ts`). Delete `jest.config.ts`.
- [ ] Collapse `tsconfig.typecheck.json` into `tsconfig.json` and re-cut `.typecheck-baseline`
      downward to the new count.
- [ ] Confirm `vi.mock` hoisting matches the old `jest.mock` semantics in the five entry-file tests.
      This is the one genuinely non-mechanical part of the migration — the rest is rename work.

**Verification:** 205 assertions passing under Vitest; no `jest` string left in `src/` or
`package.json`; typecheck ratchet green at the lowered baseline; build still green.

## Carve-out — the `sanitize-html` critical, any time

Does not wait for Phase 3. Holding a security patch behind a multi-PR test-writing phase is the wrong
trade, and this one is a patch bump whose consumer is trivially testable.

- [ ] `sanitize-html` 2.17.3 → 2.17.6 — **the only critical**
- [ ] Unit-test `algolia-index/util/sanitizer.ts` in the same PR. Pure string in, string out, two
      exported functions, no mocks needed — Tier 1 in its simplest form.
- [ ] Include an assertion for the advisory's actual vector: content inside `<xmp>` must not pass
      through unescaped. That is the regression test, not just coverage.

Rated critical by CVSS, but low practical exposure here: the allowlist is strict
(`['a','p','ul','li']`, or `[]`) and the input is CMS content from trusted editors, not public
submissions. Exploiting it needs a compromised editor account. Fix it early because it is free, not
because it is on fire.

## Phase 3 — Hook contract tests (Tier 2)

**Goal:** the safety net every phase after this one leans on. See
[the testing strategy](#the-testing-strategy) for what Tier 2 is and why Tier 1 cannot substitute, and
[why the tests come before the upgrades](#why-the-tests-come-before-the-upgrades) for why this sits
here rather than at the end.

**Ordered by what the upgrades are about to touch, not by size.** The LOC column is context, not the
sort key.

| Order | Entry | LOC | Protects which upgrade | Why it matters |
| --- | --- | --- | --- | --- |
| 1 | `algolia-index` | 1333 | `sanitize-html`, `algoliasearch`, `@directus/sdk`, `meow` — **four bumps** | Largest module, zero tests, worst typecheck offender (24). Failures are silent: records just vanish from search |
| 2 | `shared/postSlackMessage` | 26 | `@slack/web-api` 7→8 | Tiny, but it is the failure-notification path the conventions doc requires to work. Currently untestable without a refactor — client built at import time |
| 3 | `buzzsprout` | 813 | `axios` | ADR 0001 names a buzzsprout-class un-awaited promise as the bug that crashed the CMS |
| 4 | `shared/invoice-generator` | — | `pdfkit` 0.16→0.19 | Payments paperwork |
| 5 | `screenshot`, `deploy-website`, `podcast-transcript` | 138 / 108 / 203 | `axios` | The remaining uncovered `axios` consumers |
| 6 | `asset-generation` | 701 | — | Delete-then-recreate; the conventions doc warns about broken references on mid-process failure |
| 7 | `social-media-publish` | 445 | — | Outbound publishing; mistakes are public |
| 8 | `ticket-order-processing`, `ticket-profile-completion`, `ticket-wallet` | 341 / 181 / 121 | — | Payments. 16 typecheck errors between them |
| 9 | `speaker-portal-notifications`, `content-approval`, `conference`, `set-published-on` | 364 / 130 / 88 / 88 | — | |
| 10 | `create-profile`, `process-guard`, `speaker-token`, `publishable` | ≤58 | — | Low value, do last or never |

- [ ] One entry per PR, in that order. Items 1–5 are what Phase 4 and Phase 6 depend on; 6–10 can
      continue in parallel with the upgrade phases.
- [ ] Keep extracting pure logic into `util/` (Tier 1) where it is separable — ADR 0001's guidance
      still holds and those tests stay the cheapest. Tier 2 is for what is left after extraction.
- [ ] For every hook, cover the two lifecycle traps the conventions doc names: does it fire when an
      item is **created** already in the triggering state, and is there a guard against firing twice?
- [ ] Cover the **ADR 0002 contract** where it applies: assert per-item `updateOne` calls rather than
      one `updateMany`. That convention is unenforced by types and a future edit reintroduces the bug.
- [ ] Build one shared fake-context helper rather than 18 hand-rolled ones. The five existing
      entry-file tests each build their own; consolidate as the sixth is written, not before.
- [ ] Lower `.typecheck-baseline` as this incidentally fixes type errors — `algolia-index` alone is 24
      of the 124.

**Verification per PR:** the new tests fail against the bug they describe before they pass. A test
written after the fact that has never been seen red is not evidence.

## Phase 4 — Security fixes and minors, no majors

**Goal:** clear every advisory that does not need a major. Expected result: **19 → 2**, the two
remaining being the build-time `vite` and `js-yaml` highs that Phase 6 addresses.

Items 1–5 of Phase 3 should be done first — they cover `algolia-index` and the `axios` consumers,
which is most of what this phase touches.

- [ ] `axios` 1.16.0 → 1.19.0 — high; the `overrides.axios` entry propagates it tree-wide
- [ ] `npm audit fix` (no `--force`) for the transitive `form-data`, `brace-expansion`, `postcss`,
      `svgo`
- [ ] Routine minors, no behaviour expected: `@directus/errors` 2.3.1 → 2.5.0, `@slack/web-api`
      7.15.2 → 7.19.0, `algoliasearch` 5.52.1 → 5.56.0, `tsx` 4.21.0 → 4.23.7, `typescript-eslint`
      8.59.2 → 8.66.0, `@types/node` 24.12.2 → 24.13.3, `prettier` 3.8.3 → 3.9.6, `eslint`
      9.39.4 → 9.39.5
- [ ] Re-run `prettier:check` after the Prettier bump. A formatter minor can change output; that is
      how 90 files drifted in `nuxt-app`. The Phase 0 gate should catch it — confirm it does.
- [ ] `sanitize-html` will already be done by the carve-out above. If it is not, do it here.

**Verification:** `npm audit` at 2 (both build-time high); tests green including Phase 3's new ones;
build green. The Algolia hand-check the earlier draft of this plan required here is replaced by
Phase 3 item 1 — that was the tell that the ordering was wrong.

## Phase 5 — E2E harness against a real Directus (Tier 3)

**Goal:** prove the wiring Tier 2 fakes, and make `@directus/extensions-sdk` 18 verifiable in Phase 6.
**Roughly five scenarios, not twenty-six** — see
[why Tier 3 stays thin](#tier-3-exists-for-what-tier-2-fakes--so-keep-it-thin).

- [ ] Make the 5 hardcoded outbound base URLs configurable: `GEMINI_API_BASE`, `BSKY_SERVICE`, the
      Slack `WebClient` (`slackApiUrl`, and stop constructing it at module load), the Algolia client
      host, and the wallet Google endpoints. This is
      [required by AGENTS.md's "No Hidden Behavior"](#external-services-in-e2e-redirect-do-not-mock)
      independently of testing — worth its own PR ahead of the harness.
- [ ] One local stub HTTP server, fail-closed: an unrecognised path returns 500 and fails the run, so
      a missed redirect is loud rather than silent.
- [ ] Bootstrap Directus 11.17.4 in CI on SQLite from `schema.json`. Reuse `setup.sh --no-data
      --reset` rather than writing a second bootstrap path.
- [ ] Run with **no secrets in the environment at all** — not fake-but-plausible values. A missed
      redirect must fail on a connection error, never reach production Slack.
- [ ] The five scenarios, each proving something Tier 2 cannot: the bundle **loads** (23 hooks + 2
      endpoints register); a real `ItemsService.updateOne` fires the real action; the `publishable`
      interface renders in the admin UI; one full publish cascade end to end; one hook's Slack failure
      path reaches the stub.
- [ ] **Own workflow, not the PR gate.** Same reasoning as `smoke_tests.yml` in `nuxt-app`: a harness
      with a real server and a real DB will flake, and a flaky required check trains people to ignore
      red. Run it on a schedule and on demand; promote it to required only once it has proven quiet.

**Verification:** deliberately break a hook's event name and confirm the harness catches it. An E2E
suite that has never failed is not known to work.

## Phase 6 — Majors, one PR each

Ordered low to high risk. **One PR per item.** Do not batch.

- [ ] **1. `eslint` 9.39 → 10.8 + `eslint-config-prettier` 9 → 10.** `nuxt-app` already did this
      migration — read
      [its write-up](dependency-upgrade-plan.md#eslint-8571--1080-eslintrcjs--flat-config) first.
      This tree is already on flat config, so it should be the easier half of that work.
- [ ] **2. `typescript` 5.9.3 → 6.0.3.** Match `nuxt-app`, which pins `^6.0.3` with an override.
      **Not 7.0.2** — TypeScript 7 in a tree with a 124-error backlog, before `nuxt-app` has moved,
      is two experiments at once. Expect the ratchet baseline to move; record the delta.
- [ ] **3. Small majors, one PR:** `dotenv` 16 → 17, `meow` 13 → 14 (`algolia-index` CLI only),
      `node-html-parser` 7 → 9 (`fetch-open-graph`, which has 3 test files covering it).
- [ ] **4. `@slack/web-api` 7 → 8.** One import site, but it is the failure-notification path that
      the [Directus conventions](../.claude/rules/directus-conventions.md) require to work. Verify a
      message actually arrives; do not trust a green build.
- [ ] **5. `pdfkit` 0.16 → 0.19 + `@types/pdfkit` 0.13 → 0.17.** Note `extension.config.js`
      deliberately marks `pdfkit` external because it needs `__dirname` at runtime. Re-verify that
      still holds, then generate a real invoice PDF and open it.
- [ ] **6. `@directus/sdk` 21.3.0 → 24.0.0.** MIT, so not licence-gated, but it pairs a Directus
      12-era client with an 11.17.4 server. `nuxt-app` already made this exact move against the same
      server — read
      [how it was verified](dependency-upgrade-plan.md#directussdk-2130--2400) and repeat the checks
      rather than re-litigating the decision. Three import sites here.
- [ ] **7. `@directus/extensions-sdk` 17.1.4 → 18.0.2.** **Highest risk in this plan.** It clears
      the last two highs, and it is the build tool that produces the bundle Directus 11.17.4 loads.
      Requirements before merging: the built `dist/api.js` and `dist/app.js` load into a local
      11.17.4 instance; every hook fires; the `publishable` interface renders in the admin UI. If it
      cannot be verified against a real 11.17.4 server, **do not merge it** — park it until the
      licence question resolves and the server can move. Two build-time advisories do not justify
      shipping an unverifiable CMS change.

**Verification per PR:** 205 tests, build, lint, format, typecheck ratchet, plus the item-specific
manual check named above.

## Phase 7 — Bring the bundle under Renovate

- [ ] Add `directus-cms/extensions/directus-extension-programmierbar-bundle/**` to
      `includePaths` in `.github/renovate.json` — narrowly, **not** `directus-cms/**`, which would
      pull in the blocked `directus` server package.
- [ ] Correct the `description` field, which currently tells readers `directus-cms` is blocked
      wholesale. State the real rule: the `directus` server package is blocked; the MIT `@directus/*`
      packages in the extension bundle are not.
- [ ] Add the same correction to
      [the `nuxt-app` plan's](dependency-upgrade-plan.md) scope note, which is where anyone will read
      the blanket claim first.
- [ ] Add package rules mirroring the `nuxt-app` ones: group `@types/**`, group lint/format tooling,
      hold `@directus/extensions-sdk` majors behind dashboard approval while the server is frozen.
- [ ] Renovate is **still not installed** as a GitHub App — the longest-standing item on the
      `nuxt-app` follow-up list. Everything here is inert configuration until it is.

---

## Deliberately deferred

**Node 24 for this tree.** Directus 11.17.4 declares `engines.node: ">=22"`, so 24 is permitted, and
local development is already on 24.19.0 — the drift argues for moving. But the version lives in
`Dockerfile.directus`, so changing it redeploys the CMS container, which is a production change with
a different risk profile from anything else in this plan. Phase 0 pins `.nvmrc` at **22** to make
CI, image and local agree first. Move all three together afterwards, in its own PR, with the
container smoke-tested.

**A concrete blocker found while doing Phase 0, not just a caution.** Node 24 ships npm 11, which
**gates dependency install scripts** behind explicit approval. Running `npm ci` on npm 11 in these
trees reports install scripts "not yet covered by allowScripts" for `sharp`, `sqlite3`,
`isolated-vm`, `oracledb`, `esbuild`, `fsevents`, `protobufjs` and `vue-demi` — all of which compile
or download native binaries at install time. A Docker image built on Node 24 without handling this
would produce a Directus that cannot start. The move therefore needs an `allowScripts` policy or an
explicit `--allow-scripts-pending` decision as part of the same PR, not just a base-image bump. This
is the same npm 11 behaviour `nuxt-app` hit at
[its Node 24 alignment](dependency-upgrade-plan.md#npm-11-arrives-with-node-24-and-gates-dependency-install-scripts).

**TypeScript 7.** 7.0.2 is out; `nuxt-app` is on 6.0.3. Do this repo-wide when `nuxt-app` moves, not
here first.

**Batch-aware hooks.** [ADR 0002](../_ADRs/0002-batch-updates-use-updateone.md) defers making the
downstream hooks read `metadata.keys` instead of `keys[0]`, leaving "batches use `updateOne` per
item" as a convention types do not enforce. Phase 3's `algolia-index` tests are the natural place to
pin the current behaviour first — but the fix itself stays out of scope.

**The 122 remaining type errors.** Baselined in Phase 1, chipped away in Phase 3. A dedicated
error-clearing phase is not scheduled: the errors cluster in modules that need tests anyway, and
fixing types in code with no test coverage is how you turn a type error into a runtime one.

**`.vue` files are typechecked by nothing.** `tsc` does not read them, so Phase 1's gate will not
cover `publishable/presentation-publishable.vue`. Concretely, its `ref<Boolean | null>` uses the
boxed `Boolean` object type instead of `boolean` and no tool in the repo objects. Covering it needs
`vue-tsc` (which `nuxt-app` already depends on) pointed at this tree. One 76-line file is thin
justification for that on its own — worth folding in if a second SFC ever appears.

---

## Open decisions

Calls made on judgement rather than necessity. Flagged so they can be reversed cheaply before work
starts, not discovered mid-phase:

1. **Vitest over Jest 30.** ADR 0001 pre-selected Vitest and `nuxt-app` is on Vitest 4, so this
   unifies the repo on one runner and deletes 8 workaround stubs. Jest 30 would be a smaller diff but
   keeps the CJS/ESM mismatch and the stubs, and leaves the repo on two runners. Reversible: if the
   Phase 2 migration turns out worse than a rename job, Jest 30 remains a valid fallback.
2. **Typecheck gate (Phase 1) before the runner migration (Phase 2).** Costs one throwaway
   `tsconfig.typecheck.json` and one baseline re-cut. Buys a safety net before the largest source
   change, and covers the 17 extensions where tests give no protection at all. The alternative order
   sets a cleaner baseline once and gets nothing else.
3. **Stay on Node 22 through Phase 6.** Keeps CI honest about what production runs. The cost is that
   local dev stays on 24 — a real but currently harmless drift, and one Phase 0 at least makes
   visible in a file.
4. **Tier 2 before Tier 3, and both before the upgrades.** The measured
   [3-of-16 coverage overlap](#why-the-tests-come-before-the-upgrades) makes "tests before upgrades"
   close to forced. What remains a judgement call is *Tier 2 first*: building Tier 3 first would
   tempt one E2E scenario per hook, which is how a suite becomes a 20-minute flake generator. Tier 2
   first keeps Tier 3 at five scenarios. The cost is that the security minors wait behind items 1–5 of
   Phase 3 — mitigated by the `sanitize-html` carve-out, which is the only item with real urgency.
5. **Tier 3 off the PR gate, at least initially.** A real-server harness will flake, and a flaky
   required check is worse than no check because it teaches people to re-run red. The cost is that
   nothing blocks a merge on E2E, so a wiring break can land and be caught hours later. Revisit once
   the suite has a track record. **Exception:** Phase 6 item 7 (`extensions-sdk` 18) must not merge
   without a green Tier 3 run, gate or no gate.
6. **How far the endpoint refactor goes.** Phase 5 makes 5 hardcoded base URLs configurable because
   Tier 3 needs it. A larger version of that change — injecting HTTP clients rather than
   module-scoped singletons, starting with Slack's import-time `WebClient` — would make Tier 2 tests
   cleaner too and remove the need to mock `postSlackMessage` in five files. Deliberately **not**
   scoped here: it touches every integration at once. Worth revisiting after Phase 3 shows how much
   the wholesale mocking actually hurts.
