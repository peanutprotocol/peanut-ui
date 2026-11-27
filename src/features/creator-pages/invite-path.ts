/**
 * The invite page of the creator. It is the CTA's plain href (the target without JavaScript), the
 * 307 target for a username without a page, and the way out of the route's error page.
 */
export function creatorInvitePath(username: string): string {
    return `/invite?code=${encodeURIComponent(username)}`
}
