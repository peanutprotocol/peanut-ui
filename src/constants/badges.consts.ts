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
