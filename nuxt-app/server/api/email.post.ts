import { zh } from 'h3-zod'
import { EmailSchema, sendEmail } from '../utils'
import { filterSpam } from '../../helpers';

export default defineEventHandler(async (event) => {
  // Check honeypot before validation to avoid leaking form structure to bots
  const rawBody = await readBody(event)
  if (rawBody?.honeypot) {
    // Silently fail without revealing form structure
    return 'Deine Nachricht wurde an uns versendet.'
  }

  // Get parsed client data
    const clientData = await zh.useValidatedBody(event, EmailSchema).catch((e) => {
        const data = JSON.parse(e.data)
        const {
            path: [key],
            message,
        } = data.issues[0]

        throw createError({ statusCode: 400, message: `${key}: ${message}` })
    })

    const spamValidation = await filterSpam(clientData);

    if (spamValidation.isSpam === true && spamValidation.confidenceScore > 0.8) {
      console.log(`Spam blocked. Reason: ${spamValidation.reason}`);
      throw createError({
        statusCode: 400,
        statusMessage: 'Nachricht konnte nicht versendet werden.',
      });
    }

    // Send email with user's message to us
    console.debug("Send email with user's message to us")
    await sendEmail({
        to: 'programmier.bar <podcast@programmier.bar>',
        subject: 'Kontaktformular Nachricht',
        html: `
            <p>Name: ${clientData.name}</p>
            <p>E-Mail: ${clientData.email}</p>
            <p>Nachricht:</p>
            <p>${clientData.message.replace(/\n/g, '<br />')}</p>
          `,
    }).catch(genericError)

    // Send confirmation email to user
    console.debug('Send confirmation email to user')
    await sendEmail({
        to: `${clientData.name} <${clientData.email}>`,
        subject: 'Wir haben deine Nachricht erhalten',
        html: `
            <p>Hallo ${clientData.name},</p>
            <p>danke für deine Nachricht! Du erhältst in wenigen Tagen eine Antwort von uns.</p>
            <p>Deine Nachricht:</p>
            <blockquote style="margin-left: 10px; padding-left: 10px; border-left: solid 2px #00A1FF;">
              ${clientData.message.replace(/\n/g, '<br />')}
            </blockquote>
            <p>
              Falls es sich bei deinem Anliegen um einen Bug auf unserer Webseite handelt, kannst du gern einen
              <a href="https://github.com/programmierbar/website/pulls">Pull Request</a>
              erstellen. 🤓
            </p>
            <p>Bitte antworte nicht auf diese automatisch generierte E-Mail.</p>
            <p>Liebe Grüße</p>
            <p>dein programmier.bar Team</p>
            <p>
              Lotum media GmbH<br />
              Am Goldstein 1 | 61231 Bad Nauheim | Deutschland
            </p>
            <p>
              Tel.: <a href="tel:+4960329255070">+49 (0) 6032 – 92 55 07 0</a><br />
              Fax: <a href="tel:+49603292550777">+49 (0) 6032 – 92 55 07 77</a><br />
              Mail: <a href="mailto:podcast@programmier.bar">podcast@programmier.bar</a><br />
              Web: <a href="https://www.programmier.bar/">www.programmier.bar</a>
            </p>
            <p>
              Lotum media GmbH | Gesellschaftssitz: Bad Nauheim<br />
              Amtsgericht Friedberg, HRB 7067<br />
              Geschäftsführung: Dominik Anders, Jens Abke, Sebastian Schmitt
            </p>
          `,
    }).catch(genericError)

    return 'Deine Nachricht wurde an uns versendet.'
})

const genericError = (e: any) => {
    console.error(e)
    throw createError({
        statusCode: 400,
        message:
            'Oh nein! Ein unerwarteter Fehler ist aufgetreten. Bei Bedarf kannst du uns unter "podcast@programmier.bar" kontaktieren.',
    })
}
