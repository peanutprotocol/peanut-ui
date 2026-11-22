/**
 * A Pix payment opened on the neutral pay routes (`?intentId=` on /qr-pay) is read on the rail that
 * opened it, whatever the pay route says now (Chip, TASK-24947 M5): a route that turned to Manteca or
 * is gone must not mount Manteca's flow, whose init could open a second payment for the same scan.
 * Its outcome shows from its own read, with no live rate: an FX outage cannot hide a settled payment.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { IntlWrapper } from '@/test-utils/intl'

// Keep the real page selector and rate recovery UI; unrelated screens need no
// providers in this payment-controller integration test.
jest.mock('../views/QrPayFormView', () => ({ QrPayFormView: () => <div>Payment form</div> }))
jest.mock('../views/QrPayStatusView', () => ({ QrPayStatusView: () => <div>Payment status</div> }))
jest.mock('../views/QrPaySuccessView', () => ({ QrPaySuccessView: () => <div>Payment success</div> }))
jest.mock('../views/QrPayKycGateView', () => ({ QrPayKycGateView: () => null }))
jest.mock('../views/QrPayProviderRejectionView', () => ({ QrPayProviderRejectionView: () => null }))
jest.mock('../views/QrPayBlockedView', () => ({ QrPayBlockedView: () => null }))
jest.mock('../views/QrPayProcessingView', () => ({ QrPayProcessingView: () => <div>Processing payment</div> }))

const ACCOUNT = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const PAYMASTER = '0x2a1c0c8d0c0f0c8d0c0f0c8d0c0f0c8d0c0f0c8d'

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/qr-pay',
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '/mp.png', PIX: '/pix.png' }))
const mockFetchUser = jest.fn(async () => null)
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'u1', username: 'tester' } },
        fetchUser: mockFetchUser,
    }),
}))
// what the pay:PIX_BR route blocks (its own suite covers reading the route)
let mockPixBlock: 'paused' | 'residence' | null = null
jest.mock('@/features/pix/usePixPayBlock', () => ({ usePixPayBlock: () => mockPixBlock }))
const mockUseWallet = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => mockUseWallet() }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: { cards: [], balance: { spendingPower: 0 } } }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('@/hooks/wallet/useStaleSessionGuard', () => ({ useStaleSessionGuard: () => () => false }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn(), useReturnTo: () => jest.fn() }))
let mockPointsData: { estimatedPoints: number } | null = null
jest.mock('@/hooks/usePointsCalculation', () => ({
    usePointsCalculation: () => ({ pointsData: mockPointsData, pointsDivRef: { current: null } }),
}))
jest.mock('@/hooks/usePointsConfetti', () => ({ usePointsConfetti: jest.fn() }))
jest.mock('@/hooks/useAppReviewNudge', () => ({ useAppReviewNudge: jest.fn() }))
jest.mock('@/features/kill-switches/kill-switches-store', () => {
    const killSwitches = {
        disabledPaymentProviders: [] as string[],
        maintenanceBannerPaths: [],
        enableFullMaintenance: false,
        enableMaintenanceBanner: false,
    }
    return { getKillSwitches: () => killSwitches, subscribeKillSwitches: () => () => {} }
})
jest.mock('@/services/services.types', () => ({ PointsAction: { MANTECA_QR_PAYMENT: 'manteca_qr_payment' } }))
const mockGetCurrencyPrice = jest.fn()
jest.mock('@/app/actions/currency', () => ({ getCurrencyPrice: (code: string) => mockGetCurrencyPrice(code) }))
jest.mock('@/components/Global/DirectSendQR/utils', () => ({
    isPaymentProcessorQR: () => true,
    EQrType: { MERCADO_PAGO: 'MERCADO_PAGO', ARGENTINA_QR3: 'ARGENTINA_QR3', PIX: 'PIX' },
    NAME_BY_QR_TYPE: { MERCADO_PAGO: 'Mercado Pago', ARGENTINA_QR3: 'QR Interoperable', PIX: 'PIX' },
}))
jest.mock('@/features/payments/flows/qr-pay/useQrPayKycGate', () => {
    const { QrKycState } = jest.requireActual('@/constants/kyc.consts')
    return {
        useQrPayKycGate: () => ({
            kycGateState: QrKycState.PROCEED_TO_PAY,
            shouldBlockPay: false,
            qrKycUserMessage: null,
            qrKycActionKey: null,
            sumsubFlow: {},
        }),
    }
})
const mockCaptureNetworkTriagedFailure = jest.fn()
jest.mock('@/utils/network-triage', () => ({
    captureNetworkTriagedFailure: (...args: unknown[]) => mockCaptureNetworkTriagedFailure(...args),
    isNetworkLayerFailure: (error: unknown) => (error as Error)?.name === 'ConnectionTimeoutError',
}))
const mockMantecaApi = { initiateQrPayment: jest.fn(), completeQrPaymentWithSignedTx: jest.fn() }
jest.mock('@/services/manteca', () => ({ mantecaApi: mockMantecaApi }))

// ── the signing engine's boundaries (same set as useSignSpendBundle.test) ──
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
    USER_OP_ENTRY_POINT: { address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', version: '0.7' },
}))
jest.mock('@/constants/rain.consts', () => ({
    rainCoordinatorAbi: [
        {
            type: 'function',
            name: 'withdrawAsset',
            inputs: [
                { name: 'proxy', type: 'address' },
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'recipient', type: 'address' },
                { name: 'expiresAt', type: 'uint256' },
                { name: 'executorSalt', type: 'bytes32' },
                { name: 'executorSignature', type: 'bytes' },
                { name: 'adminSalts', type: 'bytes32[]' },
                { name: 'adminSignatures', type: 'bytes[]' },
                { name: 'directTransfer', type: 'bool' },
            ],
            outputs: [],
            stateMutability: 'nonpayable',
        },
    ],
}))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: { tag: 'public' } }))
jest.mock('@/constants/session-key-sign.consts', () => ({ sessionKeySignEnabled: () => false }))
jest.mock('@/hooks/wallet/mixedEphemeralSign', () => ({ signMixedEphemeralSpend: jest.fn() }))
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: () => ({ handleSendUserOpEncoded: jest.fn() }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContextOptional: () => undefined }))
const mockGrant = jest.fn()
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({ useGrantSessionKey: () => ({ grant: mockGrant }) }))
jest.mock('@/utils/rainWithdraw.utils', () => ({
    ...jest.requireActual('@/utils/rainWithdraw.utils'),
    buildRainWithdrawTypedData: jest.fn(() => ({})),
    // The real signer builds typed data from a full prep; the account's own signer is what is under test.
    signRainWithdrawAdmin: (account: { signTypedData: (data: unknown) => Promise<string> }) =>
        account.signTypedData({}),
}))
jest.mock('@/services/rain', () => ({ rainApi: { prepareWithdrawal: jest.fn(), cancelPreparation: jest.fn() } }))
jest.mock('@/hooks/wallet/spendPreflight', () => ({
    ...jest.requireActual('@/hooks/wallet/spendPreflight'),
    resolveSpendStrategy: jest.fn(),
    runCollateralSpendPreflight: jest.fn(),
}))
jest.mock('@/utils/webauthn.utils', () => ({
    ...jest.requireActual('@/utils/webauthn.utils'),
    capturePasskeySignFailure: jest.fn(),
}))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    withCeremonyPurpose: (_purpose: string, fn: () => unknown) => fn(),
    withCeremonyFlow: (_flow: string, fn: () => unknown) => fn(),
}))

type FakeClient = ReturnType<typeof makeFakeClient>
function makeFakeClient() {
    return {
        account: {
            address: ACCOUNT,
            encodeCalls: jest.fn(async (calls: { data: string }[]) => calls[0].data),
            getNonce: jest.fn(async () => 7n),
            signUserOperation: jest.fn(async () => '0x51'),
            signTypedData: jest.fn(async () => '0xad'),
        },
        prepareUserOperation: jest.fn(async ({ callData }: { callData: string }) => ({
            sender: ACCOUNT,
            nonce: 7n,
            callData,
            callGasLimit: 1n,
            verificationGasLimit: 1n,
            preVerificationGas: 1n,
            maxFeePerGas: 0n,
            maxPriorityFeePerGas: 0n,
            paymaster: PAYMASTER,
            paymasterData: '0x01d0',
            paymasterVerificationGasLimit: 1n,
            paymasterPostOpGasLimit: 1n,
            factory: undefined,
            factoryData: undefined,
            signature: '0x57',
        })),
        paymaster: {
            getPaymasterData: jest.fn(async () => ({
                paymaster: PAYMASTER,
                paymasterData: '0xf00d',
                callGasLimit: 2n,
                verificationGasLimit: 2n,
                preVerificationGas: 2n,
                paymasterVerificationGasLimit: 2n,
                paymasterPostOpGasLimit: 2n,
            })),
        },
        paymasterContext: undefined,
    }
}
let fakeClient: FakeClient
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        getClientForChain: () => fakeClient,
        ensureClientForChain: async () => fakeClient,
        rebuildClientForChain: jest.fn(),
        getPatchedSudoValidator: jest.fn(),
    }),
}))

let mockRoutes: Array<Record<string, unknown>> = []
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        capabilities: { rails: [], nextActions: [], restrictions: [], routes: mockRoutes },
        isLoading: false,
    }),
}))
const mockPixApi = {
    previewPayment: jest.fn(),
    openPayment: jest.fn(),
    reportPaymentFunding: jest.fn(),
    readPayment: jest.fn(),
}
jest.mock('@/services/pix', () => ({ pixApi: mockPixApi }))
let mockEntry: Record<string, unknown> | undefined
jest.mock('@/hooks/useHistoryEntry', () => ({ useHistoryEntry: () => ({ data: mockEntry }) }))

import { LoadingStateContextProvider } from '@/context/loadingStates.context'
import { QrPayPage } from '../QrPayPage'
import { QrPayFlowProvider, useQrPayFlow } from '../QrPayFlowContext'
import type { QrPayFlowSurface } from '../useQrPayFlow'
import { pixProviderId } from '@/utils/provider.utils'
import { ApiError } from '@/services/api-error'

const PIX_CODE =
    '00020101021226680014br.gov.bcb.pix2546pix.example.com/qr/v2/cobv/padaria-pao-dourado520400005303986540542.505802BR5924PADARIA PAO DOURADO LTDA6009SAO PAULO62070503***63043A47'
const payRoute = (provider: string) => ({
    operation: 'pay',
    method: 'PIX_BR',
    provider,
    state: 'ready',
    candidates: [{ provider, state: 'ready' }],
})
const read = (state: string, status: string) => ({
    provider: 'avenia',
    intentId: 'pay-1',
    state,
    status,
    amountBrl: '42.50',
    merchantName: 'PADARIA PAO DOURADO LTDA',
    perk: null,
})

function renderOpenedPayment(searchParams = '?intentId=pay-1') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    return render(
        <IntlWrapper>
            <NuqsTestingAdapter searchParams={searchParams}>
                <QueryClientProvider client={queryClient}>
                    <LoadingStateContextProvider>
                        <QrPayPage qrCode={PIX_CODE} timestamp="1" qrType="PIX" />
                    </LoadingStateContextProvider>
                </QueryClientProvider>
            </NuqsTestingAdapter>
        </IntlWrapper>
    )
}

const noInitCalls = () => {
    expect(mockMantecaApi.initiateQrPayment).not.toHaveBeenCalled()
    expect(mockMantecaApi.completeQrPaymentWithSignedTx).not.toHaveBeenCalled()
    expect(mockPixApi.previewPayment).not.toHaveBeenCalled()
    expect(mockPixApi.openPayment).not.toHaveBeenCalled()
}

beforeEach(() => {
    jest.clearAllMocks()
    fakeClient = makeFakeClient()
    mockUseWallet.mockReturnValue({
        address: ACCOUNT,
        balance: 100_000_000n,
        spendableBalance: 100_000_000n,
        sendTransactions: jest.fn(),
    })
    mockGetCurrencyPrice.mockResolvedValue({ sell: 5.27, buy: 5.3 })
    mockEntry = undefined
    mockPixBlock = null
})

describe('an opened Pix payment stays on the rail that opened it', () => {
    it.each([
        ['turned to Manteca', [payRoute('manteca')]],
        ['is gone', []],
    ])('the pay route %s: the payment is read, and neither provider opens another', async (_label, routes) => {
        mockRoutes = routes
        mockPixApi.readPayment.mockResolvedValue(read('processing', 'PROCESSING'))
        renderOpenedPayment()

        await waitFor(() => expect(mockPixApi.readPayment).toHaveBeenCalledWith('pay-1'))
        noInitCalls()
    })

    it('a paid payment shows its success on a route that turned to Manteca', async () => {
        mockRoutes = [payRoute('manteca')]
        mockPixApi.readPayment.mockResolvedValue(read('paid', 'COMPLETED'))
        renderOpenedPayment()

        expect(await screen.findByText('Payment success')).toBeInTheDocument()
        noInitCalls()
    })

    it('names the provider that opened the payment, not the one the route names now', async () => {
        mockRoutes = [payRoute('manteca')]
        mockPixApi.readPayment.mockResolvedValue(read('paid', 'COMPLETED'))
        let surface: QrPayFlowSurface | null = null
        const Probe = () => {
            surface = useQrPayFlow()
            return null
        }
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
        render(
            <IntlWrapper>
                <NuqsTestingAdapter searchParams="?intentId=pay-1">
                    <QueryClientProvider client={queryClient}>
                        <LoadingStateContextProvider>
                            <QrPayFlowProvider qrCode={PIX_CODE} timestamp="1" qrType="PIX">
                                <Probe />
                            </QrPayFlowProvider>
                        </LoadingStateContextProvider>
                    </QueryClientProvider>
                </NuqsTestingAdapter>
            </IntlWrapper>
        )
        await waitFor(() => expect(surface?.paymentProcessor).toBe('PIX_PAY'))
        await waitFor(() => expect(surface?.providerId).toBe(pixProviderId('avenia')))
        expect(pixProviderId('avenia')).not.toBe(pixProviderId('manteca'))
    })
})
describe('an opened payment shows its outcome without a live rate', () => {
    it.each([
        ['paid', 'COMPLETED', 'Payment success'],
        ['refunded', 'REFUNDED', 'Payment status'],
        ['cancelled', 'CANCELLED', 'Payment status'],
        ['needs_support', 'PROCESSING', 'Payment status'],
    ])('a %s payment shows its result while the rate is down, and asks no rate', async (state, status, screenText) => {
        mockRoutes = [payRoute('avenia')]
        mockGetCurrencyPrice.mockRejectedValue(new Error('fx down'))
        mockEntry = { uuid: 'pay-1', amount: '8.062211', currency: { amount: '42.50', code: 'BRL' } }
        mockPixApi.readPayment.mockResolvedValue(read(state, status))
        renderOpenedPayment()

        expect(await screen.findByText(screenText)).toBeInTheDocument()
        expect(mockGetCurrencyPrice).not.toHaveBeenCalled()
    })
})

// The API's selfPay (a1c2b82d9): a payment to the user's own account earns no points and no reward
describe('a paid Pix payment to the user’s own account', () => {
    const perk = {
        eligible: true,
        discountPercentage: 0,
        claimed: false,
        sponsoredUsd: 1,
        reason: 'Pix cashback',
        usageId: 'u-1',
        payoutStatus: 'pending',
    }
    const renderProbe = () => {
        let surface: QrPayFlowSurface | null = null
        const Probe = () => {
            surface = useQrPayFlow()
            return null
        }
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
        render(
            <IntlWrapper>
                <NuqsTestingAdapter searchParams="?intentId=pay-1">
                    <QueryClientProvider client={queryClient}>
                        <LoadingStateContextProvider>
                            <QrPayFlowProvider qrCode={PIX_CODE} timestamp="1" qrType="PIX">
                                <Probe />
                            </QrPayFlowProvider>
                        </LoadingStateContextProvider>
                    </QueryClientProvider>
                </NuqsTestingAdapter>
            </IntlWrapper>
        )
        return () => surface
    }

    beforeEach(() => {
        mockRoutes = [payRoute('avenia')]
        mockPointsData = { estimatedPoints: 42 }
    })
    afterEach(() => {
        mockPointsData = null
    })

    it('shows no points line and no reward when the read says selfPay', async () => {
        mockPixApi.readPayment.mockResolvedValue({ ...read('paid', 'COMPLETED'), perk, selfPay: true })
        const surface = renderProbe()

        await waitFor(() => expect(surface()?.isSuccess).toBe(true))
        expect(surface()?.pointsData).toBeUndefined()
        expect(surface()?.paidReward?.perk).toBeNull()
    })

    it.each([
        ['false', { selfPay: false }],
        ['absent (an older API)', {}],
    ])('keeps the points and the reward when selfPay is %s', async (_label, field) => {
        mockPixApi.readPayment.mockResolvedValue({ ...read('paid', 'COMPLETED'), perk, ...field })
        const surface = renderProbe()

        await waitFor(() => expect(surface()?.isSuccess).toBe(true))
        expect(surface()?.pointsData).toEqual({ estimatedPoints: 42 })
        expect(surface()?.paidReward?.perk).toMatchObject({ eligible: true })
    })
})

// TASK-24947 M5: the API answers Manteca's QR init for a Pix code it no longer serves on Manteca
describe("Manteca's init refuses a Pix code Manteca no longer serves", () => {
    it.each([
        ['moved to another provider', 409, 'PIX_PROVIDER_MOVED'],
        ['Manteca’s BRL switched off', 503, 'PROVIDER_UNAVAILABLE'],
        ['the route’s refusal', 403, 'ROUTE_NOT_AVAILABLE'],
    ])('%s: the capabilities are read again, so the page follows the route', async (_label, status, code) => {
        mockRoutes = [payRoute('manteca')]
        mockMantecaApi.initiateQrPayment.mockRejectedValue(new ApiError('refused', { status, code }))
        renderOpenedPayment('')

        await waitFor(() => expect(mockMantecaApi.initiateQrPayment).toHaveBeenCalled())
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalled())
    })

    it('a moved code is not retried: one init call', async () => {
        mockRoutes = [payRoute('manteca')]
        mockMantecaApi.initiateQrPayment.mockRejectedValue(
            new ApiError('moved', { status: 409, code: 'PIX_PROVIDER_MOVED' })
        )
        renderOpenedPayment('')

        await waitFor(() => expect(mockFetchUser).toHaveBeenCalled())
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(mockMantecaApi.initiateQrPayment).toHaveBeenCalledTimes(1)
    })
})
