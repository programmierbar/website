import { StrapiImage, StrapiImageFormat } from 'shared-code';

/**
 * A helper function that creates the string for
 * the srcset attribute of an <img> Element.
 *
 * @param strapiImage A Strapi image object.
 *
 * @returns A string for the srcset attribute of an <img> Element.
 */
export function getImageSrcSet(strapiImage: StrapiImage | null | undefined) {
  if (strapiImage) {
    const originalFile = `${strapiImage.url} ${strapiImage.width}w`;
    return strapiImage.formats
      ? originalFile +
          ', ' +
          (Object.values(strapiImage.formats) as StrapiImageFormat[])
            .map(({ url, width }) => `${url} ${width}w`)
            .join(', ')
      : originalFile;
  }
  return undefined;
}
