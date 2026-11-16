/**
 * The badge campaign a creator's /go visitors queue, keyed by username. The slug never comes from
 * the URL, so adding a creator here is a reviewed change. Check the link ID before a link goes out:
 * if a username changes hands, its new holder's visitors get the badge.
 */
export const CREATOR_BADGE_CAMPAIGNS: Readonly<Record<string, string>> = { juanacervio: 'nita' }

export function creatorBadgeCampaign(username: string): string | undefined {
    // Usernames such as `constructor` must not read the object prototype.
    return Object.prototype.hasOwnProperty.call(CREATOR_BADGE_CAMPAIGNS, username)
        ? CREATOR_BADGE_CAMPAIGNS[username]
        : undefined
}
