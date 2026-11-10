/** @jest-environment node */
import { deliverOpening } from '../delivery'

const originalFetch = global.fetch
const body = JSON.stringify({ event_id: 'one-stable-event', signup_journey_id: 'private-journey' })
beforeEach(() => {
    global.fetch = jest.fn()
    jest.spyOn(console, 'info').mockImplementation(() => {})
    jest.spyOn(Math, 'random').mockReturnValue(0)
})
afterEach(() => {
    global.fetch = originalFetch
    jest.restoreAllMocks()
    jest.useRealTimers()
})

it.each([429, 500, 503])('retries HTTP %s once with identical event identity', async (status) => {
    jest.mocked(fetch)
        .mockResolvedValueOnce(new Response(null, { status }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await deliverOpening('https://capture.test', body, 'tracked_link')).toEqual({
        surface: 'tracked_link',
        outcome: 'accepted',
        status: '2xx',
        attempts: 2,
    })
    expect(jest.mocked(fetch).mock.calls.map(([, init]) => init?.body)).toEqual([body, body])
})

it.each([400, 401, 403, 404, 422, 302])('does not retry a permanent HTTP %s response', async (status) => {
    jest.mocked(fetch).mockResolvedValue(new Response(null, { status }))
    expect((await deliverOpening('https://capture.test', body, 'tracked_link')).outcome).toBe('rejected')
    expect(fetch).toHaveBeenCalledTimes(1)
})

it('retries transport failure, then stops with a context-free diagnostic envelope', async () => {
    jest.mocked(fetch).mockRejectedValue(new Error('private-url private-cookie private-user'))
    const result = await deliverOpening('https://private-url.test', body, 'marketing_qr')
    expect(result).toEqual({ surface: 'marketing_qr', outcome: 'exhausted', status: 'transport', attempts: 2 })
    expect(console.info).toHaveBeenCalledWith('acquisition_opening_delivery', result)
    expect(JSON.stringify(jest.mocked(console.info).mock.calls)).not.toMatch(/private|event_id|journey|url|cookie|user/)
    expect(fetch).toHaveBeenCalledTimes(2)
})

it('bounds even a fetch that ignores AbortSignal to two seconds per attempt and 4.5 seconds total', async () => {
    jest.useFakeTimers()
    jest.mocked(fetch).mockImplementation(() => new Promise(() => {}))
    const task = deliverOpening('https://capture.test', body, 'tracked_link')
    await jest.advanceTimersByTimeAsync(2000)
    expect(fetch).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(100)
    expect(fetch).toHaveBeenCalledTimes(2)
    await jest.advanceTimersByTimeAsync(2000)
    expect(await task).toMatchObject({ outcome: 'exhausted', attempts: 2 })
    expect(jest.mocked(fetch).mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true)
    expect(jest.getTimerCount()).toBe(0)
})

it.each(['seconds', 'date'])('honors Retry-After %s before the bounded second attempt', async (format) => {
    jest.useFakeTimers({ now: new Date('2026-11-10T12:00:00Z') })
    const retryAfter = format === 'seconds' ? '1' : new Date(Date.now() + 1000).toUTCString()
    jest.mocked(fetch)
        .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': retryAfter } }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
    const pending = deliverOpening('https://capture.test', body, 'tracked_link')
    await jest.advanceTimersByTimeAsync(999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(1)
    expect(await pending).toMatchObject({ outcome: 'accepted', attempts: 2 })
})

it('stops when Retry-After exceeds the remaining delivery deadline', async () => {
    jest.mocked(fetch).mockResolvedValue(new Response(null, { status: 503, headers: { 'Retry-After': '5' } }))
    expect(await deliverOpening('https://capture.test', body, 'tracked_link')).toMatchObject({
        outcome: 'exhausted',
        attempts: 1,
        status: '5xx',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
})

it('limits the second attempt to the time left after an upstream cooldown', async () => {
    jest.useFakeTimers()
    jest.mocked(fetch)
        .mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    setTimeout(
                        () => resolve(new Response(null, { status: 429, headers: { 'Retry-After': '2' } })),
                        1900
                    )
                })
        )
        .mockImplementationOnce(() => new Promise(() => {}))
    const pending = deliverOpening('https://capture.test', body, 'tracked_link')
    await jest.advanceTimersByTimeAsync(3899)
    expect(fetch).toHaveBeenCalledTimes(1)
    await jest.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    await jest.advanceTimersByTimeAsync(600)
    expect(await pending).toMatchObject({ outcome: 'exhausted', attempts: 2 })
    expect(jest.mocked(fetch).mock.calls[1][1]?.signal?.aborted).toBe(true)
    expect(jest.getTimerCount()).toBe(0)
})

it('makes only one browser ingress attempt while retaining navigation-safe options', async () => {
    jest.mocked(fetch).mockRejectedValue(new Error('offline'))
    await deliverOpening('/api/tracked-links/open', body, 'tracked_link', { keepalive: true, maxAttempts: 1 })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith(
        '/api/tracked-links/open',
        expect.objectContaining({ credentials: 'omit', keepalive: true, referrerPolicy: 'no-referrer' })
    )
})

it('a diagnostic failure does not retry an accepted event', async () => {
    jest.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))
    jest.mocked(console.info).mockImplementation(() => {
        throw new Error('logger unavailable')
    })
    expect((await deliverOpening('/api/tracked-links/open', body, 'tracked_link')).outcome).toBe('accepted')
    expect(fetch).toHaveBeenCalledTimes(1)
})
