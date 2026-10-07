import { EVENT_VENUE } from '../../../../../../shared-code/index.ts'
import { formatDateGerman } from '../../shared/email-service.ts'
import { escapeHtml as esc, htmlToText } from '../../shared/html.ts'
import { parseAgenda, type AgendaItem } from './agenda.ts'

// The confirmation mail is kept in code rather than in `email_templates`: its
// table layout and inline styles are what make it render in mail clients, and
// the WYSIWYG editor of `email_templates.body_html` rewrites both on save.

/** Mail images are served by the production website (nuxt-app/public/images/mail). */
const MAIL_ASSET_URL = 'https://www.programmier.bar/images/mail'

const CONTACT_EMAIL = 'podcast@programmier.bar'
const TIME_ZONE = 'Europe/Berlin'

export interface ConfirmationMailInput {
    fullName: string
    wantsMeetupUpdates: boolean
    meetup: {
        title: string
        slug: string
        start_on: string
        end_on: string
        intro?: string | null
        agenda?: string | null
    }
    talks: { title: string; abstract?: string | null }[]
    speakers: { name: string; occupation?: string | null; imageUrl?: string | null }[]
    websiteUrl: string
    cancelUrl: string
    calendarLinks: { google: string; outlook: string; office365: string; ics: string }
}

export interface RenderedMail {
    subject: string
    html: string
    text: string
}

const FONT = "font-family:'Museo Sans',Arial,Helvetica,sans-serif;"
const MONO = "font-family:'DM Mono','Courier New',monospace;"
const SECTION_LABEL = `margin:0 0 16px 0;padding-bottom:10px;border-bottom:1px solid #6B7075;${FONT}font-size:12px;line-height:16px;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:#FFFFFF;`
const LIME_LINK = 'font-weight:700;color:#CFFF00;text-decoration:none;'

export function formatMeetupDate(iso: string) {
    return formatDateGerman(iso, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: TIME_ZONE,
    })
}

export function formatMeetupTime(startIso: string, endIso: string) {
    const format = (iso: string) =>
        new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE })
    return `${format(startIso)} – ${format(endIso)}`
}

/**
 * Give the editor's rich text (meetup intro, talk abstract) the inline styles a
 * mail needs; without them links show up in the client's default blue. The HTML
 * is authored by the team in the CMS, so it is trusted as-is otherwise.
 */
export function styleRichText(html: string) {
    return html
        .replace(/<p\b[^>]*>/gi, '<p style="margin:0 0 14px 0;">')
        .replace(/<a\b/gi, `<a style="${LIME_LINK}"`)
        .replace(/<(ul|ol)\b[^>]*>/gi, '<$1 style="margin:0 0 14px 0;padding-left:20px;">')
}

/** Rich text as plain text for the text part, links as "text (url)". */
export function richTextToPlainText(html: string) {
    return htmlToText(html, (href, text) => (text && text !== href ? `${text} (${href})` : href))
}

function initials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(-2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
}

function speakersHtml(speakers: ConfirmationMailInput['speakers']) {
    return speakers
        .map((speaker) => {
            const avatar = speaker.imageUrl
                ? `<td width="56" valign="middle" style="width:56px;"><img src="${esc(speaker.imageUrl)}" width="56" height="56" alt="" style="display:block;border:0;width:56px;height:56px;border-radius:28px;"></td>`
                : `<td width="56" height="56" align="center" valign="middle" bgcolor="#36363E" style="width:56px;height:56px;border-radius:28px;background-color:#36363E;${FONT}font-size:16px;font-weight:700;color:#FFFFFF;">${esc(initials(speaker.name))}</td>`
            const occupation = speaker.occupation
                ? `<br><span style="font-weight:300;color:#B5B9BC;">${esc(speaker.occupation)}</span>`
                : ''
            return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0;"><tr>${avatar}<td valign="middle" style="padding:0 0 0 14px;${FONT}font-size:15px;line-height:21px;color:#FFFFFF;"><span style="font-weight:700;">${esc(speaker.name)}</span>${occupation}</td></tr></table>`
        })
        .join('\n')
}

