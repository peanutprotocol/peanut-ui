/** @jest-environment jsdom */
/**
 * 12 Celebration (`advantage-control` after completion), contract P4 § 5. Written before the screen exists.
 * useAccountSetup is real: the redirect is observed on the router (`router.replace`), so the claim link
 * (`redirect_uri`) and the demo route are checked by where the person lands.
 */
import { StrictMode } from 'react'
import { act, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { confettiPresets } from '@/utils/confetti'
import { notifyHaptic } from '@/utils/haptics'
import { disableDemoMode, enableDemoMode } from '@/utils/demo'
import { setRedirectUrl } from '@/utils/general.utils'
import { signupControls } from '@/test-utils/signup-controls'
import { CelebrationScreen } from '../CelebrationScreen'
import { copy, copyRx, footer, renderRedesign, setupState, textMatch } from '../../Accounts/__tests__/redesignHarness'

const mockReplace = jest.fn()
let mockRedirectUri: string | null = null
jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
    useSearchParams: () => ({ get: (key: string) => (key === 'redirect_uri' ? mockRedirectUri : null) }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'user-1', username: 'kim' }, accounts: [] },
        addAccount: jest.fn(),
        fetchUser: jest.fn(),
    }),
}))
jest.mock('@/utils/confetti', () => ({ confettiPresets: { success: jest.fn(), celebration: jest.fn() } }))
jest.mock('@/utils/haptics', () => ({ notifyHaptic: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: {
        loadAnimation: () => ({
            totalFrames: 20,
            frameRate: 30,
            addEventListener: jest.fn(),
            destroy: jest.fn(),
            goToAndStop: jest.fn(),
            playSegments: jest.fn(),
        }),
    },
}))
let mockReduced = false
jest.mock('framer-motion', () => require('../../Accounts/__tests__/framerMock').framerMotionForShell(() => mockReduced))

const setReducedMotion = (matches: boolean) => {
    mockReduced = matches
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: matches && query.includes('reduce'),
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }),
    })
}

type Seed = Parameters<typeof renderRedesign>[1]['seed']
const render = (seed: Seed = { signupCompleted: true, username: 'kim' }, strict = false) =>
    renderRedesign(
        strict ? (
            <StrictMode>
                <CelebrationScreen />
            </StrictMode>
        ) : (
            <CelebrationScreen />
        ),
        {
            screenId: 'advantage-control',
            seed,
            showBackButton: true,
            progress: { index: 10, total: 10 },
        }
    )

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    mockRedirectUri = null
    setReducedMotion(false)
    disableDemoMode()
})
afterEach(() => {
    jest.useRealTimers()
    disableDemoMode()
})

