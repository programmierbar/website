#!/usr/bin/env node

/**
 * Setup script for asset generation pipeline.
 *
 * This script creates:
 * 1. `asset_templates` collection - stores template images and AI prompts for asset generation
 * 2. `podcast_generated_assets` collection - stores generated assets with status tracking
 *
 * Run with: node utils/setup-asset-templates.mjs
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

// Asset type definitions
const ASSET_TYPES = [
    { text: 'Episode Cover', value: 'episode_cover' },
    { text: 'Speaker Portrait', value: 'speaker_portrait' },
    { text: 'Heise Banner', value: 'heise_banner' },
    { text: 'LinkedIn Image', value: 'social_linkedin' },
    { text: 'Instagram Image', value: 'social_instagram' },
]

// Episode type definitions (matches podcast.type)
const EPISODE_TYPES = [
    { text: 'Deep Dive', value: 'deep_dive' },
    { text: 'CTO Special', value: 'cto_special' },
    { text: 'News', value: 'news' },
    { text: 'Other', value: 'other' },
    { text: 'All Types', value: null },
]

// Default templates with prompts
const DEFAULT_TEMPLATES = [
    {
        name: 'Episode Cover - Deep Dive',
        asset_type: 'episode_cover',
        episode_type: 'deep_dive',
        active: true,
        requires_speaker_image: true,
        prompt_template: `Use the existing template of our programmier.bar Podcast Cover for Deep Dive episodes.
Create a complete new version for the next episode with the attached speaker profile picture.

Text Info:
Deep Dive {{number}}

{{title}}
mit {{speaker_name}}

Requirements:
- Keep the Deep Dive visual style (green accent color)
- Place the speaker image prominently
- Use clean, modern typography
- Ensure text is readable
- Output as 1400x1400 PNG`,
        variables_schema: JSON.stringify([
            { name: 'number', description: 'Episode number', source: 'podcast.number' },
            { name: 'title', description: 'Episode title/topic', source: 'podcast.title' },
            { name: 'speaker_name', description: 'Full name of the speaker', source: 'speaker.full_name' },
            { name: 'speaker_image', description: 'Speaker profile image file', source: 'speaker.profile_image', type: 'image' },
        ]),
    },
    {
        name: 'Episode Cover - News',
        asset_type: 'episode_cover',
        episode_type: 'news',
        active: true,
        requires_speaker_image: false,
        prompt_template: `Use the existing template of our programmier.bar Podcast Cover for News episodes.
Create a complete new version for the next episode.

Text Info:
News {{number}}

{{title}}

Requirements:
- Keep the News visual style (pink accent color)
- Use clean, modern typography
- No speaker image needed
- Ensure text is readable
- Output as 1400x1400 PNG`,
        variables_schema: JSON.stringify([
            { name: 'number', description: 'Episode number', source: 'podcast.number' },
            { name: 'title', description: 'Episode title/topic', source: 'podcast.title' },
        ]),
    },
    {
        name: 'Speaker Portrait',
        asset_type: 'speaker_portrait',
        episode_type: null,
        active: true,
        requires_speaker_image: true,
        prompt_template: `Create a professional portrait image for our podcast website.

Speaker: {{speaker_name}}
Role: {{speaker_occupation}}

Using the attached profile picture:
- Remove or replace the background with our brand colors
- Apply subtle color grading to match our brand style
- Crop to a consistent aspect ratio (1:1 or 3:4)
- Ensure the face is well-lit and the image looks professional
- Output as 800x800 PNG with transparent or brand-colored background`,
        variables_schema: JSON.stringify([
            { name: 'speaker_name', description: 'Full name of the speaker', source: 'speaker.full_name' },
            { name: 'speaker_occupation', description: 'Speaker job title/role', source: 'speaker.occupation' },
            { name: 'speaker_image', description: 'Speaker profile image file', source: 'speaker.profile_image', type: 'image' },
        ]),
    },
    {
        name: 'Heise Banner',
        asset_type: 'heise_banner',
        episode_type: 'deep_dive',
        active: true,
        requires_speaker_image: true,
        prompt_template: `Create a banner image for Heise.de article about our podcast episode.

Episode: Deep Dive {{number}} - {{title}}
Speaker: {{speaker_name}}

Using the attached profile picture and template:
- Create a wide banner format (1200x630 or 16:9)
- Include the programmier.bar logo
- Show the speaker image
- Include episode title text
- Use professional, tech-media appropriate styling
- Output as PNG`,
        variables_schema: JSON.stringify([
            { name: 'number', description: 'Episode number', source: 'podcast.number' },
            { name: 'title', description: 'Episode title/topic', source: 'podcast.title' },
            { name: 'speaker_name', description: 'Full name of the speaker', source: 'speaker.full_name' },
            { name: 'speaker_image', description: 'Speaker profile image file', source: 'speaker.profile_image', type: 'image' },
        ]),
    },
    {
        name: 'LinkedIn Post Image',
        asset_type: 'social_linkedin',
        episode_type: null,
        active: true,
        requires_speaker_image: true,
        prompt_template: `Create a professional LinkedIn post image for our podcast episode.

Episode: {{episode_type_display}} {{number}} - {{title}}
Speaker: {{speaker_name}}

Using the attached profile picture and template:
- Create a LinkedIn-optimized format (1200x627)
- Include programmier.bar branding
- Show the speaker image if available
- Display episode info clearly
- Professional, clean design
- Output as PNG`,
        variables_schema: JSON.stringify([
            { name: 'episode_type_display', description: 'Episode type display name', source: 'podcast.type_display' },
            { name: 'number', description: 'Episode number', source: 'podcast.number' },
            { name: 'title', description: 'Episode title/topic', source: 'podcast.title' },
            { name: 'speaker_name', description: 'Full name of the speaker', source: 'speaker.full_name' },
            { name: 'speaker_image', description: 'Speaker profile image file', source: 'speaker.profile_image', type: 'image' },
        ]),
    },
    {
        name: 'Instagram Post Image',
        asset_type: 'social_instagram',
        episode_type: null,
        active: true,
        requires_speaker_image: true,
        prompt_template: `Create an engaging Instagram post image for our podcast episode.

Episode: {{episode_type_display}} {{number}} - {{title}}
Speaker: {{speaker_name}}

Using the attached profile picture and template:
- Create a square format (1080x1080)
- Include programmier.bar branding
- Show the speaker image prominently
- Use bold, attention-grabbing design
- Include episode title
- Vibrant colors matching our brand
- Output as PNG`,
        variables_schema: JSON.stringify([
            { name: 'episode_type_display', description: 'Episode type display name', source: 'podcast.type_display' },
            { name: 'number', description: 'Episode number', source: 'podcast.number' },
            { name: 'title', description: 'Episode title/topic', source: 'podcast.title' },
            { name: 'speaker_name', description: 'Full name of the speaker', source: 'speaker.full_name' },
            { name: 'speaker_image', description: 'Speaker profile image file', source: 'speaker.profile_image', type: 'image' },
        ]),
    },
]

async function createAssetTemplatesCollection() {
    console.log('Creating asset_templates collection...')

    try {
        await client.request(
            createCollection({
                collection: 'asset_templates',
                meta: {
                    collection: 'asset_templates',
                    icon: 'image',
                    note: 'Templates for AI-powered asset generation (covers, portraits, social images)',
                    display_template: '{{name}} ({{asset_type}})',
                    archive_field: null,
                    archive_value: null,
                    unarchive_value: null,
                    singleton: false,
                    sort_field: 'sort',
                },
                schema: {
                    name: 'asset_templates',
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
            field: 'name',
            type: 'string',
            meta: {
                interface: 'input',
                width: 'full',
                required: true,
                note: 'Descriptive name for this template',
            },
            schema: { is_nullable: false },
        },
        {
            field: 'asset_type',
            type: 'string',
            meta: {
                interface: 'select-dropdown',
                width: 'half',
                required: true,
                note: 'Type of asset this template generates',
                options: { choices: ASSET_TYPES },
            },
            schema: { is_nullable: false },
        },
        {
            field: 'episode_type',
            type: 'string',
            meta: {
                interface: 'select-dropdown',
                width: 'half',
                required: false,
                note: 'Specific episode type this template is for (null = all types)',
                options: { choices: EPISODE_TYPES, allowNone: true },
            },
            schema: { is_nullable: true },
        },
        {
            field: 'active',
            type: 'boolean',
            meta: {
                interface: 'boolean',
                display: 'boolean',
                width: 'half',
                required: true,
                note: 'Whether this template is currently active and should be used',
                options: { label: 'Active' },
                special: ['cast-boolean'],
            },
            schema: { is_nullable: false, default_value: true },
        },
        {
            field: 'requires_speaker_image',
            type: 'boolean',
            meta: {
                interface: 'boolean',
                display: 'boolean',
                width: 'half',
                required: true,
                note: 'Whether this template requires a speaker profile image',
                options: { label: 'Requires Speaker Image' },
                special: ['cast-boolean'],
            },
            schema: { is_nullable: false, default_value: false },
        },
        {
            field: 'template_image',
            type: 'uuid',
            meta: {
                interface: 'file-image',
                width: 'full',
                required: false,
                note: 'Base template image to be modified by AI. Upload your design template here.',
                special: ['file'],
            },
            schema: { is_nullable: true, foreign_key_table: 'directus_files', foreign_key_column: 'id' },
        },
        {
            field: 'prompt_template',
            type: 'text',
            meta: {
                interface: 'input-code',
                width: 'full',
                required: true,
                note: 'AI prompt template with {{variables}}. Used to instruct the AI how to generate the asset.',
                options: { language: 'text', lineNumber: true },
            },
            schema: { is_nullable: false },
        },
        {
            field: 'variables_schema',
            type: 'json',
            meta: {
                interface: 'input-code',
                width: 'full',
                required: false,
                note: 'JSON array documenting available template variables: [{"name": "var", "description": "...", "source": "podcast.field"}]',
                options: { language: 'json', lineNumber: true },
            },
            schema: {},
        },
        {
            field: 'generation_model',
            type: 'string',
            meta: {
                interface: 'input',
                width: 'half',
                required: false,
                note: 'AI model to use (default: from environment). E.g., gemini-2.0-flash-exp, imagen-3',
                options: { placeholder: 'Use default model' },
            },
            schema: { is_nullable: true },
        },
        {
            field: 'output_format',
            type: 'string',
            meta: {
                interface: 'select-dropdown',
                width: 'half',
                required: false,
                note: 'Output image format',
                options: {
                    choices: [
                        { text: 'PNG', value: 'png' },
                        { text: 'JPEG', value: 'jpeg' },
                        { text: 'WebP', value: 'webp' },
                    ],
                },
            },
            schema: { is_nullable: true, default_value: 'png' },
        },
        {
            field: 'date_created',
            type: 'timestamp',
            meta: {
                hidden: true,
                interface: 'datetime',
                special: ['date-created'],
                width: 'half',
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
    ]

    for (const field of fields) {
        try {
            await client.request(createField('asset_templates', field))
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

async function createGeneratedAssetsCollection() {
    console.log('\nCreating podcast_generated_assets collection...')

    try {
        await client.request(
            createCollection({
                collection: 'podcast_generated_assets',
                meta: {
                    collection: 'podcast_generated_assets',
                    icon: 'photo_library',
                    note: 'AI-generated assets for podcast episodes',
                    display_template: '{{asset_type}} - {{status}}',
                    archive_field: null,
                    archive_value: null,
                    unarchive_value: null,
                    singleton: false,
                    sort_field: null,
                },
                schema: {
                    name: 'podcast_generated_assets',
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

    const assetStatusChoices = [
        { text: 'Pending', value: 'pending' },
        { text: 'Generating', value: 'generating' },
        { text: 'Generated', value: 'generated' },
        { text: 'Failed', value: 'failed' },
        { text: 'Approved', value: 'approved' },
    ]

    const fields = [
        {
            field: 'id',
            type: 'integer',
            meta: { hidden: true, interface: 'input', readonly: true },
            schema: { is_primary_key: true, has_auto_increment: true },
        },
        {
            field: 'podcast_id',
            type: 'integer',
            meta: {
                interface: 'select-dropdown-m2o',
                width: 'half',
                required: true,
                note: 'The podcast this asset belongs to',
                options: { template: '{{title}}' },
            },
            schema: { is_nullable: false, foreign_key_table: 'podcasts', foreign_key_column: 'id' },
        },
        {
            field: 'template_id',
            type: 'integer',
            meta: {
                interface: 'select-dropdown-m2o',
                width: 'half',
                required: false,
                note: 'The template used to generate this asset',
                options: { template: '{{name}}' },
            },
            schema: { is_nullable: true, foreign_key_table: 'asset_templates', foreign_key_column: 'id' },
        },
        {
            field: 'asset_type',
            type: 'string',
            meta: {
                interface: 'select-dropdown',
                width: 'half',
                required: true,
                note: 'Type of asset',
                options: { choices: ASSET_TYPES },
            },
            schema: { is_nullable: false },
        },
        {
            field: 'status',
            type: 'string',
            meta: {
                interface: 'select-dropdown',
                width: 'half',
                required: true,
                note: 'Generation status',
                options: { choices: assetStatusChoices },
            },
            schema: { is_nullable: false, default_value: 'pending' },
        },
        {
            field: 'generated_file',
            type: 'uuid',
            meta: {
                interface: 'file-image',
                width: 'full',
                required: false,
                note: 'The generated asset file',
                special: ['file'],
            },
            schema: { is_nullable: true, foreign_key_table: 'directus_files', foreign_key_column: 'id' },
        },
        {
            field: 'generation_prompt',
            type: 'text',
            meta: {
                interface: 'input-code',
                width: 'full',
                required: false,
                note: 'The actual prompt sent to the AI (for debugging)',
                options: { language: 'text', lineNumber: true },
            },
            schema: {},
        },
        {
            field: 'error_message',
            type: 'text',
            meta: {
                interface: 'input-multiline',
                width: 'full',
                required: false,
                note: 'Error message if generation failed',
            },
            schema: {},
        },
        {
            field: 'generation_model',
            type: 'string',
            meta: {
                interface: 'input',
                width: 'half',
                required: false,
                readonly: true,
                note: 'AI model used for generation',
            },
            schema: {},
        },
        {
            field: 'generated_at',
            type: 'timestamp',
            meta: {
                interface: 'datetime',
                width: 'half',
                required: false,
                readonly: true,
                note: 'When the asset was generated',
            },
            schema: {},
        },
        {
            field: 'date_created',
            type: 'timestamp',
            meta: {
                hidden: true,
                interface: 'datetime',
                special: ['date-created'],
                width: 'half',
            },
            schema: {},
        },
    ]

    for (const field of fields) {
        try {
            await client.request(createField('podcast_generated_assets', field))
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

async function addPodcastAssetFields() {
    console.log('\nAdding asset-related fields to podcasts collection...')

    const fields = [
        {
            field: 'regenerate_assets',
            type: 'boolean',
            meta: {
                interface: 'boolean',
                width: 'half',
                required: false,
                note: 'Set to true to trigger asset regeneration',
                options: { label: 'Regenerate Assets' },
            },
            schema: { is_nullable: true, default_value: false },
        },
        {
            field: 'assets_status',
            type: 'string',
            meta: {
                interface: 'select-dropdown',
                width: 'half',
                required: false,
                readonly: true,
                note: 'Current status of asset generation',
                options: {
                    choices: [
                        { text: 'Not Started', value: 'not_started' },
                        { text: 'Generating', value: 'generating' },
                        { text: 'Complete', value: 'complete' },
                        { text: 'Partial', value: 'partial' },
                        { text: 'Failed', value: 'failed' },
                    ],
                },
            },
            schema: { is_nullable: true, default_value: 'not_started' },
        },
    ]

    for (const field of fields) {
        try {
            await client.request(createField('podcasts', field))
            console.log(`  Field '${field.field}' created on podcasts`)
        } catch (err) {
            if (err.errors?.[0]?.extensions?.code === 'INVALID_PAYLOAD') {
                console.log(`  Field '${field.field}' already exists on podcasts, skipping`)
            } else {
                throw err
            }
        }
    }
}

async function seedDefaultTemplates() {
    console.log('\nSeeding default asset templates...')

    const existing = await client.request(readItems('asset_templates', { fields: ['name'] }))
    const existingNames = new Set(existing.map((t) => t.name))

    for (const template of DEFAULT_TEMPLATES) {
        if (existingNames.has(template.name)) {
            console.log(`  Template '${template.name}' already exists, skipping`)
            continue
        }

        await client.request(createItem('asset_templates', template))
        console.log(`  Template '${template.name}' created`)
    }
}

async function main() {
    console.log('Setting up Asset Generation Pipeline\n')
    console.log(`Directus URL: ${DIRECTUS_URL}\n`)

    try {
        await createAssetTemplatesCollection()
        await createGeneratedAssetsCollection()
        await addPodcastAssetFields()
        await seedDefaultTemplates()

        console.log('\n' + '='.repeat(60))
        console.log('Setup complete!')
        console.log('='.repeat(60))
        console.log('\nNext steps:')
        console.log('1. Upload template images to the asset_templates collection')
        console.log('2. Customize the prompts in the asset_templates collection')
        console.log('3. Configure GEMINI_API_KEY in your .env file')
        console.log('4. Rebuild extensions: cd extensions/directus-extension-programmierbar-bundle && yarn build')
        console.log('\nThe asset generation hook will trigger when:')
        console.log('- A speaker\'s portal_submission_status changes to "approved"')
        console.log('- Or when regenerate_assets is set to true on a podcast')
    } catch (err) {
        console.error('Error during setup:', err)
        process.exit(1)
    }
}

main()
