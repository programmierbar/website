/**
 * A helper function that tracks goals with Fathom Analytics.
 *
 * @param eventCode The code of the event.
 * @param eventValue The value of the event.
 */
export function trackGoal(eventCode: string, eventValue?: number): void {
  (<any>window)?.fathom?.trackGoal(eventCode, eventValue || 0);
}
