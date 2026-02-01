/**
 * Heise.de document generator for podcast episodes.
 * Generates HTML documents to be sent to Heise.de for potential publication.
 */

interface Speaker {
    speaker: {
        first_name: string
        last_name: string
        academic_title?: string | null
        occupation?: string | null
        description?: string | null
        linkedin_url?: string | null
        website_url?: string | null
    }
}

interface Member {
    member: {
        first_name: string
        last_name: string
    }
}

interface PodcastData {
    id: number
    title: string
    slug: string
    type: string
    number?: string
    description?: string
    planned_publish_date?: string
    speakers?: Speaker[]
    members?: Member[]
}

interface GenerateOptions {
    podcast: PodcastData
    websiteUrl: string
}

const EPISODE_TYPE_LABELS: Record<string, string> = {
    deep_dive: 'Deep Dive',
    cto_special: 'CTO Special',
    news: 'News',
    other: 'Episode',
}

/**
 * Format a speaker's full name with academic title.
 */
function formatSpeakerName(speaker: Speaker['speaker']): string {
    const parts = []
    if (speaker.academic_title) {
        parts.push(speaker.academic_title)
    }
    parts.push(speaker.first_name)
    parts.push(speaker.last_name)
    return parts.join(' ')
}

/**
 * Format the episode type with number.
 */
function formatEpisodeLabel(type: string, number?: string): string {
    const typeLabel = EPISODE_TYPE_LABELS[type] || type
    return number ? `${typeLabel} ${number}` : typeLabel
}

/**
 * Generate the HTML document for Heise.de.
 */
export function generateHeiseDocument(options: GenerateOptions): { html: string; plainText: string } {
    const { podcast, websiteUrl } = options

    const episodeLabel = formatEpisodeLabel(podcast.type, podcast.number)
    const episodeUrl = `${websiteUrl}/podcast/${podcast.slug}`

    const publicationDate = podcast.planned_publish_date
        ? new Date(podcast.planned_publish_date).toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : 'Demnächst'

    // Format hosts
    const hosts = podcast.members
        ?.map((m) => `${m.member.first_name} ${m.member.last_name}`)
        .filter(Boolean)
        .join(', ') || 'programmier.bar Team'

    // Format guests
    const guestSections = podcast.speakers
        ?.map((s) => {
            const speaker = s.speaker
            const name = formatSpeakerName(speaker)
            const position = speaker.occupation || ''
            const bio = speaker.description || ''
            const links: string[] = []

            if (speaker.linkedin_url) {
                links.push(`<a href="${speaker.linkedin_url}">LinkedIn</a>`)
            }
            if (speaker.website_url) {
                links.push(`<a href="${speaker.website_url}">Website</a>`)
            }

            return `
                <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h4 style="margin: 0 0 5px 0; color: #1a1a1a;">${name}</h4>
                    ${position ? `<p style="margin: 0 0 10px 0; color: #666; font-style: italic;">${position}</p>` : ''}
                    ${bio ? `<p style="margin: 0 0 10px 0;">${bio}</p>` : ''}
                    ${links.length > 0 ? `<p style="margin: 0; font-size: 14px;">${links.join(' | ')}</p>` : ''}
                </div>
            `
        })
        .join('') || ''

    const guestNames = podcast.speakers
        ?.map((s) => formatSpeakerName(s.speaker))
        .join(', ') || ''

    // Clean up description HTML for display
    const description = podcast.description || 'Keine Beschreibung verfügbar.'

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>programmier.bar - ${episodeLabel}: ${podcast.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">programmier.bar</h1>
        <p style="color: #a3e635; margin: 5px 0 0 0; font-size: 14px;">Der Podcast für App- und Webentwicklung</p>
    </div>

    <!-- Content -->
    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">

        <!-- Episode Title -->
        <h2 style="color: #1a1a1a; margin: 0 0 5px 0; font-size: 24px;">${episodeLabel}</h2>
        <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px; font-weight: normal;">${podcast.title}</h3>

        <!-- Meta Info -->
        <div style="background: #f0f9e8; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
            <p style="margin: 0;">
                <strong>Erscheinungsdatum:</strong> ${publicationDate}<br>
                <strong>Moderation:</strong> ${hosts}
                ${guestNames ? `<br><strong>Gast:</strong> ${guestNames}` : ''}
            </p>
        </div>

        ${guestSections ? `
        <!-- Guest Profiles -->
        <h3 style="color: #1a1a1a; font-size: 18px; margin-bottom: 10px;">Über unsere Gäste</h3>
        ${guestSections}
        ` : ''}

        <!-- Episode Description -->
        <h3 style="color: #1a1a1a; font-size: 18px; margin: 25px 0 15px 0;">Über die Episode</h3>
        <div style="line-height: 1.7;">
            ${description}
        </div>

        <!-- Links -->
        <h3 style="color: #1a1a1a; font-size: 18px; margin: 30px 0 15px 0;">Episode anhören</h3>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <p style="margin: 0 0 10px 0;">
                <strong>Episode-Link:</strong><br>
                <a href="${episodeUrl}" style="color: #2563eb;">${episodeUrl}</a>
            </p>
            <p style="margin: 0; font-size: 14px; color: #666;">
                Verfügbar auf allen gängigen Podcast-Plattformen: Apple Podcasts, Spotify, Google Podcasts, etc.
            </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <!-- Footer -->
        <div style="font-size: 14px; color: #666;">
            <p style="margin: 0 0 10px 0;">
                <strong>programmier.bar</strong><br>
                Der Podcast für App- und Webentwicklung
            </p>
            <p style="margin: 0 0 5px 0;">
                <a href="${websiteUrl}" style="color: #333;">${websiteUrl}</a>
            </p>
            <p style="margin: 0;">
                Kontakt: <a href="mailto:podcast@programmier.bar" style="color: #333;">podcast@programmier.bar</a>
            </p>
        </div>

    </div>

</body>
</html>`

    // Generate plain text version
    const plainText = `
programmier.bar - Der Podcast für App- und Webentwicklung
=========================================================

${episodeLabel}
${podcast.title}

Erscheinungsdatum: ${publicationDate}
Moderation: ${hosts}
${guestNames ? `Gast: ${guestNames}` : ''}

${guestNames ? `
ÜBER UNSERE GÄSTE
-----------------
${podcast.speakers?.map((s) => {
    const speaker = s.speaker
    return `${formatSpeakerName(speaker)}
${speaker.occupation || ''}
${speaker.description || ''}
${speaker.linkedin_url || ''} ${speaker.website_url || ''}
`
}).join('\n')}
` : ''}

ÜBER DIE EPISODE
----------------
${description.replace(/<[^>]*>/g, '')}

EPISODE ANHÖREN
---------------
${episodeUrl}

Verfügbar auf allen gängigen Podcast-Plattformen: Apple Podcasts, Spotify, Google Podcasts, etc.

---
programmier.bar
Der Podcast für App- und Webentwicklung
${websiteUrl}
Kontakt: podcast@programmier.bar
`

    return { html, plainText }
}

/**
 * Build the email wrapper for sending to Heise.
 */
export function buildHeiseEmail(options: { title: string; documentHtml: string }): { subject: string; html: string } {
    return {
        subject: `[programmier.bar] Neue Episode: ${options.title}`,
        html: options.documentHtml,
    }
}