function agendaHtml(items: AgendaItem[]) {
    const rows = items
        .map(
            (item) =>
                `<tr><td width="96" valign="top" style="padding:7px 0;border-bottom:1px solid #36363E;${MONO}font-size:14px;line-height:22px;color:#FFFFFF;">${esc(item.time)}</td><td valign="top" style="padding:7px 0;border-bottom:1px solid #36363E;${FONT}font-size:15px;line-height:22px;font-weight:300;color:#FFFFFF;">${esc(item.label)}</td></tr>`
        )
        .join('')
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`
}

function talksHtml(talks: ConfirmationMailInput['talks']) {
    return talks
        .map(
            (talk) =>
                `<p style="margin:0 0 6px 0;${MONO}font-size:14px;line-height:20px;color:#E92980;">Talk</p>
      <p style="margin:0 0 10px 0;font-size:20px;line-height:26px;font-weight:700;">${esc(talk.title)}</p>
      <div style="margin:0 0 20px 0;">${talk.abstract ? styleRichText(talk.abstract) : ''}</div>`
        )
        .join('\n')
}

function footerNotice(input: ConfirmationMailInput) {
    const base =
        `Du bekommst diese E-Mail, weil du dich mit dieser Adresse auf programmier.bar für das Meetup „${input.meetup.title}“ angemeldet hast. ` +
        'Wir nutzen deine Angaben für die Organisation des Meetups.'
    const updates = input.wantsMeetupUpdates
        ? ` Außerdem informieren wir dich per E-Mail über kommende Meetups, wie du es bei der Anmeldung gewünscht hast. Das kannst du jederzeit mit einer kurzen Mail an ${CONTACT_EMAIL} widerrufen.`
        : ''
    return base + updates
}

/** Subject, HTML and plain-text part of the meetup confirmation mail. */
export function buildConfirmationMail(input: ConfirmationMailInput): RenderedMail {
    const { meetup, websiteUrl, calendarLinks } = input
    const date = formatMeetupDate(meetup.start_on)
    const time = formatMeetupTime(meetup.start_on, meetup.end_on)
    const agenda = parseAgenda(meetup.agenda)
    const venueAddress = `${EVENT_VENUE.streetAddress}, ${EVENT_VENUE.postalCode} ${EVENT_VENUE.locality}`
    const urls = {
        meetupPage: `${websiteUrl}/meetup/${meetup.slug}`,
        recordings: `${websiteUrl}/aufnahmen`,
        codeOfConduct: `${websiteUrl}/verhaltensregeln`,
        privacy: `${websiteUrl}/datenschutz`,
        imprint: `${websiteUrl}/impressum`,
    }
    const recordingsText = `Beim Meetup können Foto-, Video- oder Audioaufnahmen entstehen. Wir nutzen sie ausschließlich für die Öffentlichkeitsarbeit über programmier.bar- und Lotum-Events. Du kannst dem jederzeit widersprechen: persönlich bei einem programmier.bar-Teammitglied vor Ort oder per E-Mail an ${CONTACT_EMAIL}.`
    const cocIntro =
        'Wir wollen, dass sich beim Meetup alle wohlfühlen. Deshalb erwarten wir von allen, dass sie sich an unsere'
    const subject = `Du bist beim Meetup dabei: ${meetup.title} am ${date}`
    const calendarLink = (href: string, label: string) =>
        `<a href="${esc(href)}" style="color:#FFFFFF;font-weight:500;text-decoration:none;border-bottom:1px solid #6B7075;">${label}</a>`
    const divider = '<span style="color:#4B4F53;">&nbsp;&nbsp;|&nbsp;&nbsp;</span>'
    const logo = (width: number, height: number) =>
        `<a href="${esc(websiteUrl)}" style="display:block;text-decoration:none;"><img src="${MAIL_ASSET_URL}/logo.png" width="${width}" height="${height}" alt="programmier.bar" style="display:block;border:0;width:${width}px;height:${height}px;${FONT}font-size:${Math.round(width / 9)}px;font-weight:700;color:#FFFFFF;"></a>`

    const html = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Deine Meetup-Anmeldung für ${esc(meetup.title)} am ${esc(date)} ist bestätigt. Alle Infos und Links für deinen Kalender.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000;">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="width:100%;max-width:600px;background-color:#000000;">

  <tr>
    <td style="padding:16px 24px 0 24px;">${logo(200, 66)}</td>
  </tr>

  <tr>
    <td style="padding:40px 24px 8px 24px;">
      <p style="margin:0 0 10px 0;${MONO}font-size:15px;line-height:20px;color:#E92980;">Deine Meetup-Anmeldung</p>
      <h1 style="margin:0;${FONT}font-size:36px;line-height:42px;font-weight:900;color:#FFFFFF;">Du bist beim Meetup dabei!</h1>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 24px 0 24px;${FONT}font-size:16px;line-height:25px;font-weight:300;color:#FFFFFF;">
      <p style="margin:0 0 14px 0;">Hallo ${esc(input.fullName)},</p>
      <p style="margin:0;">danke für deine Anmeldung! Dein Platz beim Meetup ist reserviert. Hier sind alle Infos auf einen Blick.</p>
    </td>
  </tr>

  <tr>
    <td style="padding:36px 24px 0 24px;">
      <p style="${SECTION_LABEL}">Dein Meetup</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#131415" style="background-color:#131415;border:1px solid #4B4F53;">
        <tr>
          <td colspan="2" style="padding:22px 22px 12px 22px;${FONT}font-size:22px;line-height:28px;font-weight:700;color:#FFFFFF;">${esc(meetup.title)}</td>
        </tr>
        <tr>
          <td width="100" valign="top" style="padding:8px 0 8px 22px;${FONT}font-size:11px;line-height:23px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#B5B9BC;">Datum</td>
          <td valign="top" style="padding:8px 22px 8px 0;${FONT}font-size:16px;line-height:23px;font-weight:500;color:#FFFFFF;">${esc(date)}</td>
        </tr>
        <tr>
          <td width="100" valign="top" style="padding:8px 0 8px 22px;${FONT}font-size:11px;line-height:23px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#B5B9BC;">Uhrzeit</td>
          <td valign="top" style="padding:8px 22px 8px 0;${FONT}font-size:16px;line-height:23px;font-weight:500;color:#FFFFFF;">${esc(time)} Uhr</td>
        </tr>
        <tr>
          <td width="100" valign="top" style="padding:8px 0 22px 22px;${FONT}font-size:11px;line-height:23px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:#B5B9BC;">Ort</td>
          <td valign="top" style="padding:8px 22px 22px 0;${FONT}font-size:16px;line-height:23px;font-weight:300;color:#FFFFFF;">
            ${esc(EVENT_VENUE.name)}<br>${esc(venueAddress)}<br>
            <a href="${esc(EVENT_VENUE.mapsUrl)}" style="${LIME_LINK}">In Google Maps öffnen</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:14px 24px 0 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="28" valign="top" style="padding:1px 8px 0 0;"><img src="${MAIL_ASSET_URL}/calendar.png" width="20" height="20" alt="" style="display:block;border:0;width:20px;height:20px;"></td>
          <td valign="top" style="${FONT}font-size:13px;line-height:22px;font-weight:300;color:#B5B9BC;">
            Zum Kalender hinzufügen:&nbsp;
            ${calendarLink(calendarLinks.google, 'Google')}${divider}${calendarLink(calendarLinks.outlook, 'Outlook.com')}${divider}${calendarLink(calendarLinks.office365, 'Microsoft 365')}${divider}${calendarLink(calendarLinks.ics, 'Apple (.ics)')}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:36px 24px 0 24px;${FONT}font-size:16px;line-height:25px;font-weight:300;color:#FFFFFF;">
      <p style="${SECTION_LABEL}">Programm</p>
      ${meetup.intro ? `<div style="margin:0 0 24px 0;">${styleRichText(meetup.intro)}</div>` : ''}
      ${talksHtml(input.talks)}
      ${speakersHtml(input.speakers)}
      <p style="${SECTION_LABEL}margin-top:28px;">Ablauf</p>
      ${agendaHtml(agenda)}
      <p style="margin:18px 0 0 0;font-size:14px;line-height:21px;"><a href="${esc(urls.meetupPage)}" style="font-weight:500;color:#B5B9BC;text-decoration:underline;">Zur Meetup-Seite auf programmier.bar</a></p>
    </td>
  </tr>

  <tr>
    <td style="padding:36px 24px 0 24px;${FONT}font-size:16px;line-height:25px;font-weight:300;color:#FFFFFF;">
      <p style="${SECTION_LABEL}">Fotos und Videos</p>
      <p style="margin:0;">${esc(recordingsText)} <a href="${esc(urls.recordings)}" style="${LIME_LINK}">Hinweis zu Foto- und Videoaufnahmen</a></p>
    </td>
  </tr>

  <tr>
    <td style="padding:36px 24px 0 24px;${FONT}font-size:16px;line-height:25px;font-weight:300;color:#FFFFFF;">
      <p style="${SECTION_LABEL}">Verhaltensregeln</p>
      <p style="margin:0;">${cocIntro} <a href="${esc(urls.codeOfConduct)}" style="${LIME_LINK}">Verhaltensregeln</a> halten.</p>
    </td>
  </tr>

  <tr>
    <td style="padding:36px 24px 0 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#131415" style="background-color:#131415;border:1px solid #4B4F53;">
        <tr>
          <td style="padding:22px;${FONT}font-size:16px;line-height:25px;font-weight:300;color:#FFFFFF;">
            <p style="margin:0 0 6px 0;font-size:20px;line-height:26px;font-weight:700;">Du kannst doch nicht?</p>
            <p style="margin:0 0 18px 0;">Dann sag deine Teilnahme bitte ab, damit jemand anderes deinen Platz bekommen kann.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="border:2px solid #E92980;">
                  <a href="${esc(input.cancelUrl)}" style="display:inline-block;padding:11px 18px;${FONT}font-size:12px;line-height:16px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#FFFFFF;text-decoration:none;">Meetup-Teilnahme absagen</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:32px 24px 40px 24px;${FONT}font-size:16px;line-height:25px;font-weight:300;color:#FFFFFF;">
      <p style="margin:0;">Wir freuen uns auf dich!<br><span style="font-weight:700;">Dein programmier.bar Team</span></p>
    </td>
  </tr>

  <tr>
    <td bgcolor="#131415" style="background-color:#131415;padding:24px 24px 28px 24px;${FONT}font-size:12px;line-height:19px;font-weight:300;color:#B5B9BC;">
      <div style="margin:0 0 16px 0;">${logo(130, 43)}</div>
      <p style="margin:0 0 12px 0;">${esc(footerNotice(input))}</p>
      <p style="margin:0 0 12px 0;">
        <a href="${esc(urls.privacy)}" style="font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#CFFF00;text-decoration:none;">Datenschutzerklärung</a>
        &nbsp;&nbsp;
        <a href="${esc(urls.imprint)}" style="font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#CFFF00;text-decoration:none;">Impressum</a>
      </p>
      <p style="margin:0;">${esc(EVENT_VENUE.name)} · ${esc(EVENT_VENUE.streetAddress)} · ${esc(`${EVENT_VENUE.postalCode} ${EVENT_VENUE.locality}`)}</p>
    </td>
  </tr>

</table>
</td>
</tr>
</table>
</body>
</html>`

    const programme = [
        meetup.intro ? richTextToPlainText(meetup.intro) : '',
        ...input.talks.map((talk) =>
            [`Talk: ${talk.title}`, talk.abstract ? richTextToPlainText(talk.abstract) : ''].filter(Boolean).join('\n')
        ),
        input.speakers
            .map((speaker) => `Speaker: ${speaker.name}${speaker.occupation ? `, ${speaker.occupation}` : ''}`)
            .join('\n'),
    ].filter(Boolean)

    const text = [
        `Hallo ${input.fullName},`,
        '',
        'danke für deine Anmeldung! Dein Platz beim Meetup ist reserviert.',
        '',
        meetup.title,
        `Datum:   ${date}`,
        `Uhrzeit: ${time} Uhr`,
        `Ort:     ${EVENT_VENUE.name}, ${venueAddress}`,
        `Karte:   ${EVENT_VENUE.mapsUrl}`,
        `Seite:   ${urls.meetupPage}`,
        '',
        'ZUM KALENDER HINZUFÜGEN',
        `Google Kalender:     ${calendarLinks.google}`,
        `Outlook.com:         ${calendarLinks.outlook}`,
        `Microsoft 365:       ${calendarLinks.office365}`,
        `Apple / iCal (.ics): ${calendarLinks.ics}`,
        '',
        'PROGRAMM',
        programme.join('\n\n'),
        '',
        'ABLAUF',
        agenda.map((item) => (item.time ? `${item.time.padEnd(11)}${item.label}` : item.label)).join('\n'),
        '',
        'FOTOS UND VIDEOS',
        recordingsText,
        `Hinweis zu Foto- und Videoaufnahmen: ${urls.recordings}`,
        '',
        'VERHALTENSREGELN',
        `${cocIntro} Verhaltensregeln halten: ${urls.codeOfConduct}`,
        '',
        'DU KANNST DOCH NICHT?',
        'Dann sag deine Teilnahme bitte ab, damit jemand anderes deinen Platz bekommen kann.',
        `Meetup-Teilnahme absagen: ${input.cancelUrl}`,
        '',
        'Wir freuen uns auf dich!',
        'Dein programmier.bar Team',
        '',
        '--',
        footerNotice(input),
        `Datenschutzerklärung: ${urls.privacy}`,
        `Impressum: ${urls.imprint}`,
        `${EVENT_VENUE.name} · ${EVENT_VENUE.streetAddress} · ${EVENT_VENUE.postalCode} ${EVENT_VENUE.locality}`,
    ].join('\n')

    return { subject, html, text }
}
