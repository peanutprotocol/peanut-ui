/**
 * Data requests to another origin are API calls, and those carry personal data (KYC answers
 * include the tax number and address). serwist's default cross-origin rule would cache them for
 * an hour, ignoring `no-store`, past sign-out. Images, fonts and scripts from other origins keep
 * their caches. Matched without reading the API URL: the worker bundle has no `process.env`.
 */
export function isCrossOriginDataRequest({ request, sameOrigin }: { request: Request; sameOrigin: boolean }): boolean {
    return !sameOrigin && request.destination === ''
}

/** serwist's catch-all cache for other origins, where older workers stored API responses. */
export const CROSS_ORIGIN_CACHE = 'cross-origin'