describe('12 Celebration', () => {
    it('P4-51 renders nothing before sign-up completes', () => {
        const { container } = render({ signupCompleted: false })
        expect(container.querySelector('[data-testid="setup-redesign-celebration"]')).toBeNull()
        expect(container.querySelector('[data-setup-stage]')).toBeNull()
        expect(screen.queryByRole('heading')).toBeNull()
        expect(confettiPresets.success).not.toHaveBeenCalled()
        act(() => jest.advanceTimersByTime(5000))
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('P4-52 default: headline, @username chip, sub and going line; no back, dots, language or footer', () => {
        const { container } = render()
        expect(container.querySelector('[data-testid="setup-redesign-celebration"]')).not.toBeNull()
        expect(setupState(container)).toBe('default')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copyRx('setupRedesign.done.title'))
        expect(screen.getByText(textMatch('@kim'))).toBeInTheDocument()
        expect(screen.getByText(textMatch(copy('setupRedesign.done.sub')))).toBeInTheDocument()
        expect(screen.getByText(textMatch(copy('setupRedesign.done.going')))).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: copyRx('setup.navigation.goBack') })).toBeNull()
        expect(container.querySelector('[data-setup-dots]')).toBeNull()
        expect(screen.queryByRole('button', { name: copyRx('settings.language.title') })).toBeNull()
        expect(footer(container)).toBeNull()
        expect(screen.queryByRole('button')).toBeNull()
        // stage 'full': no white panel
        expect(container.querySelector('[data-setup-panel]')).toBeNull()
    })

    it('P4-52 the mascot is the approved whistling pose (waving-chill, owner ruling 17 Nov)', () => {
        const { container } = render()
        expect(container.querySelector('[data-mascot-pose="waving-chill"]')).not.toBeNull()
    })

    it('P4-53 haptic, celebration:open and confetti fire once on mount, also under Strict Mode', () => {
        const view = render(undefined, true)
        view.rerenderSame()
        expect(notifyHaptic).toHaveBeenCalledTimes(1)
        expect(notifyHaptic).toHaveBeenCalledWith('success')
        expect(confettiPresets.success).toHaveBeenCalledTimes(1)
        expect(signupControls(posthog.capture as jest.Mock)).toEqual(['celebration:open'])
        expect((posthog.capture as jest.Mock).mock.calls[0][1]).toEqual(
            expect.objectContaining({ screen_id: 'advantage-control' })
        )
    })

    it('P4-54 enters the account at 4500 ms, not at 4499, and only once', () => {
        render()
        act(() => jest.advanceTimersByTime(4499))
        expect(mockReplace).not.toHaveBeenCalled()
        act(() => jest.advanceTimersByTime(1))
        expect(mockReplace).toHaveBeenCalledTimes(1)
        expect(mockReplace).toHaveBeenCalledWith('/home')
        act(() => jest.advanceTimersByTime(10000))
        expect(mockReplace).toHaveBeenCalledTimes(1)
    })

    it('after Confirm later (quiet) there is no celebration: no confetti, no headline, straight into the account', () => {
        renderRedesign(<CelebrationScreen quiet />, {
            screenId: 'advantage-control',
            seed: { signupCompleted: true, username: 'kim' },
            showBackButton: true,
        })
        expect(screen.queryByTestId('setup-redesign-celebration')).toBeNull()
        expect(confettiPresets.success).not.toHaveBeenCalled()
        expect(notifyHaptic).not.toHaveBeenCalled()
        act(() => jest.advanceTimersByTime(0))
        expect(mockReplace).toHaveBeenCalledTimes(1)
        expect(mockReplace).toHaveBeenCalledWith('/home')
    })

    it('P4-54 leaving before 4500 ms never redirects', () => {
        const { unmount } = render()
        act(() => jest.advanceTimersByTime(3000))
        unmount()
        act(() => jest.advanceTimersByTime(5000))
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('P4-55 a claim-link sign-up shows the claim copy', () => {
        const { container } = render({ signupCompleted: true, username: 'kim', signupEntryFlow: 'claim' })
        expect(setupState(container)).toBe('claim-link')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copyRx('setupRedesign.done.claimTitle'))
        expect(screen.getByText(textMatch(copy('setupRedesign.done.claimSub')))).toBeInTheDocument()
        expect(screen.getByText(textMatch(copy('setupRedesign.done.claimGoing')))).toBeInTheDocument()
        expect(screen.queryByText(textMatch(copy('setupRedesign.done.going')))).toBeNull()
    })

    it('P4-56 the claim link wins over a stored route when the wait ends', () => {
        mockRedirectUri = '/claim/abc'
        setRedirectUrl('/profile/identity-verification')
        render({ signupCompleted: true, username: 'kim', signupEntryFlow: 'claim' })
        act(() => jest.advanceTimersByTime(4500))
        expect(mockReplace).toHaveBeenCalledTimes(1)
        expect(mockReplace).toHaveBeenCalledWith('/claim/abc')
    })

    it('P4-58 the EUR coin is drawn as approved: no filter, outline, shadow, border or colour override', () => {
        const { container } = render()
        const still = container.querySelector<HTMLElement>('[data-coin-still="eur"]')
        expect(still).not.toBeNull()
        const artBox = container.querySelector('[data-setup-art-box]')
        const banned =
            /\b(filter|outline|shadow|border|ring|hue-rotate|saturate|invert|brightness|sepia|grayscale|bg-|text-)/
        for (let node: HTMLElement | null = still; node && node !== artBox; node = node.parentElement) {
            for (const prop of [
                'filter',
                'outline',
                'boxShadow',
                'border',
                'backgroundColor',
                'color',
                'mixBlendMode',
            ] as const) {
                // next/image puts `color: transparent` on every <img> to hide its alt text while loading; it
                // touches no pixel of the coin, so it is the one inline colour allowed, and only on the still
                const altTextHide = node === still && prop === 'color' && node.style.color === 'transparent'
                expect(altTextHide ? '' : (node.style[prop] ?? '')).toBe('')
            }
            expect(String(node.getAttribute('class') ?? '')).not.toMatch(banned)
        }
    })

    it('P4-59 demo mode goes to /home at 4500 ms instead of the claim link', () => {
        enableDemoMode()
        mockRedirectUri = '/claim/abc'
        render()
        act(() => jest.advanceTimersByTime(4500))
        expect(mockReplace).toHaveBeenCalledTimes(1)
        expect(mockReplace).toHaveBeenCalledWith('/home')
    })

    it('P4-63 under reduced motion the mascot holds its frame and the redirect still fires at 4500 ms', () => {
        setReducedMotion(true)
        const { container } = render()
        expect(container.querySelector('[data-mascot-pose="waving-chill"]')).toHaveAttribute(
            'data-lottie-running',
            'false'
        )
        for (const piece of container.querySelectorAll<HTMLElement>('[data-setup-art-box] > div')) {
            expect(piece.style.opacity === '' || piece.style.opacity === '1').toBe(true)
        }
        act(() => jest.advanceTimersByTime(4500))
        expect(mockReplace).toHaveBeenCalledWith('/home')
    })
})
