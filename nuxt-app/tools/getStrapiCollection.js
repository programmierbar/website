import https from 'https';
import { STRAPI_CMS_URL } from '../config';

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
      .get(`${STRAPI_CMS_URL}/${collectionName}?_limit=-1`, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          resolve(JSON.parse(data));
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}
