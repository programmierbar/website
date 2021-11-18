import * as functions from 'firebase-functions';

/**
 * Helper function that logs the passed error
 * and retuns a final error for the client.
 *
 * @param error A unknown error object.
 *
 * @returns A HTTPS error.
 */
export function getFinalError(error: unknown): functions.https.HttpsError {
  // Log passed error to console
  functions.logger.error(error);

  // Replace passed error if it is not an instance of "HttpsError"
  // to prevent leaking unwanted information
  const errorForClient =
    error instanceof functions.https.HttpsError
      ? error
      : new functions.https.HttpsError(
          'unknown',
          'Oh nein! Ein unerwarteter Fehler ist aufgetreten. Bei Bedarf kannst du uns unter "podcast@programmier.bar" kontaktieren.'
        );

  // Return error for client
  return errorForClient;
}
