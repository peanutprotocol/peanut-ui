/** Frozen public integration regression: queued lifecycle callback before profile rerender. */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const mockCompleteAccountSetup = jest.fn()
const mockRecoverLoginSession = jest.fn()
let mockUserData: unknown
let mockLocked = false
let mockDemo = false
const mockApiFetch = jest.fn().mockResolvedValue(undefined)
const mockToastError = jest.fn()
const mockClearSignupAttribution = jest.fn().mockResolvedValue(undefined)

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
const mockServer = jest.fn()
jest.mock('@/hooks/query/user', () => ({
    useUserQuery: (enabled: boolean) => {
        const { useQuery } = jest.requireActual('@tanstack/react-query')
        return useQuery({
            queryKey: ['user'],
            queryFn: () => mockServer(),
            initialData: mockUserData,
            staleTime: Infinity,
            retry: false,
            enabled,
        })
    },
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
    default: {
        identify: jest.fn(),
        get_distinct_id: jest.fn(),
        setPersonProperties: jest.fn(),
        reset: jest.fn(),
        register: jest.fn(),
        capture: jest.fn(),
    },
}))

jest.mock('@/services/account-setup', () => ({
    completeAccountSetup: (...args: unknown[]) => mockCompleteAccountSetup(...args),
}))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => mockDemo, disableDemoMode: jest.fn() }))
let mockSdk: string | null = 'A'
const mockAdapter = {
    init: jest.fn(async () => {}),
    login: jest.fn(async (id: string) => {
        mockSdk = id
    }),
    logout: jest.fn(async () => {
        mockSdk = null
    }),
    getPermission: async () => 'granted',
    isOptedIn: async () => true,
    onPermissionChange: jest.fn(),
    onSubscriptionChange: jest.fn(),
    onNotificationClick: jest.fn(),
    onNotificationReceived: jest.fn(),
}
jest.mock('@/services/onesignal', () => ({ getOneSignalAdapter: async () => mockAdapter }))

import { AuthProvider, useAuth } from '@/context/authContext'
import { clearRedirectUrl, endIntentionalLogout } from '@/utils/general.utils'
import { clearSessionHeld } from '@/utils/session-presence'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as facade from '@/services/onesignal/identity'
let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
)

jest.mock('@sentry/nextjs', () => ({
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
}))
import { useNotifications } from '@/hooks/useNotifications'
it('C5-08 queued online event before profile rerender cannot replay cached A after verified B', async () => {
    mockUserData = { user: { userId: 'A', username: 'a' }, accounts: [] }
    mockLocked = false
    mockDemo = false
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
    endIntentionalLogout()
    clearRedirectUrl()
    clearSessionHeld()
    await facade.logoutNotificationIdentity()
    localStorage.removeItem('peanut:push-logged-out')
    let done!: (value: unknown) => void
    mockServer.mockImplementationOnce(() => new Promise((resolve) => (done = resolve)))
    const { unmount } = renderHook(() => ({ auth: useAuth(), notifications: useNotifications() }), { wrapper })
    await waitFor(() => expect(mockServer).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockAdapter.onSubscriptionChange).toHaveBeenCalled())
    mockAdapter.login.mockClear()
    await act(async () => {
        const online = new Promise<void>((resolve) =>
            setTimeout(() => {
                window.dispatchEvent(new Event('online'))
                resolve()
            }, 0)
        )
        done({ user: { userId: 'B', username: 'b' }, accounts: [] })
        await online
    })
    await waitFor(() => expect(mockSdk).toBe('B'))
    expect(mockAdapter.login.mock.calls.every(([id]) => id === 'B')).toBe(true)
    unmount()
    client.clear()
})
