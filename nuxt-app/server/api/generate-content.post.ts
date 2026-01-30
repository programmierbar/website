/**
 * API endpoint for AI content generation from podcast transcripts.
 * Called by Directus Flow when publishing_status changes to 'transcript_ready'.
 *
 * Requires: NUXT_GEMINI_API_KEY environment variable
 */

interface GenerateContentRequest {
    podcastId: number
    secret?: string // Optional secret for webhook security
}

interface PodcastData {
    id: number
    title: string
    type: string
    number?: string
    transcript_text?: string
    speakers?: Array<{ speakers_id: { first_name: string; last_name: string; occupation?: string; description?: string } }>
    members?: Array<{ members_id: { name: string } }>
}

const WORD_COUNT_TARGETS: Record<string, string> = {
    deep_dive: '300-500',
    cto_special: '200-350',
    news: '100-200',
    other: '150-400',
}

function buildShownotesPrompt(podcast: PodcastData): string {
    const episodeType = podcast.type || 'other'
    const wordCount = WORD_COUNT_TARGETS[episodeType] || '150-400'

    const hosts = podcast.members?.map((m) => m.members_id?.name).filter(Boolean).join(', ') || 'programmier.bar Team'

    const guests =
        podcast.speakers?.map((s) => `${s.speakers_id?.first_name} ${s.speakers_id?.last_name}`).filter(Boolean).join(', ') || ''

    const guestInfo =
        podcast.speakers
            ?.map((s) => {
                const speaker = s.speakers_id
                if (!speaker) return ''
                return `${speaker.first_name} ${speaker.last_name}${speaker.occupation ? ` - ${speaker.occupation}` : ''}${speaker.description ? `: ${speaker.description}` : ''}`
            })
            .filter(Boolean)
            .join('\n') || ''

    return `Erstelle Shownotes für folgende Podcast-Episode:

**Episode-Typ:** ${episodeType}
**Titel:** ${podcast.title}
**Episodennummer:** ${podcast.number || 'N/A'}

**Hosts:** ${hosts}
**Gäste:** ${guests || 'Keine Gäste'}
${guestInfo ? `**Gast-Info:** ${guestInfo}` : ''}

**Transkript:**
${podcast.transcript_text || 'Kein Transkript verfügbar'}

---

Erstelle basierend auf dem Transkript:

1. **Beschreibung** (${wordCount} Wörter): Eine einladende Episode-Beschreibung im programmier.bar Stil

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
}

function buildSocialPrompt(
    platform: 'linkedin' | 'instagram' | 'bluesky' | 'mastodon',
    podcast: PodcastData,
    topics: string[]
): string {
    const guests =
        podcast.speakers?.map((s) => `${s.speakers_id?.first_name} ${s.speakers_id?.last_name}`).filter(Boolean).join(', ') || ''

    const guestCompanies =
        podcast.speakers
            ?.map((s) => s.speakers_id?.occupation?.split(' at ')[1] || s.speakers_id?.occupation)
            .filter(Boolean)
            .join(', ') || ''

    const topicsText = topics.map((t) => `- ${t}`).join('\n')

    const platformPrompts: Record<string, string> = {
        linkedin: `Erstelle einen LinkedIn-Post für diese Podcast-Episode:

**Titel:** ${podcast.title}
**Typ:** ${podcast.type}
**Gäste:** ${guests || 'Keine Gäste'}
**Unternehmen:** ${guestCompanies || 'N/A'}

**Key Topics:**
${topicsText}

---

Erstelle einen LinkedIn-Post mit:
1. Hook (erste 2 Zeilen sind am wichtigsten - vor "mehr anzeigen")
2. 2-3 Key Takeaways oder interessante Punkte
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

**Titel:** ${podcast.title}
**Typ:** ${podcast.type}
**Gäste:** ${guests || 'Keine Gäste'}
**Key Topics:**
${topicsText}

---

Erstelle eine Instagram-Caption mit:
1. Aufmerksamkeitsstarke erste Zeile
2. 2-3 Sätze zum Inhalt
3. Call-to-Action ("Link in Bio")
4. 10-15 relevante Hashtags (Mix aus großen und Nischen-Tags)

Antworte im JSON-Format:
{
  "post_text": "Caption ohne Hashtags",
  "hashtags": ["#tag1", "#tag2", ...]
}`,

        bluesky: `Erstelle einen Bluesky-Post für diese Podcast-Episode:

**Titel:** ${podcast.title}
**Gäste:** ${guests || 'Keine Gäste'}

---

Erstelle einen Bluesky-Post (max 300 Zeichen inkl. Link-Platzhalter [LINK]) mit:
1. Hook oder interessantes Zitat
2. Kurze Info zur Episode
3. Platz für Link

Antworte im JSON-Format:
{
  "post_text": "Der vollständige Post-Text (max 300 Zeichen)"
}`,

        mastodon: `Erstelle einen Mastodon-Post für diese Podcast-Episode:

**Titel:** ${podcast.title}
**Gäste:** ${guests || 'Keine Gäste'}
**Topics:**
${topicsText}

---

Erstelle einen Mastodon-Post (max 500 Zeichen) mit:
1. Beschreibung der Episode
2. Was Hörer:innen lernen können
3. Link-Platzhalter [LINK]
4. 3-5 Hashtags

Antworte im JSON-Format:
{
  "post_text": "Der vollständige Post-Text",
  "hashtags": ["#tag1", "#tag2"]
}`,
    }

    return platformPrompts[platform]
}

async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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

export default defineEventHandler(async (event) => {
    const body = await readBody<GenerateContentRequest>(event)

    if (!body.podcastId) {
        throw createError({
            statusCode: 400,
            message: 'podcastId is required',
        })
    }

    const config = useRuntimeConfig()
    const geminiApiKey = config.geminiApiKey
    const directusUrl = config.public.directusCmsUrl || 'http://localhost:8055'
    const adminToken = config.directusAdminToken

    if (!geminiApiKey) {
        throw createError({
            statusCode: 500,
            message: 'GEMINI_API_KEY not configured',
        })
    }

    if (!adminToken) {
        throw createError({
            statusCode: 500,
            message: 'DIRECTUS_ADMIN_TOKEN not configured',
        })
    }

    try {
        // Fetch podcast with related data
        const podcastResponse = await fetch(
            `${directusUrl}/items/podcasts/${body.podcastId}?fields=id,title,type,number,transcript_text,speakers.speakers_id.first_name,speakers.speakers_id.last_name,speakers.speakers_id.occupation,speakers.speakers_id.description,members.members_id.name`,
            { headers: { Authorization: `Bearer ${adminToken}` } }
        )

        if (!podcastResponse.ok) {
            throw new Error(`Failed to fetch podcast: ${podcastResponse.status}`)
        }

        const podcastData = await podcastResponse.json()
        const podcast: PodcastData = podcastData.data

        if (!podcast.transcript_text) {
            throw createError({
                statusCode: 400,
                message: 'Podcast has no transcript',
            })
        }

        console.log(`Generating content for podcast: ${podcast.title}`)

        // System prompt for shownotes
        const shownotesSystemPrompt = `Du bist ein erfahrener Content-Redakteur für den deutschen Entwickler-Podcast "programmier.bar".
Deine Aufgabe ist es, ansprechende Shownotes für Podcast-Episoden zu erstellen, die sowohl informativ als auch einladend sind.

Stilrichtlinien:
- Deutsch als Hauptsprache
- Technische Fachbegriffe auf Englisch belassen (z.B. "TypeScript", "Machine Learning", "API")
- Freundlich, professionell, aber nicht steif
- HTML-Formatierung: <strong>, <em>, <ul>, <ol>, <li>, <a href="">
- Bullet Points für Themenübersicht verwenden`

        // Generate shownotes
        const shownotesPrompt = buildShownotesPrompt(podcast)
        const shownotesResponse = await callGemini(geminiApiKey, shownotesSystemPrompt, shownotesPrompt)
        const shownotesData = extractJson(shownotesResponse)

        console.log('Shownotes generated')

        // Store shownotes in podcast_generated_content
        const shownotesRecord = await fetch(`${directusUrl}/items/podcast_generated_content`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${adminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                podcast_id: podcast.id,
                content_type: 'shownotes',
                generated_text: JSON.stringify(shownotesData),
                status: 'generated',
                generated_at: new Date().toISOString(),
                llm_model: 'gemini-1.5-flash',
                prompt_version: '1.0',
            }),
        })

        if (!shownotesRecord.ok) {
            console.error('Failed to store shownotes:', await shownotesRecord.text())
        }

        // Generate social media posts
        const platforms: Array<'linkedin' | 'instagram' | 'bluesky' | 'mastodon'> = [
            'linkedin',
            'instagram',
            'bluesky',
            'mastodon',
        ]

        const socialSystemPrompts: Record<string, string> = {
            linkedin: `Du erstellst professionelle LinkedIn-Posts für den Podcast "programmier.bar". Der Ton ist professionell aber nahbar, fachlich fundiert aber zugänglich.`,
            instagram: `Du erstellst Instagram-Posts für "programmier.bar". Instagram ist visuell-fokussiert, der Text ist die Caption. Emoji sind erlaubt und erwünscht.`,
            bluesky: `Du erstellst Posts für Bluesky für "programmier.bar". Bluesky ist ähnlich wie Twitter, mit 300 Zeichen Limit pro Post. Kurz und prägnant.`,
            mastodon: `Du erstellst Posts für Mastodon für "programmier.bar". Mastodon hat ein 500 Zeichen Limit und eine tech-affine, Community-orientierte Nutzerschaft.`,
        }

        for (const platform of platforms) {
            try {
                const socialPrompt = buildSocialPrompt(platform, podcast, shownotesData.topics || [])
                const socialResponse = await callGemini(geminiApiKey, socialSystemPrompts[platform], socialPrompt)
                const socialData = extractJson(socialResponse)

                await fetch(`${directusUrl}/items/podcast_generated_content`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${adminToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        podcast_id: podcast.id,
                        content_type: `social_${platform}`,
                        generated_text: JSON.stringify(socialData),
                        status: 'generated',
                        generated_at: new Date().toISOString(),
                        llm_model: 'gemini-1.5-flash',
                        prompt_version: '1.0',
                    }),
                })

                console.log(`${platform} post generated`)
            } catch (err) {
                console.error(`Failed to generate ${platform} post:`, err)
            }
        }

        // Update podcast status to content_review
        await fetch(`${directusUrl}/items/podcasts/${podcast.id}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${adminToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                publishing_status: 'content_review',
            }),
        })

        console.log('Content generation complete')

        return {
            success: true,
            message: 'Content generated successfully',
            podcastId: podcast.id,
        }
    } catch (err: any) {
        console.error('Content generation error:', err)
        throw createError({
            statusCode: 500,
            message: err.message || 'Content generation failed',
        })
    }
})
