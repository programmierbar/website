# Newsletter (Double Opt-In)

Sign-up with a confirmed (double opt-in) subscription flow.

## Flow

1. **Sign-up** — `NewsletterBand.vue` posts the email to the Nuxt route
   `POST /api/newsletter/subscribe`, which writes **only** `{ email }` to the
   `newsletter_subscribers` collection via the authenticated Directus client.
   Duplicate emails return the same success response as new ones (no
   enumeration). The admin token never reaches the browser.

   A repeat signup for an address that previously **unsubscribed** reactivates it
   (`resubscribeNewsletterSubscriber`): back to `pending` with a fresh
   `confirm_token`, which makes the CMS send a new confirmation mail — consent is
   re-obtained, never inherited from the old signup. Without this, opting out
   would be a one-way door, because the row still exists and every later signup
   lands in the duplicate branch. The reactivation is guarded on
   `status = unsubscribed`, so a pending or confirmed address stays a no-op and
   the response is identical either way; a failure there is logged and swallowed,
   since a 500 that only fires for existing addresses would be an enumeration
   oracle.

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
     resend. An explicitly supplied window must lie in the **future**: moving it
     into the past by hand is how a link gets invalidated, not reissued, so that
     sends nothing (it would deliver an already-dead link). A rotation that
     leaves the expiry to the hook is always fine — the filter stamps a fresh
     window.
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

   | Situation                                     | Result                                                      | Page state          |
   | --------------------------------------------- | ----------------------------------------------------------- | ------------------- |
   | `pending` and not expired                     | flips to `confirmed`, sets `confirmed_at`                   | `confirmed`         |
   | already `confirmed`                           | no-op (idempotent)                                          | `already_confirmed` |
   | `pending` but past `confirm_token_expires_at` | new `confirm_token` → CMS stamps a fresh window and resends | `resent`            |
   | unknown token / other status                  | no-op                                                       | `invalid`           |
   | Directus down / token misconfigured (500)     | no-op                                                       | `error` (retry)     |

   **Expired links are recoverable.** An expired token can't be re-sent via
   re-signup (that hits the duplicate branch, which is a no-op for privacy), so
   recovery happens here: the confirm route calls `refreshNewsletterConfirmation`,
   which writes **only** a new `confirm_token`. The CMS hook does the rest — its
   update filter stamps the new 24h window (the TTL lives there, not in the
   website) and its update action mails the fresh link. The just-clicked expired
   link is invalidated by the new token, so a page refresh can't silently confirm.

   **Concurrent clicks.** The route reads by token and then writes, so both
   mutations are **conditional on the state that was read** — the update filters
   on `status = pending` and the token from the link. The token is what makes this
   work: a competing refresh rotates it, so the loser's filter stops matching. If
   a concurrent request (a double-clicked link, a
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

   `confirm_token` is **not** nulled on confirmation (it is NOT NULL). A used
   link is neutralised by the `status` + expiry checks instead.

   **Confirming works without JavaScript**, via the same form-POST fallback as the
   opt-out (see step 4 for how it works and why a POST keeps scanners out).
   Strictly speaking this one fails safe — no confirmation just means no
   subscription — but a visitor whose client can't run the call would otherwise be
   stuck on the spinner and could never subscribe at all. The 303 matters here in
   particular: a reload that repeated the POST on an expired link would rotate the
   token again and send a second mail.

4. **Unsubscribe** — the mail links to
   `{website_url}/newsletter/unsubscribe?token={unsubscribe_token}` (page
   `pages/newsletter/unsubscribe.vue`, route `POST /api/newsletter/unsubscribe`).

   The token here is the **`unsubscribe_token`, not the confirm token**: it never
   expires and stays valid after confirmation, because an unsubscribe link has to
   keep working for the life of the subscription. Like confirmation, the call runs
   client-side only, so a mail scanner can't opt someone out on their behalf.

   | Situation                                 | Result                                     | Page state             |
   | ----------------------------------------- | ------------------------------------------ | ---------------------- |
   | any status except `unsubscribed`          | `status = unsubscribed`, `unsubscribed_at` | `unsubscribed`         |
   | already `unsubscribed`                    | no-op (idempotent)                         | `already_unsubscribed` |
   | unknown token                             | no-op                                      | `invalid`              |
   | Directus down / token misconfigured (500) | no-op                                      | `error` (retry)        |

   Opting out works from `pending` too — someone who never confirmed can still
   say no, and it stops the confirmation resends. The write is guarded on
   not-already-unsubscribed, so `unsubscribed_at` keeps the timestamp of the first
   opt-out rather than being pushed forward by every re-click. Coming back is
   possible via a normal signup, see step 1.

   **Opting out never depends on JavaScript.** The page also renders a plain form
   that POSTs to `server/routes/newsletter/unsubscribe.post.ts` (a Nitro route
   sharing the page's URL, POST only, so the page's GET is untouched). It covers
   JavaScript disabled or blocked by CSP, a hydration that failed, and a
   client-side call that hangs. Being a form POST, it keeps the protection the
   client-side call existed for: scanners and link-expanders follow links, they
   don't submit forms. Confirmation has the same fallback (step 3).

   The form route answers **POST → 303 → GET** on `?status=<result>`, which the
   page renders server-side, so a reload can't repeat the submission. A crafted
   `?status=` therefore changes only what is displayed — nothing is written on that
   path — and unknown values fall back to the loading state. In the `error` state
   the retry CTA becomes a second form submit, so recovering doesn't need a client
   either. Both routes share `server/utils/newsletterUnsubscribe.ts`, so "what
   counts as an unusable link" is defined once.

   The form is rendered inside the loading state, which means visitors with working
   JavaScript may see it for the moment before the call resolves. That's deliberate:
   hiding it until a timeout would make the guarantee depend on the very client
   that might be broken.

## Shared page pieces

Both token pages are thin: they supply their own copy map and nothing else.

- `composables/useNewsletterTokenAction.ts` — the flow: reads `?token=`, posts it
  to the given route on the **client only** (`onMounted`, never during SSR — that
  is what keeps scanners and prefetchers from confirming or unsubscribing), maps
  the result onto a status, and handles the `?preview=` and `?status=` overrides
  (the latter is how the no-JS form redirect hands its outcome back).
- `components/NewsletterStatusPanel.vue` — the result page: spotlights, status
  icon, eyebrow, headline, copy, CTA (a retry button when the view sets `retry`)
  and the non-prod state switcher. An optional `fallback` prop adds the no-JS form
  described in step 4; both pages set it. When a view asks for a `retry` CTA and a
  fallback exists, the retry is rendered as a form submit rather than a JS button,
  so recovering from the `error` state doesn't need a client either.
- `server/utils/newsletterConfirm.ts` / `newsletterUnsubscribe.ts` — the actual
  decisions (what is an unusable link, how a lost race is answered), shared by each
  flow's JSON route and its form route so the two cannot diverge.

**Previewing the states without the flow:** when `FLAG_ENABLE_UI_PREVIEWS` is set
(non-prod only — off in production), both pages accept `?preview=<state>` to
render any state directly (no API call) and show a small state-switcher toolbar.
This previews the real page, so there's no separate mock to drift from.

Both routes are excluded from ISR in `nuxt.config.ts` — they render per request
from the query, and a cached query-less render would otherwise be served for
every token.

## Permissions for the API token

The website talks to Directus with `NUXT_DIRECTUS_API_TOKEN`; its policy needs
these fields on `newsletter_subscribers`. Field lists matter here — a missing
field is a **403**, which the routes surface as a technical error (500), not as
an invalid link.

| Action | Fields                                                                                                              | Why                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Create | `email`, `confirm_token_expires_at`                                                                                 | signup writes the email; the hook adds the window      |
| Read   | `id`, `status`, `confirm_token`, `confirm_token_expires_at`, `confirmed_at`, `unsubscribe_token`, `unsubscribed_at` | token lookups filter on the tokens and evaluate expiry |
| Update | `status`, `confirmed_at`, `confirm_token`, `confirm_token_expires_at`, `unsubscribed_at`                            | confirm, refresh, unsubscribe, reactivate              |

**`confirm_token_expires_at` needs create _and_ update permission even though
the website never sets it.** Filter hooks mutate the payload inside the caller's
request, and Directus validates the payload _after_ hooks against the caller's
policy (`ItemsService.updateMany` → `emitFilter` → `validateItemAccess({ action:
'update', fields: Object.keys(payloadAfterHooks) })`). So the field the CMS adds
is checked against the website's permissions. Moving the TTL into the CMS moved
the _value_, not the permission requirement.

Filters in a query-based update (`refreshNewsletterConfirmation` and friends) are
**not** permission-checked — `getKeysByQuery` resolves them through an
`ItemsService` constructed without accountability. Only payload fields are.

**Read permission is also what makes the guarded writes work.** They infer "did I
win the race?" from the number of rows the PATCH returns, and Directus produces
those by reading the updated rows back — a read whose `Forbidden` the controller
**swallows** (`controllers/items.js`: `catch → if Forbidden return next()`). Without
read permission the response carries no `data`, so a _successful_ write looks like
a lost race and confirm answers `already_confirmed` / `invalid` with nothing in the
logs. Update permission alone is not enough.

## `email_templates`

Create one row in the `email_templates` collection. Handlebars syntax
(`{{variable}}`, `{{{raw_html}}}`).

| Template Key               | Trigger                                                | Available Variables              |
| -------------------------- | ------------------------------------------------------ | -------------------------------- |
| `newsletter_double_opt_in` | New `pending` subscriber, or an expired link refreshed | `confirm_url`, `unsubscribe_url` |

`unsubscribe_url` is optional in this template — nothing is subscribed yet until
the address confirms. It is available because the token is permanent, so the same
link can be reused verbatim in later newsletter issues, where an unsubscribe link
is mandatory.

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

## Issues: rendering and Live Preview

Issues live in `newsletter_issues` with an M2A field `blocks` (junction `newsletter_issues_blocks`:
`sort`, `collection`, `item`) over `newsletter_blocks_text`, `newsletter_blocks_podcasts` and
`newsletter_blocks_meetups`. The podcast/meetup blocks are M2M over
`newsletter_blocks_podcasts_podcasts` / `newsletter_blocks_meetups_meetups`, each with its own `sort`.

- **Renderer** — `src/newsletter/render/` in the extension bundle. `renderNewsletterIssue(issue, options)`
  is a pure function (data in, HTML out) built on MJML: subject/preheader, the blocks in `sort` order, and
  a footer with the unsubscribe slot. One partial per block type in `render/blocks/`. Plain-text fields are
  escaped; the text block's rich text is sanitized to the editor's toolbar tags. Podcast/meetup links use
  the `website_url` setting. Without `unsubscribeUrl` (the preview) a placeholder is rendered; the send
  job must pass the subscriber's link.
- **Published filter** — podcasts and meetups appear only with `status = published`, the same rule the
  website follows (its Directus queries do not filter, the public permissions do; drafts/archived items
  are 404 there). It lives in the renderer (`render/published.ts`), so preview and send can never differ.
  Filtered entries come back as `hidden` (`{ collection, title, status, reason }`); a podcast/meetup block
  left empty renders nothing and adds a warning.
- **Loading** — `src/newsletter/loadIssue.ts` holds the field list and reads an issue, optionally from a
  Content Version (`ItemsService.readOne(id, { version })`; Directus applies the version's delta in a
  rolled-back transaction).
- **Live Preview** — endpoint `GET /newsletter-preview/:id?version=<key>`, for every logged-in backend user
  (401 otherwise); the issue is read with the user's own permissions (403 without read access), 404 for an
  unknown issue or version. Above the mail it shows a preview-only notice listing hidden entries and
  warnings ("N Einträge ausgeblendet, weil nicht veröffentlicht: …"); the rendered mail never contains it.
  Preview URL of `newsletter_issues`:
  `https://admin.programmier.bar/newsletter-preview/{{id}}?version={{$version}}`. The preview reloads
  after saving; a new issue has no preview until it was saved once.

Non-destructive newsletter actions (Live Preview, test send to the own address) are open to every logged-in
backend user and read with their own permissions; destructive or irreversible ones stay admin-only.

## Issues: test send ("Testversand an mich")

- **Interface** `newsletter-actions` ("Newsletter-Aktionen", alias/presentation field) on the
  `newsletter_issues` item page, same pattern as `invoice-actions`. It shows the button "Testversand an
  mich", a confirm dialog naming the recipient, and the result (incl. hidden entries and warnings). On an
  unsaved new issue it only shows a hint.
- **Endpoint** `POST /newsletter-send/:id/test`, for **any logged-in user** (401 otherwise) who can read
  the issue: it is loaded with the user's own permissions (403 if they may not read it or its blocks,
  podcasts, meetups). Sends the **saved** issue (live item, never a Content Version) to the **user's own
  address**, read from `directus_users` for `accountability.user` only (with admin rights, since a
  non-admin policy may not cover `directus_users`) — there is no recipient parameter. 400 if the account
  has no email or the issue no subject, 404 for an unknown or unsaved issue, 502 if the mail fails. Subject `[TEST] <subject>`. Nothing is written: no
  `newsletter_sends` row, no status change; the send is logged.
