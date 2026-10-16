jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const mockCompleteAccountSetup = jest.fn()
const mockRecoverLoginSession = jest.fn()
const mockSyncIdentity = jest.fn().mockResolvedValue(undefined)
const mockResumeIdentity = jest.fn().mockResolvedValue(undefined)
const mockLogoutIdentity = jest.fn().mockResolvedValue(undefined)
let mockLogoutVersion: string | null = null
let mockUserData: unknown
let mockLoading = false
let mockLocked = false
let mockDemo = false
let mockQueryError: Error | null = null
const mockClear = jest.fn()
const mockCancelQueries = jest.fn().mockResolvedValue(undefined)
const mockRefetch = jest.fn().mockResolvedValue({ data: null })
const mockApiFetch = jest.fn().mockResolvedValue(undefined)
const mockToastError = jest.fn()
const mockClearSignupAttribution = jest.fn().mockResolvedValue(undefined)

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
const mockQueryClient = { clear: mockClear, cancelQueries: mockCancelQueries, getQueryData: () => mockUserData }
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => mockQueryClient,
}))
jest.mock('@/hooks/query/user', () => ({
    useUserQuery: () => ({
        data: mockUserData,
        isLoading: mockLoading,
        refetch: mockRefetch,
        error: mockQueryError,
    }),
}))
jest.mock('@/hooks/useUserAutoRefresh', () => ({ useUserAutoRefresh: jest.fn() }))
jest.mock('@/hooks/useAppLocked', () => ({ useAppLocked: () => mockLocked }))
jest.mock('@/hooks/useZeroDevFlow', () => ({ zeroDevFlowActions: { reset: jest.fn() } }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
jest.mock('@/utils/auth-token', () => ({ clearAuthToken: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/utils/login-session', () => ({
    recoverLoginSession: (...args: unknown[]) => mockRecoverLoginSession(...args),
}))
jest.mock('@/utils/cache.utils', () => ({ purgeCaches: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/utils/crisp', () => ({ resetCrispProxySessions: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn(), setUser: jest.fn() }))
jest.mock('@/i18n/app/locale-store', () => ({
    currentAppLocale: () => 'en',
    currentDeviceContext: () => ({}),
    currentDeviceIdentity: () => ({}),
}))
jest.mock('@/services/step-up', () => ({ clearStepUpToken: jest.fn() }))
jest.mock('@/services/badge-campaigns', () => ({
    claimAndSettlePendingBadgeCampaigns: jest.fn(),
    isConfirmedBadgeCampaignClaim: () => false,
}))
jest.mock('@/components/Invites/badge-campaign-context', () => ({
    clearPendingBadgeCampaigns: jest.fn(),
    getPendingBadgeCampaigns: () => [],
}))
jest.mock('@/utils/invite-stash', () => ({ clearInvite: jest.fn() }))
jest.mock('@/utils/signup-attribution', () => ({
    clearSignupAttribution: () => mockClearSignupAttribution(),
}))
jest.mock('@/services/pending-invite-attribution', () => ({
    settlePendingInviteAttribution: jest.fn().mockResolvedValue({ status: 'none' }),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { identify: jest.fn(), reset: jest.fn(), register: jest.fn() },
}))

jest.mock('@/services/account-setup', () => ({
    completeAccountSetup: (...args: unknown[]) => mockCompleteAccountSetup(...args),
}))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => mockDemo, disableDemoMode: jest.fn() }))
jest.mock('@/services/onesignal/identity', () => ({
    getNotificationLogoutVersion: () => mockLogoutVersion,
    syncNotificationIdentity: (...args: unknown[]) => mockSyncIdentity(...args),
    reconcileNotificationIdentity: (id: unknown) => mockSyncIdentity(id),
    onNotificationIdentityLoginAvailable: () => () => {},
    resumeNotificationIdentity: (...args: unknown[]) => mockResumeIdentity(...args),
    logoutNotificationIdentity: (...args: unknown[]) => mockLogoutIdentity(...args),
}))

import { AuthProvider, useAuth } from '../authContext'
import { clearRedirectUrl, endIntentionalLogout } from '@/utils/general.utils'
import { clearSessionHeld } from '@/utils/session-presence'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>
const originalLocation = window.location
const mockNavigate = jest.fn()

function deferred() {
    let resolve!: () => void
    const promise = new Promise<void>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

describe('AuthProvider push identity public integration contract', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockUserData = { user: { userId: 'u1', username: 'probe' }, accounts: [] }
        mockLogoutVersion = null
        mockLoading = false
        mockLocked = false
        mockDemo = false
        mockQueryError = null
        mockSyncIdentity.mockResolvedValue(undefined)
        mockResumeIdentity.mockResolvedValue(undefined)
        mockLogoutIdentity.mockResolvedValue(undefined)
        mockClearSignupAttribution.mockResolvedValue(undefined)
        mockApiFetch.mockResolvedValue(undefined)
        mockRefetch.mockResolvedValue({ data: null, error: null })
        endIntentionalLogout()
        clearRedirectUrl()
        clearSessionHeld()
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...originalLocation,
                get href() {
                    return originalLocation.href
                },
                set href(_value: string) {
                    mockNavigate()
                },
            },
        })
    })
    afterEach(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
        endIntentionalLogout()
        clearRedirectUrl()
        clearSessionHeld()
    })

    it('syncs the resolved account without mounting the notification hook', async () => {
        renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(mockSyncIdentity).toHaveBeenCalledWith('u1'))
    })

    it('syncs confirmed signed-out startup to remove persisted identity', async () => {
        mockUserData = null
        renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(mockSyncIdentity).toHaveBeenCalledWith(null))
    })

    it('a paused cold-start query with undefined data is not confirmed signed-out', async () => {
        mockUserData = undefined
        mockLoading = false
        mockQueryError = null
        renderHook(() => useAuth(), { wrapper })
        await act(async () => {
            for (let i = 0; i < 20; i += 1) await Promise.resolve()
        })
        expect(mockSyncIdentity).not.toHaveBeenCalled()
        expect(mockResumeIdentity).not.toHaveBeenCalled()
        expect(mockLogoutIdentity).not.toHaveBeenCalled()
    })

    it.each(['hydration', 'app lock', 'API error', 'demo'])(
        'does not change push identity during %s',
        async (condition) => {
            if (condition === 'hydration') {
                mockUserData = undefined
                mockLoading = true
            }
            if (condition === 'app lock') mockLocked = true
            if (condition === 'API error') mockQueryError = new Error('API unavailable')
            if (condition === 'demo') mockDemo = true
            renderHook(() => useAuth(), { wrapper })
            await act(async () => {
                for (let i = 0; i < 20; i += 1) await Promise.resolve()
            })
            expect(mockSyncIdentity).not.toHaveBeenCalled()
            expect(mockResumeIdentity).not.toHaveBeenCalled()
            expect(mockLogoutIdentity).not.toHaveBeenCalled()
        }
    )

    it('explicit logout awaits identity unlink before reload with no notification hook mounted', async () => {
        const gate = deferred()
        mockLogoutIdentity.mockReturnValueOnce(gate.promise)
        const { result } = renderHook(() => useAuth(), { wrapper })
        let logout!: Promise<void>
        act(() => {
            logout = result.current.logoutUser({ skipBackendCall: true })
        })
        await waitFor(() => expect(mockLogoutIdentity).toHaveBeenCalledTimes(1))
        expect(mockNavigate).not.toHaveBeenCalled()
        gate.resolve()
        await act(async () => {
            await logout
        })
        expect(mockNavigate).toHaveBeenCalledTimes(1)
    })

    it('unlink rejection cannot trap auth logout', async () => {
        mockLogoutIdentity.mockRejectedValueOnce(new Error('push unavailable'))
        const { result } = renderHook(() => useAuth(), { wrapper })
        await act(async () => {
            await result.current.logoutUser({ skipBackendCall: true })
        })
        expect(mockLogoutIdentity).toHaveBeenCalledTimes(1)
        expect(mockClear).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalledTimes(1)
    })

    it('duplicate logout clicks join teardown and invoke unlink once', async () => {
        const gate = deferred()
        mockLogoutIdentity.mockReturnValueOnce(gate.promise)
        const { result } = renderHook(() => useAuth(), { wrapper })
        let first!: Promise<void>
        let second!: Promise<void>
        act(() => {
            first = result.current.logoutUser({ skipBackendCall: true })
            second = result.current.logoutUser({ skipBackendCall: true })
        })
        await waitFor(() => expect(mockLogoutIdentity).toHaveBeenCalledTimes(1))
        gate.resolve()
        await act(async () => {
            await Promise.all([first, second])
        })
        expect(mockLogoutIdentity).toHaveBeenCalledTimes(1)
        expect(mockNavigate).toHaveBeenCalledTimes(1)
    })
    it('login hydration started before logout cannot release the later logout boundary', async () => {
        let finishHydration!: (profile: unknown) => void
        mockRecoverLoginSession.mockReturnValueOnce(
            new Promise((resolve) => {
                finishHydration = resolve
            })
        )
        const { result } = renderHook(() => useAuth(), { wrapper })
        let hydration!: Promise<unknown>
        act(() => {
            hydration = result.current.hydrateLoginSession()
        })
        await waitFor(() => expect(mockRecoverLoginSession).toHaveBeenCalledTimes(1))
        await act(async () => {
            await result.current.logoutUser({ skipBackendCall: true })
        })
        expect(mockLogoutIdentity).toHaveBeenCalledTimes(1)
        finishHydration({ user: { userId: 'late-login', username: 'late' }, accounts: [] })
        await act(async () => {
            await hydration.catch(() => undefined)
        })
        expect(mockResumeIdentity).not.toHaveBeenCalled()
    })

    it('account setup started before logout cannot release the later logout boundary', async () => {
        let finishSetup!: (result: unknown) => void
        mockCompleteAccountSetup.mockReturnValueOnce(
            new Promise((resolve) => {
                finishSetup = resolve
            })
        )
        const { result } = renderHook(() => useAuth(), { wrapper })
        let setup!: Promise<unknown>
        act(() => {
            setup = result.current.addAccount({
                accountIdentifier: '0x0000000000000000000000000000000000000001',
                accountType: 'PEANUT' as Parameters<typeof result.current.addAccount>[0]['accountType'],
                userId: 'account-A',
            })
        })
        await waitFor(() => expect(mockCompleteAccountSetup).toHaveBeenCalledTimes(1))
        await act(async () => {
            await result.current.logoutUser({ skipBackendCall: true })
        })
        expect(mockLogoutIdentity).toHaveBeenCalledTimes(1)
        finishSetup({ status: 'created', requestAttempts: 1 })
        await act(async () => {
            await setup.catch(() => undefined)
        })
        expect(mockResumeIdentity).not.toHaveBeenCalled()
    })

    it('hydration begun before another tab logout cannot resume its stale account', async () => {
        let finishHydration!: (profile: unknown) => void
        mockRecoverLoginSession.mockReturnValueOnce(
            new Promise((resolve) => {
                finishHydration = resolve
            })
        )
        const { result } = renderHook(() => useAuth(), { wrapper })
        let hydration!: Promise<unknown>
        act(() => {
            hydration = result.current.hydrateLoginSession()
        })
        await waitFor(() => expect(mockRecoverLoginSession).toHaveBeenCalledTimes(1))
        mockLogoutVersion = 'logout-in-other-tab-receipt'
        finishHydration({ user: { userId: 'stale-cross-tab-login', username: 'late' }, accounts: [] })
        await act(async () => {
            await hydration.catch(() => undefined)
        })
        expect(mockResumeIdentity).not.toHaveBeenCalled()
    })

    it('account setup begun before another tab logout cannot resume its stale account', async () => {
        let finishSetup!: (result: unknown) => void
        mockCompleteAccountSetup.mockReturnValueOnce(
            new Promise((resolve) => {
                finishSetup = resolve
            })
        )
        const { result } = renderHook(() => useAuth(), { wrapper })
        let setup!: Promise<unknown>
        act(() => {
            setup = result.current.addAccount({
                accountIdentifier: '0x0000000000000000000000000000000000000001',
                accountType: 'PEANUT' as Parameters<typeof result.current.addAccount>[0]['accountType'],
                userId: 'account-A',
            })
        })
        await waitFor(() => expect(mockCompleteAccountSetup).toHaveBeenCalledTimes(1))
        mockLogoutVersion = 'logout-in-other-tab-receipt'
        finishSetup({ status: 'created', requestAttempts: 1 })
        await act(async () => {
            await setup.catch(() => undefined)
        })
        expect(mockResumeIdentity).not.toHaveBeenCalled()
    })
})
