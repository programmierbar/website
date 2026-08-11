import { defineInterface } from '@directus/extensions-sdk'
import InterfaceComponent from './invoice-actions.vue'

/**
 * Presentation interface that renders the invoice lifecycle actions on the
 * ticket order detail page. Depending on the state of the order's current
 * invoice document it shows:
 *
 * - "Rechnung neu generieren" while the invoice has not been issued (sent) yet
 * - "Rechnungsberichtigung erstellen" and "Stornorechnung erstellen" once it has
 *
 * Each action asks for confirmation and calls the `invoice-lifecycle` endpoint
 * of this bundle via the Directus app's own API client (`useApi`), so the
 * request is authenticated with the current admin session — the endpoint
 * enforces the admin-only check server-side.
 *
 * Replaces the former `regenerate-invoice-button` interface.
 */
export default defineInterface({
    id: 'invoice-actions',
    name: 'Rechnungs-Aktionen',
    description: 'Rechnung neu generieren, berichtigen oder stornieren (nur Admins)',
    icon: 'receipt_long',
    component: InterfaceComponent,
    types: ['alias'],
    localTypes: ['presentation'],
    group: 'presentation',
    hideLabel: true,
    options: null,
})
