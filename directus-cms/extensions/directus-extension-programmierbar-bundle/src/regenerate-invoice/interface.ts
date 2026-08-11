import { defineInterface } from '@directus/extensions-sdk'
import InterfaceComponent from './regenerate-invoice-button.vue'

/**
 * Presentation interface that renders a "Regenerate invoice" button on the
 * ticket order detail page. The button calls the `regenerate-invoice`
 * endpoint of this bundle via the Directus app's own API client (`useApi`),
 * so the request is authenticated with the current admin session — the
 * endpoint enforces the admin-only check server-side.
 */
export default defineInterface({
    id: 'regenerate-invoice-button',
    name: 'Regenerate Invoice Button',
    description: 'Button that re-renders the invoice PDF of a paid ticket order (admins only)',
    icon: 'receipt_long',
    component: InterfaceComponent,
    types: ['alias'],
    localTypes: ['presentation'],
    group: 'presentation',
    hideLabel: true,
    options: null,
})
