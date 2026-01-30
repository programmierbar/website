#!/usr/bin/env node
/**
 * Script to update schema.json with podcast automation fields.
 * This maintains the production PostgreSQL format while adding new fields.
 *
 * Run with: node utils/update-schema-json.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', 'schema.json');

// Read existing schema
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

// Helper to find max sort value in a collection
function getMaxSort(fields, collection) {
    return fields
        .filter(f => f.collection === collection)
        .reduce((max, f) => Math.max(max, f.meta?.sort || 0), 0);
}

// Helper to check if field exists
function fieldExists(fields, collection, fieldName) {
    return fields.some(f => f.collection === collection && f.field === fieldName);
}

// Helper to check if collection exists
function collectionExists(collections, name) {
    return collections.some(c => c.collection === name);
}

// Add podcast planning fields (Phase 1.1)
function addPodcastPlanningFields(schema) {
    console.log('Adding podcast planning fields...');
    let sort = getMaxSort(schema.fields, 'podcasts') + 1;

    const planningFields = [
        {
            collection: 'podcasts',
            field: 'recording_date',
            type: 'timestamp',
            meta: {
                collection: 'podcasts',
                conditions: null,
                display: 'datetime',
                display_options: { relative: false },
                field: 'recording_date',
                group: null,
                hidden: false,
                interface: 'datetime',
                note: 'When the episode will be/was recorded',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: sort++,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'recording_date',
                table: 'podcasts',
                data_type: 'timestamp with time zone',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcasts',
            field: 'planned_publish_date',
            type: 'timestamp',
            meta: {
                collection: 'podcasts',
                conditions: null,
                display: 'datetime',
                display_options: { relative: false },
                field: 'planned_publish_date',
                group: null,
                hidden: false,
                interface: 'datetime',
                note: 'Target publication date',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: sort++,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'planned_publish_date',
                table: 'podcasts',
                data_type: 'timestamp with time zone',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcasts',
            field: 'publishing_status',
            type: 'string',
            meta: {
                collection: 'podcasts',
                conditions: null,
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
                field: 'publishing_status',
                group: null,
                hidden: false,
                interface: 'select-dropdown',
                note: 'Workflow status for the publishing pipeline',
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
                readonly: false,
                required: false,
                searchable: true,
                sort: sort++,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'publishing_status',
                table: 'podcasts',
                data_type: 'character varying',
                default_value: 'planned',
                max_length: 255,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        }
    ];

    for (const field of planningFields) {
        if (!fieldExists(schema.fields, field.collection, field.field)) {
            schema.fields.push(field);
            console.log(`  Added ${field.collection}.${field.field}`);
        } else {
            console.log(`  ${field.collection}.${field.field} already exists, skipping`);
        }
    }
}

// Add speaker portal fields (Phase 1.4)
function addSpeakerPortalFields(schema) {
    console.log('Adding speaker portal fields...');
    let sort = getMaxSort(schema.fields, 'speakers') + 1;

    const portalFields = [
        {
            collection: 'speakers',
            field: 'portal_token',
            type: 'string',
            meta: {
                collection: 'speakers',
                conditions: null,
                display: 'raw',
                display_options: null,
                field: 'portal_token',
                group: null,
                hidden: true,
                interface: 'input',
                note: 'Unique token for self-service portal access',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: sort++,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'portal_token',
                table: 'speakers',
                data_type: 'character varying',
                default_value: null,
                max_length: 255,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: true,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'speakers',
            field: 'portal_token_expires',
            type: 'timestamp',
            meta: {
                collection: 'speakers',
                conditions: null,
                display: 'datetime',
                display_options: { relative: true },
                field: 'portal_token_expires',
                group: null,
                hidden: true,
                interface: 'datetime',
                note: 'Token expiration date',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: sort++,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'portal_token_expires',
                table: 'speakers',
                data_type: 'timestamp with time zone',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'speakers',
            field: 'portal_submission_status',
            type: 'string',
            meta: {
                collection: 'speakers',
                conditions: null,
                display: 'labels',
                display_options: {
                    showAsDot: true,
                    choices: [
                        { value: 'pending', background: '#F59E0B', foreground: '#FFFFFF' },
                        { value: 'submitted', background: '#3B82F6', foreground: '#FFFFFF' },
                        { value: 'approved', background: '#10B981', foreground: '#FFFFFF' }
                    ]
                },
                field: 'portal_submission_status',
                group: null,
                hidden: false,
                interface: 'select-dropdown',
                note: 'Speaker portal submission status',
                options: {
                    choices: [
                        { text: 'Pending', value: 'pending' },
                        { text: 'Submitted', value: 'submitted' },
                        { text: 'Approved', value: 'approved' }
                    ]
                },
                readonly: false,
                required: false,
                searchable: true,
                sort: sort++,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'portal_submission_status',
                table: 'speakers',
                data_type: 'character varying',
                default_value: null,
                max_length: 255,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'speakers',
            field: 'portal_submission_deadline',
            type: 'timestamp',
            meta: {
                collection: 'speakers',
                conditions: null,
                display: 'datetime',
                display_options: { relative: true },
                field: 'portal_submission_deadline',
                group: null,
                hidden: false,
                interface: 'datetime',
                note: 'Deadline for speaker to submit info',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: sort++,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'portal_submission_deadline',
                table: 'speakers',
                data_type: 'timestamp with time zone',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        }
    ];

    for (const field of portalFields) {
        if (!fieldExists(schema.fields, field.collection, field.field)) {
            schema.fields.push(field);
            console.log(`  Added ${field.collection}.${field.field}`);
        } else {
            console.log(`  ${field.collection}.${field.field} already exists, skipping`);
        }
    }
}

// Add podcast_generated_content collection (Phase 3.3)
function addPodcastGeneratedContentCollection(schema) {
    console.log('Adding podcast_generated_content collection...');

    // Add collection if not exists
    if (!collectionExists(schema.collections, 'podcast_generated_content')) {
        schema.collections.push({
            collection: 'podcast_generated_content',
            meta: {
                accountability: 'all',
                archive_app_filter: true,
                archive_field: 'status',
                archive_value: 'archived',
                collapse: 'open',
                collection: 'podcast_generated_content',
                color: null,
                display_template: null,
                group: 'Podcasts',
                hidden: false,
                icon: 'auto_awesome',
                item_duplication_fields: null,
                note: 'AI-generated content for podcast episodes',
                preview_url: null,
                singleton: false,
                sort: 5,
                sort_field: null,
                translations: null,
                unarchive_value: 'draft',
                versioning: false
            },
            schema: {
                name: 'podcast_generated_content'
            }
        });
        console.log('  Added collection podcast_generated_content');
    } else {
        console.log('  Collection podcast_generated_content already exists, skipping');
    }

    // Add fields
    const fields = [
        {
            collection: 'podcast_generated_content',
            field: 'id',
            type: 'uuid',
            meta: {
                collection: 'podcast_generated_content',
                conditions: null,
                display: null,
                display_options: null,
                field: 'id',
                group: null,
                hidden: true,
                interface: 'input',
                note: null,
                options: null,
                readonly: true,
                required: false,
                searchable: true,
                sort: 1,
                special: ['uuid'],
                translations: null,
                validation: null,
                validation_message: null,
                width: 'full'
            },
            schema: {
                name: 'id',
                table: 'podcast_generated_content',
                data_type: 'uuid',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: false,
                is_unique: true,
                is_indexed: false,
                is_primary_key: true,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcast_generated_content',
            field: 'podcast_id',
            type: 'uuid',
            meta: {
                collection: 'podcast_generated_content',
                conditions: null,
                display: 'related-values',
                display_options: { template: '{{title}}' },
                field: 'podcast_id',
                group: null,
                hidden: false,
                interface: 'select-dropdown-m2o',
                note: 'Related podcast episode',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: 2,
                special: ['m2o'],
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'podcast_id',
                table: 'podcast_generated_content',
                data_type: 'uuid',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: 'podcasts',
                foreign_key_column: 'id'
            }
        },
        {
            collection: 'podcast_generated_content',
            field: 'content_type',
            type: 'string',
            meta: {
                collection: 'podcast_generated_content',
                conditions: null,
                display: 'labels',
                display_options: null,
                field: 'content_type',
                group: null,
                hidden: false,
                interface: 'select-dropdown',
                note: 'Type of generated content',
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
                readonly: false,
                required: true,
                searchable: true,
                sort: 3,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'content_type',
                table: 'podcast_generated_content',
                data_type: 'character varying',
                default_value: null,
                max_length: 255,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: false,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcast_generated_content',
            field: 'generated_text',
            type: 'text',
            meta: {
                collection: 'podcast_generated_content',
                conditions: null,
                display: 'formatted-value',
                display_options: null,
                field: 'generated_text',
                group: null,
                hidden: false,
                interface: 'input-rich-text-md',
                note: 'AI-generated content',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: 4,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'full'
            },
            schema: {
                name: 'generated_text',
                table: 'podcast_generated_content',
                data_type: 'text',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcast_generated_content',
            field: 'edited_text',
            type: 'text',
            meta: {
                collection: 'podcast_generated_content',
                conditions: null,
                display: 'formatted-value',
                display_options: null,
                field: 'edited_text',
                group: null,
                hidden: false,
                interface: 'input-rich-text-md',
                note: 'Human-edited version (if modified)',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: 5,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'full'
            },
            schema: {
                name: 'edited_text',
                table: 'podcast_generated_content',
                data_type: 'text',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcast_generated_content',
            field: 'status',
            type: 'string',
            meta: {
                collection: 'podcast_generated_content',
                conditions: null,
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
                field: 'status',
                group: null,
                hidden: false,
                interface: 'select-dropdown',
                note: 'Content approval status',
                options: {
                    choices: [
                        { text: 'Generated', value: 'generated' },
                        { text: 'Approved', value: 'approved' },
                        { text: 'Rejected', value: 'rejected' },
                        { text: 'Published', value: 'published' }
                    ]
                },
                readonly: false,
                required: false,
                searchable: true,
                sort: 6,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'status',
                table: 'podcast_generated_content',
                data_type: 'character varying',
                default_value: 'generated',
                max_length: 255,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: false,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcast_generated_content',
            field: 'generated_at',
            type: 'timestamp',
            meta: {
                collection: 'podcast_generated_content',
                conditions: null,
                display: 'datetime',
                display_options: { relative: true },
                field: 'generated_at',
                group: null,
                hidden: false,
                interface: 'datetime',
                note: 'When content was generated',
                options: null,
                readonly: true,
                required: false,
                searchable: true,
                sort: 7,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'generated_at',
                table: 'podcast_generated_content',
                data_type: 'timestamp with time zone',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcast_generated_content',
            field: 'approved_at',
            type: 'timestamp',
            meta: {
                collection: 'podcast_generated_content',
                conditions: null,
                display: 'datetime',
                display_options: { relative: true },
                field: 'approved_at',
                group: null,
                hidden: false,
                interface: 'datetime',
                note: 'When content was approved',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: 8,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'approved_at',
                table: 'podcast_generated_content',
                data_type: 'timestamp with time zone',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcast_generated_content',
            field: 'approved_by',
            type: 'uuid',
            meta: {
                collection: 'podcast_generated_content',
                conditions: null,
                display: 'user',
                display_options: null,
                field: 'approved_by',
                group: null,
                hidden: false,
                interface: 'select-dropdown-m2o',
                note: 'User who approved the content',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: 9,
                special: ['m2o'],
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'approved_by',
                table: 'podcast_generated_content',
                data_type: 'uuid',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: 'directus_users',
                foreign_key_column: 'id'
            }
        },
        {
            collection: 'podcast_generated_content',
            field: 'llm_model',
            type: 'string',
            meta: {
                collection: 'podcast_generated_content',
                conditions: null,
                display: 'raw',
                display_options: null,
                field: 'llm_model',
                group: null,
                hidden: false,
                interface: 'input',
                note: 'Which LLM model was used',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: 10,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'llm_model',
                table: 'podcast_generated_content',
                data_type: 'character varying',
                default_value: null,
                max_length: 255,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcast_generated_content',
            field: 'prompt_version',
            type: 'string',
            meta: {
                collection: 'podcast_generated_content',
                conditions: null,
                display: 'raw',
                display_options: null,
                field: 'prompt_version',
                group: null,
                hidden: false,
                interface: 'input',
                note: 'Version of the prompt used',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: 11,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'prompt_version',
                table: 'podcast_generated_content',
                data_type: 'character varying',
                default_value: null,
                max_length: 255,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        }
    ];

    for (const field of fields) {
        if (!fieldExists(schema.fields, field.collection, field.field)) {
            schema.fields.push(field);
            console.log(`  Added ${field.collection}.${field.field}`);
        } else {
            console.log(`  ${field.collection}.${field.field} already exists, skipping`);
        }
    }

    // Add relation for podcast_id
    const podcastRelation = {
        collection: 'podcast_generated_content',
        field: 'podcast_id',
        related_collection: 'podcasts',
        meta: {
            junction_field: null,
            many_collection: 'podcast_generated_content',
            many_field: 'podcast_id',
            one_allowed_collections: null,
            one_collection: 'podcasts',
            one_collection_field: null,
            one_deselect_action: 'nullify',
            one_field: null,
            sort_field: null
        },
        schema: {
            table: 'podcast_generated_content',
            column: 'podcast_id',
            foreign_key_table: 'podcasts',
            foreign_key_column: 'id',
            on_update: 'NO ACTION',
            on_delete: 'SET NULL',
            constraint_name: null
        }
    };

    if (!schema.relations.some(r => r.collection === 'podcast_generated_content' && r.field === 'podcast_id')) {
        schema.relations.push(podcastRelation);
        console.log('  Added relation podcast_generated_content.podcast_id -> podcasts');
    }

    // Add relation for approved_by
    const approvedByRelation = {
        collection: 'podcast_generated_content',
        field: 'approved_by',
        related_collection: 'directus_users',
        meta: {
            junction_field: null,
            many_collection: 'podcast_generated_content',
            many_field: 'approved_by',
            one_allowed_collections: null,
            one_collection: 'directus_users',
            one_collection_field: null,
            one_deselect_action: 'nullify',
            one_field: null,
            sort_field: null
        },
        schema: {
            table: 'podcast_generated_content',
            column: 'approved_by',
            foreign_key_table: 'directus_users',
            foreign_key_column: 'id',
            on_update: 'NO ACTION',
            on_delete: 'SET NULL',
            constraint_name: null
        }
    };

    if (!schema.relations.some(r => r.collection === 'podcast_generated_content' && r.field === 'approved_by')) {
        schema.relations.push(approvedByRelation);
        console.log('  Added relation podcast_generated_content.approved_by -> directus_users');
    }
}

// Add Heise fields to podcasts (Phase 7.1)
function addHeiseFields(schema) {
    console.log('Adding Heise fields to podcasts...');
    let sort = getMaxSort(schema.fields, 'podcasts') + 1;

    const heiseFields = [
        {
            collection: 'podcasts',
            field: 'heise_eligible',
            type: 'boolean',
            meta: {
                collection: 'podcasts',
                conditions: null,
                display: 'boolean',
                display_options: null,
                field: 'heise_eligible',
                group: null,
                hidden: false,
                interface: 'boolean',
                note: 'Whether this episode should go to Heise.de',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: sort++,
                special: ['cast-boolean'],
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'heise_eligible',
                table: 'podcasts',
                data_type: 'boolean',
                default_value: false,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: false,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcasts',
            field: 'heise_document_status',
            type: 'string',
            meta: {
                collection: 'podcasts',
                conditions: null,
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
                field: 'heise_document_status',
                group: null,
                hidden: false,
                interface: 'select-dropdown',
                note: 'Status of Heise.de document',
                options: {
                    choices: [
                        { text: 'Not Applicable', value: 'not_applicable' },
                        { text: 'Pending', value: 'pending' },
                        { text: 'Generated', value: 'generated' },
                        { text: 'Approved', value: 'approved' },
                        { text: 'Sent', value: 'sent' }
                    ]
                },
                readonly: false,
                required: false,
                searchable: true,
                sort: sort++,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'heise_document_status',
                table: 'podcasts',
                data_type: 'character varying',
                default_value: 'not_applicable',
                max_length: 255,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcasts',
            field: 'heise_sent_at',
            type: 'timestamp',
            meta: {
                collection: 'podcasts',
                conditions: null,
                display: 'datetime',
                display_options: { relative: true },
                field: 'heise_sent_at',
                group: null,
                hidden: false,
                interface: 'datetime',
                note: 'When email was sent to Heise.de',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: sort++,
                special: null,
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'heise_sent_at',
                table: 'podcasts',
                data_type: 'timestamp with time zone',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: null,
                foreign_key_column: null
            }
        },
        {
            collection: 'podcasts',
            field: 'heise_document',
            type: 'uuid',
            meta: {
                collection: 'podcasts',
                conditions: null,
                display: 'file',
                display_options: null,
                field: 'heise_document',
                group: null,
                hidden: false,
                interface: 'file',
                note: 'Generated Heise.de document',
                options: null,
                readonly: false,
                required: false,
                searchable: true,
                sort: sort++,
                special: ['file'],
                translations: null,
                validation: null,
                validation_message: null,
                width: 'half'
            },
            schema: {
                name: 'heise_document',
                table: 'podcasts',
                data_type: 'uuid',
                default_value: null,
                max_length: null,
                numeric_precision: null,
                numeric_scale: null,
                is_nullable: true,
                is_unique: false,
                is_indexed: false,
                is_primary_key: false,
                is_generated: false,
                generation_expression: null,
                has_auto_increment: false,
                foreign_key_table: 'directus_files',
                foreign_key_column: 'id'
            }
        }
    ];

    for (const field of heiseFields) {
        if (!fieldExists(schema.fields, field.collection, field.field)) {
            schema.fields.push(field);
            console.log(`  Added ${field.collection}.${field.field}`);
        } else {
            console.log(`  ${field.collection}.${field.field} already exists, skipping`);
        }
    }

    // Add relation for heise_document
    const heiseDocRelation = {
        collection: 'podcasts',
        field: 'heise_document',
        related_collection: 'directus_files',
        meta: {
            junction_field: null,
            many_collection: 'podcasts',
            many_field: 'heise_document',
            one_allowed_collections: null,
            one_collection: 'directus_files',
            one_collection_field: null,
            one_deselect_action: 'nullify',
            one_field: null,
            sort_field: null
        },
        schema: {
            table: 'podcasts',
            column: 'heise_document',
            foreign_key_table: 'directus_files',
            foreign_key_column: 'id',
            on_update: 'NO ACTION',
            on_delete: 'SET NULL',
            constraint_name: null
        }
    };

    if (!schema.relations.some(r => r.collection === 'podcasts' && r.field === 'heise_document')) {
        schema.relations.push(heiseDocRelation);
        console.log('  Added relation podcasts.heise_document -> directus_files');
    }
}

// Main function
function main() {
    console.log('=== Updating schema.json with podcast automation fields ===\n');

    addPodcastPlanningFields(schema);
    addSpeakerPortalFields(schema);
    addPodcastGeneratedContentCollection(schema);
    addHeiseFields(schema);

    // Write updated schema
    writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
    console.log('\n=== Schema updated successfully ===');
    console.log(`Wrote to: ${schemaPath}`);
}

main();
