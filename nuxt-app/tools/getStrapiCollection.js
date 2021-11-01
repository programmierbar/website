import https from 'https';

/**
 * It fetches and returns a Strapi collection.
 *
 * @param collectionName The Strapi collection name.
 *
 * @returns The data of the collection.
 */
export function getStrapiCollection(collectionName) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `${process.env.NUXT_ENV_STRAPI_CMS}/${collectionName}?_limit=-1`,
        (response) => {
          let data = '';
          response.on('data', (chunk) => {
            data += chunk;
          });
          response.on('end', () => {
            resolve(JSON.parse(data));
          });
        }
      )
      .on('error', (error) => {
        reject(error);
      });
  });
}
