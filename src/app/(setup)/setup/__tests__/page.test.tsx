jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { ISetupStep } from '@/components/Setup/Setup.types'
import SetupPage from '../page'
import * as Sentry from '@sentry/nextjs'
import { useSetupStepAnalytics } from '@/features/setup/useSetupStepAnalytics'
import { markDeepLinkNavigated, resetDeepLinkStateForTests } from '@/utils/deep-link-state'

let mockNoBackLock: string | null = null
let mockSignupCompleted = false
const mockSetNoBackLock = jest.fn()
const mockSetSellScreensCountry = jest.fn()
let mockSellScreensCountry: string | null | undefined = undefined
const mockSupport = jest.fn()
const mockResolve = jest.fn()
const mockRouter = { replace: jest.fn(), push: jest.fn() }
const mockQueuePendingBadgeCampaigns = jest.fn((campaigns: readonly string[]) => [...campaigns])
const mockGetPendingBadgeCampaigns = jest.fn(() => [] as string[])
const mockClaimAndSettlePendingBadgeCampaigns = jest.fn((_campaigns: readonly string[]) =>
    Promise.resolve({
        claims: [{ badgeCampaign: 'bug_whisperer', outcome: 'awarded' }],
        pending: [],
        transport: 'canonical',
    })
)
const mockFlow = {
    step: undefined as ISetupStep | undefined,
    handleNext: jest.fn(),
    handleBack: jest.fn(),
    setScreenId: jest.fn(),
}
const mockStore = { steps: [] as ISetupStep[], inviteCode: undefined }
type MockAuthUser = {
    user?: { username?: string; hasAppAccess?: boolean; email?: string }
    accounts?: { type: string }[]
}
// The last setup step creates the wallet, so a finished signup always has one.
const WALLET = [{ type: 'peanut-wallet' }]
const mockAuth = {
    user: undefined as MockAuthUser | undefined,
    isFetchingUser: false,
    logoutUser: jest.fn(),
    isLoggingOut: false,
    fetchUser: jest.fn().mockResolvedValue(undefined),
}
let mockNative = true
let mockPwaSunsetOn = false
let mockSearchParams = new URLSearchParams()
let mockStoredRedirect: {
    destination: string
    origin: 'deep-link' | 'session-end' | null
    generationId: string | null
} | null = null

jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({
        ...mockStore,
        resetSetupFlow: jest.fn(),
        noBackLockScreenId: mockNoBackLock,
        signupCompleted: mockSignupCompleted,
        setNoBackLockScreenId: mockSetNoBackLock,
        sellScreensCountry: mockSellScreensCountry,
        setSellScreensCountry: mockSetSellScreensCountry,
        setSignupEntryFlow: jest.fn(),
    }),
}))
jest.mock('@/utils/invite-stash', () => ({ readInviteCode: jest.fn(), stashInvite: jest.fn() }))
jest.mock('@/components/Invites/badge-campaign-context', () => ({
    badgeCampaignsFromSearchParams: (params: URLSearchParams) => params.getAll('badge_campaign'),
    getPendingBadgeCampaigns: () => mockGetPendingBadgeCampaigns(),
    queuePendingBadgeCampaigns: (campaigns: readonly string[]) => mockQueuePendingBadgeCampaigns(campaigns),
}))
jest.mock('@/services/badge-campaigns', () => ({
    claimAndSettlePendingBadgeCampaigns: (campaigns: readonly string[]) =>
        mockClaimAndSettlePendingBadgeCampaigns(campaigns),
}))
jest.mock('@/hooks/useSetupFlow', () => ({ postRegistrationScreen: () => 'residence', useSetupFlow: () => mockFlow }))
jest.mock('@/features/setup/useSetupStepAnalytics', () => ({ useSetupStepAnalytics: jest.fn() }))
jest.mock('@/hooks/useSetupBackHandler', () => ({ useSetupBackHandler: jest.fn() }))
jest.mock('@/hooks/useGeoLocation', () => ({ useGeoLocation: jest.fn() }))
jest.mock('@/features/setup/useSetupCountrySignals', () => ({
    useSetupCountrySignals: () => ({
        ...jest.requireActual('@/features/setup/country-signals').EMPTY_SETUP_COUNTRY_SIGNALS,
        vercelIpCountry: 'PT',
    }),
}))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { WEB: 'web' },
    useDeviceType: () => ({ deviceType: 'android' }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: mockSupport }) }))
