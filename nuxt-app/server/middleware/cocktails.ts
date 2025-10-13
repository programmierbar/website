import type { H3Event } from 'h3'

import { defineEventHandler, getHeader } from 'h3'

export default defineEventHandler((event) => {
  if (event.path !== '/api/cocktails') return

  const accept = (getHeader(event, 'accept') || '').toLowerCase()
  const wantsOnlyJson =
    accept.includes('application/json') && !accept.includes('text/html')

  if (!wantsOnlyJson) {
    return
  }

  // Be a good citizen: content negotiation varies on Accept
  event.node.res.setHeader('Vary', 'Accept')

  const data = {
    cocktails: [
      {
        name: 'Gin Tonic',
        ingredients: ['gin', 'tonic water', 'ice'],
        contains_alcohol: true,
        alcohol_free_variant_available: true,
      },
      {
        name: 'Ipanema',
        ingredients: ['ginger ale', 'juice', 'lime', 'brown sugar', 'ice'],
        contains_alcohol: false,
      },
      {
        name: 'Crodino Spritz',
        ingredients: ['crodino', 'orange', 'mint', 'ice'],
        contains_alcohol: false,
      },
    ],
  }

  // Return your JSON payload
  return data;
})
