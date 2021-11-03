import { getUrlSlug } from './getUrlSlug';

type MainPath = 'hall-of-fame' | 'meetup' | 'podcast';

/**
 * A helper function that creates the path for an internal subpage.
 *
 * @param mainPath The main path.
 * @param slugText The text of the slug.
 * @param subpageId The ID of the subpage.
 * @param search The search parameter.
 *
 * @returns The path of a subpage.
 */
export function getSubpagePath(
  mainPath: MainPath,
  slugText: string,
  subpageId: number,
  search?: `?${string}`
) {
  return `/${mainPath}/${getUrlSlug(slugText)}-${subpageId}${search || ''}`;
}
