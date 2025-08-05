import { getFullPodcastTitle, getFullSpeakerName, getUrlSlug } from './../../../../../../shared-code/index.ts'

/**
 * It creates the URL slug for speakers, podcasts
 * and meetups and retuns it with the payload.
 *
 * @param futureItem The future item.
 * @param data The filter data.
 *
 * @returns The payload including the slug.
 */
export async function getPayloadWithSlug(
    futureItem: any,
    { payload, metadata }: { payload: any; metadata: Record<string, any>}
) {

    // If collection name is "speakers" and "academic_title", "first_name" and
    // "last_name" is set, log info and return payload with speaker slug
    if (metadata.collection === 'speakers' && futureItem.first_name && futureItem.last_name) {
        return {
            ...payload,
            slug: getUrlSlug(getFullSpeakerName(futureItem)),
        }
    }

    // If collection name is "podcasts" and "type", "number" and "title"
    // is set, log info and return payload with podcast slug
    if (metadata.collection === 'podcasts' && futureItem.type && futureItem.number && futureItem.title) {
        return {
            ...payload,
            slug: getUrlSlug(getFullPodcastTitle(futureItem)),
        }
    }

    // If collection name is "podcasts" and "title" is set,
    // log info and return payload with meetup slug
    if (metadata.collection === 'meetups' && futureItem.title) {
        return {
            ...payload,
            slug: getUrlSlug(futureItem.title),
        }
    }

    // If collection name is "conferences" and "title" is set,
    // log info and return payload with meetup slug
    if (metadata.collection === 'conferences' && futureItem.title) {
        return {
            ...payload,
            slug: getUrlSlug(futureItem.title),
        }
    }

    // If collection name is "profiles" and "first_name" and "last_name" are set,
    // log info and return payload with profile slug
    if (metadata.collection === 'profiles' && futureItem.first_name && futureItem.last_name) {
        if (futureItem.update_slug === false) {
            return payload;
        }

        const result = {
            ...payload
        }

        // Set suffix if empty or null
        if (!futureItem.slug_suffix || futureItem.slug_suffix.trim() == '') {
            result.slug_suffix = await getUniqueIdentifier()
        }

        let suffix = '';
        if (futureItem.slug_suffix) {
            suffix = futureItem.slug_suffix;
        } else {
            suffix = result.slug_suffix;
        }
        result.slug = getUrlSlug(`${futureItem.first_name}-${futureItem.last_name}-${suffix}`);

        return result;
    }

    // Otherwise just return payload
    return payload
}

// We use this approach to generate a unique part for the slug that remains stable over the lifetime of an item
async function getUniqueIdentifier(input?: string): Promise<string> {

    if (!input) {
        input = crypto.randomUUID();
    }

    // Convert the string to an ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    // Generate the SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert the hash to a hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Get the first 4 characters of the hex string
    return hashHex.slice(0, 4);
}
