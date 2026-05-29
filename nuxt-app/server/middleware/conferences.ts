export default eventHandler(function(event) {
  const pathToMatch = '/konferenzen';

  const requestPath = event.path;

  if (!requestPath.startsWith(pathToMatch)) {
    return
  }

  const host = 'https://programmier.bar';
  const path = requestPath.replace('konferenzen', 'konferenz');

  const redirectUrl = `${host}${path}`;

  event.node.res.writeHead(302, {
    Location: redirectUrl,
  });

  event.node.res.end();
});
