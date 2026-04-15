/**
 * Quick test script for wallet pass generation.
 * Run from the extension bundle root:
 *   npx tsx src/shared/__tests__/test-wallet-passes.ts
 */
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

async function main() {
    const env = process.env as Record<string, string>

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
        env.GOOGLE_WALLET_CLASS_ID &&
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
            '  Google: GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_CLASS_ID, GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL, GOOGLE_WALLET_PRIVATE_KEY_BASE64'
        )
    }
}

main()
