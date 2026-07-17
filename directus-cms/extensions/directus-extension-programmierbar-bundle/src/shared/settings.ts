/**
 * Shared helpers for reading values from the `automation_settings` collection.
 *
 * Kept separate from any one feature (email, Discord, wallet passes, …) so every
 * extension reads runtime configuration through the same, single path.
 */

/**
 * The slice of a Directus hook/endpoint context these helpers need. Any full
 * hook context or `EmailServiceContext` satisfies it structurally.
 */
export interface SettingsContext {
    logger: { warn: (message: string) => void }
    services: {
        ItemsService: any
    }
    getSchema: () => Promise<any>
}

/**
 * Get a setting value from the automation_settings collection. Returns `null`
 * when the key is absent or the read fails (the failure is logged).
 */
export async function getSetting(key: string, context: SettingsContext): Promise<string | null> {
    const { services, getSchema, logger } = context
    const { ItemsService } = services

    try {
        const schema = await getSchema()
        const settingsService = new ItemsService('automation_settings', {
            schema,
            accountability: { admin: true },
        })

        const settings = await settingsService.readByQuery({
            filter: { key: { _eq: key } },
            fields: ['value'],
            limit: 1,
        })

        if (settings && settings.length > 0) {
            return settings[0].value
        }

        return null
    } catch (err: any) {
        logger.warn(`Failed to read setting '${key}': ${err?.message || err}`)
        return null
    }
}

/**
 * Like {@link getSetting}, but throws when the setting is missing or blank.
 *
 * Use this for configuration the extension cannot sensibly default (per
 * AGENTS.md: no fallback values for critical config — fail explicitly rather
 * than silently substituting a value that may be wrong for the environment).
 */
export async function getRequiredSetting(key: string, context: SettingsContext): Promise<string> {
    const value = await getSetting(key, context)
    if (!value || !value.trim()) {
        throw new Error(`Required setting '${key}' is not configured`)
    }
    return value
}

/**
 * Get multiple settings as an object. Keys that are absent (or, on a read
 * failure, all keys) are simply omitted from the result.
 */
export async function getSettings(keys: string[], context: SettingsContext): Promise<Record<string, string>> {
    const { services, getSchema, logger } = context
    const { ItemsService } = services

    const result: Record<string, string> = {}

    try {
        const schema = await getSchema()
        const settingsService = new ItemsService('automation_settings', {
            schema,
            accountability: { admin: true },
        })

        const settings = await settingsService.readByQuery({
            filter: { key: { _in: keys } },
            fields: ['key', 'value'],
        })

        for (const setting of settings) {
            result[setting.key] = setting.value
        }
    } catch (err: any) {
        logger.warn(`Failed to read settings: ${err?.message || err}`)
    }

    return result
}
