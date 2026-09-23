# ADR 0003: Three-tier testing for the Directus extension bundle

- **Status:** Accepted
- **Date:** 2026-08-05
- **Scope:** `directus-cms/extensions/directus-extension-programmierbar-bundle`
- **Relationship to other ADRs:** **complements** [ADR 0001](0001-jest-runs-in-cjs-mode.md) — its
  `util/`-extraction guidance is Tier 1 here and still stands. Supersedes nothing. Gives
  [ADR 0002](0002-batch-updates-use-updateone.md)'s unenforced convention a place to be enforced.

## Context

At the time of writing, 9 of the bundle's 26 entries have any test, and the ones that do follow a
single pattern: extract business logic into a `util/` module with no framework imports, unit-test
that. `post-to-discord` is the model — it tests `buildNewsEmbed` for URL construction, brand colour
and slug fallback, and touches neither the hook registration nor the HTTP call.

That pattern is good and cheap, and it has a structural blind spot: **it cannot see the hook's
contract with Directus.** Every bug this bundle is known to have shipped lives in exactly that blind
spot:

- **ADR 0002's bug.** `ItemsService.updateMany` fires a *single* action carrying `metadata.keys[]`.
  Downstream hooks read `metadata.key || metadata.keys[0]`, so a cascade of five items reindexed only
  the first. The other four were written to the database correctly and silently never reached Algolia.
  Nothing threw.
- **The buzzsprout-class crash** referenced in ADR 0001: an un-awaited promise in a hook handler
  taking down the CMS. The `no-floating-promises` lint rule now catches that specific shape, but not
  the general class.
- The two lifecycle traps in [the conventions doc](../.claude/rules/directus-conventions.md): whether
  a hook fires when an item is *created* already in the triggering state, and whether a guard prevents
  it firing twice.

None of these are reachable from a pure function. So the gap is not "17 entries are untested" — it is
that **nothing tests the hook-to-Directus contract, including for the 9 entries that are tested.**

A real-Directus E2E suite is the obvious answer and the wrong first answer: it is slow, it flakes, and
writing one scenario per hook would put a multi-minute, network-shaped suite on the PR gate.

## Decision

Three tiers, with explicit ownership of what each is for.

### Tier 1 — unit tests on extracted pure functions

Unchanged from ADR 0001. Logic moves into `util/`, gets tested without mocks. Cheapest tests in the
tree; keep writing them, and keep extracting to make them possible.

**Owns:** decisions, payload shapes, formatting, parsing, validation.

### Tier 2 — hook contract tests

Run the **real hook module** against a **fake Directus context**. Import the hook's default export,
pass a hand-built `{ services: { ItemsService }, getSchema, env, logger }`, capture the registered
`action`/`filter` callbacks and invoke them directly. No Directus process, no network, milliseconds.

**Owns:** that the hook registers for the right events; that the create path and the update path both
behave; that guards prevent double execution; that the **ADR 0002 contract** holds — assert per-item
`updateOne` calls rather than one `updateMany`; that failures reach the notification path.

This is not a new invention. Five test files already do it — `cascade-publish`, `create-news`,
`fetch-open-graph`, `newsletter-double-opt-in`, `schedule-publication`. The decision is to make it the
**default for every entry**, and to consolidate the per-file fake contexts into one shared helper as
the sixth is written.

### Tier 3 — E2E against a real Directus, deliberately thin

The **built bundle** loaded into a **real Directus 11.17.4**. Roughly five scenarios, not
twenty-six.

**Owns only what Tier 2 fakes:** that the bundle *loads at all* (23 hooks + 2 endpoints register);
that a real `ItemsService` write fires a real action; that the `publishable` interface renders in the
admin UI. It is also the only thing that can validate `@directus/extensions-sdk` 18 against the
frozen host, which is why it must exist before that upgrade.

**Not on the PR gate.** Same reasoning as `nuxt-app`'s `smoke_tests.yml`: a harness with a real server
and a real database will flake, and a flaky *required* check trains people to ignore red. Schedule it,
run it on demand, and promote it only once it has proven quiet.

## External services in Tier 3: redirect, do not mock

In Tier 3 the hook runs inside a separate Directus process, so module mocking is unavailable — there
is no `vi.mock` across a process boundary. The only lever is **configuration**: point every outbound
base URL at one local stub server.

Audited 2026-08-05, all 11 outbound integrations:

| Already redirectable via env | Hardcoded — needs a code change |
| --- | --- |
| Buzzsprout (`BUZZSPROUT_API_URL`) | Gemini — `GEMINI_API_BASE` module const |
| Browserless (`BROWSERLESS_API_URL`) | Bluesky — `BSKY_SERVICE = 'https://bsky.social'` |
| Deepgram (`DEEPGRAM_API_URL`) | Slack — `new WebClient(token)` at module load |
| Discord (`DISCORD_WEBHOOK_URL`) | Algolia — host derived from `ALGOLIA_APP_ID` |
| Vercel (`VERCEL_DEPLOY_WEBHOOK_URL`) | Wallet — `walletobjects.`/`oauth2.googleapis.com` |
| Mastodon (`MASTODON_INSTANCE_URL`) | |

Six already work. The remaining five must become configurable — which
[AGENTS.md](../AGENTS.md) already requires under "No Hidden Behavior" (*"No hardcoded defaults buried
in business logic … If it affects behavior, it must be visible and configurable"*), so that refactor
is justified independently of testing.

Two rules for the harness:

1. **Fail closed.** The stub returns 500 for any unrecognised path and fails the run, so a missed
   redirect is loud.
2. **No secrets in the environment at all** — not fake-but-plausible values. A missed redirect must
   die on a connection error, never reach the production Slack workspace.

**Explicitly excluded:** hitting real third-party APIs, including sandboxes. That imports their uptime
into CI. Contract drift at Buzzsprout is a scheduled canary against staging, not a PR gate.

## Consequences

**Positive**

- The bug classes that have actually cost us are testable, in the fast suite, without infrastructure.
- ADR 0002's convention stops being unenforceable — a future `updateMany` fails a test.
- Tier 3 stays small enough to be maintainable, because Tier 2 covers the per-hook logic.
- The endpoint refactor Tier 3 forces is something the conventions already demanded.

**Negative / costs**

- Tier 2 tests are coupled to the *shape* of the Directus hook context. If a Directus upgrade changes
  that shape, the fakes drift from reality and can pass while production breaks. **This is the main
  risk, and it is what Tier 3 is insurance against** — the two tiers must not both be faked.
- One shared fake-context helper becomes a load-bearing test utility. Under-building it means 18
  divergent copies; over-building it means a mini-framework. Consolidate at the sixth use, not the
  first.
- Tier 3 adds ~2 minutes of CI and a stub server to maintain.
- Tier 3 only proves behaviour against 11.17.4. Correct while the server is frozen; revisit when the
  licence question resolves.

## Ordering

Tiers 2 and 3 both come **before** the dependency upgrades, which is a change from the first draft of
[the tooling plan](../docs/directus-extension-tooling-plan.md). The reason is measured, not
stylistic: of the 16 files the planned bumps touch, **3 have a test covering them**, and
`algolia-index` — largest module in the bundle, zero tests — is hit by four separate bumps
(`sanitize-html`, `algoliasearch`, `@directus/sdk`, `meow`).

The one exception is the `sanitize-html` critical, which ships as a carve-out with unit tests for its
consumer in the same PR. Holding a security patch behind a multi-PR test phase is the wrong trade.
