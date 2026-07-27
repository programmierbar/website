# Newsletter (Double Opt-In)

Sign-up with a confirmed (double opt-in) subscription flow.

## Flow

1. **Sign-up** — `NewsletterBand.vue` posts the email to the Nuxt route
   `POST /api/newsletter/subscribe`, which writes **only** `{ email }` to the
   `newsletter_subscribers` collection via the authenticated Directus client.
   Duplicate emails return the same success response as new ones (no
   enumeration). The admin token never reaches the browser.

2. **Directus fills the technical fields** — on insert Directus generates
   `confirm_token` / `unsubscribe_token` (uuid special flags), `signed_up_at`
   (date-created) and defaults `status` to `pending`. The
   `newsletter-double-opt-in` hook adds the one field Directus cannot derive:

   - **`filter` (before write)** sets `confirm_token_expires_at` to `now + 24h`.
     This column is NOT NULL with no DB default, so without the filter every
     signup would fail the insert.
   - **`action` (after write)** reads the row back to get `confirm_token`, then
     sends the `newsletter_double_opt_in` email with a confirmation link. If the
     link cannot be built or sent — `website_url` unset (required, no fallback),
     template missing, or transport error — it sends **no** mail and posts a
     Slack warning, because the subscriber is otherwise stuck in `pending` with
     no way to confirm.

3. **Confirmation** — the email links to
   `{website_url}/newsletter/confirm?token={confirm_token}` (page
   `pages/newsletter/confirm.vue`). The page calls
   `GET /api/newsletter/confirm`, which looks the subscriber up by
   `confirm_token` and:

   | Situation                                     | Result                                    | Page                             |
   | --------------------------------------------- | ----------------------------------------- | -------------------------------- |
   | `pending` and not expired                     | flips to `confirmed`, sets `confirmed_at` | success                          |
   | already `confirmed`                           | no-op (idempotent)                        | "schon bestätigt"                |
   | `pending` but past `confirm_token_expires_at` | no-op                                     | "Link abgelaufen" + neu anmelden |
   | unknown token / other status                  | no-op                                     | neutral error                    |

   **Previewing the states without the flow:** when `FLAG_ENABLE_UI_PREVIEWS` is
   set (non-prod only — off in production), the confirm page accepts
   `?preview=<confirmed|already_confirmed|expired|invalid>` to render any state
   directly (no API call), and shows a small state-switcher toolbar. This
   previews the real page, so there's no separate mock to drift from.

   `confirm_token` is **not** nulled on confirmation (it is NOT NULL). A used or
   expired link is neutralised by the `status` + expiry checks instead.

## `email_templates`

Create one row in the `email_templates` collection. Handlebars syntax
(`{{variable}}`, `{{{raw_html}}}`).

| Template Key               | Trigger                          | Available Variables |
| -------------------------- | -------------------------------- | ------------------- |
| `newsletter_double_opt_in` | New `pending` subscriber created | `confirm_url`       |

**Legal note:** this confirmation email must be **advertising-free** — greeting,
confirmation link and sender/imprint only. No offers, no CTAs beyond confirming.

Suggested content:

- **subject:** `Bitte bestätige deine Newsletter-Anmeldung`
- **body_html:**

```html
<p>Hallo,</p>
<p>
  bitte bestätige deine Anmeldung zum programmier.bar-Newsletter, indem du auf
  den folgenden Link klickst:
</p>
<p>
  <a href="{{confirm_url}}">Anmeldung bestätigen</a>
</p>
<p>
  Falls der Link nicht funktioniert, kopiere diese Adresse in deinen Browser:<br />
  {{confirm_url}}
</p>
<p>
  Wenn du dich nicht für den Newsletter angemeldet hast, ignoriere diese E-Mail
  einfach — ohne Bestätigung wird keine Anmeldung wirksam.
</p>
<p>Bitte antworte nicht auf diese automatisch generierte E-Mail.</p>
<hr />
<p>
  Lotum media GmbH<br />
  Am Goldstein 1 | 61231 Bad Nauheim | Deutschland<br />
  Mail: <a href="mailto:podcast@programmier.bar">podcast@programmier.bar</a
  ><br />
  Web: <a href="https://www.programmier.bar/">www.programmier.bar</a>
</p>
<p>
  Amtsgericht Friedberg, HRB 7067<br />
  Geschäftsführung: Dominik Anders, Jens Abke, Sebastian Schmitt<br />
  <a href="https://www.programmier.bar/impressum">Impressum</a> ·
  <a href="https://www.programmier.bar/datenschutz">Datenschutz</a>
</p>
```

> The imprint block mirrors the footer already used in `server/api/email.post.ts`.

## `automation_settings`

| Key           | Value      | Description                                                                                                                                                                                                                         |
| ------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `website_url` | URL string | Public website URL used to build the confirmation link. **Required** — there is no fallback. If it is missing, no confirmation mail is sent and a Slack warning is posted (a wrong host would be baked into an already-sent email). |