jest.mock('next/navigation', () => ({ useSearchParams: () => mockSearchParams, useRouter: () => mockRouter }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockNative }))
jest.mock('@/utils/migration.utils', () => ({ isPwaSunsetOn: () => mockPwaSunsetOn }))
jest.mock('@/utils/general.utils', () => ({
    getFromCookie: jest.fn(),
    getStoredRedirect: () => mockStoredRedirect,
    getValidRedirectUrl: (redirectUrl: string, fallbackRoute: string) =>
        jest.requireActual('@/utils/general.utils').getValidRedirectUrl(redirectUrl, fallbackRoute),
    saveToCookie: jest.fn(),
    toInviteCode: jest.fn(),
}))
jest.mock('@/components/Setup/setup-entry', () => ({
    hasKnownDeviceCredentials: () => false,
    resolveSetupEntryStep: (...args: unknown[]) => mockResolve(...args),
}))
jest.mock('@/components/Setup/Setup.utils', () => ({ isLikelyWebview: () => false, isDeviceOsSupported: () => true }))
jest.mock('@/components/Setup/components/SetupWrapper', () => ({
    SetupWrapper: ({
        children,
        showLogoutButton,
        showBackButton,
    }: {
        children: React.ReactNode
        showLogoutButton?: boolean
        showBackButton?: boolean
    }) => (
        <div>
            {showBackButton && <button>Go back</button>}
            {showLogoutButton && <button>Logout</button>}
            {children}
        </div>
    ),
}))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div role="status">Loading</div> }))
jest.mock('@/components/Global/UnsupportedBrowserModal', () => ({
    __esModule: true,
    default: () => <div>Unsupported device</div>,
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))

const landing: ISetupStep = {
    screenId: 'landing',
    layoutType: 'signup',
    image: { src: '' },
    component: () => <div>Landing step</div>,
}
const advance = (ms: number) =>
    act(async () => {
        await jest.advanceTimersByTimeAsync(ms)
    })

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockNoBackLock = null
    mockSignupCompleted = false
    mockSellScreensCountry = undefined
    mockResolve.mockReset().mockReturnValue('landing')
    mockStore.steps = [landing]
    mockFlow.step = landing
    mockAuth.isFetchingUser = false
    mockAuth.user = undefined
    mockAuth.fetchUser.mockResolvedValue(undefined)
    mockGetPendingBadgeCampaigns.mockReturnValue([])
    mockQueuePendingBadgeCampaigns.mockImplementation((campaigns: readonly string[]) => [...campaigns])
    mockClaimAndSettlePendingBadgeCampaigns.mockResolvedValue({
        claims: [{ badgeCampaign: 'bug_whisperer', outcome: 'awarded' }],
        pending: [],
        transport: 'canonical',
    })
    resetDeepLinkStateForTests()
    mockNative = true
    mockPwaSunsetOn = false
    mockSearchParams = new URLSearchParams()
    mockStoredRedirect = null
})
afterEach(() => {
    jest.useRealTimers()
})

it('shows retry and support when no current setup step can render', async () => {
    mockFlow.step = undefined
    renderWithIntl(<SetupPage />)
    await advance(100)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
    expect(mockSupport).toHaveBeenCalledWith(true)
    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'setup.recovery', level: 'info', message: 'Setup recovery required' })
    )
    expect(useSetupStepAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }))
})

it.each([true, false])('does not select the wrong step when the entry step is absent (native=%s)', async (native) => {
    mockNative = native
    Object.defineProperty(window, 'PublicKeyCredential', {
        configurable: true,
        value: { isUserVerifyingPlatformAuthenticatorAvailable: async () => true },
    })
    mockResolve.mockReturnValue('signup')
    renderWithIntl(<SetupPage />)
    await advance(100)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(mockFlow.setScreenId).not.toHaveBeenCalled()
    expect(screen.queryByText('Landing step')).not.toBeInTheDocument()
})

