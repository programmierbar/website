export default eventHandler(function (context) {
  const incomingUrl = context.path;
  const toMatch = incomingUrl.substring(0, 22);

  if (toMatch !== '/.well-known/webfinger') {
    return;
  }

  const externalHost = 'https://social.programmier.bar';
  const redirectUrl = `${externalHost}${incomingUrl}`;

  // Set the response status and location header for redirection
  // And end the response to complete the redirection
  context.node.res.writeHead(302, {
    Location: redirectUrl,
  });
  context.node.res.end();
});
