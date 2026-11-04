/**
 * Real posthog-js, no network: on a marketing document the surveys and
 * heatmaps/dead-click scripts must not load at init, and must load once the
 * deferral is released, driven by the same remote config as on app routes.
 */
import posthog, { type PostHog } from 'posthog-js'
import {
    afterLoadIdle,
    DEFERRED_ADDONS_INIT,
    releaseDeferredAddons,
    rememberRemoteConfig,
} from '../posthog-deferred-addons'

// The project's remote config on 4 Nov 2026, trimmed to the add-ons in question.
const REMOTE_CONFIG = {
    surveys: false,
    heatmaps: { captureMode: 'all' },
    captureDeadClicks: false,
    capturePerformance: { web_vitals: true, network_timing: true },
    autocaptureExceptions: true,
    hasFeatureFlags: false,
}

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const loadedScripts = () =>
    Array.from(document.querySelectorAll('script[src]')).map((script) =>
        new URL((script as HTMLScriptElement).src).pathname.split('/').pop()
    )

let originalFetch: typeof fetch

beforeEach(() => {
    document.querySelectorAll('script[src]').forEach((script) => script.remove())
    delete (window as unknown as { _POSTHOG_REMOTE_CONFIG?: unknown })._POSTHOG_REMOTE_CONFIG
    originalFetch = global.fetch
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
        const body = new URL(String(url)).pathname.endsWith('/config') ? REMOTE_CONFIG : {}
        return new Response(JSON.stringify(body), { status: 200 })
    }) as unknown as typeof fetch
})

afterEach(() => {
    global.fetch = originalFetch
})

async function init(name: string, config: Parameters<PostHog['init']>[1] = {}) {
    const ph = posthog.init(
        'phc_test',
        {
            api_host: 'https://posthog.test',
            persistence: 'memory',
            opt_out_capturing_by_default: true,
            disable_session_recording: true,
            ...config,
        },
        name
    )!
    const latest = rememberRemoteConfig(ph)
    await tick(0)
    // jsdom runs no external script: serve the remote config the way the
    // relay's config.js does, then report the script as loaded.
    ;(window as unknown as { _POSTHOG_REMOTE_CONFIG: unknown })._POSTHOG_REMOTE_CONFIG = {
        phc_test: { config: REMOTE_CONFIG },
    }
    document.querySelector('script[src*="/config.js"]')!.dispatchEvent(new Event('load'))
    await tick(0)
    return { ph, latest }
}

it('loads the surveys and dead-click scripts at init without the deferral (control)', async () => {
    await init('control')
    expect(loadedScripts()).toEqual(expect.arrayContaining(['surveys.js', 'dead-clicks-autocapture.js']))
})

it('holds surveys, heatmaps and dead clicks until released, then follows the remote config', async () => {
    const { ph, latest } = await init('deferred', DEFERRED_ADDONS_INIT)
    expect(loadedScripts()).not.toContain('surveys.js')
    expect(loadedScripts()).not.toContain('dead-clicks-autocapture.js')
    // Web vitals and exception capture are not deferred.
    expect(loadedScripts()).toEqual(expect.arrayContaining(['exception-autocapture.js']))
    expect(latest()).toEqual({ ok: true, config: expect.objectContaining({ surveys: false }) })

    releaseDeferredAddons(ph, latest())
    await tick(0)

    expect(loadedScripts()).toEqual(expect.arrayContaining(['surveys.js', 'dead-clicks-autocapture.js']))
    expect(ph.config.capture_heatmaps).toBeUndefined()
    expect(ph.config.capture_dead_clicks).toBeUndefined()
    expect(ph.config.disable_surveys).toBe(false)
})

describe('afterLoadIdle', () => {
    let readyState: DocumentReadyState
    const idleCallbacks: Array<() => void> = []

    beforeEach(() => {
        jest.useFakeTimers()
        readyState = 'interactive'
        jest.spyOn(document, 'readyState', 'get').mockImplementation(() => readyState)
        idleCallbacks.length = 0
    })

    afterEach(() => {
        jest.useRealTimers()
        jest.restoreAllMocks()
        delete (window as Partial<Window>).requestIdleCallback
    })

    it('waits for the load event, then for an idle moment', () => {
        window.requestIdleCallback = ((callback: () => void) => {
            idleCallbacks.push(callback)
            return 1
        }) as unknown as typeof window.requestIdleCallback
        const run = jest.fn()

        afterLoadIdle(run)
        expect(idleCallbacks).toHaveLength(0)

        readyState = 'complete'
        window.dispatchEvent(new Event('load'))
        expect(run).not.toHaveBeenCalled()

        idleCallbacks[0]()
        expect(run).toHaveBeenCalledTimes(1)
    })

    it('falls back to 2 s after load without requestIdleCallback', () => {
        delete (window as Partial<Window>).requestIdleCallback
        readyState = 'complete'
        const run = jest.fn()

        afterLoadIdle(run)
        jest.advanceTimersByTime(1999)
        expect(run).not.toHaveBeenCalled()
        jest.advanceTimersByTime(1)
        expect(run).toHaveBeenCalledTimes(1)
    })
})
