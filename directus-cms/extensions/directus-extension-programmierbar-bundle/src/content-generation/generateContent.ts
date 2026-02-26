import type { Logger } from 'pino'
import { callGemini, extractJson } from '../shared/gemini.ts'
import { renderTemplate } from '../shared/templateRenderer.ts'

interface HookServices {
    logger: Logger
    ItemsService: any
    getSchema: () => Promise<any>
    env: Record<string, string>
    eventContext: any
}

interface PodcastData {
    id: number
    title: string
    slug: string
    type: string
    number?: string
    transcript_text?: string
    speakers?: Array<{ speaker: { first_name: string; last_name: string; occupation?: string; description?: string } }>
    members?: Array<{ member: { first_name: string; last_name: string } }>
}

async function fetchPrompts(
    promptsService: any,
    keys: string[],
    logger: Logger,
    hookName: string
): Promise<Map<string, string>> {
    const prompts = new Map<string, string>()

    const results = await promptsService.readByQuery({
        filter: { key: { _in: keys } },
        fields: ['key', 'prompt_text'],
    })

    for (const prompt of results) {
        prompts.set(prompt.key, prompt.prompt_text)
    }

    // Verify all required prompts are present
    const missing = keys.filter((key) => !prompts.has(key))
    if (missing.length > 0) {
        throw new Error(
            `${hookName}: Required AI prompts missing from CMS: ${missing.join(', ')}. ` +
                `Please add them to the ai_prompts collection.`
        )
    }

    return prompts
}

function buildShownotesPrompt(podcast: PodcastData, prompts: Map<string, string>): string {
    const episodeType = podcast.type || 'other'

    const hosts =
        podcast.members
            ?.map((m) => `${m.member?.first_name} ${m.member?.last_name}`.trim())
            .filter(Boolean)
            .join(', ') || 'programmier.bar Team'

    const guests =
        podcast.speakers
            ?.map((s) => `${s.speaker?.first_name} ${s.speaker?.last_name}`)
            .filter(Boolean)
            .join(', ') || ''

    const guestInfo =
        podcast.speakers
            ?.map((s) => {
                const speaker = s.speaker
                if (!speaker) return ''
                return `${speaker.first_name} ${speaker.last_name}${speaker.occupation ? ` - ${speaker.occupation}` : ''}${speaker.description ? `: ${speaker.description}` : ''}`
            })
            .filter(Boolean)
            .join('\n') || ''

    const template = prompts.get('shownotes')!

    return renderTemplate(template, {
        episode_type: episodeType,
        title: podcast.title,
        number: podcast.number || 'N/A',
        hosts,
        guests: guests || 'Keine Gäste',
        guest_info: guestInfo,
        transcript: podcast.transcript_text || 'Kein Transkript verfügbar',
    })
}

function buildSocialPrompt(
    platform: 'linkedin' | 'instagram' | 'bluesky' | 'mastodon',
    podcast: PodcastData,
    shownotes: { description: string; topics: string[] },
    prompts: Map<string, string>
): string {
    const guests =
        podcast.speakers
            ?.map((s) => `${s.speaker?.first_name} ${s.speaker?.last_name}`)
            .filter(Boolean)
            .join(', ') || ''

    const guestCompanies =
        podcast.speakers
            ?.map((s) => s.speaker?.occupation?.split(' at ')[1] || s.speaker?.occupation)
            .filter(Boolean)
            .join(', ') || ''

    const topicsText = shownotes.topics.map((t) => `- ${t}`).join('\n')
    const shownotesDescription = shownotes.description || ''

    const template = prompts.get(`social_${platform}`)!

    return renderTemplate(template, {
        title: podcast.title,
        episode_type: podcast.type || 'other',
        slug: podcast.slug || '',
        guests: guests || 'Keine Gäste',
        guest_companies: guestCompanies || 'N/A',
        topics: topicsText,
        shownotes: shownotesDescription,
    })
}

