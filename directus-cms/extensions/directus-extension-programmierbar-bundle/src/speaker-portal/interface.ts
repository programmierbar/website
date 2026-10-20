import { defineInterface } from '@directus/extensions-sdk'
import InterfaceComponent from './profile-update-actions.vue'

/**
 * Presentation interface for the `speakers` item page: "Profil-Update anfragen". After a
 * confirmation it calls `POST /speaker-portal/:id/request-update` of this bundle via the Directus
 * app's own API client (`useApi`), so the request runs with the current admin session — the
 * endpoint enforces the admin-only check server-side. Same pattern as `invoice-actions`.
 *
 * Needs an alias field on `speakers` that uses this interface (added in the Data Model UI).
 */
export default defineInterface({
    id: 'speaker-profile-update-actions',
    name: 'Speaker-Profil-Update',
    description: 'Speaker:in per E-Mail bitten, das eigene Profil zu prüfen (nur Admins)',
    icon: 'manage_accounts',
    component: InterfaceComponent,
    types: ['alias'],
    localTypes: ['presentation'],
    group: 'presentation',
    hideLabel: true,
    options: null,
})
