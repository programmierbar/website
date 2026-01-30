#!/usr/bin/env node
/**
 * Sets up the O2M relation from podcasts to podcast_generated_content.
 * This allows viewing and editing generated content directly from the podcast edit page.
 *
 * Run with: node utils/setup-generated-content-relation.mjs
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

async function checkFieldExists(token, collection, field) {
    const response = await fetch(`${DIRECTUS_URL}/fields/${collection}/${field}`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    return response.ok
}

async function createGeneratedContentRelation(token) {
    // Check if the field already exists
    const exists = await checkFieldExists(token, 'podcasts', 'generated_content')
    if (exists) {
        console.log('Field "generated_content" already exists on podcasts collection')
        return
    }

    console.log('Creating O2M relation field "generated_content" on podcasts collection...')

    // Create the O2M field on podcasts
    const response = await fetch(`${DIRECTUS_URL}/fields/podcasts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            field: 'generated_content',
            type: 'alias',
            meta: {
                interface: 'list-o2m',
                special: ['o2m'],
                display: 'related-values',
                display_options: {
                    template: '{{content_type}} - {{status}}',
                },
                options: {
                    enableCreate: false,
                    enableSelect: false,
                    layout: 'table',
                    fields: ['content_type', 'status', 'generated_at', 'generated_text'],
                },
                width: 'full',
                group: null,
                hidden: false,
                note: 'AI-generated content for this podcast (shownotes, social posts)',
            },
        }),
    })

    if (!response.ok) {
        const error = await response.text()
        console.error('Failed to create field:', error)
        return
    }

    console.log('Field created successfully')

    // Now update the relation to link the two
    console.log('Updating relation...')

    const relationResponse = await fetch(`${DIRECTUS_URL}/relations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            collection: 'podcast_generated_content',
            field: 'podcast_id',
            related_collection: 'podcasts',
            meta: {
                one_field: 'generated_content',
                sort_field: null,
                one_deselect_action: 'nullify',
            },
        }),
    })

    if (!relationResponse.ok) {
        // Relation might already exist, try to update it instead
        const updateResponse = await fetch(
            `${DIRECTUS_URL}/relations/podcast_generated_content/podcast_id`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    meta: {
                        one_field: 'generated_content',
                    },
                }),
            }
        )

        if (updateResponse.ok) {
            console.log('Relation updated successfully')
        } else {
            const error = await updateResponse.text()
            console.error('Failed to update relation:', error)
        }
    } else {
        console.log('Relation created successfully')
    }
}

async function main() {
    console.log('=== Setting up Generated Content Relation ===')
    console.log(`Directus URL: ${DIRECTUS_URL}`)

    try {
        const token = await getAuthToken()
        console.log('Authenticated successfully\n')

        await createGeneratedContentRelation(token)

        console.log('\n=== Setup Complete ===')
        console.log('You can now see generated content in the podcast edit page in Directus.')
    } catch (error) {
        console.error('Setup failed:', error.message)
        process.exit(1)
    }
}

main()
