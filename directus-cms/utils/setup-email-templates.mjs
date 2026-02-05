#!/usr/bin/env node

/**
 * Setup script for email templates and automation settings collections.
 *
 * This script creates:
 * 1. `email_templates` collection - For editable email templates in the CMS
 * 2. `automation_settings` collection - For configuration like Heise contact email
 *
 * Run with: node utils/setup-email-templates.mjs
 */

import { createDirectus, rest, staticToken, createCollection, createField, createItem, readItems, updateItem } from '@directus/sdk'
import 'dotenv/config'

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
const DIRECTUS_TOKEN = process.env.DIRECTUS_ADMIN_TOKEN

if (!DIRECTUS_TOKEN) {
    console.error('Error: DIRECTUS_ADMIN_TOKEN environment variable is required')
    process.exit(1)
}

const client = createDirectus(DIRECTUS_URL).with(rest()).with(staticToken(DIRECTUS_TOKEN))

// Email template types and their default content
const EMAIL_TEMPLATES = [
    {
        key: 'speaker_invitation',
        name: 'Speaker Portal Invitation',
        description: 'Email sent to speakers when they receive a portal token',
        subject: 'programmier.bar: Bitte sende uns deine Informationen{{#if podcast_title}} für "{{podcast_title}}"{{/if}}',
        body_html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">programmier.bar</h1>
        <p style="color: #a3e635; margin: 10px 0 0 0; font-size: 14px;">Der Podcast für App- und Webentwicklung</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1a1a1a; margin-top: 0;">Hallo {{first_name}}!</h2>

        <p>Wir freuen uns sehr, dass du bei unserem Podcast zu Gast sein wirst! Um dich bestmöglich präsentieren zu können, benötigen wir einige Informationen und Bilder von dir.</p>

        {{#if recording_date}}
        <p>Die Aufnahme ist für den <strong>{{recording_date}}</strong> geplant.</p>
        {{/if}}

        <p>Bitte nutze unser Speaker Portal, um uns folgende Informationen zukommen zu lassen:</p>

        <ul style="padding-left: 20px;">
            <li><strong>Persönliche Informationen:</strong> Name, Titel, Position, Unternehmen</li>
            <li><strong>Kurze Bio:</strong> Ein paar Sätze über dich und deine Arbeit</li>
            <li><strong>Social Media Links:</strong> LinkedIn, Twitter/X, Bluesky, etc.</li>
            <li><strong>Profilbild:</strong> Ein professionelles Foto (min. 800x800px)</li>
            <li><strong>Action Shot:</strong> Ein Foto von dir "in Aktion" oder in einer lockeren Situation</li>
        </ul>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Deadline:</strong> {{deadline}}</p>
            <a href="{{portal_url}}" style="display: inline-block; background: #a3e635; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Zum Speaker Portal</a>
        </div>

        <p style="font-size: 14px; color: #666;">Der Link ist 14 Tage gültig. Falls du mehr Zeit benötigst, melde dich einfach bei uns.</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="font-size: 14px; color: #666;">
            Bei Fragen erreichst du uns jederzeit unter <a href="mailto:podcast@programmier.bar" style="color: #333;">podcast@programmier.bar</a>.
        </p>

        <p style="margin-bottom: 0;">Viele Grüße,<br><strong>Das programmier.bar Team</strong></p>
    </div>
</body>
</html>`,
    },
    {
        key: 'speaker_reminder',
        name: 'Speaker Portal Reminder (3 days)',
        description: 'Reminder email sent 3 days before deadline',
        subject: 'Erinnerung: Deine Informationen für programmier.bar',
        body_html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">programmier.bar</h1>
        <p style="color: #a3e635; margin: 10px 0 0 0; font-size: 14px;">Der Podcast für App- und Webentwicklung</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1a1a1a; margin-top: 0;">Hallo {{first_name}}!</h2>

        <p>Dies ist eine freundliche Erinnerung, dass wir noch auf deine Informationen für unseren Podcast warten.</p>

        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0;"><strong>Die Deadline ist {{deadline}}.</strong></p>
        </div>

        <p>Bitte fülle das Formular aus, damit wir dich bestmöglich im Podcast präsentieren können:</p>

        <div style="text-align: center; margin: 25px 0;">
            <a href="{{portal_url}}" style="display: inline-block; background: #a3e635; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Jetzt ausfüllen</a>
        </div>

        <p style="font-size: 14px; color: #666;">Falls du Schwierigkeiten hast oder mehr Zeit benötigst, melde dich einfach bei uns!</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="margin-bottom: 0;">Viele Grüße,<br><strong>Das programmier.bar Team</strong></p>
    </div>
</body>
</html>`,
    },
    {
        key: 'speaker_urgent_reminder',
        name: 'Speaker Portal Urgent Reminder (1 day)',
        description: 'Urgent reminder email sent 1 day before deadline',
        subject: 'Dringend: Deine Informationen werden morgen benötigt!',
        body_html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">programmier.bar</h1>
        <p style="color: #fff; margin: 10px 0 0 0; font-size: 14px;">Dringende Erinnerung</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1a1a1a; margin-top: 0;">Hallo {{first_name}}!</h2>

        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p style="margin: 0; color: #721c24;"><strong>Deine Deadline ist {{deadline}}!</strong></p>
        </div>

        <p>Wir haben bemerkt, dass du deine Informationen noch nicht eingereicht hast. Um die Podcast-Folge optimal vorbereiten zu können, benötigen wir diese dringend.</p>

        <div style="text-align: center; margin: 25px 0;">
            <a href="{{portal_url}}" style="display: inline-block; background: #dc3545; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">Jetzt ausfüllen</a>
        </div>

        <p>Falls es Probleme gibt oder du doch nicht teilnehmen kannst, gib uns bitte kurz Bescheid unter <a href="mailto:podcast@programmier.bar" style="color: #333;">podcast@programmier.bar</a>.</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="margin-bottom: 0;">Viele Grüße,<br><strong>Das programmier.bar Team</strong></p>
    </div>
</body>
</html>`,
    },
    {
        key: 'speaker_submission_confirmation',
        name: 'Speaker Submission Confirmation',
        description: 'Email sent to speaker after successful submission',
        subject: 'Vielen Dank für deine Informationen - programmier.bar',
        body_html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">programmier.bar</h1>
        <p style="color: #a3e635; margin: 10px 0 0 0; font-size: 14px;">Der Podcast für App- und Webentwicklung</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1a1a1a; margin-top: 0;">Vielen Dank, {{first_name}}!</h2>

        <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <p style="margin: 0; color: #155724;"><strong>Deine Informationen wurden erfolgreich übermittelt!</strong></p>
        </div>

        <p>Wir haben alle Informationen erhalten und werden sie nun durchsehen. Falls wir noch Rückfragen haben, melden wir uns bei dir.</p>

        <p>Wir freuen uns auf die gemeinsame Podcast-Aufnahme!</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="margin-bottom: 0;">Viele Grüße,<br><strong>Das programmier.bar Team</strong></p>
    </div>
</body>
</html>`,
    },
    {
        key: 'speaker_admin_notification',
        name: 'Admin Notification (Speaker Submission)',
        description: 'Email sent to admin when a speaker submits',
        subject: 'Neue Speaker-Einreichung: {{first_name}} {{last_name}}',
        body_html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2>Neue Speaker-Einreichung</h2>

    <p><strong>{{first_name}} {{last_name}}</strong> hat soeben das Speaker Portal Formular ausgefüllt.</p>

    {{#if podcast_title}}
    <p>Episode: {{podcast_title}}</p>
    {{/if}}

    <p>Bitte überprüfe die eingereichten Informationen im Directus CMS.</p>
</body>
</html>`,
    },
    {
        key: 'ticket_order_confirmation',
        name: 'Ticket Order Confirmation (Purchaser)',
        description: 'Email sent to the purchaser with all tickets after successful payment',
        subject: 'Deine Tickets für die {{conference_title}} - Bestellnummer {{order_number}}',
        body_html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">programmier.bar</h1>
        <p style="color: #00A1FF; margin: 10px 0 0 0; font-size: 14px;">Deine Tickets für die {{conference_title}}</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1a1a1a; margin-top: 0;">Hallo {{purchaser_name}}!</h2>

        <p>Vielen Dank für deine Bestellung! Hier sind deine Tickets:</p>

        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Bestellnummer:</strong> {{order_number}}</p>
            <p style="margin: 10px 0 0 0;"><strong>Gesamtbetrag:</strong> {{total_amount}} (inkl. 19% MwSt.)</p>
        </div>

        <h3 style="color: #333; margin-top: 30px;">Deine Tickets</h3>

        {{{ticket_list_html}}}

        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;" />

        <p style="color: #666;">
            Bitte bringe diese E-Mail oder die QR-Codes auf deinem Smartphone zum Event mit.
            Falls du Fragen hast, kontaktiere uns unter
            <a href="mailto:podcast@programmier.bar" style="color: #00A1FF;">podcast@programmier.bar</a>.
        </p>

        <p style="color: #666;">Wir freuen uns auf dich!</p>

        <p style="color: #666;">Dein programmier.bar Team</p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999;">
            <p style="margin: 0;">
                Lotum media GmbH<br />
                Am Goldstein 1 | 61231 Bad Nauheim | Deutschland
            </p>
            <p style="margin: 10px 0 0 0;">
                Tel.: +49 (0) 6032 – 92 55 07 0<br />
                Mail: podcast@programmier.bar<br />
                Web: www.programmier.bar
            </p>
        </div>
    </div>
</body>
</html>`,
    },
    {
        key: 'ticket_order_attendee',
        name: 'Ticket Order Confirmation (Attendee)',
        description: 'Email sent to individual attendees when they are different from the purchaser',
        subject: 'Dein Ticket für die {{conference_title}}',
        body_html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">programmier.bar</h1>
        <p style="color: #00A1FF; margin: 10px 0 0 0; font-size: 14px;">Dein Ticket für die {{conference_title}}</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1a1a1a; margin-top: 0;">Hallo {{attendee_name}}!</h2>

        <p>Ein Ticket für die {{conference_title}} wurde für dich gebucht. Hier ist dein Ticket:</p>

        <div style="margin: 30px 0; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <p style="margin: 5px 0; color: #666;">Ticket-Code: <strong>{{ticket_code}}</strong></p>
            <div style="text-align: center; margin-top: 15px;">
                <img src="{{qr_code_url}}" alt="QR Code" style="width: 200px; height: 200px;" />
            </div>
            <p style="text-align: center; font-size: 12px; color: #999; margin-top: 15px;">
                Bitte zeige diesen QR-Code beim Check-in vor.
            </p>
        </div>

        <p style="color: #666;">Wir freuen uns auf dich!</p>

        <p style="color: #666;">Dein programmier.bar Team</p>
    </div>
</body>
</html>`,
    },
    {
        key: 'heise_document',
        name: 'Heise.de Document',
        description: 'Document template sent to Heise.de for podcast episodes',
        subject: '[programmier.bar] Neue Episode: {{title}}',
        body_html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">

    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 20px;">programmier.bar</h1>
        <p style="color: #a3e635; margin: 5px 0 0 0; font-size: 14px;">Der Podcast für App- und Webentwicklung</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">

        <h2 style="color: #1a1a1a; margin: 0 0 5px 0; font-size: 24px;">{{episode_label}}</h2>
        <h3 style="color: #333; margin: 0 0 20px 0; font-size: 20px; font-weight: normal;">{{title}}</h3>

        <div style="background: #f0f9e8; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
            <p style="margin: 0;">
                <strong>Erscheinungsdatum:</strong> {{publication_date}}<br>
                <strong>Moderation:</strong> {{hosts}}
                {{#if guests}}<br><strong>Gast:</strong> {{guests}}{{/if}}
            </p>
        </div>

        {{#if guest_sections}}
        <h3 style="color: #1a1a1a; font-size: 18px; margin-bottom: 10px;">Über unsere Gäste</h3>
        {{{guest_sections}}}
        {{/if}}

        <h3 style="color: #1a1a1a; font-size: 18px; margin: 25px 0 15px 0;">Über die Episode</h3>
        <div style="line-height: 1.7;">
            {{{description}}}
        </div>

        <h3 style="color: #1a1a1a; font-size: 18px; margin: 30px 0 15px 0;">Episode anhören</h3>
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px;">
            <p style="margin: 0 0 10px 0;">
                <strong>Episode-Link:</strong><br>
                <a href="{{episode_url}}" style="color: #2563eb;">{{episode_url}}</a>
            </p>
            <p style="margin: 0; font-size: 14px; color: #666;">
                Verfügbar auf allen gängigen Podcast-Plattformen: Apple Podcasts, Spotify, Google Podcasts, etc.
            </p>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <div style="font-size: 14px; color: #666;">
            <p style="margin: 0 0 10px 0;">
                <strong>programmier.bar</strong><br>
                Der Podcast für App- und Webentwicklung
            </p>
            <p style="margin: 0 0 5px 0;">
                <a href="{{website_url}}" style="color: #333;">{{website_url}}</a>
            </p>
            <p style="margin: 0;">
                Kontakt: <a href="mailto:podcast@programmier.bar" style="color: #333;">podcast@programmier.bar</a>
            </p>
        </div>

    </div>

</body>
</html>`,
    },
]

// Default automation settings
const AUTOMATION_SETTINGS = [
    {
        key: 'heise_contact_email',
        name: 'Heise.de Contact Email',
        description: 'Email address to send Heise documents to',
        value: '',
        value_type: 'email',
    },
    {
        key: 'admin_notification_email',
        name: 'Admin Notification Email',
        description: 'Email address for admin notifications (speaker submissions, etc.)',
        value: 'podcast@programmier.bar',
        value_type: 'email',
    },
    {
        key: 'website_url',
        name: 'Website URL',
        description: 'Base URL for the website (used in email links)',
        value: 'https://programmier.bar',
        value_type: 'url',
    },
    {
        key: 'speaker_portal_token_validity_days',
        name: 'Speaker Portal Token Validity (Days)',
        description: 'How many days a speaker portal token is valid',
        value: '14',
        value_type: 'number',
    },
]

async function createEmailTemplatesCollection() {
    console.log('Creating email_templates collection...')

    try {
        await client.request(
            createCollection({
                collection: 'email_templates',
                meta: {
                    collection: 'email_templates',
                    icon: 'mail',
                    note: 'Email templates for automated notifications',
                    display_template: '{{name}}',
                    archive_field: null,
                    archive_value: null,
                    unarchive_value: null,
                    singleton: false,
                    sort_field: 'sort',
                },
                schema: {
                    name: 'email_templates',
                },
            })
        )
        console.log('  Collection created')
    } catch (err) {
        if (err.errors?.[0]?.extensions?.code === 'INVALID_PAYLOAD' || err.message?.includes('already exists')) {
            console.log('  Collection already exists, skipping creation')
        } else {
            throw err
        }
    }

    // Create fields
    const fields = [
        {
            field: 'id',
            type: 'integer',
            meta: { hidden: true, interface: 'input', readonly: true },
            schema: { is_primary_key: true, has_auto_increment: true },
        },
        {
            field: 'sort',
            type: 'integer',
            meta: { hidden: true, interface: 'input', width: 'full' },
            schema: {},
        },
        {
            field: 'key',
            type: 'string',
            meta: {
                interface: 'input',
                width: 'half',
                required: true,
                note: 'Unique identifier for the template (used in code)',
                options: { font: 'monospace' },
            },
            schema: { is_unique: true, is_nullable: false },
        },
        {
            field: 'name',
            type: 'string',
            meta: {
                interface: 'input',
                width: 'half',
                required: true,
                note: 'Display name for the template',
            },
            schema: { is_nullable: false },
        },
        {
            field: 'description',
            type: 'text',
            meta: {
                interface: 'input-multiline',
                width: 'full',
                note: 'Description of when this template is used',
            },
            schema: {},
        },
        {
            field: 'subject',
            type: 'string',
            meta: {
                interface: 'input',
                width: 'full',
                required: true,
                note: 'Email subject line. Supports Handlebars variables like {{first_name}}',
            },
            schema: { is_nullable: false },
        },
        {
            field: 'body_html',
            type: 'text',
            meta: {
                interface: 'input-code',
                width: 'full',
                required: true,
                note: 'HTML email body. Supports Handlebars variables.',
                options: { language: 'htmlmixed', lineNumber: true },
            },
            schema: { is_nullable: false },
        },
        {
            field: 'date_updated',
            type: 'timestamp',
            meta: {
                hidden: true,
                interface: 'datetime',
                special: ['date-updated'],
                width: 'half',
            },
            schema: {},
        },
        {
            field: 'user_updated',
            type: 'uuid',
            meta: {
                hidden: true,
                interface: 'select-dropdown-m2o',
                special: ['user-updated'],
                width: 'half',
            },
            schema: {},
        },
    ]

    for (const field of fields) {
        try {
            await client.request(createField('email_templates', field))
            console.log(`  Field '${field.field}' created`)
        } catch (err) {
            if (err.errors?.[0]?.extensions?.code === 'INVALID_PAYLOAD') {
                console.log(`  Field '${field.field}' already exists, skipping`)
            } else {
                throw err
            }
        }
    }
}

async function createAutomationSettingsCollection() {
    console.log('\nCreating automation_settings collection...')

    try {
        await client.request(
            createCollection({
                collection: 'automation_settings',
                meta: {
                    collection: 'automation_settings',
                    icon: 'settings',
                    note: 'Configuration settings for podcast automation features',
                    display_template: '{{name}}',
                    singleton: false,
                    sort_field: 'sort',
                },
                schema: {
                    name: 'automation_settings',
                },
            })
        )
        console.log('  Collection created')
    } catch (err) {
        if (err.errors?.[0]?.extensions?.code === 'INVALID_PAYLOAD' || err.message?.includes('already exists')) {
            console.log('  Collection already exists, skipping creation')
        } else {
            throw err
        }
    }

    // Create fields
    const fields = [
        {
            field: 'id',
            type: 'integer',
            meta: { hidden: true, interface: 'input', readonly: true },
            schema: { is_primary_key: true, has_auto_increment: true },
        },
        {
            field: 'sort',
            type: 'integer',
            meta: { hidden: true, interface: 'input' },
            schema: {},
        },
        {
            field: 'key',
            type: 'string',
            meta: {
                interface: 'input',
                width: 'half',
                required: true,
                readonly: true,
                note: 'Setting identifier (used in code)',
                options: { font: 'monospace' },
            },
            schema: { is_unique: true, is_nullable: false },
        },
        {
            field: 'name',
            type: 'string',
            meta: {
                interface: 'input',
                width: 'half',
                required: true,
                note: 'Display name',
            },
            schema: { is_nullable: false },
        },
        {
            field: 'description',
            type: 'text',
            meta: {
                interface: 'input-multiline',
                width: 'full',
                note: 'Description of what this setting controls',
            },
            schema: {},
        },
        {
            field: 'value',
            type: 'string',
            meta: {
                interface: 'input',
                width: 'full',
                required: true,
                note: 'Setting value',
            },
            schema: { is_nullable: false },
        },
        {
            field: 'value_type',
            type: 'string',
            meta: {
                interface: 'select-dropdown',
                width: 'half',
                note: 'Type of value for validation',
                options: {
                    choices: [
                        { text: 'Text', value: 'text' },
                        { text: 'Email', value: 'email' },
                        { text: 'URL', value: 'url' },
                        { text: 'Number', value: 'number' },
                        { text: 'Boolean', value: 'boolean' },
                    ],
                },
            },
            schema: { default_value: 'text' },
        },
    ]

    for (const field of fields) {
        try {
            await client.request(createField('automation_settings', field))
            console.log(`  Field '${field.field}' created`)
        } catch (err) {
            if (err.errors?.[0]?.extensions?.code === 'INVALID_PAYLOAD') {
                console.log(`  Field '${field.field}' already exists, skipping`)
            } else {
                throw err
            }
        }
    }
}

async function seedEmailTemplates() {
    console.log('\nSeeding email templates...')

    const existing = await client.request(readItems('email_templates', { fields: ['key'] }))
    const existingKeys = new Set(existing.map((t) => t.key))

    for (const template of EMAIL_TEMPLATES) {
        if (existingKeys.has(template.key)) {
            console.log(`  Template '${template.key}' already exists, skipping`)
            continue
        }

        await client.request(createItem('email_templates', template))
        console.log(`  Template '${template.key}' created`)
    }
}

async function seedAutomationSettings() {
    console.log('\nSeeding automation settings...')

    const existing = await client.request(readItems('automation_settings', { fields: ['key'] }))
    const existingKeys = new Set(existing.map((s) => s.key))

    for (const setting of AUTOMATION_SETTINGS) {
        if (existingKeys.has(setting.key)) {
            console.log(`  Setting '${setting.key}' already exists, skipping`)
            continue
        }

        await client.request(createItem('automation_settings', setting))
        console.log(`  Setting '${setting.key}' created`)
    }
}

async function main() {
    console.log('Setting up email templates and automation settings collections\n')
    console.log(`Directus URL: ${DIRECTUS_URL}\n`)

    try {
        await createEmailTemplatesCollection()
        await createAutomationSettingsCollection()
        await seedEmailTemplates()
        await seedAutomationSettings()

        console.log('\nSetup complete!')
        console.log('\nNext steps:')
        console.log('1. Open Directus and configure the Heise contact email in "Automation Settings"')
        console.log('2. Review and customize the email templates in "Email Templates"')
        console.log('3. Rebuild the Directus extensions: cd extensions/directus-extension-programmierbar-bundle && npm run build')
    } catch (err) {
        console.error('Error during setup:', err)
        process.exit(1)
    }
}

main()
