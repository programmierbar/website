import { getOS } from '~/helpers';
import { PROGRAMMIER_CON_APP_ANDROID, PROGRAMMIER_CON_APP_IOS } from '~/config';

export default eventHandler(function(event) {
  const hostsToMatch = [
    'con.programmier.bar',
    'conference.programmier.bar',
    'konferenz.programmier.bar',
  ];

  const pathToMatch = '/app';

  const requestHost = event.headers.get('host') || '';
  const requestPath = event.path;

  if (!hostsToMatch.some(match => requestHost.startsWith(match))) {
    return;
  }

  if ((requestPath === pathToMatch)) {
    const os = getOS();

    let redirectUrl = '';

    switch (os) {
      case 'iOS':
      case 'macOS':
        redirectUrl = PROGRAMMIER_CON_APP_IOS;
        break;
      default:
        redirectUrl = PROGRAMMIER_CON_APP_ANDROID;
      break;
    }

    event.node.res.writeHead(302, {
      Location: redirectUrl,
    });
    event.node.res.end();

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
