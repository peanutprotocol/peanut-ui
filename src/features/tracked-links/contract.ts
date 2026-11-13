export const TRACKED_LINK_EVENT = 'tracked_link_visit'
export const TRACKED_LINK_ORIGIN = 'https://peanut.me'

// Existing short usernames predate the current signup length rule. Identity still needs the API lookup.
export function isAcquisitionSlug(value: unknown): value is string {
    return typeof value === 'string' && /^[a-z0-9]{1,64}$/.test(value)
}

/** Query input never selects the inviter: the resolved slug is the only one carried. */
export function acquisitionHandoffPath(slug: string): string {
    return `/home?${new URLSearchParams({ app_entry: '1', tl: slug, acq_invite: slug })}`
}