it('bounds waiting for the layout and reloads to restart layout and session initialization', async () => {
    mockStore.steps = []
    renderWithIntl(<SetupPage />)
    await advance(15000)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    const originalLocation = window.location
    const reload = jest.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } })
    try {
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(reload).toHaveBeenCalledTimes(1)
    } finally {
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    }
})

it('recovers from an initialization exception', async () => {
    mockResolve.mockImplementation(() => {
        throw new Error('entry failed')
    })
    renderWithIntl(<SetupPage />)
    await advance(100)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Setup initialization failed',
        expect.objectContaining({ level: 'error', tags: { reason: 'initialization_failed' } })
    )
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
})

it('ignores an authenticator check that completes after initialization timed out', async () => {
    mockNative = false
    let resolveSupport!: (supported: boolean) => void
    Object.defineProperty(window, 'PublicKeyCredential', {
        configurable: true,
        value: {
            isUserVerifyingPlatformAuthenticatorAvailable: () =>
                new Promise<boolean>((resolve) => {
                    resolveSupport = resolve
                }),
        },
    })
    renderWithIntl(<SetupPage />)
    await advance(15000)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'Setup initialization failed',
        expect.objectContaining({ level: 'error', tags: { reason: 'initialization_timeout' } })
    )
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
    await act(async () => {
        resolveSupport(true)
    })
    expect(mockFlow.setScreenId).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

it('preserves the unsupported-device recovery on web', async () => {
    mockNative = false
    Object.defineProperty(window, 'PublicKeyCredential', {
        configurable: true,
        value: { isUserVerifyingPlatformAuthenticatorAvailable: async () => false },
    })
    renderWithIntl(<SetupPage />)
    await advance(100)
    expect(screen.getByText('Unsupported device')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
})

it('routes sunset web guests to landing before unsupported-browser capability gates', async () => {
    mockNative = false
    mockPwaSunsetOn = true
    Object.defineProperty(window, 'PublicKeyCredential', {
        configurable: true,
        value: { isUserVerifyingPlatformAuthenticatorAvailable: jest.fn().mockResolvedValue(false) },
    })

    renderWithIntl(<SetupPage />)
    await advance(100)

    expect(screen.getByText('Landing step')).toBeInTheDocument()
    expect(screen.queryByText('Unsupported device')).not.toBeInTheDocument()
    expect(PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable).not.toHaveBeenCalled()
    expect(mockResolve).toHaveBeenCalledWith(
        expect.objectContaining({
            webSignupClosed: true,
        })
    )
    expect(mockFlow.setScreenId).toHaveBeenCalledWith('landing', { history: 'replace' })
})

it('bounds waiting for session hydration', async () => {
    mockAuth.isFetchingUser = true
    renderWithIntl(<SetupPage />)
    await advance(15000)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

it('suppresses timeout recovery when a completed session starts leaving for home', async () => {
    mockAuth.isFetchingUser = true
    const view = renderWithIntl(<SetupPage />)
    await advance(100)
    await advance(15000)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()

    mockAuth.isFetchingUser = false
    mockAuth.user = { user: { username: 'peanutter', hasAppAccess: true }, accounts: WALLET }
    await act(async () => {
        view.rerender(<SetupPage />)
    })

    expect(mockRouter.replace).toHaveBeenCalledWith('/home')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
})

it('treats a stale legacy no-access profile as an authenticated account', async () => {
    mockAuth.user = { user: { username: 'peanutter', hasAppAccess: false }, accounts: WALLET }

    renderWithIntl(<SetupPage />)

    expect(mockRouter.replace).toHaveBeenCalledWith('/home')
    expect(screen.getByRole('status')).toBeInTheDocument()
})

/*
 * A guest funding row sends a user to /setup?redirect_uri=%2Fadd-money. A
 * user who is already signed in must land on that page, not /home (TASK-23974).
 */
it.each([
    { label: 'a same-origin redirect_uri', query: 'redirect_uri=%2Fadd-money', destination: '/add-money' },
    { label: 'an external redirect_uri', query: 'redirect_uri=https%3A%2F%2Fevil.example', destination: '/home' },
    { label: 'a redirect_uri back into setup', query: 'redirect_uri=%2Fsetup%3Fstep%3Dsignup', destination: '/home' },
    { label: 'no redirect_uri', query: '', destination: '/home' },
])('sends a completed session with $label to $destination', async ({ query, destination }) => {
    mockAuth.user = { user: { username: 'peanutter', hasAppAccess: true }, accounts: WALLET }
    mockSearchParams = new URLSearchParams(query)

    renderWithIntl(<SetupPage />)

    expect(mockRouter.replace).toHaveBeenCalledTimes(1)
    expect(mockRouter.replace).toHaveBeenCalledWith(destination)
    expect(screen.getByRole('status')).toBeInTheDocument()
})

it('does not let stored redirect state redirect a completed session', async () => {
    mockAuth.user = { user: { username: 'peanutter', hasAppAccess: true }, accounts: WALLET }
    mockStoredRedirect = { destination: '/card', origin: 'deep-link', generationId: 'g1' }

    renderWithIntl(<SetupPage />)

    expect(mockRouter.replace).toHaveBeenCalledWith('/home')
})

it('sends a completed session to its redirect_uri once a native badge claim settles', async () => {
    mockAuth.user = { user: { username: 'alice', hasAppAccess: true }, accounts: WALLET }
    mockSearchParams = new URLSearchParams('step=signup&badge_campaign=bug_whisperer&redirect_uri=%2Fadd-money')

    renderWithIntl(<SetupPage />)

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/add-money'))
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/home')
})

it.each([true, false])('preserves the resolved entry flow (native=%s)', async (native) => {
    mockNative = native
    Object.defineProperty(window, 'PublicKeyCredential', {
        configurable: true,
        value: { isUserVerifyingPlatformAuthenticatorAvailable: async () => true },
    })
    renderWithIntl(<SetupPage />)
    await advance(100)
    expect(screen.getByText('Landing step')).toBeInTheDocument()
    expect(mockFlow.setScreenId).toHaveBeenCalledWith('landing', { history: 'replace' })
})

it('attributes bare setup to an unconsumed stored deep-link intent', async () => {
    mockStoredRedirect = {
        destination: '/card',
        origin: 'deep-link',
        generationId: 'card-entry',
    }

    renderWithIntl(<SetupPage />)
    await advance(100)

    expect(useSetupStepAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ signupEntryFlow: 'card' }))
})

it('does not attribute a stored session-end page to a new signup', async () => {
    mockStoredRedirect = {
        destination: '/card',
        origin: 'session-end',
        generationId: 'previous-session',
    }

    renderWithIntl(<SetupPage />)
    await advance(100)

    expect(useSetupStepAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ signupEntryFlow: 'default' }))
})

