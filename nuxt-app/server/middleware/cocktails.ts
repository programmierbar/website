import type { H3Event } from 'h3'

import { defineEventHandler, getHeader } from 'h3'
import { useDirectus } from '~/composables/useDirectus'

const directus = useDirectus()

export default defineEventHandler(async (event) => {
  if (event.path !== '/api/cocktails') return

  const accept = (getHeader(event, 'accept') || '').toLowerCase()
  const wantsOnlyJson =
    accept.includes('application/json') && !accept.includes('text/html')

  if (!wantsOnlyJson) {
    return
  }

  // Be a good citizen: content negotiation varies on Accept
  event.node.res.setHeader('Vary', 'Accept')

  const cocktails  = await directus.getCocktailMenu();
  if (cocktails && cocktails.status !== 'published') {
    cocktails.menu = JSON.parse('{"error": "No cocktails available"}')
  }

  // Return your JSON payload
  return cocktails.menu;
})
