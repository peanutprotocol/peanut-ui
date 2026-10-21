import type { SerwistPlugin } from 'serwist'

/**
 * Hand a navigation's redirect back to the browser instead of serving the page
 * it led to.
 *
 * Navigations reach the worker with redirect mode "manual", so a response that
 * already followed a redirect (navigation preload, a network fetch, or a cache
 * entry stored from one) is one the browser has to refuse. iOS 16 Safari does,
 * and shows "Response served by service worker has redirections" in place of
 * the page: the native app's Help Center failed on every open after the first,
 * because the sheet asked for /en/help/ and redirects.json 308s it to /en/help.
 * Answering with the redirect lets the browser make the hop itself; the
 * follow-up navigation to the final URL is then served normally.
 */
export const navigationRedirectPlugin: SerwistPlugin = {
    handlerWillRespond: ({ request, response }) =>
        request.mode === 'navigate' && response.redirected ? Response.redirect(response.url, 302) : response,
}
