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
   - **`filter` (create + update)** sets `confirm_token_expires_at` to
     `now + 24h`. On create this is mandatory: the column is NOT NULL with no DB
     default, so without the filter every signup would fail the insert. On update
     it fires when a fresh `confirm_token` is issued (the expired-link recovery in
     step 3), which makes the hook the **single source of truth for the 24h TTL** —
     callers rotate the token and never compute an expiry of their own, so the
     create and refresh paths cannot drift apart.
   - **`action` (create + update)** reads the row back to get `confirm_token`,
     then sends the `newsletter_double_opt_in` email with a confirmation link.
     It fires on create and again on any update that brings a new link into
     existence — a rotated `confirm_token` or an explicitly extended window (see
     step 3). Updates that touch neither (the confirm flip, unsubscribe) don't
     resend.
     If the link cannot be built or sent — `website_url` unset (required, no
     fallback), template missing, or transport error — it sends **no** mail and
     posts a Slack warning, because the subscriber is otherwise stuck in
     `pending` with no way to confirm.

3. **Confirmation** — the email links to
   `{website_url}/newsletter/confirm?token={confirm_token}` (page
   `pages/newsletter/confirm.vue`). The confirmation is a state-changing call,
   so the page runs it **client-side** (`onMounted`), never during SSR — email
   scanners, link-expanders and prefetchers don't run JS, so they can't confirm
   a subscription on the recipient's behalf (same approach as `PodcastRating`).
   The client calls `POST /api/newsletter/confirm` (a state change, so POST not
   GET — consistent with the ticket/speaker submit routes), which looks the
   subscriber up by `confirm_token` and:

   | Situation                                     | Result                                                        | Page state          |
   | --------------------------------------------- | ------------------------------------------------------------- | ------------------- |
   | `pending` and not expired                     | flips to `confirmed`, sets `confirmed_at`                     | `confirmed`         |
   | already `confirmed`                           | no-op (idempotent)                                            | `already_confirmed` |
   | `pending` but past `confirm_token_expires_at` | new `confirm_token` → CMS stamps a fresh window and resends   | `resent`            |
   | unknown token / other status                  | no-op                                                         | `invalid`           |
   | Directus down / token misconfigured (500)     | no-op                                                         | `error` (retry)     |

   **Expired links are recoverable.** An expired token can't be re-sent via
   re-signup (that hits the duplicate branch, which is a no-op for privacy), so
   recovery happens here: the confirm route calls `refreshNewsletterConfirmation`,
   which writes **only** a new `confirm_token`. The CMS hook does the rest — its
   update filter stamps the new 24h window (the TTL lives there, not in the
   website) and its update action mails the fresh link. The just-clicked expired
   link is invalidated by the new token, so a page refresh can't silently confirm.

   **Concurrent clicks.** The route reads by token and then writes, so both
   mutations are **conditional on the state that was read** — the update filters
   on `status = pending` and the token from the link (the refresh additionally on
   an already-expired window). If a concurrent request (a double-clicked link, a
   retry, two tabs) got there first, the write reports no change and the handler
   answers from the row's current state instead of its own stale read. That
   matters most for the refresh path: every rotation triggers a mail and only the
   newest token works, so two blind writes would send two mails of which the
   first one's link is already dead.

   This **narrows** the read-to-write window; it does not close it. Directus
   resolves a filtered update to keys first and then updates by primary key
   (`ItemsService.updateByQuery`), so it is not a single atomic compare-and-swap.
   A true CAS needs one `UPDATE … WHERE …` statement, which requires direct DB
   access — i.e. it would have to live in the CMS (see
   [#215](https://github.com/programmierbar/website/issues/215)).

   **Previewing the states without the flow:** when `FLAG_ENABLE_UI_PREVIEWS` is
   set (non-prod only — off in production), the confirm page accepts
   `?preview=<confirmed|already_confirmed|resent|invalid|error>` to render any
   state directly (no API call), and shows a small state-switcher toolbar. This
   previews the real page, so there's no separate mock to drift from.

   `confirm_token` is **not** nulled on confirmation (it is NOT NULL). A used
   link is neutralised by the `status` + expiry checks instead.

## `email_templates`

Create one row in the `email_templates` collection. Handlebars syntax
(`{{variable}}`, `{{{raw_html}}}`).

| Template Key               | Trigger                                                | Available Variables |
| -------------------------- | ------------------------------------------------------ | ------------------- |
| `newsletter_double_opt_in` | New `pending` subscriber, or an expired link refreshed | `confirm_url`       |

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
