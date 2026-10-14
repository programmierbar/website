import { createError } from '@directus/errors'

/**
 * A Directus error class for a hook. `status` defaults to Directus' 500; pass 400 for
 * validation errors the editor should read in the Data Studio.
 */
export function createHookErrorConstructor(hook: string, message: string, status?: number) {
    return status === undefined ? createError(hook, message) : createError(hook, message, status)
}
