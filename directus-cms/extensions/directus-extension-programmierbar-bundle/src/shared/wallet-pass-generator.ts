import { createSign } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PKPass } from 'passkit-generator'

export interface WalletPassInput {
    ticketCode: string
    attendeeName: string
    attendeeEmail: string
    conferenceTitle: string
    conferenceDate: string // ISO date string (start_on)
    conferenceEndDate?: string // ISO date string (end_on)
    websiteUrl: string
}

interface AppleWalletConfig {
    passTypeIdentifier: string
    teamIdentifier: string
    signerCert: string | Buffer
    signerKey: string | Buffer
    wwdr: string | Buffer
}

interface GoogleWalletConfig {
    issuerId: string
    classId: string
    serviceAccountEmail: string
    privateKey: string
}

// --- Apple Wallet ---

function loadAppleConfig(env: Record<string, string>): AppleWalletConfig | null {
    const passTypeId = env.APPLE_WALLET_PASS_TYPE_ID
    const teamId = env.APPLE_WALLET_TEAM_ID
    const signerCert = env.APPLE_WALLET_SIGNER_CERT_BASE64
    const signerKey = env.APPLE_WALLET_SIGNER_KEY_BASE64
    const wwdr = env.APPLE_WALLET_WWDR_BASE64

    if (!passTypeId || !teamId || !signerCert || !signerKey || !wwdr) {
        return null
    }

    return {
        passTypeIdentifier: passTypeId,
        teamIdentifier: teamId,
        signerCert: Buffer.from(signerCert, 'base64'),
        signerKey: Buffer.from(signerKey, 'base64'),
        wwdr: Buffer.from(wwdr, 'base64'),
    }
}

function loadWalletAssets(): Record<string, Buffer> {
    const distDir = path.dirname(fileURLToPath(import.meta.url))
    const assetsDir = path.resolve(distDir, '..', 'assets', 'wallet')
    const files: Record<string, Buffer> = {}

    const expected = ['icon.png', 'icon@2x.png', 'logo.png', 'logo@2x.png']
    for (const name of expected) {
        const filePath = path.join(assetsDir, name)
        if (fs.existsSync(filePath)) {
            files[name] = fs.readFileSync(filePath)
        }
    }

    return files
}

function formatPassDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    })
}

export async function generateAppleWalletPass(
    input: WalletPassInput,
    env: Record<string, string>
): Promise<Buffer | null> {
    const config = loadAppleConfig(env)
    if (!config) return null

    const assets = loadWalletAssets()
    if (!assets['icon.png']) return null

    const verifyUrl = `${input.websiteUrl}/ticket/${input.ticketCode}`

    const pass = new PKPass(
        assets,
        {
            signerCert: config.signerCert,
            signerKey: config.signerKey,
            wwdr: config.wwdr,
        },
        {
            formatVersion: 1,
            passTypeIdentifier: config.passTypeIdentifier,
            teamIdentifier: config.teamIdentifier,
            organizationName: 'programmier.bar',
            description: `${input.conferenceTitle} Ticket`,
            serialNumber: input.ticketCode,
            foregroundColor: 'rgb(255, 255, 255)',
            backgroundColor: 'rgb(0, 0, 0)',
            labelColor: 'rgb(207, 255, 0)',
            relevantDate: input.conferenceDate,
        }
    )

    pass.type = 'eventTicket'

    pass.setBarcodes({
        format: 'PKBarcodeFormatQR',
        message: verifyUrl,
        messageEncoding: 'iso-8859-1',
    })

    pass.primaryFields.push({
        key: 'event',
        label: 'EVENT',
        value: input.conferenceTitle,
    })

    pass.secondaryFields.push(
        {
            key: 'attendee',
            label: 'TEILNEHMER',
            value: input.attendeeName,
        },
        {
            key: 'date',
            label: 'DATUM',
            value: formatPassDate(input.conferenceDate),
        }
    )

    pass.auxiliaryFields.push({
        key: 'ticketCode',
        label: 'TICKET-CODE',
        value: input.ticketCode,
    })

    pass.backFields.push(
        {
            key: 'email',
            label: 'E-Mail',
            value: input.attendeeEmail,
        },
        {
            key: 'website',
            label: 'Website',
            value: input.websiteUrl,
        }
    )

    return pass.getAsBuffer()
}

// --- Google Wallet ---

function loadGoogleConfig(env: Record<string, string>): GoogleWalletConfig | null {
    const issuerId = env.GOOGLE_WALLET_ISSUER_ID
    const classId = env.GOOGLE_WALLET_CLASS_ID
    const email = env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL
    const keyBase64 = env.GOOGLE_WALLET_PRIVATE_KEY_BASE64

    if (!issuerId || !classId || !email || !keyBase64) {
        return null
    }

    return {
        issuerId,
        classId,
        serviceAccountEmail: email,
        privateKey: Buffer.from(keyBase64, 'base64').toString('utf-8'),
    }
}

function base64url(input: string | Buffer): string {
    const buf = typeof input === 'string' ? Buffer.from(input) : input
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signJwt(payload: object, privateKey: string): string {
    const header = { alg: 'RS256', typ: 'JWT' }
    const encodedHeader = base64url(JSON.stringify(header))
    const encodedPayload = base64url(JSON.stringify(payload))
    const signatureInput = `${encodedHeader}.${encodedPayload}`

    const sign = createSign('RSA-SHA256')
    sign.update(signatureInput)
    const signature = base64url(sign.sign(privateKey))

    return `${encodedHeader}.${encodedPayload}.${signature}`
}

export function generateGoogleWalletUrl(
    input: WalletPassInput,
    env: Record<string, string>
): string | null {
    const config = loadGoogleConfig(env)
    if (!config) return null

    const verifyUrl = `${input.websiteUrl}/ticket/${input.ticketCode}`
    const objectId = `${config.issuerId}.${input.ticketCode}`
    const classId = `${config.issuerId}.${config.classId}`

    const eventTicketObject = {
        id: objectId,
        classId,
        state: 'ACTIVE',
        heroImage: {
            sourceUri: {
                uri: `${input.websiteUrl}/og-image.png`,
            },
        },
        textModulesData: [
            {
                header: 'Ticket-Code',
                body: input.ticketCode,
                id: 'ticket_code',
            },
        ],
        barcode: {
            type: 'QR_CODE',
            value: verifyUrl,
        },
        ticketHolderName: input.attendeeName,
        eventName: {
            defaultValue: {
                language: 'de',
                value: input.conferenceTitle,
            },
        },
        dateTime: {
            start: input.conferenceDate,
            ...(input.conferenceEndDate && { end: input.conferenceEndDate }),
        },
    }

    const now = Math.floor(Date.now() / 1000)
    const jwtPayload = {
        iss: config.serviceAccountEmail,
        aud: 'google',
        typ: 'savetowallet',
        iat: now,
        origins: [input.websiteUrl],
        payload: {
            eventTicketObjects: [eventTicketObject],
        },
    }

    const jwt = signJwt(jwtPayload, config.privateKey)
    return `https://pay.google.com/gp/v/save/${jwt}`
}
