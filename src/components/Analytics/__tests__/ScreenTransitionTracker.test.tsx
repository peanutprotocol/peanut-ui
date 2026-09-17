/* eslint-disable @next/next/no-html-link-for-pages -- raw anchors exercise the document-level tracker contract */
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

    it('does not carry a canceled link intent into a later transition', () => {
        const { rerender } = render(
            <>
                <ScreenTransitionTracker />
                <a href="/rewards" onClick={(event) => event.preventDefault()}>
                    Rewards
                </a>
            </>
        )

        fireEvent.click(screen.getByRole('link', { name: 'Rewards' }))
        window.history.pushState({}, '', '/rewards')
        pathname = '/rewards'
        rerender(<ScreenTransitionTracker />)

        expect(capture).toHaveBeenCalledWith(
            'screen_transition_completed',
            expect.objectContaining({ from_screen: '/home', to_screen: '/rewards', trigger: 'programmatic' })
        )
    })

    it.each([
        { target: '_blank', ctrlKey: false },
        { target: undefined, ctrlKey: true },
    ])('ignores links that do not navigate the current tab: %o', ({ target, ctrlKey }) => {
        const { rerender } = render(
            <>
                <ScreenTransitionTracker />
                <a href="/rewards" target={target}>
                    Rewards
                </a>
            </>
        )

        fireEvent.click(screen.getByRole('link', { name: 'Rewards' }), { ctrlKey })
        window.history.pushState({}, '', '/rewards')
        pathname = '/rewards'
        rerender(<ScreenTransitionTracker />)

        expect(capture).toHaveBeenCalledWith(
            'screen_transition_completed',
            expect.objectContaining({ from_screen: '/home', to_screen: '/rewards', trigger: 'programmatic' })
        )
    })

    it('expires a link intent when no route commit follows it', () => {
        jest.useFakeTimers()
        const lateCancel = (event: MouseEvent) => event.preventDefault()

        try {
            const { rerender } = render(
                <>
                    <ScreenTransitionTracker />
                    <a href="/rewards">Rewards</a>
                </>
            )
            // Registered after the tracker: this prevents JSDOM navigation but
            // deliberately leaves the capture-phase intent for its expiry.
            document.addEventListener('click', lateCancel)

            fireEvent.click(screen.getByRole('link', { name: 'Rewards' }))
            jest.advanceTimersByTime(10_001)
            window.history.pushState({}, '', '/rewards')
            pathname = '/rewards'
            rerender(<ScreenTransitionTracker />)
            jest.advanceTimersByTime(100)

            expect(capture).toHaveBeenCalledWith(
                'screen_transition_completed',
                expect.objectContaining({ from_screen: '/home', to_screen: '/rewards', trigger: 'programmatic' })
            )
        } finally {
            document.removeEventListener('click', lateCancel)
            jest.useRealTimers()
        }
    })
})
