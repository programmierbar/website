# ADR 0002: Publish/process batches with `updateOne` per item, not `updateMany`

- **Status:** Accepted
- **Date:** 2026-06-23
- **Scope:** `directus-cms/extensions/directus-extension-programmierbar-bundle` (Directus action hooks)

## Context

Directus action hooks receive different metadata depending on how an item was
written:

- `ItemsService.updateOne(key, data)` fires one `<collection>.items.update`
  action carrying a single `metadata.key`.
- `ItemsService.updateMany(keys, data)` fires a **single** action carrying
  `metadata.keys` (an array) for the whole batch.

Our downstream hooks are **not batch-aware**. They read only the first key:

```js
// src/algolia-index/index.ts
// "Directus passes `key` for single-item operations and `keys[]` for batch operations."
const itemKey = metadata.key || (metadata.keys && metadata.keys[0])
```

The same `metadata.key || metadata.keys[0]` pattern appears in the Algolia
update, delete, and talk-change paths, and other hooks listening on the same
collections (`screenshot`, `asset-generation`, `buzzsprout`, …) follow suit.

Consequence: if a hook publishes several items in one collection via
`updateMany`, the downstream hooks process **only the first** item. The rest are
written correctly in the database but silently never get reindexed in Algolia,
never get screenshots/assets generated, etc. — a drift that is hard to notice
because nothing errors.

This surfaced in the `cascade-publish` hook (PR #164), which publishes the draft
speakers / picks / talks of a podcast or meetup. A batched `updateMany` left all
but the first cascaded child missing or stale in search.

## Decision

**When a hook changes multiple items and the change must trigger downstream
action hooks, publish/process them one at a time with `updateOne` in a loop —
not `updateMany`.** Each item then fires its own action with a single
`metadata.key`, so every downstream hook handles every item.

`cascade-publish` follows this: `cascadePublishRelation` loops over the
publishable ids and calls `targetService.updateOne(id, { status: 'published' })`.

This does **not** apply to bulk writes whose side effects we explicitly do not
want fanned out per item (there are none in this hook today). If such a case
arises, document it at the call site.

## Consequences

**Positive**
- Every cascaded item is correctly reindexed and post-processed by the existing
  hooks — no silent search/asset drift.
- No change required to the downstream hooks to ship the fix.

**Negative / costs**
- More service calls and more fired actions per cascade (N instead of 1). At our
  data volumes (a handful of speakers/picks/talks per parent) this is negligible,
  but it is O(N) action fan-out rather than O(1).
- The constraint is a convention, not enforced by types — a future
  `updateMany` reintroduces the bug. Tests assert per-item `updateOne` calls to
  guard against regression in `cascade-publish`.

## Future direction (deferred — explicitly not now)

The cleaner long-term fix is to make the downstream hooks **batch-aware**: have
the shared action handlers iterate `metadata.keys` (falling back to
`metadata.key`) instead of taking `keys[0]`. That would let any hook use
`updateMany` safely and remove this convention.

That is a larger, cross-cutting change touching `algolia-index`, `screenshot`,
`asset-generation`, `buzzsprout`, and any other collection listeners, each with
its own tests. We are **not** doing it as part of PR #164. Until then, the rule
above stands: **batches use `updateOne` per item.**
