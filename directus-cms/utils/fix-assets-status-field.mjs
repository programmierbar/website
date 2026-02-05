#!/usr/bin/env node

/**
 * Fix script for assets_status field on podcasts.
 *
 * Run with: node utils/fix-assets-status-field.mjs
 */

import { createDirectus, rest, staticToken, updateField } from '@directus/sdk'
import 'dotenv/config'

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
const DIRECTUS_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN

if (!DIRECTUS_TOKEN) {
    console.error('Error: DIRECTUS_ADMIN_TOKEN environment variable is required')
    process.exit(1)
}

const client = createDirectus(DIRECTUS_URL).with(rest()).with(staticToken(DIRECTUS_TOKEN))

async function fixAssetsStatusField() {
    console.log('Updating assets_status field on podcasts...\n')

    try {
        await client.request(
            updateField('podcasts', 'assets_status', {
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
            })
        )
        console.log('  Updated assets_status field')
        console.log('\nDone!')
    } catch (err) {
        console.error('Error updating field:', err.message)
        process.exit(1)
    }
}

fixAssetsStatusField()
