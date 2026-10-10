import { renderHook, act, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { usePushProvisioning } from '@/hooks/usePushProvisioning'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { rainApi, RainCardRateLimitError, type RainProvisioningDataResponse } from '@/services/rain'
import { isAndroidNative, isIOSNative } from '@/utils/capacitor'
import { getClearEpoch } from '@/utils/auth-token'
import { clearWalletProvisioningOwner, setWalletProvisioningOwner } from '@/utils/wallet-provisioning-owner'
import {
    addCardToWallet,
    clearWalletStateIfCardMatches,
    getPushProvisioningAvailability,
    rememberCardForWallet,
    syncWalletAuthorizationToken,
} from '@/utils/push-provisioning'

jest.mock('@/services/rain', () => {
    const actual = jest.requireActual('@/services/rain')
    return {
        ...actual,
        rainApi: { ...actual.rainApi, getProvisioningData: jest.fn() },
    }
})
jest.mock('@/utils/push-provisioning', () => {
    const actual = jest.requireActual('@/utils/push-provisioning')
    return {
        ...actual,
        getPushProvisioningAvailability: jest.fn(),
        rememberCardForWallet: jest.fn(),
        addCardToWallet: jest.fn(),
        clearWalletStateIfCardMatches: jest.fn(),
        syncWalletAuthorizationToken: jest.fn(),
    }
})
jest.mock('@/utils/capacitor', () => {
    const actual = jest.requireActual('@/utils/capacitor')
    return { ...actual, isIOSNative: jest.fn(), isAndroidNative: jest.fn() }
})
jest.mock('@/utils/auth-token', () => {
    const actual = jest.requireActual('@/utils/auth-token')
    return { ...actual, getClearEpoch: jest.fn() }
})
const mockedFlag = jest.fn()
jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlags: () => mockedFlag }))

const mockedGetProvisioningData = rainApi.getProvisioningData as jest.MockedFunction<typeof rainApi.getProvisioningData>
const mockedAvailability = getPushProvisioningAvailability as jest.MockedFunction<
    typeof getPushProvisioningAvailability
>
const mockedAddCard = addCardToWallet as jest.MockedFunction<typeof addCardToWallet>
const mockedSyncWalletAuthorizationToken = syncWalletAuthorizationToken as jest.MockedFunction<
    typeof syncWalletAuthorizationToken
>
const mockedRememberCard = rememberCardForWallet as jest.MockedFunction<typeof rememberCardForWallet>
const mockedClearStaleCard = clearWalletStateIfCardMatches as jest.MockedFunction<typeof clearWalletStateIfCardMatches>
const mockedIsIOS = isIOSNative as jest.MockedFunction<typeof isIOSNative>
const mockedIsAndroid = isAndroidNative as jest.MockedFunction<typeof isAndroidNative>
const mockedClearEpoch = getClearEpoch as jest.MockedFunction<typeof getClearEpoch>

const card = { id: 'card-1', last4: '0420' }

const provisioningData: RainProvisioningDataResponse = {
    cardId: 'mea-card-1',
    cardSecret: 'secret',
    last4: '0420',
    network: 'visa',
    cardholderName: 'Ada Lovelace',
    walletAuthorizationToken: 'wallet-grant',
    walletAuthorizationExpiresIn: 2_592_000,
    billingAddress: {
        line1: '1 Main St',
        city: 'Lisbon',
        region: 'Lisboa',
        postalCode: '1000-001',
        countryCode: 'PT',
    },
}