it.each([true, false])(
    'settles a native badge campaign before redirecting home (legacy access=%s)',
    async (hasAppAccess) => {
        mockAuth.user = { user: { username: 'alice', hasAppAccess }, accounts: WALLET }
        mockSearchParams = new URLSearchParams('step=signup&badge_campaign=bug_whisperer')

        renderWithIntl(<SetupPage />)

        await waitFor(() => expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledWith(['bug_whisperer']))
        expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledTimes(1)
        await waitFor(() => expect(mockAuth.fetchUser).toHaveBeenCalledTimes(1))
        expect(mockRouter.replace).toHaveBeenCalledWith('/home')
        expect(mockRouter.replace.mock.invocationCallOrder[0]).toBeGreaterThan(
            mockClaimAndSettlePendingBadgeCampaigns.mock.invocationCallOrder[0]
        )
    }
)

it('does not redirect home when setup unmounts before the native claim settles', async () => {
    mockAuth.user = { user: { username: 'alice', hasAppAccess: true }, accounts: WALLET }
    mockSearchParams = new URLSearchParams('step=signup&badge_campaign=bug_whisperer')
    type ClaimResult = Awaited<ReturnType<typeof mockClaimAndSettlePendingBadgeCampaigns>>
    let resolveClaim!: (result: ClaimResult) => void
    mockClaimAndSettlePendingBadgeCampaigns.mockImplementation(
        (_campaigns: readonly string[]) =>
            new Promise<ClaimResult>((resolve) => {
                resolveClaim = resolve
            })
    )

    const view = renderWithIntl(<SetupPage />)
    await waitFor(() => expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledWith(['bug_whisperer']))
    view.unmount()

    await act(async () => {
        resolveClaim({
            claims: [{ badgeCampaign: 'bug_whisperer', outcome: 'awarded' }],
            pending: [],
            transport: 'canonical',
        })
    })

    expect(mockRouter.replace).not.toHaveBeenCalledWith('/home')
})

