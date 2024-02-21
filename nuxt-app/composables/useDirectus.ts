import { type Collections, directus } from '~/services';
import {
  aggregate,
  type AggregationOptions,
  type Query,
  readItems,
  readSingleton,
} from '@directus/sdk';

export function useDirectus() {
  async function getSingleton(
    collectionName: keyof Collections,
    query_object: Query<any, any>
  ) {
    return await directus.request(
      readSingleton(collectionName.toString(), query_object)
    );
  }

  async function getItems(
    collectionName: keyof Collections,
    query_object: Query<any, any>
  ) {
    return await directus.request(
      readItems(collectionName.toString(), query_object)
    );
  }

  async function aggregateItems(
    collectionName: keyof Collections,
    options: AggregationOptions<any, any>
  ) {
    return await directus.request(
      aggregate(collectionName.toString(), options)
    );
  }

  return { getSingleton, getItems, aggregateItems };
}
