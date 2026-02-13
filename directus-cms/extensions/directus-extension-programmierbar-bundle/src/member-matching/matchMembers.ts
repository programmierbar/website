import type { Logger } from 'pino'
import { postSlackMessage } from '../shared/postSlackMessage.js'

interface HookServices {
    logger: Logger
    ItemsService: any
    getSchema: () => Promise<any>
    eventContext: any
}

export interface MemberData {
    id: string
    first_name: string
    last_name: string
}

/**
 * Extract speaker names from transcript text.
 * Handles formats like:
 * - "Dennis: Hello everyone..."
 * - "Dennis Becker: Hello everyone..."
 * - "**Dennis**: Hello..."
 * - "Jan Gregor Emge-Triebel (00:12.534)" (timestamp format)
 */
export function extractSpeakerNames(transcriptText: string): string[] {
    const speakerSet = new Set<string>()

    // Pattern 1: Name followed by timestamp in parentheses
    // Examples: "Jan Gregor Emge-Triebel (00:12.534)", "Fabi Fink (00:35.735)"
    // Use [ \t]+ instead of \s+ to avoid matching across newlines
    const timestampPattern = /^([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\-]+(?:[ \t]+[A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\-]+)*)[ \t]+\(\d{2}:\d{2}\.\d+\)/gm

    let match
    while ((match = timestampPattern.exec(transcriptText)) !== null) {
        const name = match[1].trim()
        if (name.length >= 2) {
            speakerSet.add(name)
        }
    }

    // Pattern 2: Name followed by colon (fallback for other transcript formats)
    // Examples: "Dennis:", "Dennis Becker:", "**Jojo**:"
    const colonPattern = /^(?:\*\*)?([A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\-]+(?:\s+[A-ZÄÖÜa-zäöüß][A-ZÄÖÜa-zäöüß\-]+)?)(?:\*\*)?:/gm

    while ((match = colonPattern.exec(transcriptText)) !== null) {
        const name = match[1].trim()
        if (name.length >= 2) {
            speakerSet.add(name)
        }
    }

    return Array.from(speakerSet)
}

/**
 * Normalize a string for fuzzy matching.
 * Removes accents, lowercases, normalizes hyphens/spaces, and trims.
 */
function normalize(str: string): string {
    if (!str) return ''
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/ä/g, 'a')
        .replace(/ö/g, 'o')
        .replace(/ü/g, 'u')
        .replace(/ß/g, 'ss')
        .replace(/[-\s]+/g, ' ') // Normalize hyphens and multiple spaces to single space
        .trim()
}

/**
 * Check if a speaker name matches a member.
 * Matches against first name, last name, or full name.
 */
function matchesMember(speakerName: string, member: MemberData): boolean {
    const normalizedSpeaker = normalize(speakerName)
    const normalizedFirst = normalize(member.first_name)
    const normalizedLast = normalize(member.last_name)
    const normalizedFull = `${normalizedFirst} ${normalizedLast}`

    // Exact match on first name, last name, or full name
    if (normalizedSpeaker === normalizedFirst) return true
    if (normalizedSpeaker === normalizedLast) return true
    if (normalizedSpeaker === normalizedFull) return true

    // Speaker name contains first name (for nicknames like "Jojo" matching "Johannes")
    // Be careful: only match if the first name is reasonably unique (3+ chars)
    if (normalizedFirst.length >= 3 && normalizedSpeaker.startsWith(normalizedFirst)) return true

    return false
}

/**
 * Find members that match speaker names from the transcript.
 */
export function findMatchingMembers(speakerNames: string[], members: MemberData[]): MemberData[] {
    const matchedMembers: MemberData[] = []
    const matchedIds = new Set<string>()

    for (const speakerName of speakerNames) {
        for (const member of members) {
            if (!matchedIds.has(member.id) && matchesMember(speakerName, member)) {
                matchedMembers.push(member)
                matchedIds.add(member.id)
                break // One speaker name matches one member
            }
        }
    }

    return matchedMembers
}

