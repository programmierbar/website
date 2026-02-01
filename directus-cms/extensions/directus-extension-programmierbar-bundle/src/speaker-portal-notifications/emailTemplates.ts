/**
 * Email templates for speaker portal notifications.
 * All emails are in German as the podcast is for the German developer community.
 */

export interface SpeakerEmailData {
    firstName: string
    lastName: string
    email: string
    portalUrl: string
    deadline?: string
    podcastTitle?: string
    recordingDate?: string
}

/**
 * Email template for inviting a speaker to the portal.
 */
export function buildInvitationEmail(data: SpeakerEmailData): { subject: string; html: string } {
    const formattedDeadline = data.deadline
        ? new Date(data.deadline).toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : 'in den nächsten zwei Wochen'

    const recordingInfo = data.recordingDate
        ? `<p>Die Aufnahme ist für den <strong>${new Date(data.recordingDate).toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })}</strong> geplant.</p>`
        : ''

    return {
        subject: `programmier.bar: Bitte sende uns deine Informationen${data.podcastTitle ? ` für "${data.podcastTitle}"` : ''}`,
        html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>programmier.bar Speaker Portal</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">programmier.bar</h1>
        <p style="color: #a3e635; margin: 10px 0 0 0; font-size: 14px;">Der Podcast für App- und Webentwicklung</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1a1a1a; margin-top: 0;">Hallo ${data.firstName}!</h2>

        <p>Wir freuen uns sehr, dass du bei unserem Podcast zu Gast sein wirst! Um dich bestmöglich präsentieren zu können, benötigen wir einige Informationen und Bilder von dir.</p>

        ${recordingInfo}

        <p>Bitte nutze unser Speaker Portal, um uns folgende Informationen zukommen zu lassen:</p>

        <ul style="padding-left: 20px;">
            <li><strong>Persönliche Informationen:</strong> Name, Titel, Position, Unternehmen</li>
            <li><strong>Kurze Bio:</strong> Ein paar Sätze über dich und deine Arbeit</li>
            <li><strong>Social Media Links:</strong> LinkedIn, Twitter/X, Bluesky, etc.</li>
            <li><strong>Profilbild:</strong> Ein professionelles Foto (min. 800x800px)</li>
            <li><strong>Action Shot:</strong> Ein Foto von dir "in Aktion" oder in einer lockeren Situation</li>
        </ul>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <p style="margin: 0 0 10px 0;"><strong>Deadline:</strong> ${formattedDeadline}</p>
            <a href="${data.portalUrl}" style="display: inline-block; background: #a3e635; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Zum Speaker Portal</a>
        </div>

        <p style="font-size: 14px; color: #666;">Der Link ist 14 Tage gültig. Falls du mehr Zeit benötigst, melde dich einfach bei uns.</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="font-size: 14px; color: #666;">
            Bei Fragen erreichst du uns jederzeit unter <a href="mailto:podcast@programmier.bar" style="color: #333;">podcast@programmier.bar</a>.
        </p>

        <p style="margin-bottom: 0;">Viele Grüße,<br><strong>Das programmier.bar Team</strong></p>
    </div>

    <div style="text-align: center; padding: 20px; font-size: 12px; color: #999;">
        <p>programmier.bar - Der Podcast für App- und Webentwicklung</p>
    </div>
</body>
</html>`,
    }
}

/**
 * Email template for deadline reminder (3 days before).
 */
export function buildReminderEmail(data: SpeakerEmailData): { subject: string; html: string } {
    const formattedDeadline = data.deadline
        ? new Date(data.deadline).toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : 'bald'

    return {
        subject: `Erinnerung: Deine Informationen für programmier.bar`,
        html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>programmier.bar - Erinnerung</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">programmier.bar</h1>
        <p style="color: #a3e635; margin: 10px 0 0 0; font-size: 14px;">Der Podcast für App- und Webentwicklung</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1a1a1a; margin-top: 0;">Hallo ${data.firstName}!</h2>

        <p>Dies ist eine freundliche Erinnerung, dass wir noch auf deine Informationen für unseren Podcast warten.</p>

        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
            <p style="margin: 0;"><strong>Die Deadline ist ${formattedDeadline}.</strong></p>
        </div>

        <p>Bitte fülle das Formular aus, damit wir dich bestmöglich im Podcast präsentieren können:</p>

        <div style="text-align: center; margin: 25px 0;">
            <a href="${data.portalUrl}" style="display: inline-block; background: #a3e635; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Jetzt ausfüllen</a>
        </div>

        <p style="font-size: 14px; color: #666;">Falls du Schwierigkeiten hast oder mehr Zeit benötigst, melde dich einfach bei uns!</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="margin-bottom: 0;">Viele Grüße,<br><strong>Das programmier.bar Team</strong></p>
    </div>
</body>
</html>`,
    }
}