export async function generateContent(hookName: string, podcastId: number, services: HookServices): Promise<void> {
    const { logger, ItemsService, getSchema, env, eventContext } = services
    const geminiApiKey = env.GEMINI_API_KEY

    try {
        const schema = await getSchema()

        // Create services
        const podcastsService = new ItemsService('podcasts', {
            schema,
            accountability: eventContext.accountability,
        })

        const generatedContentService = new ItemsService('podcast_generated_content', {
            schema,
            accountability: eventContext.accountability,
        })

        const promptsService = new ItemsService('ai_prompts', {
            schema,
            accountability: eventContext.accountability,
        })

        // Fetch AI prompts from CMS (no fallbacks - prompts must exist)
        const promptKeys = ['shownotes', 'social_linkedin', 'social_instagram', 'social_bluesky', 'social_mastodon']
        const prompts = await fetchPrompts(promptsService, promptKeys, logger, hookName)
        logger.info(`${hookName}: Loaded ${prompts.size} AI prompts from CMS`)

        // Fetch podcast with related data
        const podcast: PodcastData = await podcastsService.readOne(podcastId, {
            fields: [
                'id',
                'title',
                'slug',
                'type',
                'number',
                'transcript_text',
                'speakers.speaker.first_name',
                'speakers.speaker.last_name',
                'speakers.speaker.occupation',
                'speakers.speaker.description',
                'members.member.first_name',
                'members.member.last_name',
            ],
        })

        if (!podcast.transcript_text) {
            logger.warn(`${hookName}: Podcast ${podcastId} has no transcript, skipping content generation`)
            return
        }

        logger.info(`${hookName}: Generating content for podcast: ${podcast.title}`)

        // Update status to transcript_ready
        logger.info(`${hookName}: Updating status to transcript_ready`)
        await podcastsService.updateOne(podcastId, {
            publishing_status: 'transcript_ready',
        })

        logger.info(`${hookName}: Calling Gemini API for shownotes`)

        // Generate shownotes
        const shownotesPrompt = buildShownotesPrompt(podcast, prompts)
        logger.info(`${hookName}: Sending request to Gemini API`)
        const shownotesResponse = await callGemini(geminiApiKey, shownotesPrompt)
        logger.info(`${hookName}: Received response from Gemini API`)
        const shownotesData = extractJson(shownotesResponse)

        logger.info(`${hookName}: Shownotes generated for podcast ${podcastId}`)

        // Store shownotes in podcast_generated_content
        // Format: description followed by topics, timestamps, and resources
        let shownotesText = shownotesData.description || ''

        if (shownotesData.topics && shownotesData.topics.length > 0) {
            shownotesText += '\n\n<strong>Themen:</strong>\n<ul>\n'
            shownotesText += shownotesData.topics.map((t: string) => `<li>${t}</li>`).join('\n')
            shownotesText += '\n</ul>'
        }

        if (shownotesData.timestamps && shownotesData.timestamps.length > 0) {
            shownotesText += '\n\n<strong>Timestamps:</strong>\n<ul>\n'
            shownotesText += shownotesData.timestamps
                .map((ts: { time: string; topic: string }) => `<li>${ts.time} - ${ts.topic}</li>`)
                .join('\n')
            shownotesText += '\n</ul>'
        }

        if (shownotesData.resources && shownotesData.resources.length > 0) {
            shownotesText += '\n\n<strong>Ressourcen:</strong>\n<ul>\n'
            shownotesText += shownotesData.resources
                .map((r: { name: string; url?: string }) =>
                    r.url ? `<li><a href="${r.url}">${r.name}</a></li>` : `<li>${r.name}</li>`
                )
                .join('\n')
            shownotesText += '\n</ul>'
        }

        await generatedContentService.createOne({
            podcast_id: podcast.id,
            content_type: 'shownotes',
            generated_text: shownotesText,
            status: 'generated',
        })

        // Generate social media posts
        const platforms: Array<'linkedin' | 'instagram' | 'bluesky' | 'mastodon'> = [
            'linkedin',
            'instagram',
            'bluesky',
            'mastodon',
        ]

        for (const platform of platforms) {
            try {
                const socialPrompt = buildSocialPrompt(
                    platform,
                    podcast,
                    {
                        description: shownotesData.description || '',
                        topics: shownotesData.topics || [],
                    },
                    prompts
                )
                const socialResponse = await callGemini(geminiApiKey, socialPrompt)
                const socialData = extractJson(socialResponse)

                // Format social post: text + hashtags (if available)
                let socialText = socialData.post_text || ''
                if (socialData.hashtags && socialData.hashtags.length > 0) {
                    socialText += '\n\n' + socialData.hashtags.join(' ')
                }
                if (socialData.tagging_suggestions && socialData.tagging_suggestions.length > 0) {
                    socialText += '\n\nTagging: ' + socialData.tagging_suggestions.join(', ')
                }

                await generatedContentService.createOne({
                    podcast_id: podcast.id,
                    content_type: `social_${platform}`,
                    generated_text: socialText,
                    status: 'generated',
                })

                logger.info(`${hookName}: ${platform} post generated for podcast ${podcastId}`)
            } catch (err) {
                logger.error(`${hookName}: Failed to generate ${platform} post for podcast ${podcastId}:`, err)
            }
        }

        // Update podcast status to content_review
        await podcastsService.updateOne(podcastId, {
            publishing_status: 'content_review',
        })

        logger.info(`${hookName}: Content generation complete for podcast ${podcastId}`)
    } catch (err: any) {
        logger.error(`${hookName}: Content generation error for podcast ${podcastId}: ${err?.message || err}`)
        if (err?.stack) {
            logger.error(`${hookName}: Stack trace: ${err.stack}`)
        }
        throw err
    }
}
