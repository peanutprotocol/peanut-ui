jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const mockCompleteAccountSetup = jest.fn()
const mockRecoverLoginSession = jest.fn()
const mockReconcile = jest.fn().mockResolvedValue(undefined)
const mockSubscribe = jest.fn()
const mockUnsubscribe = jest.fn()
let mockAvailable: (() => void) | undefined
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
    reconcileNotificationIdentity: (...args: unknown[]) => mockReconcile(...args),
    onNotificationIdentityLoginAvailable: (callback: () => void) => mockSubscribe(callback),
    getNotificationLogoutVersion: () => mockLogoutVersion,
    syncNotificationIdentity: (...args: unknown[]) => mockSyncIdentity(...args),
    resumeNotificationIdentity: (...args: unknown[]) => mockResumeIdentity(...args),
    logoutNotificationIdentity: (...args: unknown[]) => mockLogoutIdentity(...args),
}))

import { AuthProvider, useAuth } from '../authContext'
import { clearRedirectUrl, endIntentionalLogout } from '@/utils/general.utils'
import { clearSessionHeld } from '@/utils/session-presence'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

async function settle() {
    await act(async () => {
        for (let i = 0; i < 50; i += 1) await Promise.resolve()
    })
}
function latestVerify(): () => Promise<string | null> {
    return mockReconcile.mock.calls[mockReconcile.mock.calls.length - 1][1]
}
describe('cross-tab AuthProvider reconciliation', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockUserData = { user: { userId: 'cached-A', username: 'probe' }, accounts: [] }
        mockLogoutVersion = null
        mockLoading = false
        mockLocked = false
        mockDemo = false
        mockQueryError = null
        mockAvailable = undefined
        mockReconcile.mockResolvedValue(undefined)
        mockSubscribe.mockImplementation((callback) => {
            mockAvailable = callback
            return mockUnsubscribe
        })
        mockRefetch.mockResolvedValue({ data: { user: { userId: 'fresh-B' }, accounts: [] }, error: null })
        endIntentionalLogout()
        clearRedirectUrl()
        clearSessionHeld()
    })
    afterEach(() => {
        endIntentionalLogout()
        clearRedirectUrl()
        clearSessionHeld()
        jest.restoreAllMocks()
    })
    it('C5-01 supplies cached identity plus a callable fresh server profile check', async () => {
        renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(mockReconcile).toHaveBeenCalledWith('cached-A', expect.any(Function)))
        expect(mockRefetch).not.toHaveBeenCalled()
        let value: string | null | undefined
        await act(async () => {
            value = await latestVerify()()
        })
        expect(value).toBe('fresh-B')
        expect(mockRefetch).toHaveBeenCalledWith(expect.objectContaining({ cancelRefetch: false }))
    })
    it('C5-02 fresh null stays null and returned profile errors reject', async () => {
        renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(mockReconcile).toHaveBeenCalled())
        const verify = latestVerify()
        mockRefetch.mockResolvedValueOnce({ data: null, error: null })
        await act(async () => {
            await expect(verify()).resolves.toBeNull()
        })
        const error = new Error('profile failed')
        mockRefetch.mockResolvedValueOnce({ data: mockUserData, error })
        await act(async () => {
            await expect(verify()).rejects.toBeDefined()
        })
    })
    it('C5-03 shared-login notification, visible recovery, and online recovery reconcile and unsubscribe', async () => {
        const { unmount } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(mockSubscribe).toHaveBeenCalled())
        mockReconcile.mockClear()
        await act(async () => {
            mockAvailable?.()
        })
        expect(mockReconcile).toHaveBeenCalledWith('cached-A', expect.any(Function))
        mockReconcile.mockClear()
        jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'))
        })
        expect(mockReconcile).toHaveBeenCalledWith('cached-A', expect.any(Function))
        mockReconcile.mockClear()
        await act(async () => {
            window.dispatchEvent(new Event('online'))
        })
        expect(mockReconcile).toHaveBeenCalledWith('cached-A', expect.any(Function))
        unmount()
        expect(mockUnsubscribe).toHaveBeenCalled()
    })
    it.each(['locked', 'demo', 'loading', 'unresolved', 'profile-error'])(
        'C5-04 %s must not subscribe or verify',
        async (state) => {
            if (state === 'locked') mockLocked = true
            if (state === 'demo') mockDemo = true
            if (state === 'loading') mockLoading = true
            if (state === 'unresolved') mockUserData = undefined
            if (state === 'profile-error') mockQueryError = new Error('profile failed')
            renderHook(() => useAuth(), { wrapper })
            await settle()
            expect(mockSubscribe).not.toHaveBeenCalled()
            expect(mockReconcile).not.toHaveBeenCalled()
            expect(mockRefetch).not.toHaveBeenCalled()
        }
    )
    it('C5-05 locking during fresh verification invalidates the pending profile result', async () => {
        const { rerender } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(mockReconcile).toHaveBeenCalled())
        let finish!: (value: unknown) => void
        mockRefetch.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        const outcome = latestVerify()().then(
            (value) => value,
            () => null
        )
        await settle()
        mockLocked = true
        rerender()
        await settle()
        finish({ data: { user: { userId: 'stale-B' }, accounts: [] }, error: null })
        await act(async () => {
            expect(await outcome).toBeNull()
        })
        expect(mockUnsubscribe).toHaveBeenCalled()
    })
    it('C5-06 same-account cache object replacement preserves pending fresh verification without restarting it', async () => {
        const { rerender } = renderHook(() => useAuth(), { wrapper })
        await waitFor(() => expect(mockReconcile).toHaveBeenCalled())
        let finish!: (value: unknown) => void
        mockRefetch.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        const outcome = latestVerify()()
        await settle()
        const reconciliationsBeforeCacheUpdate = mockReconcile.mock.calls.length
        mockUserData = { user: { userId: 'cached-A', username: 'updated-profile' }, accounts: [] }
        rerender()
        await settle()
        expect(mockReconcile).toHaveBeenCalledTimes(reconciliationsBeforeCacheUpdate)
        expect(mockRefetch).toHaveBeenCalledTimes(1)
        finish({ data: { user: { userId: 'fresh-B' }, accounts: [] }, error: null })
        await act(async () => {
            await expect(outcome).resolves.toBe('fresh-B')
        })
        expect(mockRefetch).toHaveBeenCalledTimes(1)
    })
})
