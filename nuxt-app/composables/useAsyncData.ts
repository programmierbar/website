import { useContext, useRoute, Ref, useStatic } from '@nuxtjs/composition-api';

/**
 * Composable for fetching the async data of a page.
 *
 * @param fetcher The fetcher function.
 *
 * @returns The requested data.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>): Ref<T | null> {
  // Add Nuxt.js context
  const context = useContext();

  // Add Nuxt.js route
  const route = useRoute();

  // Return useStatic composables
  return useStatic(
    async () => {
      try {
        return await fetcher();
      } catch (error: any) {
        context.error({ statusCode: 404, message: error.message });
        return null;
      }
    },
    undefined,
    route.value.path.replace(/\//g, '-')
  );
}
