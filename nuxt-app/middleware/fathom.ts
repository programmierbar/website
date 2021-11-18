/**
 * Fathom Analytics integration
 * https://usefathom.com/docs/integrations/nuxt
 */
export default function () {
  if (!process.client) {
    return;
  }
  (window as typeof window & { fathom?: any }).fathom?.trackPageview();
}