it('does not redirect home after a newer native deep link is accepted', async () => {
    mockAuth.user = { user: { username: 'alice', hasAppAccess: true }, accounts: WALLET }
    mockSearchParams = new URLSearchParams('step=signup&badge_campaign=bug_whisperer')
    type ClaimResult = Awaited<ReturnType<typeof mockClaimAndSettlePendingBadgeCampaigns>>
    let resolveClaim!: (result: ClaimResult) => void
    mockClaimAndSettlePendingBadgeCampaigns.mockImplementation(
        (_campaigns: readonly string[]) =>
            new Promise<ClaimResult>((resolve) => {
                resolveClaim = resolve
            })
    )

    renderWithIntl(<SetupPage />)
    await waitFor(() => expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledWith(['bug_whisperer']))
    markDeepLinkNavigated('/pay-request')

    await act(async () => {
        resolveClaim({
            claims: [{ badgeCampaign: 'bug_whisperer', outcome: 'awarded' }],
            pending: [],
            transport: 'canonical',
        })
    })

    expect(mockRouter.replace).not.toHaveBeenCalledWith('/home')
})

it('restarts native badge settlement when the same invite is accepted again', async () => {
    mockAuth.user = { user: { username: 'alice', hasAppAccess: true }, accounts: WALLET }
    mockSearchParams = new URLSearchParams('step=signup&badge_campaign=bug_whisperer')
    type ClaimResult = Awaited<ReturnType<typeof mockClaimAndSettlePendingBadgeCampaigns>>
    const resolveClaims: Array<(result: ClaimResult) => void> = []
    mockClaimAndSettlePendingBadgeCampaigns.mockImplementation(
        (_campaigns: readonly string[]) =>
            new Promise<ClaimResult>((resolve) => {
                resolveClaims.push(resolve)
            })
    )

    renderWithIntl(<SetupPage />)
    await waitFor(() => expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledTimes(1))
    markDeepLinkNavigated('/setup?step=signup&badge_campaign=bug_whisperer')

    await waitFor(() => expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledTimes(2))
    expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenNthCalledWith(2, ['bug_whisperer'])

    await act(async () => {
        resolveClaims[0]({
            claims: [{ badgeCampaign: 'bug_whisperer', outcome: 'awarded' }],
            pending: [],
            transport: 'canonical',
        })
    })
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/home')

    await act(async () => {
        resolveClaims[1]({
            claims: [{ badgeCampaign: 'bug_whisperer', outcome: 'awarded' }],
            pending: [],
            transport: 'canonical',
        })
    })
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'))
})

