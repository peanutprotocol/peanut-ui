/**
 * The badge that records a device's owner as having found the five-tap beta
 * switch on the About screen. The OTA card reads it back as permission to join
 * the `staging` channel — a record of who opted in and a handle to revoke it,
 * NOT an access boundary: anyone who performs the gesture awards it to
 * themselves. Capgo's channel self-assignment setting is the real boundary.
 *
 * It is never rendered. It says "team" and is handed out on a gesture, so
 * showing it beside earned badges would let any customer wear Peanut staff
 * colours in a payments app.
 */
export const PEANUT_TEAM_BADGE = 'PEANUT_TEAM'

/**
 * Badges that are permission records rather than collectibles, and are never
 * shown to anyone — including their owner.
 */
const NEVER_DISPLAYED = new Set<string>([PEANUT_TEAM_BADGE])

/**
 * Drops the records from a badge list before it is rendered.
 *
 * The public profile response already omits them (the query filters on
 * `isVisible`), but `/users/me` deliberately does not — that is how the beta
 * switch reads its own permission. So every surface that renders the CALLER's
 * badges has to filter here, or the badge shows up on their own profile.
 */
export function displayableBadges<T extends { code: string }>(badges: readonly T[]): T[] {
    return badges.filter((badge) => !NEVER_DISPLAYED.has(badge.code))
}
