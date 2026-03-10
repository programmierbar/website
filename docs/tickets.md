# Ticket Purchase Flow

This document describes the complete ticket purchase and attendee management flow, including all external dependencies, environment variables, and Directus configuration required.

## Overview

The flow consists of four main phases:

1. **Checkout** – User selects tickets, enters billing info, pays via Stripe
2. **Order Processing** – Webhook triggers ticket creation, invoice generation, and emails
3. **Profile Completion** – Attendees complete their profile via a token-based portal
4. **Ticket Delivery** – QR code ticket is emailed after profile completion

## Environment Variables

### Nuxt App (`nuxt-app/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NUXT_STRIPE_SECRET_KEY` | Stripe secret API key | Yes |
| `NUXT_STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Yes |
| `NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (exposed to frontend) | Yes |
| `NUXT_DIRECTUS_API_TOKEN` | Directus static API token (admin access) | Yes |
| `DIRECTUS_CMS_URL` | Directus instance URL (default: `https://admin.programmier.bar`) | Yes |
| `WEBSITE_URL` | Public website URL (default: `https://www.programmier.bar`) | Yes |

### Directus CMS (`directus-cms/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `STORAGE_LOCATIONS` | Comma-separated storage location IDs (first is used for invoice PDFs) | Yes |
| Email transport config | Directus email settings (`EMAIL_TRANSPORT`, `EMAIL_SMTP_HOST`, etc.) | Yes |

## External Services

### Stripe

- **Checkout Sessions** – Creates hosted payment pages
- **Webhooks** – Receives `checkout.session.completed` event
- **Setup**: Configure webhook endpoint at `{WEBSITE_URL}/api/tickets/webhook` in Stripe Dashboard

### Directus MailService

