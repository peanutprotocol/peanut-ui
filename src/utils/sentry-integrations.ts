/**
 * Integration list surgery for the native Sentry client.
 *
 * BrowserTracing is dropped on native because it instruments regardless of
 * tracesSampleRate: it wraps fetch and XHR, patches history, and runs
 * PerformanceObservers in every session, and sampling only decides whether the
 * resulting transaction is sent. That overhead is visible jank in the WebView.
 *
 * The removal is a string match against a Sentry-owned constant, so a version
 * bump that renames the integration would silently restore all of it with
 * nothing failing. The name lives here as one exported constant, and
 * sentry-integrations.test.ts pins it against the real integration so CI
 * breaks instead.
 */

export const BROWSER_TRACING_INTEGRATION_NAME = 'BrowserTracing'

export function withoutBrowserTracing<T extends { name: string }>(defaults: T[]): T[] {
    return defaults.filter((integration) => integration.name !== BROWSER_TRACING_INTEGRATION_NAME)
}
