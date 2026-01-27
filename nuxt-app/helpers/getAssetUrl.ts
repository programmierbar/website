import { DIRECTUS_CMS_URL } from '~/config';

/**
 * Helper function to build the URL of an asset from Directus CMS.
 *
 * @param file The file object with an id property or a string id or null.
 * @param options The options object with a queryParams property.
 *
 * @returns The full URL to the asset.
 */
export function getAssetUrl(file?: { id: string } | string | null, options?: {queryParams: Record<string, string | number | boolean>}): string {

  if (!file) return '';

  let id = '';

  if (typeof file === 'string') {
    id = file;
  } else {
    id = file.id;
  }

  let url = `${DIRECTUS_CMS_URL}/assets/${id}`;

  if (options?.queryParams) {
    // Convert all values to strings for URLSearchParams
    const stringifiedParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(options.queryParams)) {
      stringifiedParams[key] = String(value);
    }
    url = `${url}?${(new URLSearchParams(stringifiedParams)).toString()}`;
  }

  return url;
}
