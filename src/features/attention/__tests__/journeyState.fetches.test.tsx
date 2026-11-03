/**
 * Off Home only the terms prompt, banners and inline notices can show, so the
 * manager fetches the data that only Home's asks read on Home alone.
 */
import { renderHook } from '@testing-library/react'
import type { FeatureReport } from '@/types/capabilities'

let mockFeatures: FeatureReport | undefined

let mockPathname = '/home'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))

const mockQueryOptions: { queryKey: unknown[]; enabled?: boolean }[] = []
jest.mock('@tanstack/react-query', () => ({
    useQuery: (options: { queryKey: unknown[]; enabled?: boolean }) => {
        mockQueryOptions.push(options)
        return { data: undefined, isLoading: false, isError: false }
    },
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-a' } }, isFetchingUser: false }),
}))
jest.mock('@/hooks/useActivationStatus', () => ({
    useActivationStatus: () => ({ onboarding: null, isActivated: true, isLoading: false }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        capabilities: { rails: [], nextActions: [], restrictions: [], features: mockFeatures },
        nextActions: [],
        rails: [],
        canDo: () => false,
        railsForProvider: () => [],
        channelOf: () => null,
        isLoading: false,
    }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({
        status: undefined,
        isVerified: false,
        needsAction: false,
        isTerminalFailure: false,
        isRegionRestricted: false,
    }),
}))
jest.mock('@/hooks/useProviderRejection', () => ({ useProviderRejection: () => ({ blockedCard: null }) }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({
        overview: { cards: [{ id: 'card-1', status: 'ACTIVE' }], status: {} },
        isLoading: false,
    }),
}))
const mockFundingAccess = jest.fn((_: { enabled?: boolean }) => ({ isLoading: false, access: undefined }))
jest.mock('@/hooks/useCardFundingAccess', () => ({
    useCardFundingAccess: (options: { enabled?: boolean }) => mockFundingAccess(options),
}))
jest.mock('@/hooks/useCardInfo', () => ({
    useCardInfo: () => ({ cardInfo: undefined, isEligible: false, isLoading: false, error: undefined }),
}))
jest.mock('@/hooks/useCardSurfaceAccess', () => ({
    useCardSurfaceAccess: () => ({ showCardSurface: false, canSpendPathViaCard: false }),
}))
jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlags: () => () => false }))
const mockGeo = jest.fn((_?: { enabled?: boolean }) => ({ countryCode: null }))
jest.mock('@/hooks/useGeoLocation', () => ({ useGeoLocation: (options?: { enabled?: boolean }) => mockGeo(options) }))
const mockArrival = jest.fn((_: boolean) => ({ arrival: null, checked: true }))
jest.mock('@/features/home/useArrivalPrompt', () => ({ useArrivalPrompt: (enabled: boolean) => mockArrival(enabled) }))
jest.mock('@/features/kill-switches/useKillSwitches', () => ({
    useKillSwitches: () => ({
        enableFullMaintenance: false,
        enableMaintenanceBanner: false,
        maintenanceBannerPaths: [],
    }),
}))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('@/hooks/useNotifications', () => ({
    useNotifications: () => ({
        oneSignalInitialized: true,
        isPermissionGranted: true,
        isPermissionDenied: false,
        isPushOptedIn: true,
        contextualPromptShownThisSession: false,
    }),
}))
const mockHistory = jest.fn((_: { enabled?: boolean }) => ({ data: undefined }))
jest.mock('@/hooks/useTransactionHistory', () => ({
    useTransactionHistory: (options: { enabled?: boolean }) => mockHistory(options),
}))
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({ useDepositAccountsEnabled: () => true }))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ balance: undefined }) }))

import { DEPOSIT_ACCOUNTS_QUERY_KEY } from '@/features/deposit-accounts/useDepositAccounts'
import { CONSENT_STATUS_QUERY_KEY, useJourneyState } from '../journeyState'

const enabledFor = (key: unknown) => mockQueryOptions.findLast((options) => options.queryKey[0] === key)?.enabled

beforeEach(() => {
    mockFeatures = undefined
    mockQueryOptions.length = 0
    jest.clearAllMocks()
})

test.each([
    ['on', true],
    ['refused', false],
    ['pending', false],
] as const)('QR availability follows the canonical %s feature report', (state, expected) => {
    mockFeatures = {
        qr: { state },
        card: { state: 'refused' },
        local: { state: 'refused', accounts: {} },
        bank: { state: 'refused', accounts: {} },
    }
    const { result } = renderHook(() => useJourneyState())
    expect(result.current.qr.canPayNow).toBe(expected)
})

test.each([
    ['/home', true],
    ['/send', false],
    ['/receipt/abc', false],
])('on %s the data only Home reads is fetched: %s', (pathname, onHome) => {
    mockPathname = pathname
    renderHook(() => useJourneyState())

    expect(mockFundingAccess).toHaveBeenLastCalledWith({ enabled: onHome })
    expect(mockHistory).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: onHome }))
    expect(mockGeo).toHaveBeenLastCalledWith({ enabled: onHome })
    expect(mockArrival).toHaveBeenLastCalledWith(onHome)
    expect(enabledFor('cashStatus')).toBe(onHome)
    expect(enabledFor(DEPOSIT_ACCOUNTS_QUERY_KEY[0])).toBe(onHome)
    // the terms prompt opens on any route, so its status is read everywhere
    expect(enabledFor(CONSENT_STATUS_QUERY_KEY)).toBe(true)
})

test('the diagnostics page loads Home facts without raising a travel arrival', () => {
    mockPathname = '/dev/attention'
    renderHook(() => useJourneyState())
    expect(mockFundingAccess).toHaveBeenLastCalledWith({ enabled: true })
    expect(mockHistory).toHaveBeenLastCalledWith(expect.objectContaining({ enabled: true }))
    expect(enabledFor(DEPOSIT_ACCOUNTS_QUERY_KEY[0])).toBe(true)
    expect(mockGeo).toHaveBeenLastCalledWith({ enabled: false })
    expect(mockArrival).toHaveBeenLastCalledWith(false)
})
