# Nuxt App Conventions

## API Access

- Never use raw `fetch` against internal APIs (e.g. Directus) when an SDK or composable exists.
- Wrap all privileged/authenticated API access in a dedicated composable (e.g. `useAuthenticatedDirectus`). Don't spread token handling across individual endpoints.
- Don't reimplement caching — use Nuxt's built-in mechanisms instead.

## Framework First

- Use the framework's configuration system (`nuxt.config.ts`, `config.ts`) for constants like VAT rates, API URLs, etc. Don't hardcode them in business logic.
- Don't reimplement what the framework provides (caching, timestamps, environment handling).

## Schemas & Types

- Schemas belong in a consolidated location (e.g. `server/utils/schema.ts`). Don't create per-feature schema files unless there's a clear structural reason.
- Types go in the established type files (`types/directus.ts`, `types/items.ts`). Avoid new type files for things that fit existing ones.

## Component Design

- Break large UI components into smaller ones along clear domain boundaries. If you can name a sub-concern, it's probably its own component.
- Don't mix unrelated concerns in a single component just because they appear on the same page.