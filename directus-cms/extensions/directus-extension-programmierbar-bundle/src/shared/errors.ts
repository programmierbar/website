import { createError } from '@directus/errors'

export function createHookErrorConstructor(hook: string, message: string) {
    return createError(hook, message)
}