it('restarts native badge settlement when a newer invite replaces the setup URL', async () => {
    mockAuth.user = { user: { username: 'alice', hasAppAccess: true }, accounts: WALLET }
    mockSearchParams = new URLSearchParams('step=signup&badge_campaign=bug_whisperer')
    type ClaimResult = Awaited<ReturnType<typeof mockClaimAndSettlePendingBadgeCampaigns>>
    const resolveClaims: Array<(result: ClaimResult) => void> = []
    mockClaimAndSettlePendingBadgeCampaigns.mockImplementation(
        (_campaigns: readonly string[]) =>
            new Promise<ClaimResult>((resolve) => {
                resolveClaims.push(resolve)
            })
    )

    const view = renderWithIntl(<SetupPage />)
    await waitFor(() => expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledTimes(1))

    markDeepLinkNavigated('/setup?step=signup&badge_campaign=bug_whisperer_v2')
    await waitFor(() => expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledTimes(1))
    mockSearchParams = new URLSearchParams('step=signup&badge_campaign=bug_whisperer_v2')
    view.rerender(<SetupPage />)

    await waitFor(() => expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledTimes(2))
    expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenNthCalledWith(2, ['bug_whisperer_v2'])

    await act(async () => {
        resolveClaims[0]({
            claims: [{ badgeCampaign: 'bug_whisperer', outcome: 'awarded' }],
            pending: [],
            transport: 'canonical',
        })
    })
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/home')

    await act(async () => {
        resolveClaims[1]({
            claims: [{ badgeCampaign: 'bug_whisperer_v2', outcome: 'awarded' }],
            pending: [],
            transport: 'canonical',
        })
    })
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'))
})

it('redirects home for a newer setup invite without a badge campaign', async () => {
    mockAuth.user = { user: { username: 'alice', hasAppAccess: true }, accounts: WALLET }
    mockSearchParams = new URLSearchParams('step=signup&badge_campaign=bug_whisperer')
    type ClaimResult = Awaited<ReturnType<typeof mockClaimAndSettlePendingBadgeCampaigns>>
    mockClaimAndSettlePendingBadgeCampaigns.mockImplementation(
        (_campaigns: readonly string[]) => new Promise<ClaimResult>(() => {})
    )

    const view = renderWithIntl(<SetupPage />)
    await waitFor(() => expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledTimes(1))

    markDeepLinkNavigated('/setup?step=signup')
    mockSearchParams = new URLSearchParams('step=signup')
    view.rerender(<SetupPage />)

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'))
})

it('does not initialize after unmount', async () => {
    const view = renderWithIntl(<SetupPage />)
    view.unmount()
    await advance(100)
    expect(mockFlow.setScreenId).not.toHaveBeenCalled()
})

/*
 * Back after a completed signup lands here: the flow leaves a history entry
 * per step on web, and the post-signup redirect only replaces the last one.
 * The session effect already bounces such a visit to /home — while that soft
 * nav is in flight the page must keep waiting, not report a fault it is
 * already recovering from (PEANUT-UI-T3A, reason=missing_step).
 */
it('bounces a completed session home without showing the recovery screen', async () => {
    mockAuth.user = { user: { username: 'peanutter', hasAppAccess: true }, accounts: WALLET }
    mockFlow.step = undefined
    renderWithIntl(<SetupPage />)
    await advance(100)
    expect(mockRouter.replace).toHaveBeenCalledWith('/home')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    // the initialization bound must not turn the pending bounce into a fault either
    await advance(15000)
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(Sentry.addBreadcrumb).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
})

it('does not reinitialize the entry when residence eligibility changes the step list', async () => {
    const view = renderWithIntl(<SetupPage />)
    await advance(100)
    expect(mockFlow.setScreenId).toHaveBeenCalledTimes(1)
    const card = { ...landing, screenId: 'advantage-card' as const, component: () => <div>Card step</div> }
    mockStore.steps = [landing, card]
    mockFlow.step = card
    view.rerender(<SetupPage />)
    await advance(200)
    expect(mockFlow.setScreenId).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Card step')).toBeInTheDocument()
})

