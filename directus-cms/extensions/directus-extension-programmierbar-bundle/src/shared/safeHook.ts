type ActionHandler = (meta: any, ctx: any) => unknown | Promise<unknown>

/**
 * Wraps a Directus action handler so that no error it produces — a synchronous
 * throw or a rejected promise it returns — can ever escape to the Node process
 * and crash the CMS. Errors are caught and logged instead.
 *
 * `Promise.resolve().then(() => handler(...))` captures both synchronous throws
 * and rejected promises returned by the handler in a single `.catch`. For this
 * to observe a handler's async work, the handler must RETURN its promise.
 *
 * Handlers that intentionally detach their own fire-and-forget promise still
 * need a local `.catch` on that promise (the wrapper cannot see a detached one).
 *
 * @param hookName The hook name, used for log context.
 * @param logger The hook's logger instance.
 * @param handler The action handler to protect.
 */
export function safeAction(hookName: string, logger: any, handler: ActionHandler) {
    return (meta: any, ctx: any): void => {
        Promise.resolve()
            .then(() => handler(meta, ctx))
            .catch((error: any) => {
                logger.error(`${hookName} hook: error in action handler: ${error?.message ?? error}`)
                if (error?.stack) {
                    logger.error(error.stack)
                }
            })
    }
}
