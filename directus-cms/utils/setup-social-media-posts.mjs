#!/usr/bin/env node
/**
 * Sets up the social_media_posts collection for scheduling and tracking social media posts.
 *
 * Run with: node utils/setup-social-media-posts.mjs
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@programmier.bar'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456'

async function getAuthToken() {
    const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    })

    if (!response.ok) {
        throw new Error(`Failed to authenticate: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.data.access_token
}

async function checkCollectionExists(token, collection) {
    const response = await fetch(`${DIRECTUS_URL}/collections/${collection}`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    return response.ok
}

async function createSocialMediaPostsCollection(token) {
    // Check if collection already exists
    const exists = await checkCollectionExists(token, 'social_media_posts')
    if (exists) {
        console.log('Collection "social_media_posts" already exists')
        return
    }

    console.log('Creating social_media_posts collection...')

    // Create the collection
    const collectionResponse = await fetch(`${DIRECTUS_URL}/collections`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            collection: 'social_media_posts',
            meta: {
                collection: 'social_media_posts',
                icon: 'share',
                note: 'Scheduled social media posts for podcast episodes',
                display_template: '{{platform}} - {{status}}',
                hidden: false,
                singleton: false,
                archive_field: 'status',
                archive_value: 'archived',
                sort_field: 'scheduled_for',
            },
            schema: {
                name: 'social_media_posts',
            },
            fields: [
                {
                    field: 'id',
                    type: 'integer',
                    meta: {
                        hidden: true,
                        readonly: true,
                        interface: 'input',
                        special: null,
                    },
                    schema: {
                        is_primary_key: true,
                        has_auto_increment: true,
                    },
                },
            ],
        }),
    })

    if (!collectionResponse.ok) {
        const error = await collectionResponse.text()
        throw new Error(`Failed to create collection: ${error}`)
    }

    console.log('Collection created successfully')

    // Add fields
    const fields = [
        {
            field: 'podcast_id',
            type: 'integer',
            meta: {
                interface: 'select-dropdown-m2o',
                special: ['m2o'],
                display: 'related-values',
                display_options: { template: '{{title}}' },
                note: 'The podcast episode this post is for',
                width: 'half',
            },
            schema: {},
        },
        {
            field: 'generated_content_id',
            type: 'integer',
            meta: {
                interface: 'select-dropdown-m2o',
                special: ['m2o'],
                display: 'related-values',
                display_options: { template: '{{content_type}}' },
                note: 'Link to the AI-generated content',
                width: 'half',
            },
            schema: {},
        },
        {
            field: 'platform',
            type: 'string',
            meta: {
                interface: 'select-dropdown',
                display: 'labels',
                display_options: {
                    choices: [
                        { text: 'LinkedIn', value: 'linkedin', foreground: '#FFFFFF', background: '#0A66C2' },
                        { text: 'Instagram', value: 'instagram', foreground: '#FFFFFF', background: '#E4405F' },
                        { text: 'Bluesky', value: 'bluesky', foreground: '#FFFFFF', background: '#0085FF' },
                        { text: 'Mastodon', value: 'mastodon', foreground: '#FFFFFF', background: '#6364FF' },
                    ],
                },
                options: {
                    choices: [
                        { text: 'LinkedIn', value: 'linkedin' },
                        { text: 'Instagram', value: 'instagram' },
                        { text: 'Bluesky', value: 'bluesky' },
                        { text: 'Mastodon', value: 'mastodon' },
                    ],
                },
                width: 'half',
                required: true,
            },
            schema: {
                is_nullable: false,
            },
        },
        {
            field: 'status',
            type: 'string',
            meta: {
                interface: 'select-dropdown',
                display: 'labels',
                display_options: {
                    choices: [
                        { text: 'Draft', value: 'draft', foreground: '#FFFFFF', background: '#6B7280' },
                        { text: 'Scheduled', value: 'scheduled', foreground: '#000000', background: '#FCD34D' },
                        { text: 'Publishing', value: 'publishing', foreground: '#FFFFFF', background: '#3B82F6' },
                        { text: 'Published', value: 'published', foreground: '#FFFFFF', background: '#10B981' },
                        { text: 'Failed', value: 'failed', foreground: '#FFFFFF', background: '#EF4444' },
                    ],
                },
                options: {
                    choices: [
                        { text: 'Draft', value: 'draft' },
                        { text: 'Scheduled', value: 'scheduled' },
                        { text: 'Publishing', value: 'publishing' },
                        { text: 'Published', value: 'published' },
                        { text: 'Failed', value: 'failed' },
                    ],
                },
                width: 'half',
                default_value: 'draft',
            },
            schema: {
                default_value: 'draft',
            },
        },
        {
            field: 'post_text',
            type: 'text',
            meta: {
                interface: 'input-multiline',
                display: 'formatted-value',
                note: 'The text content of the post',
                width: 'full',
            },
            schema: {},
        },
        {
            field: 'scheduled_for',
            type: 'timestamp',
            meta: {
                interface: 'datetime',
                display: 'datetime',
                note: 'When to publish the post',
                width: 'half',
            },
            schema: {},
        },
        {
            field: 'published_at',
            type: 'timestamp',
            meta: {
                interface: 'datetime',
                display: 'datetime',
                note: 'When the post was actually published',
                width: 'half',
                readonly: true,
            },
            schema: {},
        },
        {
            field: 'platform_post_id',
            type: 'string',
            meta: {
                interface: 'input',
                note: 'ID returned by the platform after publishing',
                width: 'half',
                readonly: true,
            },
            schema: {},
        },
        {
            field: 'platform_post_url',
            type: 'string',
            meta: {
                interface: 'input',
                display: 'formatted-value',
                display_options: { format: true },
                note: 'URL to the published post',
                width: 'half',
                readonly: true,
            },
            schema: {},
        },
        {
            field: 'error_message',
            type: 'text',
            meta: {
                interface: 'input-multiline',
                note: 'Error message if publishing failed',
                width: 'full',
                hidden: false,
                readonly: true,
            },
            schema: {},
        },
        {
            field: 'tags',
            type: 'json',
            meta: {
                interface: 'input-code',
                options: { language: 'json' },
                note: 'People/companies to tag (platform-specific identifiers)',
                width: 'full',
            },
            schema: {},
        },
        {
            field: 'date_created',
            type: 'timestamp',
            meta: {
                interface: 'datetime',
                display: 'datetime',
                readonly: true,
                hidden: true,
                special: ['date-created'],
            },
            schema: {},
        },
        {
            field: 'date_updated',
            type: 'timestamp',
            meta: {
                interface: 'datetime',
                display: 'datetime',
                readonly: true,
                hidden: true,
                special: ['date-updated'],
            },
            schema: {},
        },
    ]

    for (const field of fields) {
        console.log(`Creating field: ${field.field}`)
        const fieldResponse = await fetch(`${DIRECTUS_URL}/fields/social_media_posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(field),
        })

        if (!fieldResponse.ok) {
            const error = await fieldResponse.text()
            console.warn(`Warning: Failed to create field ${field.field}: ${error}`)
        }
    }

    console.log('Fields created successfully')
}

async function createRelations(token) {
    console.log('\nSetting up relations...')

    // Relation to podcasts
    const podcastRelation = await fetch(`${DIRECTUS_URL}/relations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            collection: 'social_media_posts',
            field: 'podcast_id',
            related_collection: 'podcasts',
            meta: {
                one_field: 'social_media_posts',
                sort_field: null,
                one_deselect_action: 'nullify',
            },
        }),
    })

    if (podcastRelation.ok) {
        console.log('Podcast relation created')
    } else {
        console.warn('Podcast relation may already exist or failed')
    }

    // Relation to podcast_generated_content
    const contentRelation = await fetch(`${DIRECTUS_URL}/relations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            collection: 'social_media_posts',
            field: 'generated_content_id',
            related_collection: 'podcast_generated_content',
            meta: {
                sort_field: null,
                one_deselect_action: 'nullify',
            },
        }),
    })

    if (contentRelation.ok) {
        console.log('Generated content relation created')
    } else {
        console.warn('Generated content relation may already exist or failed')
    }
}

async function addO2MFieldToPodcasts(token) {
    console.log('\nAdding social_media_posts field to podcasts collection...')

    const response = await fetch(`${DIRECTUS_URL}/fields/podcasts/social_media_posts`, {
        headers: { Authorization: `Bearer ${token}` },
    })

    if (response.ok) {
        console.log('Field already exists on podcasts')
        return
    }

    const fieldResponse = await fetch(`${DIRECTUS_URL}/fields/podcasts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            field: 'social_media_posts',
            type: 'alias',
            meta: {
                interface: 'list-o2m',
                special: ['o2m'],
                display: 'related-values',
                display_options: {
                    template: '{{platform}} - {{status}}',
                },
                options: {
                    enableCreate: true,
                    enableSelect: false,
                    layout: 'table',
                    fields: ['platform', 'status', 'scheduled_for', 'post_text'],
                },
                width: 'full',
                note: 'Social media posts scheduled for this episode',
            },
        }),
    })

    if (fieldResponse.ok) {
        console.log('O2M field added to podcasts')
    } else {
        const error = await fieldResponse.text()
        console.warn('Failed to add O2M field:', error)
    }
}

async function main() {
    console.log('=== Setting up Social Media Posts Collection ===')
    console.log(`Directus URL: ${DIRECTUS_URL}\n`)

    try {
        const token = await getAuthToken()
        console.log('Authenticated successfully\n')

        await createSocialMediaPostsCollection(token)
        await createRelations(token)
        await addO2MFieldToPodcasts(token)

        console.log('\n=== Setup Complete ===')
        console.log('The social_media_posts collection is ready.')
        console.log('You can now schedule and track social media posts for podcast episodes.')
    } catch (error) {
        console.error('Setup failed:', error.message)
        process.exit(1)
    }
}

main()
