import { createError } from '@directus/errors'

/**
 * @param status HTTP status the API answers with (Directus' default is 500).
 *   Callers that map the error code to a user-facing answer can set e.g. 409.
 */
export function createHookErrorConstructor(hook: string, message: string, status?: number) {
    return createError(hook, message, status)
}
