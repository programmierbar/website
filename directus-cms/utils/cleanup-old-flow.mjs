#!/usr/bin/env node
/**
 * Utility to delete the old "Process Transcript Upload" flow.
 * This flow is no longer needed as content generation is now handled by a Directus hook.
 *
 * Run with: node utils/cleanup-old-flow.mjs
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

async function deleteFlow(token, flowName) {
    // Find the flow
    const response = await fetch(`${DIRECTUS_URL}/flows?filter[name][_eq]=${encodeURIComponent(flowName)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
        console.log(`Could not find flow "${flowName}"`);
        return;
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        console.log(`Flow "${flowName}" not found, nothing to delete`);
        return;
    }

    const flowId = data.data[0].id;
    console.log(`Found flow "${flowName}" with ID: ${flowId}`);

    // Delete the flow
    const deleteResponse = await fetch(`${DIRECTUS_URL}/flows/${flowId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (deleteResponse.ok) {
        console.log(`Successfully deleted flow "${flowName}"`);
    } else {
        console.error(`Failed to delete flow: ${deleteResponse.status}`);
    }
}

async function main() {
    console.log('=== Cleaning up old flows ===');
    console.log(`Directus URL: ${DIRECTUS_URL}`);

    try {
        const token = await getAuthToken();
        console.log('Authenticated successfully\n');

        await deleteFlow(token, 'Process Transcript Upload');

        console.log('\n=== Cleanup Complete ===');
    } catch (error) {
        console.error('Cleanup failed:', error.message);
        process.exit(1);
    }
}

main();
