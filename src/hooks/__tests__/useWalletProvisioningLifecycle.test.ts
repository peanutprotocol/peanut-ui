import { renderHook, waitFor } from '@testing-library/react'
import { useWalletProvisioningLifecycle } from '../useWalletProvisioningLifecycle'
import { rainApi } from '@/services/rain'
import { isIOSNative } from '@/utils/capacitor'
import { clearWalletProvisioningOwner, getWalletProvisioningOwner } from '@/utils/wallet-provisioning-owner'
import {
    clearLegacyWalletSessionForWallet,
    clearWalletAuthorizationToken,
    clearWalletCardForWallet,
    rememberCardForWallet,
    syncWalletAuthorizationToken,
} from '@/utils/push-provisioning'

const mockedFlag = jest.fn()
const mockedFlagsLoaded = jest.fn()
const mockedOverview = jest.fn()
const mockedCachedStepUpToken = jest.fn()

jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlags: () => mockedFlag }))
jest.mock('@/utils/featureFlag.utils', () => ({ areFeatureFlagsLoaded: () => mockedFlagsLoaded() }))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => mockedOverview() }))
jest.mock('@/services/rain', () => ({ rainApi: { getProvisioningAuthorization: jest.fn() } }))
jest.mock('@/services/step-up-cache', () => ({ getCachedStepUpToken: () => mockedCachedStepUpToken() }))
jest.mock('@/utils/capacitor', () => ({ isIOSNative: jest.fn() }))
jest.mock('@/utils/push-provisioning', () => ({
    clearLegacyWalletSessionForWallet: jest.fn(),
    clearWalletAuthorizationToken: jest.fn(),
    clearWalletCardForWallet: jest.fn(),
    rememberCardForWallet: jest.fn(),
    syncWalletAuthorizationToken: jest.fn(),
    PUSH_PROVISIONING_FLAGS: { apple: 'push-provisioning-apple', google: 'push-provisioning-google' },
}))

const mockedIsIOS = isIOSNative as jest.MockedFunction<typeof isIOSNative>
const mockedClearLegacy = clearLegacyWalletSessionForWallet as jest.MockedFunction<
    typeof clearLegacyWalletSessionForWallet
>
const mockedClearAuthorization = clearWalletAuthorizationToken as jest.MockedFunction<
    typeof clearWalletAuthorizationToken
>
const mockedClearCard = clearWalletCardForWallet as jest.MockedFunction<typeof clearWalletCardForWallet>
const mockedRememberCard = rememberCardForWallet as jest.MockedFunction<typeof rememberCardForWallet>
const mockedSyncAuthorization = syncWalletAuthorizationToken as jest.MockedFunction<typeof syncWalletAuthorizationToken>
const mockedGetAuthorization = rainApi.getProvisioningAuthorization as jest.MockedFunction<
    typeof rainApi.getProvisioningAuthorization
>

const overviewWithCard = (id: string) => ({
    overview: {
        status: { hasApplication: true },
        balance: null,
        cards: [{ id, last4: id === 'card-a' ? '1111' : '2222', status: 'ACTIVE' }],
    },
})

