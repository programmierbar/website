#!/usr/bin/env node
/**
 * Generate portal tokens for existing speakers who don't have one.
 *
 * Run with: node utils/generate-speaker-tokens.mjs
 */

import crypto from 'crypto';

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

async function main() {
    console.log('=== Generate Speaker Portal Tokens ===\n');
    console.log(`Directus URL: ${DIRECTUS_URL}\n`);

    try {
        const token = await getAuthToken();
        console.log('Authenticated successfully\n');

        // Get all speakers without a portal token
        const speakersResponse = await fetch(
            `${DIRECTUS_URL}/items/speakers?filter[portal_token][_null]=true&fields=id,first_name,last_name,slug`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (!speakersResponse.ok) {
            const errorText = await speakersResponse.text();
            throw new Error(`Failed to fetch speakers: ${speakersResponse.status} - ${errorText}`);
        }

        const speakersData = await speakersResponse.json();
        const speakers = speakersData.data || [];

        if (speakers.length === 0) {
            console.log('All speakers already have portal tokens!');
            return;
        }

        console.log(`Found ${speakers.length} speaker(s) without tokens:\n`);

        for (const speaker of speakers) {
            const portalToken = crypto.randomUUID();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 14); // 14 days from now
            const displayName = `${speaker.first_name} ${speaker.last_name}`.trim() || speaker.slug;

            const updateResponse = await fetch(`${DIRECTUS_URL}/items/speakers/${speaker.id}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    portal_token: portalToken,
                    portal_token_expires: expiresAt.toISOString(),
                    portal_submission_status: 'pending'
                })
            });

            if (updateResponse.ok) {
                console.log(`✓ ${displayName}`);
                console.log(`  Token: ${portalToken}`);
                console.log(`  Expires: ${expiresAt.toISOString()}\n`);
            } else {
                console.log(`✗ Failed to update ${displayName}`);
            }
        }

        console.log('=== Done ===');
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

main();