/**
 * Email template for urgent reminder (1 day before deadline).
 */
export function buildUrgentReminderEmail(data: SpeakerEmailData): { subject: string; html: string } {
    const formattedDeadline = data.deadline
        ? new Date(data.deadline).toLocaleDateString('de-DE', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : 'morgen'

    return {
        subject: `Dringend: Deine Informationen werden morgen benötigt!`,
        html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>programmier.bar - Dringende Erinnerung</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">programmier.bar</h1>
        <p style="color: #fff; margin: 10px 0 0 0; font-size: 14px;">Dringende Erinnerung</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1a1a1a; margin-top: 0;">Hallo ${data.firstName}!</h2>

        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p style="margin: 0; color: #721c24;"><strong>Deine Deadline ist ${formattedDeadline}!</strong></p>
        </div>

        <p>Wir haben bemerkt, dass du deine Informationen noch nicht eingereicht hast. Um die Podcast-Folge optimal vorbereiten zu können, benötigen wir diese dringend.</p>

        <div style="text-align: center; margin: 25px 0;">
            <a href="${data.portalUrl}" style="display: inline-block; background: #dc3545; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">Jetzt ausfüllen</a>
        </div>

        <p>Falls es Probleme gibt oder du doch nicht teilnehmen kannst, gib uns bitte kurz Bescheid unter <a href="mailto:podcast@programmier.bar" style="color: #333;">podcast@programmier.bar</a>.</p>

        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

        <p style="margin-bottom: 0;">Viele Grüße,<br><strong>Das programmier.bar Team</strong></p>
    </div>
</body>
</html>`,
    }
}

/**
 * Email template for submission confirmation to the speaker.
 */
export function buildSubmissionConfirmationEmail(data: SpeakerEmailData): { subject: string; html: string } {
    return {
        subject: `Vielen Dank für deine Informationen - programmier.bar`,
        html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Danke!</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">programmier.bar</h1>
        <p style="color: #a3e635; margin: 10px 0 0 0; font-size: 14px;">Der Podcast für App- und Webentwicklung</p>
    </div>

    <div style="background: #fff; padding: 30px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #1a1a1a; margin-top: 0;">Vielen Dank, ${data.firstName}!</h2>

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
    }
}

/**
 * Email template for admin notification when a speaker submits.
 */
export function buildAdminNotificationEmail(data: SpeakerEmailData): { subject: string; html: string } {
    return {
        subject: `Neue Speaker-Einreichung: ${data.firstName} ${data.lastName}`,
        html: `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <h2>Neue Speaker-Einreichung</h2>

    <p><strong>${data.firstName} ${data.lastName}</strong> hat soeben das Speaker Portal Formular ausgefüllt.</p>

    ${data.podcastTitle ? `<p>Episode: ${data.podcastTitle}</p>` : ''}

    <p>Bitte überprüfe die eingereichten Informationen im Directus CMS.</p>
</body>
</html>`,
    }
}
