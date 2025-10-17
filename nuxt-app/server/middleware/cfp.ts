export default eventHandler(function(event) {
  const toMatch = 'cfp.programmier.bar';
  const requestHost = event.headers.get('host') || '';

  if (!requestHost.startsWith(toMatch)) {
    return;
  }

  const redirectUrl = `https://l.programmier.bar/pcon-26-cfp`;

  // Set the response status and location header for redirection
  // And end the response to complete the redirection
  event.node.res.writeHead(302, {
    Location: redirectUrl,
  });

  event.node.res.end();
});
