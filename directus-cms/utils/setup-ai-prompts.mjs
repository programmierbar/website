#!/usr/bin/env node

/**
 * Setup script for AI prompts collection.
 *
 * This script creates the `ai_prompts` collection for storing editable AI prompts
 * used in content generation (shownotes, social media posts, etc.)
 *
 * Run with: node utils/setup-ai-prompts.mjs
 */

import { createDirectus, rest, staticToken, createCollection, createField, createItem, readItems } from '@directus/sdk'
import 'dotenv/config'

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
const DIRECTUS_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN

if (!DIRECTUS_TOKEN) {
    console.error('Error: DIRECTUS_ADMIN_TOKEN environment variable is required')
    process.exit(1)
}

const client = createDirectus(DIRECTUS_URL).with(rest()).with(staticToken(DIRECTUS_TOKEN))

// AI prompt templates with their default content
const AI_PROMPTS = [
    // Shownotes prompts
    {
        key: 'shownotes_system',
        name: 'Shownotes System Prompt',
        description: 'System prompt defining the style and guidelines for generating podcast shownotes',
        category: 'shownotes',
        prompt_text: `Du bist ein erfahrener Content-Redakteur für den deutschen Entwickler-Podcast "programmier.bar".
Deine Aufgabe ist es, ansprechende Shownotes für Podcast-Episoden zu erstellen, die sowohl informativ als auch einladend sind.

Stilrichtlinien:
- Deutsch als Hauptsprache
- Technische Fachbegriffe auf Englisch belassen (z.B. "TypeScript", "Machine Learning", "API")
- Freundlich, professionell, aber nicht steif
- HTML-Formatierung: <strong>, <em>, <ul>, <ol>, <li>, <a href="">
- Bullet Points für Themenübersicht verwenden`,
        variables: JSON.stringify([]),
    },
    {
        key: 'shownotes_user',
        name: 'Shownotes User Prompt',
        description: 'User prompt template for generating shownotes. Variables: {{episode_type}}, {{title}}, {{number}}, {{hosts}}, {{guests}}, {{guest_info}}, {{transcript}}, {{word_count}}',
        category: 'shownotes',
        prompt_text: `Erstelle Shownotes für folgende Podcast-Episode:

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
}`,
        variables: JSON.stringify([
            { name: 'episode_type', description: 'Type of episode (deep_dive, cto_special, news, other)' },
            { name: 'title', description: 'Episode title' },
            { name: 'number', description: 'Episode number' },
            { name: 'hosts', description: 'Comma-separated list of host names' },
            { name: 'guests', description: 'Comma-separated list of guest names' },
            { name: 'guest_info', description: 'Detailed guest information with occupation/bio' },
            { name: 'transcript', description: 'Full episode transcript' },
            { name: 'word_count', description: 'Target word count range for description' },
        ]),
    },
    {
        key: 'shownotes_word_counts',
        name: 'Shownotes Word Count Targets',
        description: 'JSON configuration for word count targets per episode type. Format: {"episode_type": "min-max"}',
        category: 'shownotes',
        prompt_text: JSON.stringify(
            {
                deep_dive: '300-500',
                cto_special: '200-350',
                news: '100-200',
                other: '150-400',
            },
            null,
            2
        ),
        variables: JSON.stringify([]),
    },

    // LinkedIn prompts
    {
        key: 'social_linkedin_system',
        name: 'LinkedIn System Prompt',
        description: 'System prompt for generating LinkedIn posts',
        category: 'social_media',
        prompt_text: `Du erstellst professionelle LinkedIn-Posts für den Podcast "programmier.bar". Der Ton ist professionell aber nahbar, fachlich fundiert aber zugänglich.`,
        variables: JSON.stringify([]),
    },
    {
        key: 'social_linkedin_user',
        name: 'LinkedIn User Prompt',
        description: 'User prompt template for generating LinkedIn posts. The shownotes are generated first and passed as context.',
        category: 'social_media',
        prompt_text: `Erstelle einen LinkedIn-Post für diese Podcast-Episode:

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
        variables: JSON.stringify([
            { name: 'title', description: 'Episode title' },
            { name: 'episode_type', description: 'Type of episode' },
            { name: 'guests', description: 'Guest names' },
            { name: 'guest_companies', description: 'Guest companies/organizations' },
            { name: 'shownotes', description: 'Generated shownotes description (HTML)' },
            { name: 'topics', description: 'Key topics as bullet points' },
        ]),
    },

    // Instagram prompts
    {
        key: 'social_instagram_system',
        name: 'Instagram System Prompt',
        description: 'System prompt for generating Instagram posts',
        category: 'social_media',
        prompt_text: `Du erstellst Instagram-Posts für "programmier.bar". Instagram ist visuell-fokussiert, der Text ist die Caption. Emoji sind erlaubt und erwünscht.`,
        variables: JSON.stringify([]),
    },
    {
        key: 'social_instagram_user',
        name: 'Instagram User Prompt',
        description: 'User prompt template for generating Instagram posts. The shownotes are generated first and passed as context.',
        category: 'social_media',
        prompt_text: `Erstelle eine Instagram-Caption für diese Podcast-Episode:

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
        variables: JSON.stringify([
            { name: 'title', description: 'Episode title' },
            { name: 'episode_type', description: 'Type of episode' },
            { name: 'guests', description: 'Guest names' },
            { name: 'shownotes', description: 'Generated shownotes description (HTML)' },
            { name: 'topics', description: 'Key topics as bullet points' },
        ]),
    },

    // Bluesky prompts
    {
        key: 'social_bluesky_system',
        name: 'Bluesky System Prompt',
        description: 'System prompt for generating Bluesky posts',
        category: 'social_media',
        prompt_text: `Du erstellst Posts für Bluesky für "programmier.bar". Bluesky ist ähnlich wie Twitter, mit 300 Zeichen Limit pro Post. Kurz und prägnant.`,
        variables: JSON.stringify([]),
    },
    {
        key: 'social_bluesky_user',
        name: 'Bluesky User Prompt',
        description: 'User prompt template for generating Bluesky posts. The shownotes are generated first and passed as context.',
        category: 'social_media',
        prompt_text: `Erstelle einen Bluesky-Post für diese Podcast-Episode:

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
        variables: JSON.stringify([
            { name: 'title', description: 'Episode title' },
            { name: 'guests', description: 'Guest names' },
            { name: 'shownotes', description: 'Generated shownotes description (HTML)' },
        ]),
    },

    // Mastodon prompts
    {
        key: 'social_mastodon_system',
        name: 'Mastodon System Prompt',
        description: 'System prompt for generating Mastodon posts',
        category: 'social_media',
        prompt_text: `Du erstellst Posts für Mastodon für "programmier.bar". Mastodon hat ein 500 Zeichen Limit und eine tech-affine, Community-orientierte Nutzerschaft.`,
        variables: JSON.stringify([]),
    },
    {
        key: 'social_mastodon_user',
        name: 'Mastodon User Prompt',
        description: 'User prompt template for generating Mastodon posts. The shownotes are generated first and passed as context.',
        category: 'social_media',
        prompt_text: `Erstelle einen Mastodon-Post für diese Podcast-Episode:

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
        variables: JSON.stringify([
            { name: 'title', description: 'Episode title' },
            { name: 'guests', description: 'Guest names' },
            { name: 'shownotes', description: 'Generated shownotes description (HTML)' },
            { name: 'topics', description: 'Key topics as bullet points' },
        ]),
    },
]

