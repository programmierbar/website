import { z } from 'zod';
import * as functions from 'firebase-functions';
import { isKeyInObject } from './isKeyInObject';

/**
 * Helper function with custom error handling that parses
 * data with a Zod schema and then returns it.
 *
 * @param zodSchema A Zod scheme of expected data.
 * @param data The data to be parsed.
 *
 * @returns The parsed data.
 */
export function getParsedZodSchema<T>(
  zodSchema: z.ZodType<T>,
  data: unknown
): T {
  try {
    // Parse data and then return it
    return zodSchema.parse(data);

    // Handle errors
  } catch (error) {
    // Check instance of error object
    if (error instanceof z.ZodError) {
      error.errors.forEach((suberror) => {
        // Convert path array to readable string
        const path = suberror.path.join('.');

        // Use path to get value that caused error
        const value = suberror.path.reduce(
          (value, path) =>
            value && typeof value === 'object' && isKeyInObject(path, value)
              ? value[path]
              : value,
          data
        );

        // Add debugging info to console
        functions.logger.debug(
          `Zod error  at "${path}" with value "${value}".`
        );
      });

      // Throw expected Zod error with first error messages that occurred
      throw new functions.https.HttpsError(
        'invalid-argument',
        error.errors[0].message
      );
    }

    // Add debugging info to console
    functions.logger.debug('error:', error);

    // Throw unexpected error
    throw new functions.https.HttpsError(
      'unknown',
      'Oh nein! Ein unerwarteter Fehler ist aufgetreten. Bei Bedarf kannst du uns unter "podcast@programmier.bar" kontaktieren.'
    );
  }
}
