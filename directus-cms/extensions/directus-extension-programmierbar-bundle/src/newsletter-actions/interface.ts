import { defineInterface } from '@directus/extensions-sdk'
import InterfaceComponent from './newsletter-actions.vue'

/**
 * Presentation interface for the `newsletter_issues` item page. For now it offers
 * "Testversand an mich": after a confirmation naming the recipient, it calls the
 * `newsletter-send` endpoint of this bundle via the Directus app's own API client
 * (`useApi`), so the request is authenticated with the current session. Any logged-in
 * user who can read the issue may use it; the endpoint only ever mails that user's own
 * address. Same pattern as `invoice-actions`.
 */
export default defineInterface({
    id: 'newsletter-actions',
    name: 'Newsletter-Aktionen',
    description: 'Testversand einer Newsletter-Ausgabe an die eigene Adresse',
    icon: 'forward_to_inbox',
    component: InterfaceComponent,
    types: ['alias'],
    localTypes: ['presentation'],
    group: 'presentation',
    hideLabel: true,
    options: null,
})
