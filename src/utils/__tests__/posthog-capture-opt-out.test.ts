/**
 * Real posthog-js, no network: what a non-production build actually sends.
 * Staging and previews keep the production key so feature flags load; capture
 * is opted out, so /flags is the only request (Hugo, 2026-10-20).
 */
import posthog from 'posthog-js'

function recordRequests(): { paths: string[]; restore: () => void } {
    const paths: string[] = []
    const open = jest.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(function (_method, url) {
        paths.push(new URL(String(url)).pathname)
    })
    const send = jest.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(() => {})
    const header = jest.spyOn(XMLHttpRequest.prototype, 'setRequestHeader').mockImplementation(() => {})
    const fetchSpy = jest.fn(async (url: RequestInfo | URL) => {
        paths.push(new URL(String(url)).pathname)
        return new Response('{}', { status: 200 })
    })
    const originalFetch = global.fetch
    global.fetch = fetchSpy as unknown as typeof fetch
    return {
        paths,
        restore: () => {
            open.mockRestore()
            send.mockRestore()
            header.mockRestore()
            global.fetch = originalFetch
        },
    }
}

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

it.each([
    ['non-production', true],
    ['production', false],
])('%s build: flags are requested; events only when capture is on', async (name, optedOut) => {
    const requests = recordRequests()
    const ph = posthog.init(
        'phc_test',
        {
            api_host: 'https://posthog.test',
            opt_out_capturing_by_default: optedOut,
            capture_pageview: true,
            disable_session_recording: true,
            request_batching: false,
        },
        `capture-${name}`
    )!
    await tick(50)
    ph.capture('some_event')
    ph.identify('user-1', { username: 'ana' })
    ph.setPersonProperties({ totalPoints: 1 })
    await tick(50)
    requests.restore()

    expect(ph.has_opted_out_capturing()).toBe(optedOut)
    expect(requests.paths).toContain('/flags/')
    const eventRequests = requests.paths.filter((path) => path !== '/flags/' && !path.includes('/config'))
    if (optedOut) expect(eventRequests).toEqual([])
    else expect(eventRequests.length).toBeGreaterThan(0)
})
