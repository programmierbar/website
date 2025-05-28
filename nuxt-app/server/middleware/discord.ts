import { DISCORD_INVITE_LINK } from '~/config';

export default eventHandler(function(event) {
  const hostToMatch = 'discord.programmier.bar';
  const pathToMatch = '/discord';
  const requestHost = event.headers.get('host') || '';
  const requestPath = event.path;

  console.log(requestPath);

  if (!requestHost.startsWith(hostToMatch) && !(requestPath === pathToMatch)) {
    return;
  }

  const redirectUrl = `${DISCORD_INVITE_LINK}`;

  // Set the response status and location header for redirection
  // And end the response to complete the redirection
  event.node.res.writeHead(302, {
    Location: redirectUrl,
  });

  event.node.res.end();
});
