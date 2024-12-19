import * as fathom from 'fathom-client';

/**
 * A helper function that tracks goals with Fathom Analytics.
 *
 * @param eventId The ID of the event.
 * @param value The value of the event.
 */
export function trackGoal(eventId: string, value?: number): void {
    console.log(`Tracking goal: ${eventId} (${value})`);
    fathom.trackEvent(eventId, {
      _value: value || 0
    });
}
