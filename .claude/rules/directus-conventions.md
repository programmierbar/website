# Directus Extension Conventions

## Hook Lifecycle Awareness

- Always consider both creation and update paths. Will a hook trigger correctly if an entity is created in an already-valid state? Will it fire on every update instead of just once?
- If a hook sends notifications or triggers side effects, ensure there's a status field or guard that prevents repeated execution.
- If a hook only listens for updates, document (or handle) the case where an item is created in a state that would normally trigger the hook.

## Failure Notifications

- If an automated process fails and requires human intervention (content generation, member matching, asset generation), send a Slack notification. Logs alone are not sufficient — they're only visible in the hosting dashboard.

## Resource Lifecycle

- When deleting and recreating resources (e.g. regenerating assets), account for existing references. If regeneration fails mid-process, the system must not leave broken references.
- Prefer updating in place over delete-then-recreate when resources are referenced elsewhere.

## LLM & Template Handling

- Extract LLM API calls (Gemini, etc.) into a shared utility. Individual extensions should not manage API keys or base URLs themselves.
- Don't embed fallback prompts in business logic. Prompts should be managed externally and fail explicitly if missing.
- Template logic should be consolidated similarly — don't duplicate rendering/handling across extensions.

## Shared Helpers

- Extract repeated patterns (e.g. `getSetting` calls with fallback URLs) into shared utilities.
- Let Directus handle what it can natively (e.g. timestamps via `date_created` / `date_updated` fields) instead of setting them manually.