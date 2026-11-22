export const TRACKED_LINK_ORIGIN = 'https://peanut.me'

const GO_CODE_PATTERN = /^[1-9][0-9]{0,3}$/

// A username shape only: existing short usernames predate the current signup length rule. It proves no account exists.
export function isAcquisitionSlug(value: unknown): value is string {
    return typeof value === 'string' && /^[a-z0-9]{1,64}$/.test(value)
}

/** True for the `c<code>` utmContent that /go codes wrote; journeys from before their removal can still hold one. */
export function isGoCodeContent(value: string | null | undefined): boolean {
    return !!value && value.startsWith('c') && GO_CODE_PATTERN.test(value.slice(1))
}
