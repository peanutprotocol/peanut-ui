import { isPlausibleUsername } from '@/constants/routes'

/**
 * The username of a /c/<username> path segment, decoded once and lowercased, or `null` when it is
 * not shaped like a Peanut username (the route then answers 404). The segment arrives
 * percent-encoded; encoding it again would put `%25…` in the redirect.
 */
export function creatorUsernameFromSegment(segment: string): string | null {
    return isPlausibleUsername(segment) ? decodeURIComponent(segment).toLowerCase() : null
}
