import { getHeader } from 'h3'
import { useDirectus } from '~/composables/useDirectus'

export default eventHandler(async function(event) {
  const requestPath = event.path;
  if (!requestPath.startsWith('/podcast/')) {
    return;
  }

  // Path pattern "/podcast/[slug]/[up|down]"
  const regex = /^\/podcast\/([^/]+)\/(up|down)$/;
  const match = requestPath.match(regex);
  if (!match) {
    return;
  }

  const slug = match[1];
  const voteString = match[2];

  // Type narrowing: the regex already validated this is "up" or "down"
  // We use a type guard to make TypeScript aware of this
  if (voteString !== 'up' && voteString !== 'down') {
    // This should never happen due to regex validation, but satisfies TypeScript
    throw createError({ statusCode: 400, message: 'Invalid vote value' });
  }
  const vote = voteString;

  const directus = useDirectus();

  const podcast = await directus.getPodcastBySlug(slug);

  if (!podcast) {
    throw createError({ statusCode: 404, message: 'Podcast not found' });
  }

  // Content negotiation: detect if the client wants JSON
  const accept = (getHeader(event, 'accept') || '').toLowerCase()
  const wantsJson = accept.includes('application/json') && !accept.includes('text/html')

  let success = false;
  let message = '';

  try {
    const metadata: Record<string, string> = {};

    // Fix: split x-forwarded-for on comma and take first entry
    const xForwardedFor = event.node.req.headers['x-forwarded-for'] as string | undefined;
    const rawIP = xForwardedFor
      ? xForwardedFor.split(',')[0].trim()
      : event.node.req.socket.remoteAddress;

    const userAgent = event.node.req.headers['user-agent'];
    const referrer = event.node.req.headers['referer'];

    if (rawIP) {
      metadata['ip'] = rawIP;
    }
    if (userAgent) {
      metadata['user_agent'] = userAgent;
    }
    if (referrer) {
      metadata['referer_url'] = referrer;
    }

    await directus.createRating(vote, podcast, metadata);
    success = true;
    message = 'Vielen Dank für dein Feedback!';
  } catch (error) {
    // Log the error and set an error flash message
    console.error('Failed to create rating for podcast', podcast.slug, error);
    success = false;
    message = 'Dein Feedback konnte leider nicht gespeichert werden. Bitte versuche es später erneut.';
  }

  // Content negotiation: JSON response for fetch() calls
  if (wantsJson) {
    event.node.res.setHeader('Vary', 'Accept')
    return { success, message };
  }

  // Redirect response for direct browser navigation
  setCookie(event, 'flash-message', JSON.stringify({
    text: message,
    type: 'rating',
    payload: {}
  }), {
    maxAge: 60, // 60 seconds
    path: '/'
  });

  event.node.res.writeHead(302, {
    Location: '/podcast/' + podcast.slug,
  });

  event.node.res.end();
});
