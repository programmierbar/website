export default eventHandler(function(event) {
  const toMatch = [
    'con.programmier.bar',
    'conference.programmier.bar',
    'konferenz.programmier.bar',
  ];

  const requestHost = event.headers.get('host') || '';

  if (!toMatch.some(match => requestHost.startsWith(match))) {
    return;
  }

  const host = 'https://programmier.bar';
  const path = '/konferenzen/programmier-con-web-ai-edition-2025';

  const redirectUrl = `${host}${path}`;

  // Set the response status and location header for redirection
  // And end the response to complete the redirection
  event.node.res.writeHead(302, {
    Location: redirectUrl,
  });

  event.node.res.end();
});