export async function matchMembersFromTranscript(
    hookName: string,
    podcastId: number,
    transcriptText: string,
    services: HookServices
): Promise<void> {
    const { logger, ItemsService, getSchema, eventContext } = services

    try {
        const schema = await getSchema()

        const podcastsService = new ItemsService('podcasts', {
            schema,
            accountability: eventContext.accountability,
        })

        const membersService = new ItemsService('members', {
            schema,
            accountability: eventContext.accountability,
        })

        // Fetch non-archived members only
        const allMembers: MemberData[] = await membersService.readByQuery({
            fields: ['id', 'first_name', 'last_name'],
            filter: { status: { _neq: 'archived' } },
            limit: -1,
        })

        logger.info(`${hookName}: Found ${allMembers.length} members in database`)
        logger.info(`${hookName}: Members: ${allMembers.map((m) => `${m.first_name} ${m.last_name}`).join(', ')}`)

        // Extract speaker names from transcript
        const speakerNames = extractSpeakerNames(transcriptText)
        logger.info(`${hookName}: Extracted speaker names from transcript: [${speakerNames.join(', ')}]`)
        logger.info(`${hookName}: First 500 chars of transcript: ${transcriptText.substring(0, 500)}`)

        if (speakerNames.length === 0) {
            logger.warn(`${hookName}: No speaker names found in transcript for podcast ${podcastId}`)
            try {
                await postSlackMessage(
                    `:warning: *${hookName} hook*: Keine Sprecher im Transkript von Podcast ${podcastId} erkannt. Bitte Members manuell zuweisen: https://admin.programmier.bar/admin/content/podcasts/${podcastId}`
                )
            } catch (slackError: any) {
                logger.error(`${hookName}: Could not post to Slack: ${slackError.message}`)
            }
            return
        }

        // Match speakers to members
        const matchedMembers = findMatchingMembers(speakerNames, allMembers)
        logger.info(
            `${hookName}: Matched ${matchedMembers.length} members: ${matchedMembers.map((m) => `${m.first_name} ${m.last_name}`).join(', ')}`
        )

        if (matchedMembers.length === 0) {
            logger.warn(`${hookName}: No members matched for podcast ${podcastId} (speakers: [${speakerNames.join(', ')}])`)
            try {
                await postSlackMessage(
                    `:warning: *${hookName} hook*: Keine Members für Podcast ${podcastId} zugeordnet (Sprecher: ${speakerNames.join(', ')}). Bitte manuell zuweisen: https://admin.programmier.bar/admin/content/podcasts/${podcastId}`
                )
            } catch (slackError: any) {
                logger.error(`${hookName}: Could not post to Slack: ${slackError.message}`)
            }
            return
        }

        // Check current members to avoid overwriting manual selections
        const currentPodcast = await podcastsService.readOne(podcastId, {
            fields: ['members.member'],
        })

        if (currentPodcast.members && currentPodcast.members.length > 0) {
            logger.info(`${hookName}: Podcast already has ${currentPodcast.members.length} members assigned, skipping auto-assignment`)
            return
        }

        // Update podcast with matched members (M2M relation)
        // Format: array of objects with member ID and sort order
        const membersPayload = matchedMembers.map((member, index) => ({
            member: member.id,
            sort: index + 1,
        }))

        await podcastsService.updateOne(podcastId, {
            members: membersPayload,
        })

        logger.info(`${hookName}: Successfully assigned ${matchedMembers.length} members to podcast ${podcastId}`)
    } catch (err: any) {
        logger.error(`${hookName}: Member matching error for podcast ${podcastId}: ${err?.message || err}`)
        if (err?.stack) {
            logger.error(`${hookName}: Stack trace: ${err.stack}`)
        }
        try {
            await postSlackMessage(
                `:warning: *${hookName} hook*: Member-Matching für Podcast ${podcastId} fehlgeschlagen. Error: ${err?.message || err}`
            )
        } catch (slackError: any) {
            logger.error(`${hookName}: Could not post to Slack: ${slackError.message}`)
        }
        // Don't throw - member matching failure shouldn't block other operations
    }
}
