#!/usr/bin/env node
/**
 * Initialize ticket_settings singleton with default values.
 * Run with: node utils/setup-ticket-settings.mjs
 */

import 'dotenv/config'

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin'

async function getAdminToken() {
    const response = await fetch(`${DIRECTUS_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
        }),
    })

    if (!response.ok) {
        throw new Error(`Failed to authenticate: ${response.status}`)
    }

    const data = await response.json()
    return data.data.access_token
}

async function main() {
    console.log('=== Setting up ticket_settings ===\n')
    console.log(`Directus URL: ${DIRECTUS_URL}`)

    const token = await getAdminToken()
    console.log('Authenticated successfully\n')

    // Check if singleton already has data
    const checkResponse = await fetch(`${DIRECTUS_URL}/items/ticket_settings`, {
        headers: { Authorization: `Bearer ${token}` },
    })

    if (!checkResponse.ok) {
        console.error('Failed to check ticket_settings:', checkResponse.status)
        const text = await checkResponse.text()
        console.error(text)
        process.exit(1)
    }

    const existing = await checkResponse.json()

    // Default values
    const defaultSettings = {
        early_bird_price_cents: 24900, // €249.00
        regular_price_cents: 34900, // €349.00
        discounted_price_cents: 29900, // €299.00
        early_bird_deadline: '2026-03-31T23:59:59',
        discount_code: 'EARLYDEV',
    }

    if (existing.data && existing.data.id) {
        // Update existing record
        console.log('Updating existing ticket_settings...')
        const updateResponse = await fetch(`${DIRECTUS_URL}/items/ticket_settings`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(defaultSettings),
        })

        if (!updateResponse.ok) {
            console.error('Failed to update:', updateResponse.status)
            const text = await updateResponse.text()
            console.error(text)
            process.exit(1)
        }

        console.log('Updated ticket_settings with default values')
    } else {
        // Create new record (shouldn't happen for singletons, but just in case)
        console.log('Creating ticket_settings...')
        const createResponse = await fetch(`${DIRECTUS_URL}/items/ticket_settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(defaultSettings),
        })

        if (!createResponse.ok) {
            console.error('Failed to create:', createResponse.status)
            const text = await createResponse.text()
            console.error(text)
            process.exit(1)
        }

        console.log('Created ticket_settings with default values')
    }

    console.log('\nDefault values:')
    console.log(`  Early Bird Price: €${(defaultSettings.early_bird_price_cents / 100).toFixed(2)}`)
    console.log(`  Regular Price: €${(defaultSettings.regular_price_cents / 100).toFixed(2)}`)
    console.log(`  Discounted Price: €${(defaultSettings.discounted_price_cents / 100).toFixed(2)}`)
    console.log(`  Early Bird Deadline: ${defaultSettings.early_bird_deadline}`)
    console.log(`  Discount Code: ${defaultSettings.discount_code}`)

    console.log('\n=== Done ===')
}

main().catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
})
