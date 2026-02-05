#!/usr/bin/env node

/**
 * Fix script for asset template boolean fields.
 *
 * This script updates the active and requires_speaker_image fields
 * to have the correct 'special: ["cast-boolean"]' configuration.
 *
 * Run with: node utils/fix-asset-boolean-fields.mjs
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

async function fixBooleanFields() {
    console.log('Fixing boolean field configurations...\n')

    // Fix 'active' field
    console.log('Fixing asset_templates.active...')
    try {
        await client.request(
            updateField('asset_templates', 'active', {
                meta: {
                    interface: 'boolean',
                    display: 'boolean',
                    width: 'half',
                    required: true,
                    note: 'Whether this template is currently active and should be used',
                    options: { label: 'Active' },
                    special: ['cast-boolean'],
                },
            })
        )
        console.log('  Updated active field')
    } catch (err) {
        console.error('  Error updating active field:', err.message)
    }

    // Fix 'requires_speaker_image' field
    console.log('Fixing asset_templates.requires_speaker_image...')
    try {
        await client.request(
            updateField('asset_templates', 'requires_speaker_image', {
                meta: {
                    interface: 'boolean',
                    display: 'boolean',
                    width: 'half',
                    required: true,
                    note: 'Whether this template requires a speaker profile image',
                    options: { label: 'Requires Speaker Image' },
                    special: ['cast-boolean'],
                },
            })
        )
        console.log('  Updated requires_speaker_image field')
    } catch (err) {
        console.error('  Error updating requires_speaker_image field:', err.message)
    }

    console.log('\nDone! Boolean fields should now display correctly.')
    console.log('Please refresh your Directus admin page.')
}

fixBooleanFields().catch((err) => {
    console.error('Error:', err)
    process.exit(1)
})