describe('useWalletProvisioningLifecycle', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        clearWalletProvisioningOwner()
        mockedIsIOS.mockReturnValue(true)
        mockedFlag.mockReturnValue(false)
        mockedFlagsLoaded.mockReturnValue(true)
        mockedOverview.mockReturnValue({ overview: undefined })
        mockedCachedStepUpToken.mockReturnValue('cached-step-up')
    })

    it('clears legacy sessions and disabled rollout state globally', async () => {
        renderHook(() => useWalletProvisioningLifecycle())
        await waitFor(() => expect(mockedClearAuthorization).toHaveBeenCalled())
        expect(mockedClearLegacy).toHaveBeenCalledTimes(1)
        expect(mockedClearCard).toHaveBeenCalledTimes(1)
    })

    it('clears Apple Wallet grants when only the Google or retired shared flag is enabled', async () => {
        mockedFlag.mockImplementation((key: string) => key !== 'push-provisioning-apple')
        mockedOverview.mockReturnValue(overviewWithCard('card-a'))
        renderHook(() => useWalletProvisioningLifecycle())
        await waitFor(() => expect(mockedClearAuthorization).toHaveBeenCalled())
        expect(mockedClearCard).toHaveBeenCalledTimes(1)
        expect(mockedRememberCard).not.toHaveBeenCalled()
        expect(mockedGetAuthorization).not.toHaveBeenCalled()
        expect(mockedFlag).toHaveBeenCalledWith('push-provisioning-apple')
        expect(mockedFlag).not.toHaveBeenCalledWith('push-provisioning-google')
    })

    it('does not touch native Wallet state on web', async () => {
        mockedIsIOS.mockReturnValue(false)
        renderHook(() => useWalletProvisioningLifecycle())
        await Promise.resolve()
        expect(mockedClearLegacy).not.toHaveBeenCalled()
        expect(mockedClearAuthorization).not.toHaveBeenCalled()
        expect(mockedClearCard).not.toHaveBeenCalled()
    })

    it('keeps card state when the rollout is enabled', async () => {
        mockedFlag.mockReturnValue(true)
        renderHook(() => useWalletProvisioningLifecycle())
        await waitFor(() => expect(mockedClearLegacy).toHaveBeenCalled())
        expect(mockedClearAuthorization).not.toHaveBeenCalled()
        expect(mockedClearCard).not.toHaveBeenCalled()
    })

    it('clears Wallet state when the loaded overview has no active card', async () => {
        mockedFlag.mockReturnValue(true)
        mockedOverview.mockReturnValue({
            overview: {
                status: { hasApplication: true },
                balance: null,
                cards: [{ id: 'card-canceled', last4: '9999', status: 'CANCELED' }],
            },
        })

        renderHook(() => useWalletProvisioningLifecycle())

        await waitFor(() => expect(mockedClearAuthorization).toHaveBeenCalled())
        expect(mockedClearCard).toHaveBeenCalledTimes(1)
    })

    it('does not clear a valid grant while the startup flag state is unknown', async () => {
        mockedFlagsLoaded.mockReturnValue(false)
        mockedFlag.mockReturnValue(false)
        const { rerender } = renderHook(() => useWalletProvisioningLifecycle())
        await waitFor(() => expect(mockedClearLegacy).toHaveBeenCalled())
        expect(mockedClearAuthorization).not.toHaveBeenCalled()
        expect(mockedClearCard).not.toHaveBeenCalled()

        // Once the same launch receives an explicit enabled answer, the
        // previous unknown false must not have destroyed the Wallet state.
        mockedFlagsLoaded.mockReturnValue(true)
        mockedFlag.mockReturnValue(true)
        rerender()
        await Promise.resolve()
        expect(mockedClearAuthorization).not.toHaveBeenCalled()
        expect(mockedClearCard).not.toHaveBeenCalled()
    })

    it('clears Wallet state when the first loaded flag value is disabled', async () => {
        mockedFlagsLoaded.mockReturnValue(false)
        mockedFlag.mockReturnValue(false)
        const { rerender } = renderHook(() => useWalletProvisioningLifecycle())
        await waitFor(() => expect(mockedClearLegacy).toHaveBeenCalled())
        expect(mockedClearAuthorization).not.toHaveBeenCalled()
        expect(mockedClearCard).not.toHaveBeenCalled()

        mockedFlagsLoaded.mockReturnValue(true)
        rerender()
        await waitFor(() => expect(mockedClearAuthorization).toHaveBeenCalled())
        expect(mockedClearCard).toHaveBeenCalledTimes(1)
    })

    it('bootstraps from an app-wide card overview without prompting', async () => {
        mockedFlag.mockReturnValue(true)
        mockedOverview.mockReturnValue(overviewWithCard('card-a'))
        mockedGetAuthorization.mockResolvedValue({
            walletAuthorizationToken: 'grant-a',
            walletAuthorizationExpiresIn: 2_592_000,
        })

        renderHook(() => useWalletProvisioningLifecycle())

        await waitFor(() => expect(mockedRememberCard).toHaveBeenCalledWith({ peanutCardId: 'card-a', last4: '1111' }))
        await waitFor(() => expect(mockedSyncAuthorization).toHaveBeenCalledWith('card-a', 'grant-a', 2_592_000))
        expect(mockedGetAuthorization).toHaveBeenCalledWith('card-a', 'apple', { stepUpToken: expect.any(String) })
    })

    it('publishes the current selection and flag even after the card screen is gone', () => {
        mockedFlag.mockReturnValue(true)
        mockedOverview.mockReturnValue(overviewWithCard('card-a'))
        const { rerender, unmount } = renderHook(() => useWalletProvisioningLifecycle())
        expect(getWalletProvisioningOwner()).toEqual({ cardId: 'card-a', last4: '1111', flagOn: true })

        mockedOverview.mockReturnValue(overviewWithCard('card-b'))
        rerender()
        expect(getWalletProvisioningOwner()).toEqual({ cardId: 'card-b', last4: '2222', flagOn: true })

        mockedFlag.mockReturnValue(false)
        rerender()
        expect(getWalletProvisioningOwner()).toEqual({ cardId: 'card-b', last4: '2222', flagOn: false })

        unmount()
        expect(getWalletProvisioningOwner()).toBeNull()
    })

    it('only mirrors metadata globally when no step-up proof is cached', async () => {
        mockedFlag.mockReturnValue(true)
        mockedCachedStepUpToken.mockReturnValue(null)
        mockedOverview.mockReturnValue(overviewWithCard('card-a'))

        renderHook(() => useWalletProvisioningLifecycle())

        await waitFor(() => expect(mockedRememberCard).toHaveBeenCalledWith({ peanutCardId: 'card-a', last4: '1111' }))
        expect(mockedGetAuthorization).not.toHaveBeenCalled()
        expect(mockedSyncAuthorization).not.toHaveBeenCalled()
    })

    it('does not let a stale card authorization overwrite the replacement card grant', async () => {
        mockedFlag.mockReturnValue(true)
        mockedOverview.mockReturnValue(overviewWithCard('card-a'))
        let resolveA!: (value: { walletAuthorizationToken: string; walletAuthorizationExpiresIn: number }) => void
        let resolveB!: (value: { walletAuthorizationToken: string; walletAuthorizationExpiresIn: number }) => void
        mockedGetAuthorization
            .mockReturnValueOnce(new Promise((resolve) => (resolveA = resolve)))
            .mockReturnValueOnce(new Promise((resolve) => (resolveB = resolve)))

        const { rerender } = renderHook(() => useWalletProvisioningLifecycle())
        await waitFor(() => expect(mockedGetAuthorization).toHaveBeenCalledWith('card-a', 'apple', expect.anything()))

        mockedOverview.mockReturnValue(overviewWithCard('card-b'))
        rerender()
        await waitFor(() => expect(mockedGetAuthorization).toHaveBeenCalledWith('card-b', 'apple', expect.anything()))

        resolveB({ walletAuthorizationToken: 'grant-b', walletAuthorizationExpiresIn: 2_592_000 })
        await waitFor(() => expect(mockedSyncAuthorization).toHaveBeenCalledWith('card-b', 'grant-b', 2_592_000))
        resolveA({ walletAuthorizationToken: 'grant-a', walletAuthorizationExpiresIn: 2_592_000 })
        await Promise.resolve()

        expect(mockedSyncAuthorization).toHaveBeenCalledTimes(1)
        expect(mockedSyncAuthorization).toHaveBeenLastCalledWith('card-b', 'grant-b', 2_592_000)
    })

    it('clears the previous card grant before advertising a replacement without cached proof', async () => {
        mockedFlag.mockReturnValue(true)
        mockedCachedStepUpToken.mockReturnValue(null)
        mockedOverview.mockReturnValue(overviewWithCard('card-a'))
        const { rerender } = renderHook(() => useWalletProvisioningLifecycle())
        await waitFor(() => expect(mockedRememberCard).toHaveBeenCalledWith({ peanutCardId: 'card-a', last4: '1111' }))

        mockedOverview.mockReturnValue(overviewWithCard('card-b'))
        rerender()
        await waitFor(() => expect(mockedRememberCard).toHaveBeenCalledWith({ peanutCardId: 'card-b', last4: '2222' }))

        expect(mockedClearAuthorization).toHaveBeenCalledTimes(1)
        expect(mockedClearAuthorization.mock.invocationCallOrder[0]).toBeLessThan(
            mockedRememberCard.mock.invocationCallOrder[1]
        )
        expect(mockedGetAuthorization).not.toHaveBeenCalled()
    })
})
