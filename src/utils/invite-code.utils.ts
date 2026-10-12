/**
 * Normalises a username into an invite code.
 *
 * Tolerates copied profile handles (`@alice ` or ` Alice`): trims whitespace
 * and strips a leading @.
 *
 * Kept in its own module because `demo.ts` needs only this helper, and
 * importing it from `general.utils` drags that module's chain/token metadata
 * (189 KB of JSON) onto every route that touches demo mode — including the
 * landing page.
 */
export const toInviteCode = (username: string): string => username.trim().replace(/^@/, '').toLowerCase()
