import type { Logger } from 'pino'

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
    type: string
    number?: string
    transcript_text?: string
    speakers?: Array<{ speaker: { first_name: string; last_name: string; occupation?: string; description?: string } }>
    members?: Array<{ member: { first_name: string; last_name: string } }>
}

interface AiPrompt {
    key: string
    prompt_text: string
}

// Default word count targets (used if not found in CMS)
const DEFAULT_WORD_COUNT_TARGETS: Record<string, string> = {
    deep_dive: '300-500',
    cto_special: '200-350',
    news: '100-200',
    other: '150-400',
}

// Simple template renderer for Handlebars-like syntax
function renderTemplate(template: string, variables: Record<string, string>): string {
    let result = template

    // Handle simple variables {{variable}}
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
        result = result.replace(regex, value || '')
    }

    // Handle conditional blocks {{#if variable}}...{{/if}}
    const ifBlockRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g
    result = result.replace(ifBlockRegex, (_, varName, content) => {
        return variables[varName] ? content : ''
    })

    return result
}

async function fetchPrompts(
    promptsService: any,
    keys: string[],
    logger: Logger,
    hookName: string
): Promise<Map<string, string>> {
    const prompts = new Map<string, string>()

    try {
        const results = await promptsService.readByQuery({
            filter: { key: { _in: keys } },
            fields: ['key', 'prompt_text'],
        })

        for (const prompt of results) {
            prompts.set(prompt.key, prompt.prompt_text)
        }

        // Log which prompts were found/missing
        for (const key of keys) {
            if (!prompts.has(key)) {
                logger.warn(`${hookName}: AI prompt '${key}' not found in CMS, using default`)
            }
        }
    } catch (err) {
        logger.warn(`${hookName}: Failed to fetch AI prompts from CMS, using defaults: ${err}`)
    }

    return prompts
}

function getWordCountTargets(prompts: Map<string, string>): Record<string, string> {
    const configPrompt = prompts.get('shownotes_word_counts')
    if (configPrompt) {
        try {
            return JSON.parse(configPrompt)
        } catch {
            // Invalid JSON, use defaults
        }
    }
    return DEFAULT_WORD_COUNT_TARGETS
}

function buildShownotesPrompt(podcast: PodcastData, prompts: Map<string, string>): { system: string; user: string } {
    const wordCountTargets = getWordCountTargets(prompts)
    const episodeType = podcast.type || 'other'
    const wordCount = wordCountTargets[episodeType] || wordCountTargets['other'] || '150-400'

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

    // Get prompts from CMS or use defaults
    const systemPrompt =
        prompts.get('shownotes_system') ||
        `Du bist ein erfahrener Content-Redakteur für den deutschen Entwickler-Podcast "programmier.bar".
Deine Aufgabe ist es, ansprechende Shownotes für Podcast-Episoden zu erstellen, die sowohl informativ als auch einladend sind.

Stilrichtlinien:
- Deutsch als Hauptsprache
- Technische Fachbegriffe auf Englisch belassen (z.B. "TypeScript", "Machine Learning", "API")
- Freundlich, professionell, aber nicht steif
- HTML-Formatierung: <strong>, <em>, <ul>, <ol>, <li>, <a href="">
- Bullet Points für Themenübersicht verwenden`

    const userTemplate =
        prompts.get('shownotes_user') ||
        `Erstelle Shownotes für folgende Podcast-Episode:

**Episode-Typ:** {{episode_type}}
**Titel:** {{title}}
**Episodennummer:** {{number}}

**Hosts:** {{hosts}}
**Gäste:** {{guests}}
{{#if guest_info}}**Gast-Info:** {{guest_info}}{{/if}}

**Transkript:**
{{transcript}}

---

Erstelle basierend auf dem Transkript:

1. **Beschreibung** ({{word_count}} Wörter): Eine einladende Episode-Beschreibung im programmier.bar Stil

2. **Themenübersicht**: 3-7 Hauptthemen als Bullet Points

3. **Timestamps**: Wichtige Zeitmarken für Themenwechsel (Format: MM:SS - Thema)

4. **Ressourcen**: Liste der im Gespräch erwähnten Tools, Technologien, Links

Formatiere die Beschreibung in HTML mit <strong>, <ul>, <li>, und <a> Tags wo angemessen.

Antworte im folgenden JSON-Format:
{
  "description": "HTML-formatierte Beschreibung",
  "topics": ["Thema 1", "Thema 2", ...],
  "timestamps": [{"time": "00:00", "topic": "Intro"}, ...],
  "resources": [{"name": "Resource Name", "url": "https://..."}, ...]
}`

    const userPrompt = renderTemplate(userTemplate, {
        episode_type: episodeType,
        title: podcast.title,
        number: podcast.number || 'N/A',
        hosts,
        guests: guests || 'Keine Gäste',
        guest_info: guestInfo,
        transcript: podcast.transcript_text || 'Kein Transkript verfügbar',
        word_count: wordCount,
    })

    return { system: systemPrompt, user: userPrompt }
}

