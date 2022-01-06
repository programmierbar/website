/**
 * Helper function to convert a text into a URL slug.
 *
 * @param text The text to be converted.
 *
 * @returns A URL slug.
 */
export function getUrlSlug(text: string) {
  return (
    text
      // Convert to lower case
      .toLowerCase()

      // Convert special german characters
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')

      // Remove accents
      .normalize('NFD')
      .replace(/[\u0300-\u036F]/g, '')

      // Remove invalid characters
      .replace(/(^[^a-z0-9]+|[^a-z0-9/.\- ]+|[^a-z0-9]+$)/g, '')

      // Replace certain characters with a hyphen
      .replace(/( |\/|\.|-)+/g, '-')
  );
}
