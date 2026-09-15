import { renderHook } from '@testing-library/react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useHomeViewAnalytics } from '@/features/home/useHomeViewAnalytics'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockedCapture = posthog.capture as jest.MockedFunction<typeof posthog.capture>

beforeEach(() => jest.clearAllMocks())

describe('useHomeViewAnalytics', () => {
    it('captures once when the usable home screen replaces its loader', () => {
        const { rerender } = renderHook(({ loading }) => useHomeViewAnalytics(loading), {
            initialProps: { loading: true },
        })

        expect(mockedCapture).not.toHaveBeenCalled()
        rerender({ loading: false })
        rerender({ loading: false })

        expect(mockedCapture).toHaveBeenCalledTimes(1)
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.HOME_VIEWED, { screen_id: 'home' })
    })
})
