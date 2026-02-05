#!/usr/bin/env node

/**
 * Fix script for asset template file fields.
 *
 * This script updates the template_image and generated_file fields
 * to have the correct 'special: ["file"]' configuration AND creates
 * the necessary relations to directus_files.
 *
 * Run with: node utils/fix-asset-file-fields.mjs
 */

import { createDirectus, rest, staticToken, updateField, createRelation, readRelations } from '@directus/sdk'
import 'dotenv/config'

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
const DIRECTUS_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN

if (!DIRECTUS_TOKEN) {
    console.error('Error: DIRECTUS_ADMIN_TOKEN environment variable is required')
    process.exit(1)
}

const client = createDirectus(DIRECTUS_URL).with(rest()).with(staticToken(DIRECTUS_TOKEN))

async function createFileRelation(collection, field) {
    const relationData = {
        collection: collection,
        field: field,
        related_collection: 'directus_files',
        meta: {
            junction_field: null,
            many_collection: collection,
            many_field: field,
            one_allowed_collections: null,
            one_collection: 'directus_files',
            one_collection_field: null,
            one_deselect_action: 'nullify',
            one_field: null,
            sort_field: null,
        },
        schema: {
            table: collection,
            column: field,
            foreign_key_table: 'directus_files',
            foreign_key_column: 'id',
            on_update: 'NO ACTION',
            on_delete: 'SET NULL',
            constraint_name: null,
        },
    }

    try {
        await client.request(createRelation(relationData))
        console.log(`  Created relation ${collection}.${field} -> directus_files`)
        return true
    } catch (err) {
        if (err.errors?.[0]?.extensions?.code === 'RECORD_NOT_UNIQUE' || err.message?.includes('already exists')) {
            console.log(`  Relation ${collection}.${field} already exists`)
            return true
        }
        console.error(`  Error creating relation ${collection}.${field}:`, err.message)
        return false
    }
}

async function fixFileFields() {
    console.log('Fixing file field configurations...\n')

    // Check existing relations
    let existingRelations = []
    try {
        existingRelations = await client.request(readRelations())
    } catch (err) {
        console.log('Could not read existing relations, will try to create them anyway')
    }

    const hasRelation = (collection, field) =>
        existingRelations.some((r) => r.collection === collection && r.field === field)

    // Fix template_image in asset_templates
    console.log('Fixing asset_templates.template_image...')
    try {
        await client.request(
            updateField('asset_templates', 'template_image', {
                meta: {
                    interface: 'file-image',
                    width: 'full',
                    required: false,
                    note: 'Base template image to be modified by AI. Upload your design template here.',
                    special: ['file'],
                },
            })
        )
        console.log('  Updated field meta')
    } catch (err) {
        console.error('  Error updating field:', err.message)
    }

    if (!hasRelation('asset_templates', 'template_image')) {
        await createFileRelation('asset_templates', 'template_image')
    } else {
        console.log('  Relation already exists')
    }

    // Fix generated_file in podcast_generated_assets
    console.log('\nFixing podcast_generated_assets.generated_file...')
    try {
        await client.request(
            updateField('podcast_generated_assets', 'generated_file', {
                meta: {
                    interface: 'file-image',
                    width: 'full',
                    required: false,
                    note: 'The generated asset file',
                    special: ['file'],
                },
            })
        )
        console.log('  Updated field meta')
    } catch (err) {
        console.error('  Error updating field:', err.message)
    }

    if (!hasRelation('podcast_generated_assets', 'generated_file')) {
        await createFileRelation('podcast_generated_assets', 'generated_file')
    } else {
        console.log('  Relation already exists')
    }

    console.log('\nDone! File fields should now work correctly.')
    console.log('Please refresh your Directus admin page.')
}

fixFileFields().catch((err) => {
    console.error('Error:', err)
    process.exit(1)
})
