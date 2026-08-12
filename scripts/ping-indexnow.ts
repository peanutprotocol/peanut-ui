/**
 * Fail-closed IndexNow entrypoint.
 *
 * URLs come only from the deployed peanut.me root and Split sitemaps. A live
 * request requires production robots.txt to advertise both exact sitemap URLs,
 * every Split page to be indexable and self-canonical, and the public key proof.
 */

import { runIndexNowFromEnvironment } from './indexnow'

runIndexNowFromEnvironment().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
