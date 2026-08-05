/**
 * Native drops BrowserTracing because it instruments in every session
 * regardless of tracesSampleRate — wrapping fetch and XHR, patching history,
 * running PerformanceObservers — and sampling only gates whether the resulting
 * transaction is sent. That cost is visible jank inside the WebView.
 *
 * The removal is a string match against a Sentry-owned constant, so the failure
 * mode is silent: a version bump that renames the integration restores all of
 * that instrumentation with nothing erroring and no test failing. This pins the
 * name against the real integration so the upgrade breaks CI instead.
 */
import { browserTracingIntegration } from '@sentry/nextjs'

import { BROWSER_TRACING_INTEGRATION_NAME, withoutBrowserTracing } from '@/utils/sentry-integrations'

describe('withoutBrowserTracing', () => {
    it("matches the name Sentry's own integration reports", () => {
        expect(browserTracingIntegration().name).toBe(BROWSER_TRACING_INTEGRATION_NAME)
    })

    it('removes exactly the tracing integration and keeps the rest', () => {
        const defaults = [
            { name: 'InboundFilters' },
            { name: 'FunctionToString' },
            { name: BROWSER_TRACING_INTEGRATION_NAME },
            { name: 'Breadcrumbs' },
            { name: 'Dedupe' },
        ]

        expect(withoutBrowserTracing(defaults).map((i) => i.name)).toEqual([
            'InboundFilters',
            'FunctionToString',
            'Breadcrumbs',
            'Dedupe',
        ])
    })

    it('removes the real integration out of a real default set', () => {
        const defaults = [browserTracingIntegration(), { name: 'Dedupe' }]

        expect(withoutBrowserTracing(defaults)).toHaveLength(1)
        expect(withoutBrowserTracing(defaults)[0].name).toBe('Dedupe')
    })

    it('leaves a list that never contained it untouched', () => {
        const defaults = [{ name: 'Dedupe' }]

        expect(withoutBrowserTracing(defaults)).toEqual(defaults)
    })
})
