/**
 * Fail-closed IndexNow entrypoint.
 *
 * URLs come only from the deployed peanut.me root sitemap and the optional
 * deployed Split sitemap. A real API request additionally requires the explicit
 * INDEXNOW_INDEX_RELEASED=true gate. The committed workflow keeps that gate off.
 */

import { runIndexNowFromEnvironment } from './indexnow'

runIndexNowFromEnvironment().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
