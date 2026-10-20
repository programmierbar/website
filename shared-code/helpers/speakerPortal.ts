/**
 * Values shared by the website (speaker portal) and the CMS (profile-update
 * request endpoint, portal notifications), so both sides agree on the status
 * values and on which Content Version holds a speaker's profile update.
 */

/** Values of `speakers.portal_submission_status`. */
export const SPEAKER_PORTAL_STATUS = {
  pending: 'pending',
  /** An admin asked an existing speaker to check their profile. */
  updateRequested: 'update_requested',
  submitted: 'submitted',
  approved: 'approved',
} as const;

/**
 * Key of the Content Version a profile update is saved into. One version per
 * speaker: a later update request reuses it instead of piling up versions.
 */
export const SPEAKER_PROFILE_UPDATE_VERSION_KEY = 'profile-update';
