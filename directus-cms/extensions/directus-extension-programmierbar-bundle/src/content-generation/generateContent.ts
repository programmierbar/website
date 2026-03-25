import type { Logger } from 'pino'
import { callGemini, extractHtml } from '../shared/gemini.ts'
import { renderTemplate } from '../shared/templateRenderer.ts'
import { fetchSlackContext } from '../shared/fetchSlackContext.ts'

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

function buildShownotesPrompt(podcast: PodcastData, prompts: Map<string, string>, slackContext?: string | null): string {
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
        slack_context: slackContext || '',
    })
}

function buildSocialPrompt(
    platform: 'linkedin' | 'instagram' | 'bluesky' | 'mastodon',
    podcast: PodcastData,
    shownotes: string,
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

    const template = prompts.get(`social_${platform}`)!

    return renderTemplate(template, {
        title: podcast.title,
        episode_type: podcast.type || 'other',
        slug: podcast.slug || '',
        guests: guests || 'Keine Gäste',
        guest_companies: guestCompanies || 'N/A',
        shownotes,
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

        // Fetch Slack context for news podcasts
        let slackContext: string | null = null
        if (podcast.type === 'news' && !env.SLACK_BOT_TOKEN) {
            logger.warn(`${hookName}: SLACK_BOT_TOKEN not set. Slack context for news shownotes will not be available.`)
        }
        if (podcast.type === 'news' && env.SLACK_BOT_TOKEN) {
            logger.info(`${hookName}: Fetching Slack context for news podcast`)
            slackContext = await fetchSlackContext({
                podcastType: podcast.type,
                podcastTitle: podcast.title,
                slackBotToken: env.SLACK_BOT_TOKEN,
                logger,
                getSettingValue: async (key: string) => {
                    const settingsService = new ItemsService('automation_settings', {
                        schema,
                        accountability: eventContext.accountability,
                    })
                    const settings = await settingsService.readByQuery({
                        filter: { key: { _eq: key } },
                        fields: ['value'],
                        limit: 1,
                    })
                    return settings?.[0]?.value || null
                },
            })
            if (slackContext) {
                logger.info(`${hookName}: Slack context fetched successfully`)
            }
        }

        // Update status to transcript_ready
        logger.info(`${hookName}: Updating status to transcript_ready`)
        await podcastsService.updateOne(podcastId, {
            publishing_status: 'transcript_ready',
        })

        logger.info(`${hookName}: Calling Gemini API for shownotes`)

        // Generate shownotes (returns HTML directly, no JSON wrapping)
        const shownotesPrompt = buildShownotesPrompt(podcast, prompts, slackContext)
        logger.info(`${hookName}: Sending request to Gemini API`)
        const shownotesResponse = await callGemini(geminiApiKey, shownotesPrompt)
        logger.info(`${hookName}: Received response from Gemini API`)
        const shownotesHtml = extractHtml(shownotesResponse)

        logger.info(`${hookName}: Shownotes generated for podcast ${podcastId}`)

        await generatedContentService.createOne({
            podcast_id: podcast.id,
            content_type: 'shownotes',
            generated_text: shownotesHtml,
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
                    shownotesHtml,
                    prompts
                )
                const socialResponse = await callGemini(geminiApiKey, socialPrompt)
                const socialText = socialResponse.trim()

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
