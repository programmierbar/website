/**
 * Fathom Analytics integration
 * https://usefathom.com/docs/integrations/nuxt
 */
export default function () {
  if (process.client) {
    (<any>window)?.fathom?.trackPageview();
  }
}
