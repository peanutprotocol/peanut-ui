import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import type { ISetupStep } from '@/components/Setup/Setup.types'
import SetupPage from '../page'
import * as Sentry from '@sentry/nextjs'
import { useSetupStepAnalytics } from '@/features/setup/useSetupStepAnalytics'
import { markDeepLinkNavigated, resetDeepLinkStateForTests } from '@/utils/deep-link-state'

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
type MockAuthUser = { user?: { username?: string; hasAppAccess?: boolean } }
const mockAuth = {
    user: undefined as MockAuthUser | undefined,
    isFetchingUser: false,
    logoutUser: jest.fn(),
    isLoggingOut: false,
    fetchUser: jest.fn().mockResolvedValue(undefined),
}
let mockNative = true
let mockSearchParams = new URLSearchParams()

jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({ ...mockStore, resetSetupFlow: jest.fn(), setNoBackLockScreenId: jest.fn() }),
}))
jest.mock('@/hooks/useIosPwaInstallGate', () => ({
    useIosPwaInstallGate: () => ({ setShowIosPwaInstallScreen: jest.fn() }),
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
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => mockFlow }))
jest.mock('@/features/setup/useSetupStepAnalytics', () => ({ useSetupStepAnalytics: jest.fn() }))
jest.mock('@/hooks/useSetupBackHandler', () => ({ useSetupBackHandler: jest.fn() }))
jest.mock('@/hooks/useGeoLocation', () => ({ useGeoLocation: jest.fn() }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { WEB: 'web' },
    useDeviceType: () => ({ deviceType: 'android' }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => mockAuth }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: mockSupport }) }))
jest.mock('next/navigation', () => ({ useSearchParams: () => mockSearchParams, useRouter: () => mockRouter }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => mockNative }))
jest.mock('@/utils/migration.utils', () => ({ isPwaSunsetOn: () => false }))
jest.mock('@/utils/general.utils', () => ({
    getFromCookie: jest.fn(),
    saveToCookie: jest.fn(),
    toInviteCode: jest.fn(),
}))
jest.mock('@/components/Setup/setup-entry', () => ({
    hasKnownDeviceCredentials: () => false,
    resolveSetupEntryStep: (...args: unknown[]) => mockResolve(...args),
}))
jest.mock('@/components/Setup/Setup.consts', () => ({ setupSteps: [{ screenId: 'unsupported-browser' }] }))
jest.mock('@/components/Setup/Setup.utils', () => ({ isLikelyWebview: () => false, isDeviceOsSupported: () => true }))
jest.mock('@/components/Setup/components/SetupWrapper', () => ({
    SetupWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div role="status">Loading</div> }))
jest.mock('@/components/Global/UnsupportedBrowserModal', () => ({
    __esModule: true,
    default: () => <div>Unsupported device</div>,
}))
jest.mock('@/assets/mascot', () => ({ PeanutWavingHello: { src: '' } }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))

const landing: ISetupStep = {
    screenId: 'landing',
    layoutType: 'signup',
    image: '',
    component: () => <div>Landing step</div>,
}
const advance = (ms: number) =>
    act(async () => {
        await jest.advanceTimersByTimeAsync(ms)
    })

beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
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
    mockSearchParams = new URLSearchParams()
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
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(useSetupStepAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: false }))
})

it.each([true, false])('does not select the wrong step when the entry step is absent (native=%s)', async (native) => {
    mockNative = native
    Object.defineProperty(window, 'PublicKeyCredential', {
        configurable: true,
        value: { isUserVerifyingPlatformAuthenticatorAvailable: async () => true },
    })
    mockResolve.mockReturnValue('pwa-install')
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

it('bounds waiting for session hydration', async () => {
    mockAuth.isFetchingUser = true
    renderWithIntl(<SetupPage />)
    await advance(15000)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
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

it('settles a native badge campaign before redirecting an authenticated user home', async () => {
    mockAuth.user = { user: { username: 'alice', hasAppAccess: true } }
    mockSearchParams = new URLSearchParams('step=signup&badge_campaign=bug_whisperer')

    renderWithIntl(<SetupPage />)

    await waitFor(() => expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledWith(['bug_whisperer']))
    expect(mockClaimAndSettlePendingBadgeCampaigns).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(mockAuth.fetchUser).toHaveBeenCalledTimes(1))
    expect(mockRouter.replace).toHaveBeenCalledWith('/home')
    expect(mockRouter.replace.mock.invocationCallOrder[0]).toBeGreaterThan(
        mockClaimAndSettlePendingBadgeCampaigns.mock.invocationCallOrder[0]
    )
})

it('does not redirect home when setup unmounts before the native claim settles', async () => {
    mockAuth.user = { user: { username: 'alice', hasAppAccess: true } }
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
    mockAuth.user = { user: { username: 'alice', hasAppAccess: true } }
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
    markDeepLinkNavigated()

    await act(async () => {
        resolveClaim({
            claims: [{ badgeCampaign: 'bug_whisperer', outcome: 'awarded' }],
            pending: [],
            transport: 'canonical',
        })
    })

    expect(mockRouter.replace).not.toHaveBeenCalledWith('/home')
})

it('restarts native badge settlement when a newer invite replaces the setup URL', async () => {
    mockAuth.user = { user: { username: 'alice', hasAppAccess: true } }
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

    markDeepLinkNavigated()
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

it('does not initialize after unmount', async () => {
    const view = renderWithIntl(<SetupPage />)
    view.unmount()
    await advance(100)
    expect(mockFlow.setScreenId).not.toHaveBeenCalled()
})
