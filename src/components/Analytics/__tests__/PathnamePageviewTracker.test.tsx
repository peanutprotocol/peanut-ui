import { render } from '@testing-library/react'
import posthog from 'posthog-js'
import { PathnamePageviewTracker } from '@/components/Analytics/PathnamePageviewTracker'

let pathname = '/setup'

jest.mock('next/navigation', () => ({ usePathname: () => pathname }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockedCapture = posthog.capture as jest.MockedFunction<typeof posthog.capture>

beforeEach(() => {
    pathname = '/setup'
    jest.clearAllMocks()
})

describe('PathnamePageviewTracker', () => {
    it('leaves the initial pageview to PostHog init', () => {
        render(<PathnamePageviewTracker />)
        expect(mockedCapture).not.toHaveBeenCalled()
    })

    it('captures one pageview for each pathname transition', () => {
        const { rerender } = render(<PathnamePageviewTracker />)

        pathname = '/home'
        rerender(<PathnamePageviewTracker />)
        rerender(<PathnamePageviewTracker />)

        expect(mockedCapture).toHaveBeenCalledTimes(1)
        expect(mockedCapture).toHaveBeenCalledWith('$pageview')

        pathname = '/card'
        rerender(<PathnamePageviewTracker />)
        expect(mockedCapture).toHaveBeenCalledTimes(2)
    })
})
