/**
 * Venue of meetups and conferences. Meetups always take place here, so there is
 * no location field in the CMS. Shared because the website (structured data,
 * calendar files) and the CMS (confirmation mail) both print it.
 */
export const EVENT_VENUE = {
  name: 'Lotum media GmbH',
  streetAddress: 'Am Goldstein 1',
  postalCode: '61231',
  locality: 'Bad Nauheim',
  country: 'DE',
  mapsUrl: 'https://goo.gl/maps/7h8a14WPPQkQL4LB8',
} as const;

/**
 * The venue as a single line, e.g. for calendar entries:
 * "Lotum media GmbH, Am Goldstein 1, 61231 Bad Nauheim".
 */
export function getEventVenueLine() {
  return `${EVENT_VENUE.name}, ${EVENT_VENUE.streetAddress}, ${EVENT_VENUE.postalCode} ${EVENT_VENUE.locality}`;
}