- **Rendering** with the shared `renderNewsletterIssue`, so the same published filter as preview and real
  send applies. Hidden entries and warnings go back to the UI, never into the mail.
- **Unsubscribe**: if the user's address is a `confirmed` subscriber, the mail carries their real link
  (clicking it really unsubscribes). Otherwise the token is `00000000-0000-0000-0000-000000000000`, a
  well-formed UUID that matches nobody, so the website answers "invalid link". (Directus answers a
  malformed token on the uuid column with a 500; the website now rejects non-UUID confirm and unsubscribe
  tokens as "invalid" before asking Directus, see `nuxt-app/server/utils/newsletterToken.ts`.)
- **Headers**: `List-Unsubscribe: <https://…/newsletter/unsubscribe?token=…>` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058), via the new `headers` option of
  `sendRawEmail`/`sendTemplatedEmail` in `src/shared/email-service.ts` (MailService passes it to
  nodemailer). No `mailto:` entry, because no mailbox processes unsubscribe mails. From address: Directus
  `EMAIL_FROM`, as for all CMS mail.
- **One-click on the website**: `nuxt-app/server/routes/newsletter/unsubscribe.post.ts` serves the same URL
  as the page. A POST with body `List-Unsubscribe=One-Click` takes the token from the query, opts out and
  answers 200 (500 on a technical error) instead of the form's 303 redirect.
