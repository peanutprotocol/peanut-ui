/**
 * Lookup-term parsing for the /dev/journey user inspector.
 *
 * The inspector takes whatever you have to hand — a username you read in a
 * support thread, or a raw userId you copied out of the DB — and the API takes
 * exactly one of `userId` or `username`. This decides which.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True when the term is a canonical uuid — our userIds are uuids, usernames never are. */
export function isUuid(value: string): boolean {
    return UUID_PATTERN.test(value.trim())
}

/** The GET /__dev/journey-inspect query param this term belongs in. */
export function inspectParam(value: string): 'userId' | 'username' {
    return isUuid(value) ? 'userId' : 'username'
}
