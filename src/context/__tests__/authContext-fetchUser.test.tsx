/**
 * fetchUser, through the provider.
 *
 * React Query keeps the cached profile when a refresh fails (5xx, 429,
 * network), and answers the refetch with that profile AND the error. The
 * plain call keeps returning the cached profile, as every existing caller
 * expects. `throwOnError` is for a caller that must not act on a profile the
 * refresh could not confirm: it rejects with the error instead.
 */
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

const mockRefetch = jest.fn()

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ clear: jest.fn(), cancelQueries: jest.fn().mockResolvedValue(undefined) }),
}))
jest.mock('@/hooks/query/user', () => ({
    useUserQuery: () => ({
        data: { user: { userId: 'u1', username: 'probe' }, accounts: [] },
        isLoading: false,
        refetch: mockRefetch,
        error: null,
    }),
}))
jest.mock('@/hooks/useUserAutoRefresh', () => ({ useUserAutoRefresh: jest.fn() }))
jest.mock('@/hooks/useAppLocked', () => ({ useAppLocked: () => false }))
jest.mock('@/hooks/useZeroDevFlow', () => ({ zeroDevFlowActions: { reset: jest.fn() } }))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/utils/auth-token', () => ({ clearAuthToken: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/utils/login-session', () => ({ recoverLoginSession: jest.fn() }))
jest.mock('@/utils/cache.utils', () => ({ purgeCaches: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@/utils/crisp', () => ({ resetCrispProxySessions: jest.fn() }))
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
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { identify: jest.fn(), reset: jest.fn(), register: jest.fn() },
}))

import { AuthProvider, useAuth } from '../authContext'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

const cachedReady = { user: { userId: 'u1', username: 'probe' }, accounts: [], capabilities: { rails: [] } }
const networkError = new Error('Failed to fetch')

describe('fetchUser', () => {
    beforeEach(() => {
        mockRefetch.mockReset()
    })

    it('a failed refresh: the plain call still returns the cached profile', async () => {
        mockRefetch.mockResolvedValue({ data: cachedReady, error: networkError })
        const { result } = renderHook(() => useAuth(), { wrapper })

        await expect(result.current.fetchUser()).resolves.toBe(cachedReady)
    })

    it('a failed refresh: the strict call rejects with the error, never the cached profile', async () => {
        mockRefetch.mockResolvedValue({ data: cachedReady, error: networkError })
        const { result } = renderHook(() => useAuth(), { wrapper })

        await expect(result.current.fetchUser({ throwOnError: true })).rejects.toBe(networkError)
    })

    it('a good refresh: both calls return the fresh profile', async () => {
        mockRefetch.mockResolvedValue({ data: cachedReady, error: null })
        const { result } = renderHook(() => useAuth(), { wrapper })

        await expect(result.current.fetchUser()).resolves.toBe(cachedReady)
        await expect(result.current.fetchUser({ throwOnError: true })).resolves.toBe(cachedReady)
    })

    it('a 401/404 resolves null on both calls: no profile, no error', async () => {
        mockRefetch.mockResolvedValue({ data: null, error: null })
        const { result } = renderHook(() => useAuth(), { wrapper })

        await expect(result.current.fetchUser()).resolves.toBeNull()
        await expect(result.current.fetchUser({ throwOnError: true })).resolves.toBeNull()
    })
})