it('hides Logout on the final ready-to-start confirmation screen', async () => {
    const ready: ISetupStep = {
        ...landing,
        screenId: 'advantage-control',
        component: () => <div>Ready confirmation</div>,
    }
    mockStore.steps = [landing, ready]
    mockFlow.step = ready
    renderWithIntl(<SetupPage />)
    await advance(100)
    expect(screen.getByText('Ready confirmation')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument()
})

it.each([
    'invite',
    'payment-plan',
    'advantage-fees',
    'advantage-card',
    'notification-email',
    'notification-permission',
    'advantage-control',
] as const)('shows Back on %s after registration and arms the lock at residence', async (screenId) => {
    const step = { ...landing, screenId, showBackButton: true }
    mockStore.steps = [step]
    mockFlow.step = step
    mockResolve.mockReturnValue(screenId)
    mockNoBackLock = 'residence'
    renderWithIntl(<SetupPage />)
    await advance(100)
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument()
    expect(mockSetNoBackLock).toHaveBeenCalledWith('residence')
})
it('fixes the sell screens to the suggested country once the account exists', async () => {
    const step = { ...landing, screenId: 'invite' as const, showBackButton: true }
    mockStore.steps = [step]
    mockFlow.step = step
    mockResolve.mockReturnValue(step.screenId)
    mockSellScreensCountry = undefined
    renderWithIntl(<SetupPage />)
    await advance(100)
    expect(mockSetSellScreensCountry).toHaveBeenCalledWith('PT')
})
it.each(['landing', 'signup'] as const)('does not arm the registration lock on %s', async (screenId) => {
    const step = { ...landing, screenId, showBackButton: true }
    mockStore.steps = [step]
    mockFlow.step = step
    mockResolve.mockReturnValue(screenId)
    renderWithIntl(<SetupPage />)
    await advance(100)
    expect(mockSetNoBackLock).not.toHaveBeenCalled()
})
it('hides Back at the residence boundary once registered, and during celebration', async () => {
    const step = { ...landing, screenId: 'residence' as const, showBackButton: true }
    mockStore.steps = [step]
    mockFlow.step = step
    mockResolve.mockReturnValue(step.screenId)
    mockNoBackLock = 'residence'
    const view = renderWithIntl(<SetupPage />)
    await advance(100)
    expect(mockSetNoBackLock).toHaveBeenCalledWith('residence')
    expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument()
    mockSignupCompleted = true
    mockFlow.step = { ...step, screenId: 'advantage-control' }
    view.rerender(<SetupPage />)
    expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument()
})

/*
 * A reload mid-signup (a deploy's service worker, chunk recovery, pull to
 * refresh) or an app restart lands on /setup signed in but without the wallet
 * the last step creates. Leaving for /home sent it to /setup/finish and skipped
 * the email and every other step after registration (test044, 2026-10-26).
 */
describe('a signup interrupted after registration', () => {
    const residence: ISetupStep = { ...landing, screenId: 'residence', component: () => <div>Residence step</div> }
    const unfinished = { user: { username: 'test044', hasAppAccess: true }, accounts: [] }

    beforeEach(() => {
        mockStore.steps = [landing, residence]
        mockFlow.step = residence
        mockSearchParams = new URLSearchParams('screen=notification-email')
    })

    it.each([true, false])('restarts at the first step after registration (native=%s)', async (native) => {
        mockNative = native
        Object.defineProperty(window, 'PublicKeyCredential', {
            configurable: true,
            value: { isUserVerifyingPlatformAuthenticatorAvailable: async () => true },
        })
        mockAuth.user = unfinished
        renderWithIntl(<SetupPage />)
        await advance(100)
        expect(mockRouter.replace).not.toHaveBeenCalled()
        expect(mockFlow.setScreenId).toHaveBeenCalledTimes(1)
        expect(mockFlow.setScreenId).toHaveBeenCalledWith('residence', { history: 'replace' })
        expect(screen.getByText('Residence step')).toBeInTheDocument()
        expect(mockSetNoBackLock).toHaveBeenCalledWith('residence')
    })

    it('moves to that step when the profile arrives after the entry step resolved', async () => {
        mockAuth.isFetchingUser = true
        mockFlow.step = landing
        const view = renderWithIntl(<SetupPage />)
        await advance(100)
        expect(mockFlow.setScreenId).toHaveBeenLastCalledWith('landing', { history: 'replace' })

        mockAuth.isFetchingUser = false
        mockAuth.user = unfinished
        await act(async () => {
            view.rerender(<SetupPage />)
        })

        expect(mockFlow.setScreenId).toHaveBeenLastCalledWith('residence', { history: 'replace' })
        expect(mockRouter.replace).not.toHaveBeenCalled()
    })

    it('resumes, not leaves, once a native badge claim settles', async () => {
        mockAuth.user = unfinished
        mockSearchParams = new URLSearchParams('step=signup&badge_campaign=bug_whisperer')
        renderWithIntl(<SetupPage />)
        await advance(100)
        await waitFor(() => expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledWith(['bug_whisperer']))
        await waitFor(() => expect(mockAuth.fetchUser).toHaveBeenCalledTimes(1))
        await advance(0)
        expect(mockRouter.replace).not.toHaveBeenCalled()
        expect(mockFlow.setScreenId).toHaveBeenCalledWith('residence', { history: 'replace' })
    })

    it('keeps its place when a newer setup deep link arrives mid-flow', async () => {
        const paymentPlan: ISetupStep = { ...landing, screenId: 'payment-plan', component: () => <div>Plan step</div> }
        mockStore.steps = [landing, residence, paymentPlan]
        mockAuth.user = unfinished
        mockSearchParams = new URLSearchParams()
        const view = renderWithIntl(<SetupPage />)
        await advance(100)
        expect(mockFlow.setScreenId).toHaveBeenLastCalledWith('residence', { history: 'replace' })

        // The person moves on in the flow, then a new invite link opens /setup.
        mockFlow.step = paymentPlan
        view.rerender(<SetupPage />)
        mockFlow.setScreenId.mockClear()
        mockSearchParams = new URLSearchParams('code=friend')
        await act(async () => {
            markDeepLinkNavigated('/setup?code=friend')
            view.rerender(<SetupPage />)
        })
        await advance(100)

        expect(mockRouter.replace).not.toHaveBeenCalled()
        expect(mockFlow.setScreenId).not.toHaveBeenCalledWith('residence', expect.anything())
        expect(screen.getByText('Plan step')).toBeInTheDocument()
    })

    it('keeps a flow under way going after its email is saved, until the wallet exists', async () => {
        const paymentPlan: ISetupStep = { ...landing, screenId: 'payment-plan', component: () => <div>Plan step</div> }
        mockStore.steps = [landing, residence, paymentPlan]
        mockAuth.user = unfinished
        const view = renderWithIntl(<SetupPage />)
        await advance(100)

        mockFlow.step = paymentPlan
        mockAuth.user = { ...unfinished, user: { ...unfinished.user, email: 'test044@example.com' } }
        view.rerender(<SetupPage />)
        mockSearchParams = new URLSearchParams('code=friend')
        await act(async () => {
            markDeepLinkNavigated('/setup?code=friend')
            view.rerender(<SetupPage />)
        })
        await advance(100)

        expect(mockRouter.replace).not.toHaveBeenCalled()
        expect(screen.getByText('Plan step')).toBeInTheDocument()
    })

    it('restarts after registration on a fresh load even when the URL names a later step', async () => {
        const paymentPlan: ISetupStep = { ...landing, screenId: 'payment-plan', component: () => <div>Plan step</div> }
        mockStore.steps = [landing, residence, paymentPlan]
        mockFlow.step = paymentPlan
        mockAuth.user = unfinished
        renderWithIntl(<SetupPage />)
        await advance(100)
        expect(mockFlow.setScreenId).toHaveBeenCalledWith('residence', { history: 'replace' })
        expect(mockFlow.setScreenId).not.toHaveBeenCalledWith('payment-plan', expect.anything())
    })

    it('still sends a finished signup home', async () => {
        mockAuth.user = { ...unfinished, accounts: WALLET }
        renderWithIntl(<SetupPage />)
        expect(mockRouter.replace).toHaveBeenCalledWith('/home')
    })

    // Its answers are in: only the wallet is missing, which /home hands to /setup/finish.
    it('does not walk the steps again for an account that already gave its email', async () => {
        mockAuth.user = { ...unfinished, user: { ...unfinished.user, email: 'test044@example.com' } }
        renderWithIntl(<SetupPage />)
        await advance(100)
        expect(mockRouter.replace).toHaveBeenCalledWith('/home')
        expect(mockFlow.setScreenId).not.toHaveBeenCalledWith('residence', { history: 'replace' })
    })
})
