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
 *
 * This is the backstop, not the rule: `isVisible` below is what actually
 * decides. A code only needs listing here if rows of it were awarded before
 * the server started marking them invisible.
 */
const NEVER_DISPLAYED = new Set<string>([PEANUT_TEAM_BADGE])

/**
 * Drops permission records from a badge list before it is rendered.
 *
 * The public profile response already omits them — that query filters on
 * `isVisible` — but `/users/me` deliberately does not, since that is how the
 * beta switch reads its own permission. So every surface rendering the
 * CALLER's own badges has to filter here, or the record shows up on their own
 * profile.
 *
 * `isVisible` is the server's own answer and covers every future record badge
 * with no client change; the code list catches rows awarded before the server
 * began setting it. Same convention the badge-earn toast already uses.
 */
export function displayableBadges<T extends { code: string; isVisible?: boolean }>(badges: readonly T[]): T[] {
    return badges.filter((badge) => badge.isVisible !== false && !NEVER_DISPLAYED.has(badge.code))
}
