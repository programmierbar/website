export default eventHandler(function(event) {
  const toMatch = 'flutterday.programmier.bar';
  const requestHost = event.headers.get('host') || '';

  if (!requestHost.startsWith(toMatch)) {
    return;
  }

  // Skip API routes and internal Nuxt routes so they aren't 302'd to the apex,
  // which would break client-side $fetch calls (e.g. discount validation).
  if (event.path.startsWith('/api/') || event.path.startsWith('/_')) {
    return;
  }

  const host = 'https://programmier.bar';
  const path = '/konferenz/flutter-day-2024';

  const redirectUrl = `${host}${path}`;

  // Set the response status and location header for redirection
  // And end the response to complete the redirection
  event.node.res.writeHead(302, {
    Location: redirectUrl,
  });

  event.node.res.end();
});