- Used by extension hooks to send templated emails
- Configured via Directus environment variables (see [Directus email docs](https://docs.directus.io/self-hosted/config-options.html#email))

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/tickets/create-checkout` | POST | Creates Stripe checkout session and ticket order |
| `/api/tickets/validate-discount` | POST | Validates a discount code against `ticket_settings` |
| `/api/tickets/webhook` | POST | Receives Stripe webhook, updates order to `paid` |
| `/api/tickets/order-status` | GET | Polls order status (used by success page) |
| `/api/ticket-portal/validate` | GET | Validates profile completion token |
| `/api/ticket-portal/submit` | POST | Submits attendee profile data |

## Directus Collections

### `ticket_settings` (singleton)

Ticketing configuration. Must exist before ticketing works.

| Field | Type | Description |
|-------|------|-------------|
| `early_bird_price_cents` | integer | Early bird ticket price in cents |
| `regular_price_cents` | integer | Regular ticket price in cents |
| `discounted_price_cents` | integer | Discounted ticket price in cents |
| `early_bird_deadline` | datetime | End of early bird period |
| `discount_code` | string | Active discount code |

### `ticket_orders`

One record per purchase.

| Field | Type | Description |
|-------|------|-------------|
| `order_number` | string | Auto-generated order number (ORD-YYYY-XXXXX) |
| `status` | enum | `pending`, `paid`, `cancelled` |
| `conference` | M2O → conferences | Conference reference |
| `purchaser_first_name` | string | |
| `purchaser_last_name` | string | |
| `purchaser_email` | string | |
| `purchase_type` | enum | `personal`, `company` |
| `company_name` | string | |
| `company_vat_id` | string | |
| `billing_email` | string | CC address for invoice |
| `billing_address_line1` | string | |
| `billing_address_line2` | string | |
| `billing_city` | string | |
| `billing_postal_code` | string | |
| `billing_country` | string | |
| `ticket_type` | enum | `early_bird`, `regular`, `discounted` |
| `ticket_count` | integer | |
| `unit_price_cents` | integer | Per-ticket price in cents |
| `discount_code` | string | Applied discount code |
| `discount_amount_cents` | integer | Discount amount |
| `vat_amount_cents` | integer | VAT (19%) in cents |
| `total_gross_cents` | integer | Total incl. VAT |
| `subtotal_cents` | integer | Net total |
| `stripe_checkout_session_id` | string | Stripe session ID |
| `stripe_payment_intent_id` | string | Stripe payment intent ID |
| `attendees_json` | JSON | Attendee data from checkout |
| `date_paid` | datetime | Payment timestamp |
| `invoice_number` | string | e.g. `PB-CON26-001` |
| `invoice_file` | M2O → directus_files | Generated invoice PDF |

### `tickets`

One record per attendee.

| Field | Type | Description |
|-------|------|-------------|
| `ticket_code` | string | Unique code (TKT-XXXXXX) |
| `status` | enum | `valid`, `checked_in`, `cancelled` |
| `order` | M2O → ticket_orders | |
| `conference` | M2O → conferences | |
| `attendee_first_name` | string | |
| `attendee_last_name` | string | |
| `attendee_email` | string | |
| `ticket_type` | enum | `early_bird`, `regular`, `discounted` |
| `profile_token` | string | UUID for profile completion (nullified after use) |
| `profile_status` | enum | `pending`, `completed` |
| `job_title` | string (100) | Required in profile |
| `company` | string (100) | Required in profile |
| `dietary_preferences` | string (200) | Optional |
| `pronouns` | string (50) | Optional |
| `tshirt_size` | enum | `S`, `M`, `L`, `XL`, `XXL` (optional) |
| `last_event_visited` | string (200) | Optional |
| `heard_about_from` | string (500) | Optional |
| `additional_notes` | text (1000) | Optional |

### `email_templates`

Templates stored with a `key`, `subject`, and `body_html` field. Uses Handlebars syntax (`{{variable}}`, `{{{raw_html}}}`).

| Template Key | Trigger | Available Variables |
|-------------|---------|---------------------|
| `ticket_order_confirmation` | Order paid | `purchaser_name`, `conference_title`, `order_number`, `total_amount`, `ticket_count`, `invoice_number` |
| `ticket_profile_invitation` | Order paid (sent to each attendee) | `attendee_name`, `conference_title`, `portal_url`, `purchaser_name` |
| `ticket_profile_completed` | Profile submitted | `attendee_name`, `conference_title`, `ticket_code`, `qr_code_data_url`, `ticket_card_html` |

### `automation_settings`

Key-value settings used by extension hooks.

| Key | Value | Description |
|-----|-------|-------------|
| `website_url` | URL string | Public website URL for generating links (portal URLs, QR codes) |

## Directus Extension Hooks

### `ticket-order-processing`

- **Trigger**: `ticket_orders.items.update` when `status` becomes `paid`
- **Actions**:
  1. Creates `tickets` records with unique codes and profile tokens
  2. Generates invoice PDF (pdfkit) and uploads to Directus files
  3. Updates order with `invoice_number` and `invoice_file`
  4. Sends `ticket_order_confirmation` email to purchaser (with invoice PDF attachment, CC to `billing_email` if set)
  5. Sends `ticket_profile_invitation` email to all attendees

### `ticket-profile-completion`

- **Trigger**: `tickets.items.update` when `profile_status` becomes `completed`
- **Actions**:
  1. Generates QR code (links to `{website_url}/ticket/{ticket_code}`)
  2. Sends `ticket_profile_completed` email with QR code and ticket card HTML

## Invoice Generation

- **Library**: pdfkit (marked as external in Rollup via `extension.config.js`)
- **Font**: Museo Sans 700 (loaded from `assets/MuseoSans700.otf`, falls back to Helvetica)
- **Number format**: `PB-CON{YY}-{NNN}` (e.g. `PB-CON26-001`), derived from conference `start_on` year
- **Seller**: Lotum media GmbH, Am Goldstein 1, 61231 Bad Nauheim, USt-ID DE272856704
- **Line items**: Show netto (net) prices; VAT (19%) shown separately in totals

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. CHECKOUT (Frontend)                                  │
│    User selects tickets → enters billing → reviews      │
│    POST /api/tickets/create-checkout                    │
│    → Creates ticket_order (status: pending)             │
│    → Creates Stripe checkout session                    │
│    → Redirects to Stripe                                │
├─────────────────────────────────────────────────────────┤
│ 2. PAYMENT (Stripe)                                     │
│    User pays on Stripe hosted page                      │
│    → Stripe sends checkout.session.completed webhook    │
│    POST /api/tickets/webhook                            │
│    → Updates order: status=paid, date_paid, etc.        │
├─────────────────────────────────────────────────────────┤
│ 3. ORDER PROCESSING (Directus Hook)                     │
│    ticket-order-processing fires on status=paid         │
│    → Creates ticket records with profile tokens         │
│    → Generates & uploads invoice PDF                    │
│    → Sends confirmation email + invoice to purchaser    │
│    → Sends profile invitation emails to all attendees   │
├─────────────────────────────────────────────────────────┤
│ 4. SUCCESS PAGE (Frontend)                              │
│    Polls GET /api/tickets/order-status                  │
│    Single ticket: shows "Ticket vervollständigen" button│
│    Multiple tickets: shows email instructions           │
├─────────────────────────────────────────────────────────┤
│ 5. PROFILE COMPLETION (Frontend + API)                  │
│    Attendee opens /ticket-portal?token=...              │
│    GET /api/ticket-portal/validate → shows form         │
│    POST /api/ticket-portal/submit → saves profile data  │
│    → Sets profile_status=completed, nullifies token     │
├─────────────────────────────────────────────────────────┤
│ 6. TICKET DELIVERY (Directus Hook)                      │
│    ticket-profile-completion fires on status=completed  │
│    → Generates QR code                                  │
│    → Sends final ticket email with QR code              │
└─────────────────────────────────────────────────────────┘
```

## Setup Checklist

- [ ] Set all environment variables (Nuxt + Directus)
- [ ] Create `ticket_settings` collection and populate pricing
- [ ] Create all fields on `ticket_orders` collection (including `invoice_number`, `invoice_file`)
- [ ] Create all fields on `tickets` collection (including profile fields and `profile_token`, `profile_status`)
- [ ] Create `email_templates` entries for `ticket_order_confirmation`, `ticket_profile_invitation`, `ticket_profile_completed`
- [ ] Add `website_url` entry to `automation_settings`
- [ ] Configure Stripe webhook pointing to `/api/tickets/webhook`
- [ ] Configure Directus email transport
- [ ] Configure Directus file storage (`STORAGE_LOCATIONS`)
- [ ] Build the Directus extension (`npm run build` in the extension directory)
- [ ] Place `MuseoSans700.otf` in extension `assets/` directory (optional, falls back to Helvetica)
