import * as functions from 'firebase-functions';
import { z } from 'zod';
import { getParsedZodSchema, sendEmail, getFinalError } from '../helpers';
import { cors } from '../middleware';

export interface ClientData {
  name: string;
  email: string;
  message: string;
}

/**
 * It sends the contact email to us and a confirmation email to the user.
 */
export const sendContactEmail = functions
  .region('europe-west3')
  .runWith({ memory: '256MB', timeoutSeconds: 15 })
  .https.onRequest((request, response) =>
    cors(request, response, async () => {
      try {
        // Get parsed client data
        functions.logger.debug('Get parsed client data');
        const clientData = getParsedZodSchema(
          z.object({
            name: z
              .string()
              .min(1, 'Bitte trage deinen Namen ein.')
              .max(50, 'Dein Name darf nicht länger als 50 Zeichen lang sein.'),
            email: z
              .string()
              .email('Deine E-Mail-Adresse scheint ungültig zu sein.')
              .max(
                50,
                'Deine E-Mail-Adresse darf nicht länger als 50 Zeichen lang sein.'
              ),
            message: z
              .string()
              .min(1, 'Bitte trage deine Nachricht ein.')
              .max(
                5000,
                'Dein Nachricht darf nicht länger als 5.000 Zeichen lang sein.'
              ),
          }),
          request.body
        );

        // Send email with user's message to us
        functions.logger.debug("Send email with user's message to us");
        await sendEmail({
          to: 'programmier.bar <podcast@programmier.bar>',
          subject: 'Kontaktformular Nachricht',
          html: `
            <p>Name: ${clientData.name}</p>
            <p>E-Mail: ${clientData.email}</p>
            <p>Nachricht:</p>
            <p>${clientData.message.replace(/\n/g, '<br />')}</p>
          `,
        });

        // Send confirmation email to user
        functions.logger.debug('Send confirmation email to user');
        await sendEmail({
          to: `${clientData.name} <${clientData.email}>`,
          subject: 'Wir haben deine Nachricht erhalten',
          html: `
            <p>Hallo ${clientData.name},</p>
            <p>danke für deine Nachricht!</p>
            <p>Du erhältst in wenigen Tagen eine Antwort von uns.</p>
            <p>Deine Nachricht:</p>
            <blockquote style="margin-left: 10px; padding-left: 10px; border-left: solid 2px #00A1FF;">
              ${clientData.message.replace(/\n/g, '<br />')}
            </blockquote>
            <p>Bitte antworte nicht auf diese E-Mail – sie wurde automatisch generiert.</p>
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
        });

        // Terminate HTTPS function
        functions.logger.debug('Terminate HTTPS function');
        response.status(200).send('Deine Nachricht wurde an uns versendet.');

        // Handle errors
      } catch (error) {
        // Get final error
        functions.logger.debug('Get final error');
        const finalError = getFinalError(error);

        // Terminate HTTPS function
        functions.logger.debug('Terminate HTTPS function');
        response
          .status(finalError.code === 'unknown' ? 500 : 400)
          .send(finalError.message);
      }
    })
  );
