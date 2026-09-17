/**
 * Client compatibility generation: an integer embedded in this UI bundle.
 *
 * Raise it when the client stops needing an old API behavior. The mono
 * compatibility registry (engineering/compatibility) records which generation
 * each published release carries and publishes the minimum supported one per
 * platform as the public policy at /client-support.json. The number is
 * independent of the shell version and of APP_RELEASE: a git hash identifies a
 * release but cannot order two of them.
 */
export const CLIENT_GENERATION = 1

/** Public policy path. The web deployment serves it; every platform reads it. */
export const CLIENT_SUPPORT_POLICY_PATH = '/client-support.json'

/** Where the last validated policy is kept between launches. */
export const CLIENT_SUPPORT_POLICY_STORAGE_KEY = 'peanutClientSupportPolicy'

/** A policy read blocks the wallet tree on a cold start, so it must fail fast. */
export const CLIENT_SUPPORT_FETCH_TIMEOUT_MS = 5_000
