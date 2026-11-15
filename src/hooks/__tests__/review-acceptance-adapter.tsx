import React from 'react'
import { act, within } from '@testing-library/react'
import YourCardScreen from '@/components/Card/YourCardScreen'
import { renderWithIntl } from '@/test-utils/intl'
import { usePushProvisioning } from '@/hooks/usePushProvisioning'
import type { RainCardOverview, RainCardSummary } from '@/services/rain'
import type { AddCardToWalletResult, PushProvisioningAvailability } from '@/utils/push-provisioning'

let mockPlatform: 'android' | 'ios' = 'android'
let mockFlag = true
let mockEpoch = 0
let mockHookResult: ReturnType<typeof usePushProvisioning>
const mockAvailability = jest.fn()
const mockProvisioning = jest.fn()
const mockNativeAdd = jest.fn()
const mockRainWallets = jest.fn()

jest.mock('@/hooks/usePushProvisioning', () => ({
    usePushProvisioning: (card: { id: string; last4: string }) => {
        const actual = jest.requireActual('@/hooks/usePushProvisioning')
        mockHookResult = actual.usePushProvisioning(card)
        return mockHookResult
    },
}))
jest.mock('@/utils/native-platform', () => ({
    useNativePlatform: () => ({ isIOSNative: mockPlatform === 'ios', isAndroidNative: mockPlatform === 'android' }),
}))
jest.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlags: () => () => mockFlag }))
jest.mock('@/utils/auth-token', () => ({
    ...jest.requireActual('@/utils/auth-token'),
    getClearEpoch: () => mockEpoch,
}))
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isIOSNative: () => mockPlatform === 'ios',
    isAndroidNative: () => mockPlatform === 'android',
}))
jest.mock('@/utils/push-provisioning', () => ({
    ...jest.requireActual('@/utils/push-provisioning'),
    getPushProvisioningAvailability: (...args: unknown[]) => mockAvailability(...args),
    addCardToWallet: (...args: unknown[]) => mockNativeAdd(...args),
    rememberCardForWallet: jest.fn().mockResolvedValue(undefined),
    syncWalletAuthorizationToken: jest.fn().mockResolvedValue(undefined),
    clearWalletStateIfCardMatches: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/services/rain', () => ({
    ...jest.requireActual('@/services/rain'),
    rainApi: {
        getProvisioningData: (...args: unknown[]) => mockProvisioning(...args),
        getCardWallets: (...args: unknown[]) => mockRainWallets(...args),
    },
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/hooks/useWalletPlatform', () => ({ useWalletPlatform: () => mockPlatform }))
jest.mock('@/hooks/useCardReveal', () => ({
    useCardReveal: () => ({ revealed: null, isLoading: false, toggle: jest.fn() }),
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ success: jest.fn(), error: jest.fn() }) }))
jest.mock('@/components/Card/CardFace', () => ({ __esModule: true, default: () => <div>Card</div> }))
jest.mock('@/components/Card/LockCardModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Card/CancelCardModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
    useModalsContextOptional: () => ({ setIsSupportModalOpen: jest.fn() }),
}))
jest.mock('@/hooks/wallet/useCardCollateralReturn', () => ({
    useCardCollateralReturn: () => ({ returnCollateral: jest.fn(), isReturning: false, lastError: null }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'synthetic-user' } } }) }))
jest.mock('@/hooks/useCardFundingAccess', () => ({ useCardFundingAccess: () => ({ access: undefined }) }))
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: undefined }) }))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({
        unoptimized: _unoptimized,
        ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => <img {...props} />,
}))

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (error: Error) => void
    const promise = new Promise<T>((yes, no) => {
        resolve = yes
        reject = no
    })
    return { promise, resolve, reject }
}