async function createAiPromptsCollection() {
    console.log('Creating ai_prompts collection...')

    try {
        await client.request(
            createCollection({
                collection: 'ai_prompts',
                meta: {
                    collection: 'ai_prompts',
                    icon: 'psychology',
                    note: 'AI prompts for content generation (shownotes, social media posts)',
                    display_template: '{{name}}',
                    archive_field: null,
                    archive_value: null,
                    unarchive_value: null,
                    singleton: false,
                    sort_field: 'sort',
                },
                schema: {
                    name: 'ai_prompts',
                },
            })
        )
        console.log('  Collection created')
    } catch (err) {
        if (err.errors?.[0]?.extensions?.code === 'INVALID_PAYLOAD' || err.message?.includes('already exists')) {
            console.log('  Collection already exists, skipping creation')
        } else {
            throw err
        }
    }

    // Create fields
    const fields = [
        {
            field: 'id',
            type: 'integer',
            meta: { hidden: true, interface: 'input', readonly: true },
            schema: { is_primary_key: true, has_auto_increment: true },
        },
        {
            field: 'sort',
            type: 'integer',
            meta: { hidden: true, interface: 'input', width: 'full' },
            schema: {},
        },
        {
            field: 'key',
            type: 'string',
            meta: {
                interface: 'input',
                width: 'half',
                required: true,
                note: 'Unique identifier for the prompt (used in code)',
                options: { font: 'monospace' },
            },
            schema: { is_unique: true, is_nullable: false },
        },
        {
            field: 'name',
            type: 'string',
            meta: {
                interface: 'input',
                width: 'half',
                required: true,
                note: 'Display name for the prompt',
            },
            schema: { is_nullable: false },
        },
        {
            field: 'category',
            type: 'string',
            meta: {
                interface: 'select-dropdown',
                width: 'half',
                required: true,
                note: 'Category for organizing prompts',
                options: {
                    choices: [
                        { text: 'Shownotes', value: 'shownotes' },
                        { text: 'Social Media', value: 'social_media' },
                        { text: 'Other', value: 'other' },
                    ],
                },
            },
            schema: { is_nullable: false, default_value: 'other' },
        },
        {
            field: 'description',
            type: 'text',
            meta: {
                interface: 'input-multiline',
                width: 'full',
                note: 'Description of when and how this prompt is used',
            },
            schema: {},
        },
        {
            field: 'prompt_text',
            type: 'text',
            meta: {
                interface: 'input-code',
                width: 'full',
                required: true,
                note: 'The prompt text. Supports Handlebars variables like {{title}}, {{transcript}}, etc.',
                options: { language: 'text', lineNumber: true },
            },
            schema: { is_nullable: false },
        },
        {
            field: 'variables',
            type: 'json',
            meta: {
                interface: 'input-code',
                width: 'full',
                note: 'JSON array documenting available template variables: [{"name": "var", "description": "..."}]',
                options: { language: 'json', lineNumber: true },
            },
            schema: {},
        },
        {
            field: 'date_updated',
            type: 'timestamp',
            meta: {
                hidden: true,
                interface: 'datetime',
                special: ['date-updated'],
                width: 'half',
            },
            schema: {},
        },
        {
            field: 'user_updated',
            type: 'uuid',
            meta: {
                hidden: true,
                interface: 'select-dropdown-m2o',
                special: ['user-updated'],
                width: 'half',
            },
            schema: {},
        },
    ]

    for (const field of fields) {
        try {
            await client.request(createField('ai_prompts', field))
            console.log(`  Field '${field.field}' created`)
        } catch (err) {
            if (err.errors?.[0]?.extensions?.code === 'INVALID_PAYLOAD') {
                console.log(`  Field '${field.field}' already exists, skipping`)
            } else {
                throw err
            }
        }
    }
}

async function seedAiPrompts() {
    console.log('\nSeeding AI prompts...')

    const existing = await client.request(readItems('ai_prompts', { fields: ['key'] }))
    const existingKeys = new Set(existing.map((p) => p.key))

    for (const prompt of AI_PROMPTS) {
        if (existingKeys.has(prompt.key)) {
            console.log(`  Prompt '${prompt.key}' already exists, skipping`)
            continue
        }

        await client.request(createItem('ai_prompts', prompt))
        console.log(`  Prompt '${prompt.key}' created`)
    }
}

async function main() {
    console.log('Setting up AI prompts collection\n')
    console.log(`Directus URL: ${DIRECTUS_URL}\n`)

    try {
        await createAiPromptsCollection()
        await seedAiPrompts()

        console.log('\nSetup complete!')
        console.log('\nNext steps:')
        console.log('1. Open Directus and review/customize the AI prompts in "AI Prompts"')
        console.log('2. Rebuild the Directus extensions: cd extensions/directus-extension-programmierbar-bundle && yarn build')
        console.log('\nNote: Changes to prompts take effect immediately - no rebuild required.')
    } catch (err) {
        console.error('Error during setup:', err)
        process.exit(1)
    }
}

main()
