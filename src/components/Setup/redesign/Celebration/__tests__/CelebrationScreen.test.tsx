/** @jest-environment jsdom */
/**
 * 12 Celebration (`advantage-control` after completion), contract P4 § 5. Written before the screen exists.
 * useAccountSetup is real: the redirect is observed on the router (`router.replace`), so the claim link
 * (`redirect_uri`) and the demo route are checked by where the person lands.
 */
import { startVerifySource } from '@/features/paperwork-verification/verifySource'
import { StrictMode } from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { shootStarConfetti } from '@/utils/confetti'
import { notifyHaptic } from '@/utils/haptics'
import { disableDemoMode, enableDemoMode } from '@/utils/demo'
import { getStoredRedirect, setRedirectUrl } from '@/utils/general.utils'
import { signupControls } from '@/test-utils/signup-controls'
import { FinalStep } from '../../FinalConfirm/FinalStep'
import { CelebrationScreen } from '../CelebrationScreen'
import { copy, copyRx, footer, renderRedesign, setupState, textMatch } from '../../Accounts/__tests__/redesignHarness'

const mockReplace = jest.fn()
const mockPush = jest.fn()
let mockRedirectUri: string | null = null
jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, push: mockPush }),
    useSearchParams: () => ({ get: (key: string) => (key === 'redirect_uri' ? mockRedirectUri : null) }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'user-1', username: 'kim' }, accounts: [] },
        addAccount: jest.fn(),
        fetchUser: jest.fn(),
    }),
}))
jest.mock('@/utils/confetti', () => ({ shootStarConfetti: jest.fn() }))
jest.mock('@/utils/haptics', () => ({ notifyHaptic: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))
// The verify start: the door checks, and the ID-check start's boundaries (the start's own routing is
// covered by ActivationCTAs.test, which shares useIdentityCheckStart).
let mockRegionRestricted = false
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: mockRegionRestricted }),
}))
let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({ useResidenceRestrictions: () => mockRestrictions }))
let mockOpensVerify = true
jest.mock('@/features/paperwork-verification/usePaperworkVerificationStart', () => ({
    usePaperworkVerificationStart: () => async () => mockOpensVerify,
}))
let mockKycOptions: { onKycSuccess?: () => void } = {}
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: (options: { onKycSuccess?: () => void }) => {
        mockKycOptions = options
        return { showWrapper: false, handleInitiateKyc: jest.fn(), isLoading: false }
    },
}))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    // a tap stands for its Remind me later
    InitiateKycModal: ({ visible, onClose }: { visible: boolean; onClose: () => void }) =>
        visible ? <button onClick={onClose}>initiate-kyc-modal</button> : null,
}))
jest.mock('@/features/payments/flows/qr-pay/useQrIdentityCheck', () => ({
    useQrIdentityCheck: () => ({ start: jest.fn(), modals: null }),
}))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ openSupportWithMessage: jest.fn() }) }))
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
// dev's Celebration with its redirect, as a deep-link sign-up (add money) still gets it: a default sign-up gets the
// buttons. The verify suite renders FinalStep, as the page does.
const render = (
    seed: Seed = { signupCompleted: true, username: 'kim', signupEntryFlow: 'add-money' },
    strict = false,
    step = false
) =>
    renderRedesign(
        step ? (
            <FinalStep />
        ) : strict ? (
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
    mockRegionRestricted = false
    mockRestrictions = { banking: false, card: false }
    mockOpensVerify = true
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
        expect(shootStarConfetti).not.toHaveBeenCalled()
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
        expect(shootStarConfetti).toHaveBeenCalledTimes(1)
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
        // a default sign-up, which would otherwise get the Verify now buttons and hold the redirect
        renderRedesign(<CelebrationScreen quiet />, {
            screenId: 'advantage-control',
            seed: { signupCompleted: true, username: 'kim' },
            showBackButton: true,
        })
        expect(screen.queryByTestId('setup-redesign-celebration')).toBeNull()
        expect(screen.queryByTestId('setup-redesign-celebration-verify-now')).toBeNull()
        expect(shootStarConfetti).not.toHaveBeenCalled()
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

describe('12 Celebration and the one verify screen (a default sign-up)', () => {
    const renderStep = (seed: Seed = { signupCompleted: true, username: 'kim' }) => render(seed, false, true)
    const celebrationVerify = () => screen.getByTestId('setup-redesign-celebration-verify-now')
    const later = () => screen.getByRole('button', { name: copyRx('setupRedesign.verifyStart.remindLater') })

    it("VS-1 Celebration: dev's copy, a white Verify now and a Remind me later link in place of the wait", () => {
        const { container } = renderStep()
        expect(setupState(container)).toBe('buttons')
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(copyRx('setupRedesign.done.title'))
        expect(screen.getByText(textMatch('@kim'))).toBeInTheDocument()
        expect(screen.getByText(textMatch(copy('setupRedesign.done.sub')))).toBeInTheDocument()
        expect(screen.queryByText(textMatch(copy('setupRedesign.done.going')))).toBeNull()
        expect(container.querySelector('[data-mascot-pose="waving-chill"]')).not.toBeNull()
        // white on the pink ground: the pink primary would vanish (Kush, feedback round 1)
        expect(celebrationVerify()).toHaveTextContent(copy('setupRedesign.verifyStart.verifyNow'))
        expect(celebrationVerify()).toHaveClass('btn-secondary')
        // design.md: a defer action is the tertiary link, never a Button
        expect(later()).not.toHaveClass('btn')
        expect(shootStarConfetti).toHaveBeenCalledTimes(1)
        act(() => jest.advanceTimersByTime(10000))
        expect(mockReplace).not.toHaveBeenCalled()
    })

    it('VS-2 Verify now leaves sign-up for /verify in its place: no Verify start step, so no sign-up footer there', async () => {
        const { container } = renderStep()
        await act(async () => fireEvent.click(celebrationVerify()))
        expect(signupControls(posthog.capture as jest.Mock)).toEqual(['celebration:open', 'celebration-verify-now:tap'])
        // replace: Back from /verify must not reopen sign-up
        expect(mockReplace).toHaveBeenCalledWith('/verify')
        // the Verify start /verify shows reports sign-up as its entry
        expect(startVerifySource()).toBe('signup')
        expect(mockReplace).toHaveBeenCalledTimes(1)
        expect(mockPush).not.toHaveBeenCalled()
        // the step stays the Celebration until the route changes and unmounts the sign-up shell with its footer
        expect(setupState(container)).toBe('buttons')
        expect(screen.queryByTestId('setup-redesign-verify-start')).toBeNull()
    })

    it('VS-3 Verify now clears a stored redirect of an earlier session', async () => {
        setRedirectUrl('/profile', 'session-end')
        renderStep()
        await act(async () => fireEvent.click(celebrationVerify()))
        expect(getStoredRedirect()).toBeNull()
    })

    it('VS-4 a user outside the /verify flow gets the same start modal as Home; closing it leaves sign-up for Home', async () => {
        mockOpensVerify = false
        renderStep()
        await act(async () => fireEvent.click(celebrationVerify()))
        expect(mockPush).not.toHaveBeenCalled()
        fireEvent.click(screen.getByText('initiate-kyc-modal'))
        expect(screen.queryByText('initiate-kyc-modal')).toBeNull()
        expect(mockReplace).toHaveBeenCalledWith('/home')
    })

    it('VS-4 the legacy start, once verified, goes where sign-up goes', async () => {
        mockOpensVerify = false
        renderStep()
        await act(async () => fireEvent.click(celebrationVerify()))
        expect(mockReplace).not.toHaveBeenCalled()
        act(() => mockKycOptions.onKycSuccess?.())
        expect(mockReplace).toHaveBeenCalledWith('/home')
    })

    it('VS-5 Celebration Remind me later goes Home without starting the check', () => {
        const { container } = renderStep()
        fireEvent.click(later())
        expect(mockReplace).toHaveBeenCalledWith('/home')
        expect(mockReplace).toHaveBeenCalledTimes(1)
        expect(setupState(container)).toBe('buttons')
        expect(signupControls(posthog.capture as jest.Mock)).toEqual([
            'celebration:open',
            'celebration-remind-later:tap',
        ])
    })

    it('VS-7 a claim-link sign-up keeps the claim redirect at 4500 ms', () => {
        mockRedirectUri = '/claim/abc'
        const { container } = renderStep({ signupCompleted: true, username: 'kim', signupEntryFlow: 'claim' })
        expect(setupState(container)).toBe('claim-link')
        expect(screen.queryByRole('button')).toBeNull()
        act(() => jest.advanceTimersByTime(4500))
        expect(mockReplace).toHaveBeenCalledWith('/claim/abc')
    })

    it('VS-7 another deep link (add money) keeps its redirect', () => {
        mockRedirectUri = '/add-money'
        renderStep({ signupCompleted: true, username: 'kim', signupEntryFlow: 'add-money' })
        expect(screen.queryByRole('button')).toBeNull()
        act(() => jest.advanceTimersByTime(4500))
        expect(mockReplace).toHaveBeenCalledWith('/add-money')
    })

    it.each([
        ['no bank rails and no card', () => (mockRestrictions = { banking: true, card: true })],
        ['a region-restricted ID', () => (mockRegionRestricted = true)],
    ])('VS-8 %s: no buttons, the redirect stays', (_label, restrict) => {
        restrict()
        const { container } = renderStep()
        expect(setupState(container)).toBe('default')
        expect(screen.queryByRole('button')).toBeNull()
        act(() => jest.advanceTimersByTime(4500))
        expect(mockReplace).toHaveBeenCalledWith('/home')
    })

    it('VS-8 card only (bank rails closed) still gets the buttons, and Verify now opens /verify', async () => {
        mockRestrictions = { banking: true, card: false }
        renderStep()
        await act(async () => fireEvent.click(celebrationVerify()))
        expect(mockReplace).toHaveBeenCalledWith('/verify')
    })

    it('VS-9 demo mode keeps the walkthrough redirect', () => {
        enableDemoMode()
        renderStep()
        expect(screen.queryByRole('button')).toBeNull()
        act(() => jest.advanceTimersByTime(4500))
        expect(mockReplace).toHaveBeenCalledWith('/home')
    })
})
