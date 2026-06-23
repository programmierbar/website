# ADR 0001: Jest runs in CommonJS mode; ESM test migration deferred

- **Status:** Accepted
- **Date:** 2026-06-23
- **Scope:** `directus-cms/extensions/directus-extension-programmierbar-bundle` (Jest test suite)

## Context

Our extension source is written as **ES Modules** (ESM — `import`/`export`, `.ts` files with explicit extensions). The Jest setup, however, effectively runs tests in **CommonJS (CJS)** mode:

- `tsconfig.json` does not set a `module` value compatible with Jest's ESM mode. Although `jest.config.ts` uses the `ts-jest/presets/js-with-ts-esm` preset and lists `extensionsToTreatAsEsm: ['.ts']`, ts-jest transpiles each file down to CommonJS at runtime.
- Confirmed empirically: running with `NODE_OPTIONS=--experimental-vm-modules` produces `ts-jest[ts-compiler] (ERROR) The current compiler option "module" value is not suitable for Jest ESM mode`.

This has two practical consequences for writing tests:

1. **ESM-only test features don't work.** `jest.unstable_mockModule(...)` and top-level `await` (the idiomatic way to mock a module and then dynamically import the code under test in ESM) fail to parse, because the file is executed as CommonJS.
2. **ESM-only dependencies can't be imported directly in a test.** Files inside `node_modules` are not transpiled by Jest. Importing a module that itself imports an ESM-only package (e.g. `@directus/extensions-sdk`, which re-exports from `@directus/composables` / `@directus/extensions` using `export` syntax) throws `SyntaxError: Unexpected token 'export'`.

This surfaced while adding tests for the `cascade-publish` hook, whose entry file imports `defineHook` from `@directus/extensions-sdk`.

## Decision

For now we **keep the suite in CJS mode** and use the CJS-compatible testing patterns rather than reconfiguring the toolchain:

- **Prefer testing extracted pure functions.** The established convention (see `set-slug/util/getPayloadWithSlug.ts`, `member-matching/matchMembers.ts`) is to extract business logic into a `util/` module with no framework imports, and unit-test that. These tests need no mocking and are unaffected by the module-mode issue. `cascade-publish/util/cascadePublish.ts` follows this pattern.
- **When a hook's entry file must be tested directly**, use **hoisted `jest.mock(...)`** (ts-jest hoists these above imports, so static `import` of the code under test still works) and **stub any ESM-only framework dependency**. For `@directus/extensions-sdk` the stub is one line — `defineHook` just returns its callback, which matches the real implementation — so the test exercises the real hook logic without loading the untranspiled package:

  ```ts
  jest.mock('@directus/extensions-sdk', () => ({
      defineHook: (callback: unknown) => callback,
  }))
  ```

  See `cascade-publish/__tests__/index.test.ts` for the full pattern (it also mocks `postSlackMessage` to keep tests offline).

## Consequences

**Positive**
- No toolchain change required; existing tests keep passing.
- Pure-function tests stay simple and mock-free.
- Stubbing a framework export is small and explicit, with the real behavior documented inline.

**Negative / costs**
- Each new ESM-only dependency pulled into a tested code path adds another stub. This is the main signal to watch: when stubs start to accumulate, the workaround stops paying for itself.
- We can't use `unstable_mockModule` / top-level `await`, so some module-mocking scenarios are harder to express.
- Tests run in a slightly different module mode than production, so they don't perfectly mirror runtime module resolution.

## Future direction (deferred)

Migrating the test suite to true ESM is the right long-term direction — the source is already ESM, the ecosystem is trending ESM-only (the Directus SDK already is), and it would remove the stubbing workarounds and unlock the modern mocking APIs.

It is **not urgent.** Treat it as known tech debt. Trigger points to act on it:

- The number of ESM-stub workarounds grows beyond a couple of files, **or**
- We need a test feature that CJS mode blocks.

When that happens, evaluate two options as a small spike before committing:

1. **Jest in ESM mode** — set a `module` value in `tsconfig.json` (or a test-specific tsconfig) compatible with Jest's ESM mode and run with `node --experimental-vm-modules`. Lower churn, but Jest's ESM support is still officially experimental and mocking becomes more verbose.
2. **Switch to [Vitest](https://vitest.dev/)** — ESM-native, far less configuration, native TS/ESM mocking. Larger one-time migration, but likely the lower-friction destination.

Either path is a project-wide change affecting all existing test files and should be done deliberately, not incidentally.