describe('usePushProvisioning', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        clearWalletProvisioningOwner()
        mockedFlag.mockReturnValue(true)
        mockedIsIOS.mockReturnValue(true)
        mockedIsAndroid.mockReturnValue(false)
        mockedClearEpoch.mockReturnValue(0)
        mockedAvailability.mockResolvedValue({ available: true, alreadyInWallet: false })
        mockedGetProvisioningData.mockResolvedValue(provisioningData)
        mockedRememberCard.mockResolvedValue(undefined)
        mockedSyncWalletAuthorizationToken.mockResolvedValue(undefined)
        mockedClearStaleCard.mockResolvedValue(undefined)
        jest.spyOn(posthog, 'capture').mockImplementation(() => undefined as never)
    })

    it('offers the native row only when the plugin is available and the card is not already in the wallet', async () => {
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
        expect(mockedAvailability).toHaveBeenCalledWith('0420')
    })

    it('enables iOS independently of the Google flag', async () => {
        mockedFlag.mockImplementation((key: string) => key === 'push-provisioning-apple')
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
        expect(mockedFlag).toHaveBeenCalledWith('push-provisioning-apple')
        expect(mockedFlag).not.toHaveBeenCalledWith('push-provisioning-google')
    })

    it('does not enable Apple provisioning from the Google or retired shared flag', async () => {
        mockedFlag.mockImplementation((key: string) => key !== 'push-provisioning-apple')
        const { result } = renderHook(() => usePushProvisioning(card))
        await act(async () => {
            expect(await result.current.addToWallet()).toEqual({ added: false, error: 'unavailable' })
        })
        expect(result.current.nativeAvailable).toBe(false)
        expect(mockedAvailability).not.toHaveBeenCalled()
        expect(mockedGetProvisioningData).not.toHaveBeenCalled()
        expect(mockedAddCard).not.toHaveBeenCalled()
    })

    it('keeps the manual carousel for a card already in the wallet', async () => {
        mockedAvailability.mockResolvedValue({ available: true, alreadyInWallet: true })
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(mockedAvailability).toHaveBeenCalled())
        expect(result.current.nativeAvailable).toBe(false)
    })

    it('does not query the plugin on web or behind the flag', async () => {
        mockedIsIOS.mockReturnValue(false)
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(false))

        mockedIsIOS.mockReturnValue(true)
        mockedFlag.mockReturnValue(false)
        const flagOff = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(flagOff.result.current.nativeAvailable).toBe(false))

        expect(mockedAvailability).not.toHaveBeenCalled()
    })

    it('removes the native card mirror when the rollout flag changes from on to off', async () => {
        const { result, rerender } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        mockedFlag.mockReturnValue(false)
        rerender()

        expect(result.current.nativeAvailable).toBe(false)
    })

    it('keeps the native row when a paired Watch can still take the card after an iPhone add', async () => {
        mockedAddCard.mockResolvedValue({ added: true, last4: '0420' })
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        await act(async () => {
            await result.current.addToWallet()
        })

        expect(mockedGetProvisioningData).toHaveBeenCalledWith('card-1', 'apple')
        expect(mockedSyncWalletAuthorizationToken).toHaveBeenCalledWith('card-1', 'wallet-grant', 2_592_000)
        expect(mockedRememberCard).toHaveBeenCalledWith({ peanutCardId: 'card-1', last4: '0420' })
        expect(mockedAddCard).toHaveBeenCalledWith({
            peanutCardId: 'card-1',
            cardId: 'mea-card-1',
            cardSecret: 'secret',
            cardholderName: 'Ada Lovelace',
            last4: '0420',
            address: provisioningData.billingAddress,
        })
        expect(mockedAvailability).toHaveBeenCalledTimes(2)
        expect(result.current.nativeAvailable).toBe(true)
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_SUCCEEDED, {
            wallet: 'apple',
            error: undefined,
        })
    })

    it('flips back to the carousel when neither device can take the card after a successful add', async () => {
        mockedAddCard.mockResolvedValue({ added: true, last4: '0420' })
        mockedAvailability
            .mockResolvedValueOnce({ available: true, alreadyInWallet: false })
            .mockResolvedValueOnce({ available: false, alreadyInWallet: true })
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        await act(async () => {
            await result.current.addToWallet()
        })

        expect(result.current.nativeAvailable).toBe(false)
    })

    it('preserves a successful add if the follow-up availability check fails', async () => {
        mockedAddCard.mockResolvedValue({ added: true, last4: '0420' })
        mockedAvailability
            .mockResolvedValueOnce({ available: true, alreadyInWallet: false })
            .mockRejectedValueOnce(new Error('PassKit lookup failed'))
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        let outcome!: Awaited<ReturnType<typeof result.current.addToWallet>>
        await act(async () => {
            outcome = await result.current.addToWallet()
        })

        expect(outcome).toEqual({ added: true, last4: '0420' })
        expect(result.current.nativeAvailable).toBe(false)
    })

    it('flips the row back when the plugin reports the card is already in the wallet', async () => {
        mockedAddCard.mockResolvedValue({ added: false, alreadyInWallet: true })
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        await act(async () => {
            await result.current.addToWallet()
        })

        expect(result.current.nativeAvailable).toBe(false)
    })

    it('keeps the row after a cancellation and reports it as canceled, not failed', async () => {
        mockedAddCard.mockResolvedValue({ added: false, canceled: true })
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        await act(async () => {
            await result.current.addToWallet()
        })

        expect(result.current.nativeAvailable).toBe(true)
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_CANCELED, {
            wallet: 'apple',
            error: undefined,
        })
    })

    it('resolves rather than rejects when the provisioning-data fetch fails', async () => {
        mockedGetProvisioningData.mockRejectedValue(new RainCardRateLimitError('slow down'))
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        let outcome!: Awaited<ReturnType<typeof result.current.addToWallet>>
        await act(async () => {
            outcome = await result.current.addToWallet()
        })

        expect(outcome).toEqual({ added: false, error: 'slow down' })
        expect(mockedAddCard).not.toHaveBeenCalled()
        expect(result.current.nativeAvailable).toBe(true)
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_FAILED, {
            wallet: 'apple',
            error: 'slow down',
        })
    })

    it('does not save a stale authorization when the selected card changes during the fetch', async () => {
        let finishFetch!: (data: RainProvisioningDataResponse) => void
        mockedGetProvisioningData.mockReturnValue(new Promise((resolve) => (finishFetch = resolve)))
        const { result, rerender } = renderHook(({ selectedCard }) => usePushProvisioning(selectedCard), {
            initialProps: { selectedCard: card },
        })
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        let pending!: Promise<Awaited<ReturnType<typeof result.current.addToWallet>>>
        act(() => {
            pending = result.current.addToWallet()
        })
        rerender({ selectedCard: { id: 'card-2', last4: '2222' } })

        let outcome!: Awaited<typeof pending>
        await act(async () => {
            finishFetch(provisioningData)
            outcome = await pending
        })
        expect(outcome).toEqual({ added: false, canceled: true })
        expect(mockedRememberCard).not.toHaveBeenCalled()
        expect(mockedSyncWalletAuthorizationToken).not.toHaveBeenCalled()
        expect(mockedAddCard).not.toHaveBeenCalled()
    })

    it('clears only the old card when selection changes during the native mirror', async () => {
        let finishMirror!: () => void
        mockedRememberCard.mockReturnValueOnce(new Promise((resolve) => (finishMirror = resolve)))
        const { result, rerender } = renderHook(({ selectedCard }) => usePushProvisioning(selectedCard), {
            initialProps: { selectedCard: card },
        })
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        let pending!: Promise<Awaited<ReturnType<typeof result.current.addToWallet>>>
        act(() => {
            pending = result.current.addToWallet()
        })
        await waitFor(() => expect(mockedRememberCard).toHaveBeenCalled())
        rerender({ selectedCard: { id: 'card-2', last4: '2222' } })

        let outcome!: Awaited<typeof pending>
        await act(async () => {
            finishMirror()
            outcome = await pending
        })
        expect(outcome).toEqual({ added: false, canceled: true })
        expect(mockedClearStaleCard).toHaveBeenCalledWith('card-1')
        expect(mockedRememberCard).toHaveBeenLastCalledWith({ peanutCardId: 'card-2', last4: '2222' })
        expect(mockedSyncWalletAuthorizationToken).not.toHaveBeenCalled()
        expect(mockedAddCard).not.toHaveBeenCalled()
    })

    it('clears the old grant and skips native add when selection changes during grant storage', async () => {
        let finishGrant!: () => void
        mockedSyncWalletAuthorizationToken.mockReturnValue(new Promise((resolve) => (finishGrant = resolve)))
        const { result, rerender } = renderHook(({ selectedCard }) => usePushProvisioning(selectedCard), {
            initialProps: { selectedCard: card },
        })
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        let pending!: Promise<Awaited<ReturnType<typeof result.current.addToWallet>>>
        act(() => {
            pending = result.current.addToWallet()
        })
        await waitFor(() => expect(mockedSyncWalletAuthorizationToken).toHaveBeenCalled())
        rerender({ selectedCard: { id: 'card-2', last4: '2222' } })

        let outcome!: Awaited<typeof pending>
        await act(async () => {
            finishGrant()
            outcome = await pending
        })
        expect(outcome).toEqual({ added: false, canceled: true })
        expect(mockedClearStaleCard).toHaveBeenCalledWith('card-1')
        expect(mockedRememberCard).toHaveBeenLastCalledWith({ peanutCardId: 'card-2', last4: '2222' })
        expect(mockedAddCard).not.toHaveBeenCalled()
    })

    it('cancels a screen-unmounted add without removing the active Wallet card', async () => {
        let finishMirror!: () => void
        mockedRememberCard.mockReturnValueOnce(new Promise((resolve) => (finishMirror = resolve)))
        const { result, unmount } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        let pending!: Promise<Awaited<ReturnType<typeof result.current.addToWallet>>>
        act(() => {
            pending = result.current.addToWallet()
        })
        await waitFor(() => expect(mockedRememberCard).toHaveBeenCalled())
        unmount()

        let outcome!: Awaited<typeof pending>
        await act(async () => {
            finishMirror()
            outcome = await pending
        })
        expect(outcome).toEqual({ added: false, canceled: true })
        expect(mockedClearStaleCard).not.toHaveBeenCalled()
        expect(mockedRememberCard).toHaveBeenCalledTimes(1)
        expect(mockedAddCard).not.toHaveBeenCalled()
    })

    it('clears a late old-card write when the app-wide owner switches cards offscreen', async () => {
        let finishMirror!: () => void
        mockedRememberCard.mockReturnValueOnce(new Promise((resolve) => (finishMirror = resolve)))
        setWalletProvisioningOwner({ cardId: 'card-1', last4: '0420', flagOn: true })
        const { result, unmount } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        let pending!: Promise<Awaited<ReturnType<typeof result.current.addToWallet>>>
        act(() => {
            pending = result.current.addToWallet()
        })
        await waitFor(() => expect(mockedRememberCard).toHaveBeenCalled())
        unmount()
        setWalletProvisioningOwner({ cardId: 'card-2', last4: '2222', flagOn: true })

        await act(async () => {
            finishMirror()
            expect(await pending).toEqual({ added: false, canceled: true })
        })
        expect(mockedClearStaleCard).toHaveBeenCalledWith('card-1')
        expect(mockedRememberCard).toHaveBeenLastCalledWith({ peanutCardId: 'card-2', last4: '2222' })
        expect(mockedSyncWalletAuthorizationToken).not.toHaveBeenCalled()
    })

    it('re-reads the app-wide owner after clearing a stale card', async () => {
        let finishMirror!: () => void
        let finishClear!: () => void
        mockedRememberCard.mockReturnValueOnce(new Promise((resolve) => (finishMirror = resolve)))
        mockedClearStaleCard.mockReturnValueOnce(new Promise((resolve) => (finishClear = resolve)))
        setWalletProvisioningOwner({ cardId: 'card-1', last4: '0420', flagOn: true })
        const { result, unmount } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        let pending!: Promise<Awaited<ReturnType<typeof result.current.addToWallet>>>
        act(() => {
            pending = result.current.addToWallet()
        })
        await waitFor(() => expect(mockedRememberCard).toHaveBeenCalled())
        unmount()
        setWalletProvisioningOwner({ cardId: 'card-2', last4: '2222', flagOn: true })
        await act(async () => finishMirror())
        await waitFor(() => expect(mockedClearStaleCard).toHaveBeenCalledWith('card-1'))
        setWalletProvisioningOwner({ cardId: 'card-3', last4: '3333', flagOn: true })
        await act(async () => {
            finishClear()
            expect(await pending).toEqual({ added: false, canceled: true })
        })
        expect(mockedRememberCard).toHaveBeenLastCalledWith({ peanutCardId: 'card-3', last4: '3333' })
    })

    it('does not restore card metadata when the app-wide flag turns off during cleanup', async () => {
        let finishMirror!: () => void
        let finishClear!: () => void
        mockedRememberCard.mockReturnValueOnce(new Promise((resolve) => (finishMirror = resolve)))
        mockedClearStaleCard.mockReturnValueOnce(new Promise((resolve) => (finishClear = resolve)))
        setWalletProvisioningOwner({ cardId: 'card-1', last4: '0420', flagOn: true })
        const { result, unmount } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        let pending!: Promise<Awaited<ReturnType<typeof result.current.addToWallet>>>
        act(() => {
            pending = result.current.addToWallet()
        })
        await waitFor(() => expect(mockedRememberCard).toHaveBeenCalled())
        unmount()
        setWalletProvisioningOwner({ cardId: 'card-1', last4: '0420', flagOn: false })
        await act(async () => finishMirror())
        await waitFor(() => expect(mockedClearStaleCard).toHaveBeenCalledWith('card-1'))
        await act(async () => {
            finishClear()
            expect(await pending).toEqual({ added: false, canceled: true })
        })
        expect(mockedRememberCard).toHaveBeenCalledTimes(1)
    })

    it('does not restore a replacement card after logout while native cleanup is pending', async () => {
        let finishMirror!: () => void
        let finishClear!: () => void
        mockedRememberCard.mockReturnValueOnce(new Promise((resolve) => (finishMirror = resolve)))
        mockedClearStaleCard.mockReturnValueOnce(new Promise((resolve) => (finishClear = resolve)))
        setWalletProvisioningOwner({ cardId: 'card-1', last4: '0420', flagOn: true })
        const { result, unmount } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        let pending!: Promise<Awaited<ReturnType<typeof result.current.addToWallet>>>
        act(() => {
            pending = result.current.addToWallet()
        })
        await waitFor(() => expect(mockedRememberCard).toHaveBeenCalled())
        unmount()
        setWalletProvisioningOwner({ cardId: 'card-2', last4: '2222', flagOn: true })
        await act(async () => finishMirror())
        await waitFor(() => expect(mockedClearStaleCard).toHaveBeenCalledWith('card-1'))
        mockedClearEpoch.mockReturnValue(1)
        await act(async () => {
            finishClear()
            expect(await pending).toEqual({ added: false, canceled: true })
        })
        expect(mockedRememberCard).toHaveBeenCalledTimes(1)
    })

    it('clears a late native write after logout even when the card screen unmounted', async () => {
        let finishMirror!: () => void
        mockedRememberCard.mockReturnValueOnce(new Promise((resolve) => (finishMirror = resolve)))
        const { result, unmount } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        let pending!: Promise<Awaited<ReturnType<typeof result.current.addToWallet>>>
        act(() => {
            pending = result.current.addToWallet()
        })
        await waitFor(() => expect(mockedRememberCard).toHaveBeenCalled())
        unmount()
        mockedClearEpoch.mockReturnValue(1)

        let outcome!: Awaited<typeof pending>
        await act(async () => {
            finishMirror()
            outcome = await pending
        })
        expect(outcome).toEqual({ added: false, canceled: true })
        expect(mockedClearStaleCard).toHaveBeenCalledWith('card-1')
        expect(mockedAddCard).not.toHaveBeenCalled()
    })

    describe('Android', () => {
        beforeEach(() => {
            mockedIsIOS.mockReturnValue(false)
            mockedIsAndroid.mockReturnValue(true)
            mockedFlag.mockImplementation((key: string) => key === 'push-provisioning-google')
        })

        it('requests Google provisioning while Apple stays disabled, without writing Apple extension state', async () => {
            mockedAddCard.mockResolvedValue({ added: true })
            const { result } = renderHook(() => usePushProvisioning(card))
            await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
            await act(async () => {
                expect(await result.current.addToWallet()).toEqual({ added: true })
            })
            expect(mockedFlag).toHaveBeenCalledWith('push-provisioning-google')
            expect(mockedFlag).not.toHaveBeenCalledWith('push-provisioning-apple')
            expect(mockedGetProvisioningData).toHaveBeenCalledWith(card.id, 'google')
            expect(mockedAddCard).toHaveBeenCalledWith(
                expect.objectContaining({ cardId: 'mea-card-1', cardSecret: 'secret' })
            )
            expect(mockedRememberCard).not.toHaveBeenCalled()
            expect(mockedSyncWalletAuthorizationToken).not.toHaveBeenCalled()
            expect(mockedAvailability).toHaveBeenCalledTimes(1)
            expect(result.current.nativeAvailable).toBe(false)
            expect(result.current.alreadyInWallet).toBe(true)
        })

        it('does not enable Google from the Apple or retired shared flag', async () => {
            mockedFlag.mockImplementation((key: string) => key !== 'push-provisioning-google')
            const { result } = renderHook(() => usePushProvisioning(card))
            await act(async () => {
                expect(await result.current.addToWallet()).toEqual({ added: false, error: 'unavailable' })
            })
            expect(mockedAvailability).not.toHaveBeenCalled()
            expect(mockedGetProvisioningData).not.toHaveBeenCalled()
            expect(mockedAddCard).not.toHaveBeenCalled()
        })

        it('keeps the fallback on a binary without the SDK, even with the Google flag on', async () => {
            mockedAvailability.mockResolvedValue({ available: false, alreadyInWallet: false })
            const { result } = renderHook(() => usePushProvisioning(card))
            await waitFor(() => expect(mockedAvailability).toHaveBeenCalled())
            await act(async () => {
                expect(await result.current.addToWallet()).toEqual({ added: false, error: 'unavailable' })
            })
            expect(result.current.nativeAvailable).toBe(false)
            expect(mockedGetProvisioningData).not.toHaveBeenCalled()
        })

        it('fails closed when the initial native availability lookup rejects', async () => {
            mockedAvailability.mockRejectedValue(new Error('bridge unavailable'))
            const { result } = renderHook(() => usePushProvisioning(card))
            await act(async () => {})
            expect(result.current.nativeAvailable).toBe(false)
            expect(mockedGetProvisioningData).not.toHaveBeenCalled()
        })

        it('reports an existing token only after the native exact-card check', async () => {
            mockedAddCard.mockResolvedValue({ added: false, alreadyInWallet: true })
            const { result } = renderHook(() => usePushProvisioning(card))
            await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
            expect(result.current.alreadyInWallet).toBe(false)
            await act(async () => {
                expect(await result.current.addToWallet()).toEqual({ added: false, alreadyInWallet: true })
            })
            expect(result.current.alreadyInWallet).toBe(true)
            expect(result.current.nativeAvailable).toBe(false)
            expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_ALREADY_ADDED, {
                wallet: 'google',
                error: undefined,
            })
            expect(posthog.capture).not.toHaveBeenCalledWith(
                ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_FAILED,
                expect.anything()
            )
            expect(posthog.capture).not.toHaveBeenCalledWith(
                ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_SUCCEEDED,
                expect.anything()
            )
        })

        it('can provision a different card with the same suffix as an existing token', async () => {
            mockedAvailability.mockImplementation(async (last4) => ({
                available: last4 !== card.last4,
                alreadyInWallet: last4 === card.last4,
            }))
            mockedAddCard
                .mockResolvedValueOnce({ added: false, alreadyInWallet: true })
                .mockResolvedValueOnce({ added: true })
            mockedGetProvisioningData.mockImplementation(async (cardId) => ({
                ...provisioningData,
                cardId: cardId === card.id ? 'mea-card-1' : 'mea-card-2',
            }))
            const { result, rerender } = renderHook(({ selectedCard }) => usePushProvisioning(selectedCard), {
                initialProps: { selectedCard: card },
            })
            await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
            await act(async () => {
                await result.current.addToWallet()
            })
            expect(result.current.alreadyInWallet).toBe(true)

            rerender({ selectedCard: { id: 'card-2', last4: card.last4 } })
            expect(result.current.alreadyInWallet).toBe(false)
            await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
            await act(async () => {
                expect(await result.current.addToWallet()).toEqual({ added: true })
            })
            expect(mockedAddCard).toHaveBeenLastCalledWith(expect.objectContaining({ cardId: 'mea-card-2' }))
            expect(result.current.alreadyInWallet).toBe(true)
            expect(result.current.nativeAvailable).toBe(false)
        })

        it('preserves retry after user cancellation', async () => {
            mockedAddCard.mockResolvedValue({ added: false, canceled: true })
            const { result } = renderHook(() => usePushProvisioning(card))
            await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
            await act(async () => {
                expect(await result.current.addToWallet()).toEqual({ added: false, canceled: true })
            })
            expect(result.current.nativeAvailable).toBe(true)
            expect(result.current.alreadyInWallet).toBe(false)
        })

        it('blocks duplicate taps and cancels a fetched credential when the Google rollout closes', async () => {
            let finishFetch!: (value: RainProvisioningDataResponse) => void
            mockedGetProvisioningData.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        finishFetch = resolve
                    })
            )
            const { result, rerender } = renderHook(() => usePushProvisioning(card))
            await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
            let pending!: ReturnType<typeof result.current.addToWallet>
            await act(async () => {
                pending = result.current.addToWallet()
                expect(await result.current.addToWallet()).toEqual({ added: false, error: 'unavailable' })
            })
            expect(mockedGetProvisioningData).toHaveBeenCalledTimes(1)
            mockedFlag.mockReturnValue(false)
            rerender()
            await act(async () => {
                finishFetch(provisioningData)
                expect(await pending).toEqual({ added: false, canceled: true })
            })
            expect(mockedAddCard).not.toHaveBeenCalled()
            expect(mockedRememberCard).not.toHaveBeenCalled()
            expect(mockedSyncWalletAuthorizationToken).not.toHaveBeenCalled()
        })
    })
})
