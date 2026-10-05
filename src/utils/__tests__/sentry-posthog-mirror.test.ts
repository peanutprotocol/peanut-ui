const mockSentryIntegration = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { sentryIntegration: mockSentryIntegration } }))

import { posthogErrorMirror } from '../sentry-posthog-mirror'
import { beforeSendHandler } from '../../../sentry.utils'

describe('posthogErrorMirror', () => {
    it('wraps the PostHog integration so Capgo noise never reaches the mirror', () => {
        const inner = jest.fn((event) => event)
        mockSentryIntegration.mockReturnValue({ name: 'posthog', processEvent: inner })

        const mirror = posthogErrorMirror()
        expect(mockSentryIntegration).toHaveBeenCalledWith({
            organization: 'peanut-c34d84c05',
            projectId: 4505827431415808,
        })

        const noise = { message: '[CapgoUpdater] Failed to download bundle' } as never
        expect(mirror.processEvent?.(noise)).toBe(noise)
        expect(inner).not.toHaveBeenCalled()

        const real = { exception: { values: [{ type: 'TypeError', value: 'boom' }] } } as never
        mirror.processEvent?.(real)
        expect(inner).toHaveBeenCalledWith(real)
    })
})

it('keeps the posthog-js rate-limit notice out of the mirror and out of Sentry', () => {
    const inner = jest.fn((event) => event)
    mockSentryIntegration.mockReturnValue({ name: 'posthog', processEvent: inner })
    // the shape captureConsoleIntegration gives a console.error
    const notice = {
        level: 'error',
        logger: 'console',
        message: '[PostHog.js] This capture call is ignored due to client rate limiting.',
    } as never

    expect(posthogErrorMirror().processEvent?.(notice)).toBe(notice)
    expect(inner).not.toHaveBeenCalled()
    expect(beforeSendHandler(notice)).toBeNull()

    const other = { level: 'error', logger: 'console', message: '[PostHog.js] capture transport failed' } as never
    posthogErrorMirror().processEvent?.(other)
    expect(inner).toHaveBeenCalledWith(other)
})

it('redacts QR copies before the Sentry event reaches the PostHog integration', () => {
    const inner = jest.fn((event) => event)
    mockSentryIntegration.mockReturnValue({ name: 'posthog', processEvent: inner })
    const url = '/qr-pay?qrCode=private-payload'
    const event = { message: url, request: { url }, exception: { values: [{ value: url }] } } as never
    posthogErrorMirror().processEvent?.(event)
    expect(inner).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(inner.mock.calls)).not.toContain('private-payload')
})

it('skips cancellations and duplicate wrappers but retains first-party failures before Sentry filtering', () => {
    const inner = jest.fn((event) => event)
    mockSentryIntegration.mockReturnValue({ name: 'posthog', processEvent: inner })
    const mirror = posthogErrorMirror()
    for (const value of ['User canceled the request', '[16] Canceled on BiometricPromptFragment.']) {
        mirror.processEvent?.({ exception: { values: [{ type: 'Error', value }] } } as never)
    }
    mirror.processEvent?.({ exception: { values: [{ type: 'PasskeyError', value: 'Please try again' }] } } as never)
    expect(inner).not.toHaveBeenCalled()
    for (const value of [
        'Failed to fetch exchange rate from bridge',
        'Minified React error #418',
        'Invalid sponsorship request',
    ]) {
        mirror.processEvent?.({ exception: { values: [{ type: 'Error', value }] } } as never)
    }
    expect(inner).toHaveBeenCalledTimes(3)
})
