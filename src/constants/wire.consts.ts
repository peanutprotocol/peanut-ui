/**
 * The wire version this bundle understands. The API projects statuses this bundle does not know
 * to ones it does, and refuses bundles below its floor (peanut-api-ts src/wire/). Bump it in the
 * PR that teaches the app a new wire value the API projects (the `since` of its projection row).
 */
export const WIRE_HEADER = 'x-peanut-wire'
export const WIRE_CLIENT_VERSION = 1
