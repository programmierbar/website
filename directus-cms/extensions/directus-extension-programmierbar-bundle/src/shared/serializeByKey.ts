type Task<T> = () => T | Promise<T>

/**
 * Creates a function that runs tasks one after another per key, while tasks
 * for different keys still run concurrently.
 *
 * Directus fires actions without awaiting them, so two quick updates of the
 * same item start their handlers in parallel. Handlers that read state, call
 * an external API and only then write the result back (e.g. "create the
 * Buzzsprout episode if no `buzzsprout_id` is set yet") would otherwise both
 * see the old state and perform the side effect twice.
 *
 * Each task starts once the previous task for the same key has settled. A
 * rejection of the previous task does not affect the next one; the caller
 * still receives the rejection of its own task. Tasks without a key are run
 * immediately.
 */
export function createKeyedSerializer() {
    const tails = new Map<string | number, Promise<unknown>>()

    return function serialize<T>(key: string | number | null | undefined, task: Task<T>): Promise<T> {
        if (key === null || key === undefined) {
            return Promise.resolve().then(task)
        }

        const previous = tails.get(key) ?? Promise.resolve()
        const current = previous.catch(() => undefined).then(task)
        tails.set(key, current)

        const cleanUp = () => {
            if (tails.get(key) === current) {
                tails.delete(key)
            }
        }
        current.then(cleanUp, cleanUp)

        return current
    }
}