export async function walletScenario(options: {
    platform: 'android' | 'ios'
    card: { id: string; last4: string }
    flagOn?: boolean
    availability?: PushProvisioningAvailability
    historicalCardIds?: string[]
    rainWallets?: unknown
    deferLookup?: boolean
}) {
    jest.clearAllMocks()
    mockAvailability.mockReset()
    mockProvisioning.mockReset()
    mockNativeAdd.mockReset()
    mockRainWallets.mockReset()
    mockPlatform = options.platform
    mockFlag = options.flagOn ?? true
    mockEpoch = 0
    window.localStorage.clear()
    window.localStorage.setItem('peanut:walletAddedCards', JSON.stringify(options.historicalCardIds ?? []))
    let selected = options.card
    const initialLookup = deferred<PushProvisioningAvailability>()
    mockAvailability.mockResolvedValue(options.availability ?? { available: true, alreadyInWallet: false })
    if (options.deferLookup) mockAvailability.mockImplementationOnce(() => initialLookup.promise)
    mockRainWallets.mockResolvedValue(options.rainWallets)
    const data = {
        cardId: 'synthetic-native-card',
        cardSecret: 'synthetic-secret',
        last4: selected.last4,
        network: 'visa',
    }
    mockProvisioning.mockResolvedValue(data)
    mockNativeAdd.mockResolvedValue({ added: false, canceled: true })
    let provisioningWait: ReturnType<typeof deferred<typeof data>> | undefined
    let nativeWait: ReturnType<typeof deferred<AddCardToWalletResult>> | undefined
    let nextLookup: ReturnType<typeof deferred<PushProvisioningAvailability>> | undefined
    let mounted = true
    const component = () => (
        <YourCardScreen
            card={{ ...selected, status: 'ACTIVE', expiryMonth: 12, expiryYear: 2030 } as RainCardSummary}
            overview={{ balance: {} } as RainCardOverview}
        />
    )
    const rendered = renderWithIntl(component())
    const flush = async () => {
        await act(async () => {})
    }
    const rerender = async () => {
        rendered.rerender(component())
        await flush()
    }
    await flush()
    return {
        flush,
        deferNextLookup() {
            nextLookup = deferred<PushProvisioningAvailability>()
            mockAvailability.mockImplementationOnce(() => nextLookup!.promise)
        },
        async resolveNextLookup(value: PushProvisioningAvailability) {
            await act(async () => {
                nextLookup!.resolve(value)
            })
            nextLookup = undefined
        },
        beginAdd(outcome?: AddCardToWalletResult) {
            if (outcome) mockNativeAdd.mockResolvedValueOnce(outcome)
            let operation!: Promise<AddCardToWalletResult>
            act(() => {
                operation = mockHookResult.addToWallet()
            })
            return operation
        },
        nextAvailability(value: PushProvisioningAvailability | Error) {
            if (value instanceof Error) mockAvailability.mockRejectedValueOnce(value)
            else mockAvailability.mockResolvedValueOnce(value)
        },
        async settleLookup(value: PushProvisioningAvailability = { available: true, alreadyInWallet: false }) {
            await act(async () => {
                initialLookup.resolve(value)
            })
        },
        async rejectLookup() {
            await act(async () => {
                initialLookup.reject(new Error('synthetic lookup error'))
            })
        },
        deferProvisioning() {
            provisioningWait = deferred<typeof data>()
            mockProvisioning.mockImplementationOnce(() => provisioningWait!.promise)
        },
        async resolveProvisioning() {
            await act(async () => {
                provisioningWait!.resolve(data)
            })
            provisioningWait = undefined
        },
        async rejectProvisioning() {
            await act(async () => {
                provisioningWait!.reject(new Error('synthetic credential error'))
            })
            provisioningWait = undefined
        },
        deferNativeAdd() {
            nativeWait = deferred<AddCardToWalletResult>()
            mockNativeAdd.mockImplementationOnce(() => nativeWait!.promise)
        },
        async resolveNativeAdd(result: AddCardToWalletResult) {
            await act(async () => {
                nativeWait!.resolve(result)
            })
            nativeWait = undefined
        },
        tapAdd(outcome?: AddCardToWalletResult) {
            if (outcome) mockNativeAdd.mockResolvedValueOnce(outcome)
            let operation!: Promise<AddCardToWalletResult>
            if (provisioningWait || nativeWait) {
                act(() => {
                    operation = mockHookResult.addToWallet()
                })
                return operation
            }
            return act(async () => {
                await mockHookResult.addToWallet()
            })
        },
        async setFlag(enabled: boolean) {
            mockFlag = enabled
            await rerender()
        },
        async logout() {
            mockEpoch += 1
            await flush()
        },
        async selectCard(card: { id: string; last4: string }) {
            selected = card
            await rerender()
        },
        unmount() {
            if (mounted) rendered.unmount()
            mounted = false
        },
        state() {
            const label = mockPlatform === 'android' ? 'Add to Google Wallet' : 'Add to Apple Wallet'
            const button = mounted ? within(rendered.container).queryByRole('button', { name: label }) : null
            const action = button
                ? mockPlatform === 'android'
                    ? button.querySelector('img')
                        ? 'native'
                        : 'manual'
                    : mockHookResult.nativeAvailable
                      ? 'native'
                      : 'manual'
                : 'none'
            const addedLabel = mockPlatform === 'android' ? 'Added to Google Wallet' : 'Added to Apple Wallet'
            return {
                action,
                isAdding: mockHookResult.isAdding,
                added: mounted && !!within(rendered.container).queryByText(addedLabel),
                provisioningCalls: mockProvisioning.mock.calls.length,
                nativeAddCalls: mockNativeAdd.mock.calls.length,
            }
        },
    }
}
