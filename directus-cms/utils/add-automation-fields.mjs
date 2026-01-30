#!/usr/bin/env node
/**
 * Migration script to add podcast automation fields to the Directus schema.
 *
 * This script adds:
 * - Planning fields to podcasts collection (Phase 1.1)
 * - Speaker portal fields (Phase 1.4)
 * - podcast_generated_content collection (Phase 3.3)
 * - Heise fields to podcasts collection (Phase 7.1)
 *
 * Run with: node utils/add-automation-fields.mjs
 * After running, snapshot the schema: npm run snapshot-schema
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@programmier.bar';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';

async function getAuthToken() {
    const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });

    if (!response.ok) {
        throw new Error(`Failed to authenticate: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.data.access_token;
}

async function fieldExists(token, collection, field) {
    const response = await fetch(`${DIRECTUS_URL}/fields/${collection}/${field}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.ok;
}

async function createField(token, collection, field) {
    const exists = await fieldExists(token, collection, field.field);
    if (exists) {
        console.log(`  Field ${collection}.${field.field} already exists, skipping`);
        return;
    }

    const response = await fetch(`${DIRECTUS_URL}/fields/${collection}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(field)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create field ${collection}.${field.field}: ${error}`);
    }

    console.log(`  Created field ${collection}.${field.field}`);
}

async function collectionExists(token, collection) {
    const response = await fetch(`${DIRECTUS_URL}/collections/${collection}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.ok;
}

async function createCollection(token, collection) {
    const exists = await collectionExists(token, collection.collection);
    if (exists) {
        console.log(`  Collection ${collection.collection} already exists, skipping`);
        return;
    }

    const response = await fetch(`${DIRECTUS_URL}/collections`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(collection)
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create collection ${collection.collection}: ${error}`);
    }

    console.log(`  Created collection ${collection.collection}`);
}

async function addPodcastPlanningFields(token) {
    console.log('\n=== Adding Planning Fields to Podcasts (Phase 1.1) ===');

    // Recording date field
    await createField(token, 'podcasts', {
        field: 'recording_date',
        type: 'timestamp',
        meta: {
            interface: 'datetime',
            display: 'datetime',
            display_options: { relative: false },
            note: 'When the episode will be/was recorded',
            sort: 100,
            width: 'half'
        },
        schema: {
            is_nullable: true
        }
    });

    // Planned publish date field
    await createField(token, 'podcasts', {
        field: 'planned_publish_date',
        type: 'timestamp',
        meta: {
            interface: 'datetime',
            display: 'datetime',
            display_options: { relative: false },
            note: 'Target publication date',
            sort: 101,
            width: 'half'
        },
        schema: {
            is_nullable: true
        }
    });

    // Publishing status field
    await createField(token, 'podcasts', {
        field: 'publishing_status',
        type: 'string',
        meta: {
            interface: 'select-dropdown',
            display: 'labels',
            display_options: {
                showAsDot: true,
                choices: [
                    { value: 'planned', background: '#6B7280', foreground: '#FFFFFF' },
                    { value: 'recorded', background: '#3B82F6', foreground: '#FFFFFF' },
                    { value: 'transcribing', background: '#F59E0B', foreground: '#FFFFFF' },
                    { value: 'transcript_ready', background: '#8B5CF6', foreground: '#FFFFFF' },
                    { value: 'content_review', background: '#EC4899', foreground: '#FFFFFF' },
                    { value: 'approved', background: '#10B981', foreground: '#FFFFFF' },
                    { value: 'published', background: '#00C897', foreground: '#FFFFFF' }
                ]
            },
            options: {
                choices: [
                    { text: 'Planned', value: 'planned' },
                    { text: 'Recorded', value: 'recorded' },
                    { text: 'Transcribing', value: 'transcribing' },
                    { text: 'Transcript Ready', value: 'transcript_ready' },
                    { text: 'Content Review', value: 'content_review' },
                    { text: 'Approved', value: 'approved' },
                    { text: 'Published', value: 'published' }
                ]
            },
            note: 'Workflow status for the publishing pipeline',
            sort: 102,
            width: 'half'
        },
        schema: {
            default_value: 'planned',
            is_nullable: true
        }
    });
}

async function addSpeakerPortalFields(token) {
    console.log('\n=== Adding Speaker Portal Fields (Phase 1.4) ===');

    // Portal token
    await createField(token, 'speakers', {
        field: 'portal_token',
        type: 'string',
        meta: {
            interface: 'input',
            display: 'raw',
            note: 'Unique token for self-service portal access',
            sort: 100,
            width: 'half',
            hidden: true
        },
        schema: {
            is_nullable: true,
            is_unique: true
        }
    });

    // Portal token expires
    await createField(token, 'speakers', {
        field: 'portal_token_expires',
        type: 'timestamp',
        meta: {
            interface: 'datetime',
            display: 'datetime',
            display_options: { relative: true },
            note: 'Token expiration date',
            sort: 101,
            width: 'half',
            hidden: true
        },
        schema: {
            is_nullable: true
        }
    });

    // Portal submission status
    await createField(token, 'speakers', {
        field: 'portal_submission_status',
        type: 'string',
        meta: {
            interface: 'select-dropdown',
            display: 'labels',
            display_options: {
                showAsDot: true,
                choices: [
                    { value: 'pending', background: '#F59E0B', foreground: '#FFFFFF' },
                    { value: 'submitted', background: '#3B82F6', foreground: '#FFFFFF' },
                    { value: 'approved', background: '#10B981', foreground: '#FFFFFF' }
                ]
            },
            options: {
                choices: [
                    { text: 'Pending', value: 'pending' },
                    { text: 'Submitted', value: 'submitted' },
                    { text: 'Approved', value: 'approved' }
                ]
            },
            note: 'Speaker portal submission status',
            sort: 102,
            width: 'half'
        },
        schema: {
            is_nullable: true
        }
    });

    // Portal submission deadline
    await createField(token, 'speakers', {
        field: 'portal_submission_deadline',
        type: 'timestamp',
        meta: {
            interface: 'datetime',
            display: 'datetime',
            display_options: { relative: true },
            note: 'Deadline for speaker to submit info',
            sort: 103,
            width: 'half'
        },
        schema: {
            is_nullable: true
        }
    });
}

async function createPodcastGeneratedContentCollection(token) {
    console.log('\n=== Creating podcast_generated_content Collection (Phase 3.3) ===');

    // Create the collection
    await createCollection(token, {
        collection: 'podcast_generated_content',
        meta: {
            icon: 'auto_awesome',
            note: 'AI-generated content for podcast episodes',
            group: 'Podcasts',
            sort: 5,
            accountability: 'all',
            archive_field: 'status',
            archive_value: 'archived',
            unarchive_value: 'draft'
        },
        schema: {
            name: 'podcast_generated_content'
        }
    });

    // Add fields
    await createField(token, 'podcast_generated_content', {
        field: 'id',
        type: 'uuid',
        meta: {
            interface: 'input',
            readonly: true,
            hidden: true,
            special: ['uuid']
        },
        schema: {
            is_primary_key: true,
            is_nullable: false
        }
    });

    await createField(token, 'podcast_generated_content', {
        field: 'podcast_id',
        type: 'uuid',
        meta: {
            interface: 'select-dropdown-m2o',
            display: 'related-values',
            display_options: { template: '{{title}}' },
            note: 'Related podcast episode',
            sort: 1,
            width: 'half',
            special: ['m2o']
        },
        schema: {
            is_nullable: true,
            foreign_key_table: 'podcasts',
            foreign_key_column: 'id'
        }
    });

    await createField(token, 'podcast_generated_content', {
        field: 'content_type',
        type: 'string',
        meta: {
            interface: 'select-dropdown',
            display: 'labels',
            options: {
                choices: [
                    { text: 'Shownotes', value: 'shownotes' },
                    { text: 'LinkedIn', value: 'social_linkedin' },
                    { text: 'Instagram', value: 'social_instagram' },
                    { text: 'Bluesky', value: 'social_bluesky' },
                    { text: 'Mastodon', value: 'social_mastodon' },
                    { text: 'Heise Document', value: 'heise_document' }
                ]
            },
            note: 'Type of generated content',
            sort: 2,
            width: 'half'
        },
        schema: {
            is_nullable: false
        }
    });

    await createField(token, 'podcast_generated_content', {
        field: 'generated_text',
        type: 'text',
        meta: {
            interface: 'input-rich-text-md',
            display: 'formatted-value',
            note: 'AI-generated content',
            sort: 3,
            width: 'full'
        },
        schema: {
            is_nullable: true
        }
    });

    await createField(token, 'podcast_generated_content', {
        field: 'edited_text',
        type: 'text',
        meta: {
            interface: 'input-rich-text-md',
            display: 'formatted-value',
            note: 'Human-edited version (if modified)',
            sort: 4,
            width: 'full'
        },
        schema: {
            is_nullable: true
        }
    });

    await createField(token, 'podcast_generated_content', {
        field: 'status',
        type: 'string',
        meta: {
            interface: 'select-dropdown',
            display: 'labels',
            display_options: {
                showAsDot: true,
                choices: [
                    { value: 'generated', background: '#6B7280', foreground: '#FFFFFF' },
                    { value: 'approved', background: '#10B981', foreground: '#FFFFFF' },
                    { value: 'rejected', background: '#EF4444', foreground: '#FFFFFF' },
                    { value: 'published', background: '#00C897', foreground: '#FFFFFF' }
                ]
            },
            options: {
                choices: [
                    { text: 'Generated', value: 'generated' },
                    { text: 'Approved', value: 'approved' },
                    { text: 'Rejected', value: 'rejected' },
                    { text: 'Published', value: 'published' }
                ]
            },
            note: 'Content approval status',
            sort: 5,
            width: 'half'
        },
        schema: {
            default_value: 'generated',
            is_nullable: false
        }
    });

    await createField(token, 'podcast_generated_content', {
        field: 'generated_at',
        type: 'timestamp',
        meta: {
            interface: 'datetime',
            display: 'datetime',
            display_options: { relative: true },
            note: 'When content was generated',
            sort: 6,
            width: 'half',
            readonly: true
        },
        schema: {
            is_nullable: true
        }
    });

    await createField(token, 'podcast_generated_content', {
        field: 'approved_at',
        type: 'timestamp',
        meta: {
            interface: 'datetime',
            display: 'datetime',
            display_options: { relative: true },
            note: 'When content was approved',
            sort: 7,
            width: 'half'
        },
        schema: {
            is_nullable: true
        }
    });

    await createField(token, 'podcast_generated_content', {
        field: 'approved_by',
        type: 'uuid',
        meta: {
            interface: 'select-dropdown-m2o',
            display: 'user',
            note: 'User who approved the content',
            sort: 8,
            width: 'half',
            special: ['m2o']
        },
        schema: {
            is_nullable: true,
            foreign_key_table: 'directus_users',
            foreign_key_column: 'id'
        }
    });

    await createField(token, 'podcast_generated_content', {
        field: 'llm_model',
        type: 'string',
        meta: {
            interface: 'input',
            display: 'raw',
            note: 'Which LLM model was used',
            sort: 9,
            width: 'half'
        },
        schema: {
            is_nullable: true
        }
    });

    await createField(token, 'podcast_generated_content', {
        field: 'prompt_version',
        type: 'string',
        meta: {
            interface: 'input',
            display: 'raw',
            note: 'Version of the prompt used',
            sort: 10,
            width: 'half'
        },
        schema: {
            is_nullable: true
        }
    });
}

async function addHeiseFields(token) {
    console.log('\n=== Adding Heise Fields to Podcasts (Phase 7.1) ===');

    // Heise eligible
    await createField(token, 'podcasts', {
        field: 'heise_eligible',
        type: 'boolean',
        meta: {
            interface: 'boolean',
            display: 'boolean',
            note: 'Whether this episode should go to Heise.de',
            sort: 110,
            width: 'half'
        },
        schema: {
            default_value: false,
            is_nullable: false
        }
    });

    // Heise document status
    await createField(token, 'podcasts', {
        field: 'heise_document_status',
        type: 'string',
        meta: {
            interface: 'select-dropdown',
            display: 'labels',
            display_options: {
                showAsDot: true,
                choices: [
                    { value: 'not_applicable', background: '#6B7280', foreground: '#FFFFFF' },
                    { value: 'pending', background: '#F59E0B', foreground: '#FFFFFF' },
                    { value: 'generated', background: '#3B82F6', foreground: '#FFFFFF' },
                    { value: 'approved', background: '#8B5CF6', foreground: '#FFFFFF' },
                    { value: 'sent', background: '#10B981', foreground: '#FFFFFF' }
                ]
            },
            options: {
                choices: [
                    { text: 'Not Applicable', value: 'not_applicable' },
                    { text: 'Pending', value: 'pending' },
                    { text: 'Generated', value: 'generated' },
                    { text: 'Approved', value: 'approved' },
                    { text: 'Sent', value: 'sent' }
                ]
            },
            note: 'Status of Heise.de document',
            sort: 111,
            width: 'half'
        },
        schema: {
            default_value: 'not_applicable',
            is_nullable: true
        }
    });

    // Heise sent at
    await createField(token, 'podcasts', {
        field: 'heise_sent_at',
        type: 'timestamp',
        meta: {
            interface: 'datetime',
            display: 'datetime',
            display_options: { relative: true },
            note: 'When email was sent to Heise.de',
            sort: 112,
            width: 'half'
        },
        schema: {
            is_nullable: true
        }
    });

    // Heise document (relation to files)
    await createField(token, 'podcasts', {
        field: 'heise_document',
        type: 'uuid',
        meta: {
            interface: 'file',
            display: 'file',
            note: 'Generated Heise.de document',
            sort: 113,
            width: 'half',
            special: ['file']
        },
        schema: {
            is_nullable: true,
            foreign_key_table: 'directus_files',
            foreign_key_column: 'id'
        }
    });
}

async function main() {
    console.log('=== Podcast Automation Schema Migration ===');
    console.log(`Directus URL: ${DIRECTUS_URL}`);

    try {
        const token = await getAuthToken();
        console.log('Authenticated successfully');

        await addPodcastPlanningFields(token);
        await addSpeakerPortalFields(token);
        await createPodcastGeneratedContentCollection(token);
        await addHeiseFields(token);

        console.log('\n=== Migration Complete ===');
        console.log('Run "npm run snapshot-schema" to update schema.json');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }
}

main();
