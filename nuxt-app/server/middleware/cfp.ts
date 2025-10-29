export default eventHandler(function(event) {
  const toMatch = 'cfp.programmier.bar';
  const requestHost = event.headers.get('host') || '';

  if (!requestHost.startsWith(toMatch)) {
    return;
  }

  const redirectUrl = `https://docs.google.com/forms/d/e/1FAIpQLSdswI25P39NaWoH1BP5XCBzvSfcH1ATPbW6YtBMBa6cfGuhdQ/viewform?usp=header`;

  // Set the response status and location header for redirection
  // And end the response to complete the redirection
  event.node.res.writeHead(302, {
    Location: redirectUrl,
  });

  event.node.res.end();
});
