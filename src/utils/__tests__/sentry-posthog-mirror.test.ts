const mockSentryIntegration = jest.fn()
jest.mock('posthog-js', () => ({ __esModule: true, default: { sentryIntegration: mockSentryIntegration } }))

import { posthogErrorMirror } from '../sentry-posthog-mirror'

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
