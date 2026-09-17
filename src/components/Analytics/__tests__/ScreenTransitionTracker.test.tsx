/* eslint-disable @next/next/no-html-link-for-pages -- raw anchors exercise the document-level tracker contract */
import { fireEvent, render, screen } from '@testing-library/react'
import Link from 'next/link'
import type { NextRouter } from 'next/router'
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime'
import posthog from 'posthog-js'
import type { ReactNode } from 'react'
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

function NextRouterProvider({ children }: { children: ReactNode }) {
    const router = {
        push: jest.fn((href: string) => {
            window.history.pushState({}, '', href)
            return Promise.resolve(true)
        }),
        prefetch: jest.fn(() => Promise.resolve()),
        beforePopState: jest.fn(),
    } as unknown as NextRouter

    return <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
}

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

    it('preserves click-to-commit timing for a Next.js Link navigation', () => {
        const { rerender } = render(
            <NextRouterProvider>
                <ScreenTransitionTracker />
                <Link href="/rewards">Rewards</Link>
            </NextRouterProvider>
        )

        fireEvent.click(screen.getByRole('link', { name: 'Rewards' }))
        pathname = '/rewards'
        rerender(
            <NextRouterProvider>
                <ScreenTransitionTracker />
                <Link href="/rewards">Rewards</Link>
            </NextRouterProvider>
        )

        expect(capture).toHaveBeenCalledWith(
            'screen_transition_completed',
            expect.objectContaining({ from_screen: '/home', to_screen: '/rewards', trigger: 'link' })
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

    it('expires a genuinely canceled link intent before a later transition', () => {
        jest.useFakeTimers()

        try {
            const { rerender } = render(
                <>
                    <ScreenTransitionTracker />
                    <a href="/rewards" onClick={(event) => event.preventDefault()}>
                        Rewards
                    </a>
                </>
            )

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
            jest.useRealTimers()
        }
    })
})
