#!/usr/bin/env node
/**
 * Script to set up Directus Flows for podcast automation.
 *
 * This script creates:
 * - Speaker token generation flow (Phase 5.2)
 * - Calendar view presets (Phase 1.2, 1.3)
 *
 * Run with: node utils/setup-flows.mjs
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

async function flowExists(token, name) {
    const response = await fetch(`${DIRECTUS_URL}/flows?filter[name][_eq]=${encodeURIComponent(name)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.data && data.data.length > 0;
}

async function createSpeakerTokenGenerationFlow(token) {
    console.log('\n=== Creating Speaker Token Generation Flow ===');

    const flowName = 'Generate Speaker Portal Token';

    if (await flowExists(token, flowName)) {
        console.log('  Flow already exists, skipping');
        return;
    }

    // Create the flow
    const flowResponse = await fetch(`${DIRECTUS_URL}/flows`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: flowName,
            icon: 'key',
            color: '#10B981',
            description: 'Automatically generates a portal token when a new speaker is created',
            status: 'active',
            trigger: 'event',
            accountability: 'all',
            options: {
                type: 'filter',
                scope: ['items.create'],
                collections: ['speakers']
            }
        })
    });

    if (!flowResponse.ok) {
        const error = await flowResponse.text();
        console.error('  Failed to create flow:', error);
        return;
    }

    const flow = await flowResponse.json();
    const flowId = flow.data.id;
    console.log('  Created flow:', flowId);

    // Create operation: Generate UUID token
    const generateTokenOp = await fetch(`${DIRECTUS_URL}/operations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: 'Generate Token',
            key: 'generate_token',
            type: 'exec',
            position_x: 19,
            position_y: 1,
            flow: flowId,
            options: {
                code: `
module.exports = async function(data) {
    const crypto = require('crypto');
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days from now
    return {
        portal_token: token,
        portal_token_expires: expiresAt.toISOString(),
        portal_submission_status: 'pending'
    };
}
`
            }
        })
    });

    if (!generateTokenOp.ok) {
        console.error('  Failed to create generate token operation');
        return;
    }

    const tokenOp = await generateTokenOp.json();
    console.log('  Created generate token operation');

    // Create operation: Update speaker with token
    const updateSpeakerOp = await fetch(`${DIRECTUS_URL}/operations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: 'Update Speaker',
            key: 'update_speaker',
            type: 'item-update',
            position_x: 37,
            position_y: 1,
            flow: flowId,
            options: {
                collection: 'speakers',
                key: '{{$trigger.keys[0]}}',
                payload: {
                    portal_token: '{{generate_token.portal_token}}',
                    portal_token_expires: '{{generate_token.portal_token_expires}}',
                    portal_submission_status: '{{generate_token.portal_submission_status}}'
                }
            }
        })
    });

    if (!updateSpeakerOp.ok) {
        console.error('  Failed to create update speaker operation');
        return;
    }

    const updateOp = await updateSpeakerOp.json();
    console.log('  Created update speaker operation');

    // Link operations
    await fetch(`${DIRECTUS_URL}/operations/${tokenOp.data.id}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            resolve: updateOp.data.id
        })
    });

    // Set first operation on flow
    await fetch(`${DIRECTUS_URL}/flows/${flowId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            operation: tokenOp.data.id
        })
    });

    console.log('  Flow setup complete!');
}

async function presetExists(token, collection, bookmark) {
    const response = await fetch(`${DIRECTUS_URL}/presets?filter[collection][_eq]=${collection}&filter[bookmark][_eq]=${encodeURIComponent(bookmark)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.data && data.data.length > 0;
}

async function createCalendarViewPresets(token) {
    console.log('\n=== Creating Calendar View Presets ===');

    // Recording Calendar View
    const recordingPresetName = 'Recording Calendar';
    if (await presetExists(token, 'podcasts', recordingPresetName)) {
        console.log('  Recording calendar preset already exists, skipping');
    } else {
        const recordingResponse = await fetch(`${DIRECTUS_URL}/presets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bookmark: recordingPresetName,
                collection: 'podcasts',
                layout: 'calendar',
                layout_query: {
                    calendar: {
                        date_field: 'recording_date',
                        view_type: 'month'
                    }
                },
                layout_options: {
                    calendar: {
                        date_field: 'recording_date',
                        view_type: 'month',
                        first_day: 1,
                        template: '{{title}}'
                    }
                },
                filter: null,
                icon: 'calendar_month',
                color: '#3B82F6'
            })
        });

        if (recordingResponse.ok) {
            console.log('  Created Recording Calendar preset');
        } else {
            console.error('  Failed to create Recording Calendar preset');
        }
    }

    // Publishing Calendar View
    const publishingPresetName = 'Publishing Calendar';
    if (await presetExists(token, 'podcasts', publishingPresetName)) {
        console.log('  Publishing calendar preset already exists, skipping');
    } else {
        const publishingResponse = await fetch(`${DIRECTUS_URL}/presets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bookmark: publishingPresetName,
                collection: 'podcasts',
                layout: 'calendar',
                layout_query: {
                    calendar: {
                        date_field: 'planned_publish_date',
                        view_type: 'month'
                    }
                },
                layout_options: {
                    calendar: {
                        date_field: 'planned_publish_date',
                        view_type: 'month',
                        first_day: 1,
                        template: '{{title}}'
                    }
                },
                filter: {
                    _and: [
                        {
                            publishing_status: {
                                _in: ['approved', 'content_review', 'transcript_ready', 'transcribing', 'recorded', 'planned']
                            }
                        }
                    ]
                },
                icon: 'event',
                color: '#10B981'
            })
        });

        if (publishingResponse.ok) {
            console.log('  Created Publishing Calendar preset');
        } else {
            console.error('  Failed to create Publishing Calendar preset');
        }
    }

    // Approved Episodes (ready to publish)
    const approvedPresetName = 'Ready to Publish';
    if (await presetExists(token, 'podcasts', approvedPresetName)) {
        console.log('  Ready to Publish preset already exists, skipping');
    } else {
        const approvedResponse = await fetch(`${DIRECTUS_URL}/presets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bookmark: approvedPresetName,
                collection: 'podcasts',
                layout: 'tabular',
                layout_query: {
                    tabular: {
                        fields: ['title', 'type', 'planned_publish_date', 'publishing_status']
                    }
                },
                filter: {
                    publishing_status: {
                        _eq: 'approved'
                    }
                },
                icon: 'check_circle',
                color: '#10B981'
            })
        });

        if (approvedResponse.ok) {
            console.log('  Created Ready to Publish preset');
        } else {
            console.error('  Failed to create Ready to Publish preset');
        }
    }
}

async function main() {
    console.log('=== Setting up Directus Flows and Presets ===');
    console.log(`Directus URL: ${DIRECTUS_URL}`);

    try {
        const token = await getAuthToken();
        console.log('Authenticated successfully');

        await createSpeakerTokenGenerationFlow(token);
        await createCalendarViewPresets(token);

        console.log('\n=== Setup Complete ===');
    } catch (error) {
        console.error('Setup failed:', error.message);
        process.exit(1);
    }
}

main();
