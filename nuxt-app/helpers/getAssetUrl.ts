import { DIRECTUS_CMS_URL } from '~/config';

/**
 * Helper function to build the URL of an asset from Directus CMS.
 *
 * @param file The file object with an id property or a string id.
 * @param options The options object with a queryParams property.
 *
 * @returns The full URL to the asset.
 */
export function getAssetUrl(file: { id: string } | string, options?: {queryParams: {}}): string {

  if (!file) return '';

  let id = '';

  if (typeof file === 'string') {
    id = file;
  } else {
    id = file.id;
  }

  let url = `${DIRECTUS_CMS_URL}/assets/${id}`;

  if (options?.queryParams) {
    url = `${url}?${(new URLSearchParams(options.queryParams)).toString()}`;
  }

  return url
}
