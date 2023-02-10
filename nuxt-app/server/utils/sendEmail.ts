import nodemailer from 'nodemailer';

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: 'noreply@programmier.bar',
    pass: useRuntimeConfig().emailPassword,
  },
});

type EmailData = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Helper function that sends an email via nodemailer.
 *
 * @param emailData The email data.
 */
export async function sendEmail(emailData: EmailData): Promise<void> {
  return new Promise((resolve, reject) => {
    transporter.sendMail(
      {
        ...emailData,
        from: 'programmier.bar <noreply@programmier.bar>',
      },
      (error) => {
        if (error) {
          reject(error);
        }
        resolve();
      }
    );
  });
}
