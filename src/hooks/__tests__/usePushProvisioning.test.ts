import { renderHook, act, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { usePushProvisioning } from '@/hooks/usePushProvisioning'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { rainApi, RainCardRateLimitError, type RainProvisioningDataResponse } from '@/services/rain'
import { isAndroidNative, isIOSNative } from '@/utils/capacitor'
import { addCardToWallet, getPushProvisioningAvailability } from '@/utils/push-provisioning'

jest.mock('@/services/rain', () => {
    const actual = jest.requireActual('@/services/rain')
    return { ...actual, rainApi: { ...actual.rainApi, getProvisioningData: jest.fn() } }
})
jest.mock('@/utils/push-provisioning', () => {
    const actual = jest.requireActual('@/utils/push-provisioning')
    return { ...actual, getPushProvisioningAvailability: jest.fn(), addCardToWallet: jest.fn() }
})
jest.mock('@/utils/capacitor', () => {
    const actual = jest.requireActual('@/utils/capacitor')
    return { ...actual, isIOSNative: jest.fn(), isAndroidNative: jest.fn() }
})

const mockedFlag = jest.fn()
jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlags: () => mockedFlag }))

const mockedGetProvisioningData = rainApi.getProvisioningData as jest.MockedFunction<typeof rainApi.getProvisioningData>
const mockedAvailability = getPushProvisioningAvailability as jest.MockedFunction<
    typeof getPushProvisioningAvailability
>
const mockedAddCard = addCardToWallet as jest.MockedFunction<typeof addCardToWallet>
const mockedIsIOS = isIOSNative as jest.MockedFunction<typeof isIOSNative>
const mockedIsAndroid = isAndroidNative as jest.MockedFunction<typeof isAndroidNative>

const card = { id: 'card-1', last4: '0420' }

const provisioningData: RainProvisioningDataResponse = {
    cardId: 'mea-card-1',
    cardSecret: 'secret',
    last4: '0420',
    network: 'visa',
    cardholderName: 'Ada Lovelace',
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
        mockedFlag.mockReturnValue(true)
        mockedIsIOS.mockReturnValue(true)
        mockedIsAndroid.mockReturnValue(false)
        mockedAvailability.mockResolvedValue({ available: true, alreadyInWallet: false })
        mockedGetProvisioningData.mockResolvedValue(provisioningData)
        jest.spyOn(posthog, 'capture').mockImplementation(() => undefined as never)
    })

    it('offers the native row only when the plugin is available and the card is not already in the wallet', async () => {
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))
        expect(mockedAvailability).toHaveBeenCalledWith('0420')
    })

    it('keeps the manual carousel for a card already in the wallet', async () => {
        mockedAvailability.mockResolvedValue({ available: true, alreadyInWallet: true })
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(mockedAvailability).toHaveBeenCalled())
        expect(result.current.nativeAvailable).toBe(false)
    })

    it('never touches the plugin on web or behind the flag', async () => {
        mockedIsIOS.mockReturnValue(false)
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(false))

        mockedIsIOS.mockReturnValue(true)
        mockedFlag.mockReturnValue(false)
        const flagOff = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(flagOff.result.current.nativeAvailable).toBe(false))

        expect(mockedAvailability).not.toHaveBeenCalled()
    })

    it('flips the row back to the carousel after a successful add', async () => {
        mockedAddCard.mockResolvedValue({ added: true, last4: '0420' })
        const { result } = renderHook(() => usePushProvisioning(card))
        await waitFor(() => expect(result.current.nativeAvailable).toBe(true))

        await act(async () => {
            await result.current.addToWallet()
        })

        expect(mockedGetProvisioningData).toHaveBeenCalledWith('card-1', 'apple')
        expect(mockedAddCard).toHaveBeenCalledWith({
            cardId: 'mea-card-1',
            cardSecret: 'secret',
            cardholderName: 'Ada Lovelace',
            last4: '0420',
            address: provisioningData.billingAddress,
        })
        expect(result.current.nativeAvailable).toBe(false)
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_SUCCEEDED, {
            wallet: 'apple',
            error: undefined,
        })
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

    // Google requires its own supplied Add to Google Wallet asset on any control
    // that starts provisioning, and it ships with issuer onboarding. Until then
    // Android keeps the manual carousel.
    it('keeps the manual carousel on android binaries', async () => {
        mockedIsIOS.mockReturnValue(false)
        mockedIsAndroid.mockReturnValue(true)
        const { result } = renderHook(() => usePushProvisioning(card))

        await waitFor(() => expect(result.current.nativeAvailable).toBe(false))
        expect(mockedAvailability).not.toHaveBeenCalled()
    })
})
