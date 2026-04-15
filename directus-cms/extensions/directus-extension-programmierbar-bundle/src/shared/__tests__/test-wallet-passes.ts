/**
 * Quick test script for wallet pass generation.
 * Run from the extension bundle root:
 *   npx tsx src/shared/__tests__/test-wallet-passes.ts
 */
import { createSign } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import { generateAppleWalletPass, generateGoogleWalletUrl, type WalletPassInput } from '../wallet-pass-generator.js'

// Load env from directus-cms/.env
const envPath = path.resolve(import.meta.dirname, '..', '..', '..', '..', '..', '.env')
console.log(`Loading env from: ${envPath}`)
config({ path: envPath })

const dummyTicket: WalletPassInput = {
    ticketCode: 'TKT-TEST42',
    attendeeName: 'Max Mustermann',
    attendeeEmail: 'max@example.com',
    conferenceTitle: 'programmier.con 2026',
    conferenceDate: '2026-11-25T08:00:00.000Z',
    conferenceEndDate: '2026-11-26T22:00:00.000Z',
    websiteUrl: 'https://programmier.bar',
}

// --- Google Wallet REST API helpers ---

function base64url(input: string | Buffer): string {
    const buf = typeof input === 'string' ? Buffer.from(input) : input
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function createOAuthJwt(serviceAccountEmail: string, privateKey: string): string {
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = {
        iss: serviceAccountEmail,
        scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    }
    const encodedHeader = base64url(JSON.stringify(header))
    const encodedPayload = base64url(JSON.stringify(payload))
    const sign = createSign('RSA-SHA256')
    sign.update(`${encodedHeader}.${encodedPayload}`)
    const signature = base64url(sign.sign(privateKey))
    return `${encodedHeader}.${encodedPayload}.${signature}`
}

async function getAccessToken(serviceAccountEmail: string, privateKey: string): Promise<string> {
    const jwt = createOAuthJwt(serviceAccountEmail, privateKey)
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    })
    const data = await res.json() as any
    if (!res.ok) {
        throw new Error(`OAuth failed: ${JSON.stringify(data)}`)
    }
    return data.access_token
}

async function upsertGoogleWalletClass(env: Record<string, string>): Promise<void> {
    const issuerId = env.GOOGLE_WALLET_ISSUER_ID
    const email = env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
    const privateKey = Buffer.from(env.GOOGLE_WALLET_PRIVATE_KEY_BASE64, 'base64').toString('utf-8')

    // Must match the constant in wallet-pass-generator.ts
    const classSuffix = 'programmiercon_ticket_v4'
    const classId = `${issuerId}.${classSuffix}`

    const classDefinition = {
        id: classId,
        issuerName: 'programmier.bar',
        logo: {
            sourceUri: {
                uri: `${dummyTicket.websiteUrl}/wallet_google_logo.png`,
            },
        },
        hexBackgroundColor: '#003F64',
        eventName: {
            defaultValue: {
                language: 'de',
                value: dummyTicket.conferenceTitle,
            },
        },
        venue: {
            name: {
                defaultValue: {
                    language: 'de',
                    value: 'Bad Nauheim',
                },
            },
            address: {
                defaultValue: {
                    language: 'de',
                    value: 'Bad Nauheim, Deutschland',
                },
            },
        },
        dateTime: {
            start: dummyTicket.conferenceDate,
            end: dummyTicket.conferenceEndDate,
        },
        reviewStatus: 'UNDER_REVIEW',
    }

    console.log('Getting OAuth access token...')
    const accessToken = await getAccessToken(email, privateKey)

    console.log(`Upserting class ${classId}...`)

    // Try PUT (update) first, then POST (create) if 404
    const putRes = await fetch(
        `https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass/${classId}`,
        {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(classDefinition),
        }
    )

    if (putRes.ok) {
        console.log('Class updated successfully via REST API')
        const data = await putRes.json()
        console.log('Class data:', JSON.stringify(data, null, 2))
        return
    }

    if (putRes.status === 404) {
        console.log('Class not found, creating...')
        const postRes = await fetch(
            'https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(classDefinition),
            }
        )
        if (postRes.ok) {
            console.log('Class created successfully via REST API')
            const data = await postRes.json()
            console.log('Class data:', JSON.stringify(data, null, 2))
        } else {
            const err = await postRes.text()
            console.error(`Failed to create class (${postRes.status}): ${err}`)
        }
        return
    }

    const err = await putRes.text()
    console.error(`Failed to update class (${putRes.status}): ${err}`)
}

// --- Main ---

async function main() {
    const env = process.env as Record<string, string>
    const command = process.argv[2]

    // If called with "upsert-class", just create/update the Google class via REST API
    if (command === 'upsert-class') {
        await upsertGoogleWalletClass(env)
        return
    }

    console.log('\n--- Apple Wallet ---')
    const hasAppleConfig = !!(
        env.APPLE_WALLET_PASS_TYPE_ID &&
        env.APPLE_WALLET_TEAM_ID &&
        env.APPLE_WALLET_SIGNER_CERT_BASE64 &&
        env.APPLE_WALLET_SIGNER_KEY_BASE64 &&
        env.APPLE_WALLET_WWDR_BASE64
    )
    console.log(`Config present: ${hasAppleConfig}`)

    if (hasAppleConfig) {
        try {
            const passBuffer = await generateAppleWalletPass(dummyTicket, env)
            if (passBuffer) {
                const outPath = path.resolve(import.meta.dirname, 'test-ticket.pkpass')
                fs.writeFileSync(outPath, passBuffer)
                console.log(`Pass written to: ${outPath}`)
                console.log(`Size: ${passBuffer.length} bytes`)
                console.log('Open it with: open test-ticket.pkpass')
            } else {
                console.log('generateAppleWalletPass returned null (missing assets?)')
                console.log('Make sure assets/wallet/ contains icon.png, icon@2x.png, logo.png, logo@2x.png')
            }
        } catch (err) {
            console.error('Apple Wallet error:', err)
        }
    }

    console.log('\n--- Google Wallet ---')
    const hasGoogleConfig = !!(
        env.GOOGLE_WALLET_ISSUER_ID &&
        env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL &&
        env.GOOGLE_WALLET_PRIVATE_KEY_BASE64
    )
    console.log(`Config present: ${hasGoogleConfig}`)

    if (hasGoogleConfig) {
        try {
            const url = generateGoogleWalletUrl(dummyTicket, env)
            if (url) {
                console.log(`Google Wallet URL (${url.length} chars):`)
                console.log(url)

                // Decode and print JWT payload for debugging
                const jwt = url.replace('https://pay.google.com/gp/v/save/', '')
                const payloadPart = jwt.split('.')[1]
                const decoded = JSON.parse(Buffer.from(payloadPart, 'base64url').toString())
                console.log('\nDecoded JWT payload:')
                console.log(JSON.stringify(decoded, null, 2))
            } else {
                console.log('generateGoogleWalletUrl returned null')
            }
        } catch (err) {
            console.error('Google Wallet error:', err)
        }
    }

    if (!hasAppleConfig && !hasGoogleConfig) {
        console.log('\nNo wallet config found. Expected env vars:')
        console.log(
            '  Apple:  APPLE_WALLET_PASS_TYPE_ID, APPLE_WALLET_TEAM_ID, APPLE_WALLET_SIGNER_CERT_BASE64, APPLE_WALLET_SIGNER_KEY_BASE64, APPLE_WALLET_WWDR_BASE64'
        )
        console.log(
            '  Google: GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL, GOOGLE_WALLET_PRIVATE_KEY_BASE64'
        )
    }
}

main()