function buildSocialPrompt(
    platform: 'linkedin' | 'instagram' | 'bluesky' | 'mastodon',
    podcast: PodcastData,
    shownotes: { description: string; topics: string[] },
    prompts: Map<string, string>
): { system: string; user: string } {
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

    // Default system prompts
    const defaultSystemPrompts: Record<string, string> = {
        linkedin: `Du erstellst professionelle LinkedIn-Posts für den Podcast "programmier.bar". Der Ton ist professionell aber nahbar, fachlich fundiert aber zugänglich.`,
        instagram: `Du erstellst Instagram-Posts für "programmier.bar". Instagram ist visuell-fokussiert, der Text ist die Caption. Emoji sind erlaubt und erwünscht.`,
        bluesky: `Du erstellst Posts für Bluesky für "programmier.bar". Bluesky ist ähnlich wie Twitter, mit 300 Zeichen Limit pro Post. Kurz und prägnant.`,
        mastodon: `Du erstellst Posts für Mastodon für "programmier.bar". Mastodon hat ein 500 Zeichen Limit und eine tech-affine, Community-orientierte Nutzerschaft.`,
    }

    // Default user prompts
    const defaultUserPrompts: Record<string, string> = {
        linkedin: `Erstelle einen LinkedIn-Post für diese Podcast-Episode:

**Titel:** {{title}}
**Typ:** {{episode_type}}
**Gäste:** {{guests}}
**Unternehmen:** {{guest_companies}}

**Shownotes (Zusammenfassung der Episode):**
{{shownotes}}

**Key Topics:**
{{topics}}

---

Basierend auf den Shownotes, erstelle einen LinkedIn-Post mit:
1. Hook (erste 2 Zeilen sind am wichtigsten - vor "mehr anzeigen")
2. 2-3 Key Takeaways oder interessante Punkte aus den Shownotes
3. Call-to-Action mit Link-Platzhalter [LINK]
4. 3-5 relevante Hashtags

Gib auch an, welche Personen/Unternehmen getaggt werden sollten.

Antworte im JSON-Format:
{
  "post_text": "Der vollständige Post-Text",
  "hashtags": ["#tag1", "#tag2"],
  "tagging_suggestions": ["@Person1", "@Company1"]
}`,

        instagram: `Erstelle eine Instagram-Caption für diese Podcast-Episode:

**Titel:** {{title}}
**Typ:** {{episode_type}}
**Gäste:** {{guests}}

**Shownotes (Zusammenfassung der Episode):**
{{shownotes}}

**Key Topics:**
{{topics}}

---

Basierend auf den Shownotes, erstelle eine Instagram-Caption mit:
1. Aufmerksamkeitsstarke erste Zeile
2. 2-3 Sätze zum Inhalt (kurze Version der Shownotes)
3. Call-to-Action ("Link in Bio")
4. 10-15 relevante Hashtags (Mix aus großen und Nischen-Tags)

Antworte im JSON-Format:
{
  "post_text": "Caption ohne Hashtags",
  "hashtags": ["#tag1", "#tag2", ...]
}`,

        bluesky: `Erstelle einen Bluesky-Post für diese Podcast-Episode:

**Titel:** {{title}}
**Gäste:** {{guests}}

**Shownotes (Zusammenfassung der Episode):**
{{shownotes}}

---

Basierend auf den Shownotes, erstelle einen Bluesky-Post (max 300 Zeichen inkl. Link-Platzhalter [LINK]) mit:
1. Hook oder interessantes Zitat aus der Episode
2. Kurze Info zur Episode
3. Platz für Link

Antworte im JSON-Format:
{
  "post_text": "Der vollständige Post-Text (max 300 Zeichen)"
}`,

        mastodon: `Erstelle einen Mastodon-Post für diese Podcast-Episode:

**Titel:** {{title}}
**Gäste:** {{guests}}

**Shownotes (Zusammenfassung der Episode):**
{{shownotes}}

**Topics:**
{{topics}}

---

Basierend auf den Shownotes, erstelle einen Mastodon-Post (max 500 Zeichen) mit:
1. Kurze Beschreibung der Episode (aus den Shownotes)
2. Was Hörer:innen lernen können
3. Link-Platzhalter [LINK]
4. 3-5 Hashtags

Antworte im JSON-Format:
{
  "post_text": "Der vollständige Post-Text",
  "hashtags": ["#tag1", "#tag2"]
}`,
    }

    // Get prompts from CMS or use defaults
    const systemPrompt = prompts.get(`social_${platform}_system`) || defaultSystemPrompts[platform]
    const userTemplate = prompts.get(`social_${platform}_user`) || defaultUserPrompts[platform]

    const userPrompt = renderTemplate(userTemplate, {
        title: podcast.title,
        episode_type: podcast.type || 'other',
        guests: guests || 'Keine Gäste',
        guest_companies: guestCompanies || 'N/A',
        topics: topicsText,
        shownotes: shownotesDescription,
    })

    return { system: systemPrompt, user: userPrompt }
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                },
            }),
        }
    )

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Gemini API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
        throw new Error('No content in Gemini response')
    }

    return text
}

