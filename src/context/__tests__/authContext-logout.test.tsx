/**
 * logoutUser, through the provider.
 *
 * The redirect latch has to be armed BEFORE anything empties the user cache:
 * that is what re-runs the (mobile-ui) auth gate, which stores the current
 * path as the post-auth destination — and the logout button lives on
 * /profile, so a fresh account created afterwards inherited that page. Unit
 * tests that call `beginIntentionalLogout` themselves cannot see that
 * ordering, so these drive the real logout and let the emptied cache stand in
 * for the gate.
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const mockClear = jest.fn()
const mockCancelQueries = jest.fn().mockResolvedValue(undefined)
const mockRefetch = jest.fn().mockResolvedValue({ data: null })
const mockApiFetch = jest.fn().mockResolvedValue(undefined)
const mockToastError = jest.fn()

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ clear: mockClear, cancelQueries: mockCancelQueries }),
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
jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }))
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
import { clearRedirectUrl, endIntentionalLogout, getRedirectUrl, saveRedirectUrl } from '@/utils/general.utils'
import { clearSessionHeld, hasHeldSession, markSessionHeld } from '@/utils/session-presence'

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

const originalLocation = window.location

/** Replaces window.location so assigning href is observable, or explodes. */
const stubLocation = (onNavigate?: () => void) => {
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            ...originalLocation,
            get href() {
                return originalLocation.href
            },
            set href(_value: string) {
                onNavigate?.()
            },
        },
    })
}

describe('logoutUser', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockCancelQueries.mockResolvedValue(undefined)
        mockRefetch.mockResolvedValue({ data: null })
        endIntentionalLogout()
        clearRedirectUrl()
        clearSessionHeld()
        window.history.replaceState({}, '', '/profile')
    })

    afterEach(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
        endIntentionalLogout()
        clearRedirectUrl()
        clearSessionHeld()
    })

    it('arms the latch before the user cache is emptied', async () => {
        /*
         * Read back inside the hook, not after the call: logout clears the
         * stored redirect later in its own teardown, which would mask a save
         * that did land here. What this pins is the state AT the moment the
         * gate reacts — arming the latch any later leaves the path stored.
         */
        let storedWhenCacheEmptied: unknown = 'not-observed'
        mockClear.mockImplementation(() => {
            saveRedirectUrl('session-end')
            storedWhenCacheEmptied = getRedirectUrl()
        })
        stubLocation()
        const { result } = renderHook(() => useAuth(), { wrapper })

        await act(async () => {
            await result.current.logoutUser()
        })

        expect(mockClear).toHaveBeenCalled()
        expect(storedWhenCacheEmptied).toBeNull()
        expect(getRedirectUrl()).toBeNull()
    })

    it('leaves this tab logged out, so a later deep link is intent again', async () => {
        markSessionHeld()
        stubLocation()
        const { result } = renderHook(() => useAuth(), { wrapper })

        await act(async () => {
            await result.current.logoutUser()
        })

        expect(hasHeldSession()).toBe(false)
    })

    it('releases the latch when the hard navigation never happens', async () => {
        stubLocation(() => {
            throw new Error('navigation blocked')
        })
        const { result } = renderHook(() => useAuth(), { wrapper })

        await act(async () => {
            await result.current.logoutUser({ skipBackendCall: true })
        })
        await waitFor(() => expect(mockToastError).toHaveBeenCalled())

        // this document keeps serving the app: a deep-link bounce must store again
        saveRedirectUrl()
        expect(getRedirectUrl()).toBe('/profile')
    })

    it('revokes the session server-side before clearing local state', async () => {
        const order: string[] = []
        mockApiFetch.mockImplementation(async (path: string) => {
            order.push(`api:${path}`)
        })
        mockClear.mockImplementation(() => order.push('cache-cleared'))
        stubLocation()
        const { result } = renderHook(() => useAuth(), { wrapper })

        await act(async () => {
            await result.current.logoutUser()
        })

        expect(order).toEqual(['api:/users/logout', 'cache-cleared'])
    })
})
