import { REGISTRATION_FIELDS, type RegistrationUpdate, type RetentionRepository } from './retention.ts'

const REGISTRATIONS = 'meetup_registrations'
const MEETUPS = 'meetups'
const REVISIONS = 'directus_revisions'

/**
 * Database access for the retention run, on the Directus knex instance.
 *
 * Deliberately not through `ItemsService`:
 * - `first_name`, `last_name` and `email` are required fields, and the anonymised
 *   value is an empty string, which the item validation is not meant to accept;
 * - the collection tracks revisions (`accountability: all`), so every earlier
 *   revision still holds the personal data — they have to be purged as well, which
 *   no service offers, and an update through the service would only add another;
 * - no registration hook (confirmation mail, capacity checks) must run on it.
 */
export function createRetentionRepository(database: any): RetentionRepository {
    return {
        async readMeetupCandidates(cutoff) {
            return await database(MEETUPS)
                .select('id', 'start_on', 'end_on')
                .where('start_on', '<', cutoff)
                .orWhere('end_on', '<', cutoff)
        },

        async readRegistrations(meetupIds, afterId, limit) {
            const query = database(REGISTRATIONS)
                .select(...REGISTRATION_FIELDS)
                .whereIn('meetup', meetupIds)
                .orderBy('id', 'asc')
                .limit(limit)
            if (afterId !== null) query.andWhere('id', '>', afterId)
            return await query
        },

        async anonymise(updates: RegistrationUpdate[]) {
            const ids = updates.map((update) => update.id)
            await database.transaction(async (trx: any) => {
                for (const { id, patch } of updates) {
                    await trx(REGISTRATIONS).where('id', id).update(patch)
                }

                const ownRevisions = () => trx(REVISIONS).where('collection', REGISTRATIONS).whereIn('item', ids)
                // A revision of a nested save can name one of these as its parent.
                await trx(REVISIONS).whereIn('parent', ownRevisions().select('id')).update({ parent: null })
                await ownRevisions().delete()
            })
        },
    }
}