function extractJson(text: string): any {
    // Try to extract JSON from the response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0]
        return JSON.parse(jsonStr)
    }
    throw new Error('Could not extract JSON from response')
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

        // Fetch AI prompts from CMS
        const promptKeys = [
            'shownotes_system',
            'shownotes_user',
            'shownotes_word_counts',
            'social_linkedin_system',
            'social_linkedin_user',
            'social_instagram_system',
            'social_instagram_user',
            'social_bluesky_system',
            'social_bluesky_user',
            'social_mastodon_system',
            'social_mastodon_user',
        ]
        const prompts = await fetchPrompts(promptsService, promptKeys, logger, hookName)
        logger.info(`${hookName}: Loaded ${prompts.size} AI prompts from CMS`)

        // Fetch podcast with related data
        const podcast: PodcastData = await podcastsService.readOne(podcastId, {
            fields: [
                'id',
                'title',
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
        const shownotesPrompts = buildShownotesPrompt(podcast, prompts)
        logger.info(`${hookName}: Sending request to Gemini API`)
        const shownotesResponse = await callGemini(geminiApiKey, shownotesPrompts.system, shownotesPrompts.user)
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
            generated_at: new Date().toISOString(),
            llm_model: 'gemini-3-flash-preview',
            prompt_version: '1.0',
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
                const socialPrompts = buildSocialPrompt(
                    platform,
                    podcast,
                    {
                        description: shownotesData.description || '',
                        topics: shownotesData.topics || [],
                    },
                    prompts
                )
                const socialResponse = await callGemini(geminiApiKey, socialPrompts.system, socialPrompts.user)
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
                    generated_at: new Date().toISOString(),
                    llm_model: 'gemini-3-flash-preview',
                    prompt_version: '1.0',
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
