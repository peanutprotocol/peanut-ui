import { fireEvent, render, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { ScreenTransitionTracker } from '../ScreenTransitionTracker'

let pathname = '/home'
let mockQueryState: Record<string, string | null> = {}

jest.mock('next/navigation', () => ({
    usePathname: () => pathname,
}))
jest.mock('nuqs', () => ({
    parseAsString: {},
    useQueryStates: () => [mockQueryState, jest.fn()],
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const capture = posthog.capture as jest.MockedFunction<typeof posthog.capture>

beforeEach(() => {
    pathname = '/home'
    mockQueryState = {}
    window.history.replaceState({}, '', '/home')
    jest.clearAllMocks()
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(performance.now())
        return 1
    })
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
})

afterEach(() => jest.restoreAllMocks())

describe('ScreenTransitionTracker', () => {
    it('measures button-driven router navigation from the interaction', () => {
        const { rerender } = render(
            <>
                <ScreenTransitionTracker />
                <button onClick={() => window.history.pushState({}, '', '/rewards')}>Rewards</button>
            </>
        )

        fireEvent.click(screen.getByRole('button', { name: 'Rewards' }))
        pathname = '/rewards'
        rerender(
            <>
                <ScreenTransitionTracker />
                <button>Rewards</button>
            </>
        )

        expect(capture).toHaveBeenCalledWith(
            'screen_transition_completed',
            expect.objectContaining({
                from_screen: '/home',
                to_screen: '/rewards',
                trigger: 'interaction',
                measurement: 'route_shell_double_raf',
            })
        )
    })

    it('uses an enumerated name for query-only add-money drawer transitions', () => {
        const { rerender } = render(<ScreenTransitionTracker />)

        window.history.pushState({}, '', '/home?drawer=add')
        mockQueryState = { drawer: 'add' }
        rerender(<ScreenTransitionTracker />)

        expect(capture).toHaveBeenCalledWith(
            'screen_transition_completed',
            expect.objectContaining({ from_screen: '/home', to_screen: '/home#add' })
        )
    })
})
