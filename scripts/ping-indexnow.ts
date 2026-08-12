/**
 * Fail-closed IndexNow entrypoint.
 *
 * URLs come only from the deployed peanut.me root and Split sitemaps. A live
 * request requires production robots.txt to advertise the exact root sitemap
 * URL and the public key proof. Split URLs join the run only once robots.txt
 * also advertises the Split sitemap, and only while every Split page is
 * indexable and self-canonical.
 */

import { runIndexNowFromEnvironment } from './indexnow'

runIndexNowFromEnvironment().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
})
