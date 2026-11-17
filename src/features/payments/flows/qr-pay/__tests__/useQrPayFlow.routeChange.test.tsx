/**
 * A payment of this scan keeps its processor while it may exist (TASK-24947, review 2, n=1): a pay
 * route that changes under a Manteca payment that is signed or paid, or under a Pix payment that is
 * opening, neither resets that payment's screen nor starts the other provider's payment. A route that
 * now asks to activate does not unmount the flow either.
 */
import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { IntlWrapper } from '@/test-utils/intl'

// The form exposes the flow so the test can tap Pay; the other screens are their names.
let mockSurface: { payQR: () => Promise<void> } | null = null
jest.mock('../views/QrPayFormView', () => ({
    QrPayFormView: () => {
        const { useQrPayFlow } = jest.requireActual('../QrPayFlowContext')
        mockSurface = useQrPayFlow()
        return <div>Payment form</div>
    },
}))
jest.mock('../views/QrPayStatusView', () => ({ QrPayStatusView: () => <div>Payment status</div> }))
jest.mock('../views/QrPaySuccessView', () => ({ QrPaySuccessView: () => <div>Payment success</div> }))
jest.mock('../views/QrPayKycGateView', () => ({ QrPayKycGateView: () => null }))
jest.mock('../views/QrPayProviderRejectionView', () => ({ QrPayProviderRejectionView: () => null }))
jest.mock('../views/QrPayBlockedView', () => ({ QrPayBlockedView: () => null }))
jest.mock('../views/QrPayProcessingView', () => ({ QrPayProcessingView: () => <div>Processing payment</div> }))
jest.mock('@/features/pix/components/PixSetup', () => ({ PixSetup: () => <div>Pix setup</div> }))
jest.mock('@/features/pix/components/PixUnavailableScreen', () => ({
    PixUnavailableScreen: () => <div>Pix unavailable</div>,
}))

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
jest.mock('@/hooks/usePointsCalculation', () => ({
    usePointsCalculation: () => ({ pointsData: null, pointsDivRef: { current: null } }),
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
            isKycApproved: true,
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

import { resolveSpendStrategy, runCollateralSpendPreflight } from '@/hooks/wallet/spendPreflight'
import { LoadingStateContextProvider } from '@/context/loadingStates.context'
import { QrPayPage } from '../QrPayPage'

const PIX_CODE =
    '00020101021226680014br.gov.bcb.pix2546pix.example.com/qr/v2/cobv/padaria-pao-dourado520400005303986540542.505802BR5924PADARIA PAO DOURADO LTDA6009SAO PAULO62070503***63043A47'
const payRoute = (provider: string, extra: Record<string, unknown> = { state: 'ready' }) => ({
    operation: 'pay',
    method: 'PIX_BR',
    provider,
    candidates: [{ provider, state: 'ready' }],
    ...extra,
})
const ACTIVATE = { state: 'action_required', action: 'activate', reason: { code: 'first_use_required' } }

const mantecaPixLock = () => ({
    code: 'LOCK123',
    type: 'PIX',
    companyId: 'c1',
    userId: 'u1',
    userNumberId: 'un1',
    userExternalId: 'ue1',
    paymentRecipientName: 'PADARIA PAO DOURADO LTDA',
    paymentRecipientLegalId: 'legal1',
    paymentAssetAmount: '42.50',
    paymentAsset: 'BRL',
    paymentPrice: '5.27',
    paymentAgainstAmount: '8.06',
    paymentAgainst: 'USD',
    expireAt: new Date(Date.now() + 120_000).toISOString(),
    expiresInMs: 120_000,
    creationTime: new Date().toISOString(),
    depositAddress: '0x49200bF84dC26349C86ce040019063FeCE88CB1c',
})
const mantecaPayment = (status: string) => ({
    id: 'qp1',
    externalId: 'ext1',
    sessionId: 's1',
    status,
    currentStage: 'done',
    stages: [],
    type: 'PIX',
    details: {
        depositAddress: '0x49200bF84dC26349C86ce040019063FeCE88CB1c',
        paymentAsset: 'BRL',
        paymentAgainst: 'USD',
        paymentAgainstAmount: '8.06',
        paymentAssetAmount: '42.50',
        paymentPrice: '5.27',
        priceExpireAt: new Date(Date.now() + 120_000).toISOString(),
        merchant: { name: 'PADARIA PAO DOURADO LTDA' },
    },
})
const review = {
    amountBrl: '42.50',
    amountFixed: true,
    merchantName: 'PADARIA PAO DOURADO LTDA',
    merchantTaxIdMasked: null,
    bankName: null,
    withdrawUsd: '8.062211',
    rate: '5.364547',
    fixedFeeBrl: '0.75',
    arrivalEstimateSeconds: 60,
    provider: 'Avenia',
}

function renderScan() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const tree = () => (
        <IntlWrapper>
            <NuqsTestingAdapter>
                <QueryClientProvider client={queryClient}>
                    <LoadingStateContextProvider>
                        <QrPayPage qrCode={PIX_CODE} timestamp="1" qrType="PIX" />
                    </LoadingStateContextProvider>
                </QueryClientProvider>
            </NuqsTestingAdapter>
        </IntlWrapper>
    )
    const rendered = render(tree())
    return {
        rerouted: (routes: Array<Record<string, unknown>>) => {
            mockRoutes = routes
            rendered.rerender(tree())
        },
    }
}

beforeEach(() => {
    jest.clearAllMocks()
    mockSurface = null
    fakeClient = makeFakeClient()
    mockUseWallet.mockReturnValue({
        address: ACCOUNT,
        balance: 100_000_000n,
        spendableBalance: 100_000_000n,
        sendTransactions: jest.fn(),
    })
    ;(resolveSpendStrategy as jest.Mock).mockResolvedValue({ strategy: 'smart-only', smartBalance: 100_000_000n })
    ;(runCollateralSpendPreflight as jest.Mock).mockImplementation(async ({ kernelClient }) => kernelClient)
    mockGetCurrencyPrice.mockResolvedValue({ sell: 5.27, buy: 5.3 })
    mockEntry = undefined
    mockPixBlock = null
    mockMantecaApi.initiateQrPayment.mockResolvedValue(mantecaPixLock())
})

async function payOnManteca(status: string) {
    mockRoutes = [payRoute('manteca')]
    mockMantecaApi.completeQrPaymentWithSignedTx.mockResolvedValue(mantecaPayment(status))
    const scan = renderScan()
    await screen.findByText('Payment form')
    await act(async () => {
        await mockSurface!.payQR()
    })
    return scan
}

describe('a Manteca payment keeps its screen when the pay route moves to the Pix pay routes', () => {
    it.each([
        ['ready on Avenia', [payRoute('avenia')]],
        ['asking to activate Avenia', [payRoute('avenia', ACTIVATE)]],
    ])('paid, then the route is %s: the success stays, and nothing is reviewed or opened', async (_label, routes) => {
        const scan = await payOnManteca('COMPLETED')
        expect(await screen.findByText('Payment success')).toBeInTheDocument()

        scan.rerouted(routes)
        await act(async () => {})

        expect(screen.getByText('Payment success')).toBeInTheDocument()
        expect(screen.queryByText('Payment form')).not.toBeInTheDocument()
        expect(screen.queryByText('Pix setup')).not.toBeInTheDocument()
        expect(mockPixApi.previewPayment).not.toHaveBeenCalled()
        expect(mockPixApi.openPayment).not.toHaveBeenCalled()
    })

    it('still processing, then the route is ready on Avenia: the status stays, Pay is not offered', async () => {
        const scan = await payOnManteca('ACTIVE')
        expect(await screen.findByText('Payment status')).toBeInTheDocument()

        scan.rerouted([payRoute('avenia')])
        await act(async () => {})

        expect(screen.getByText('Payment status')).toBeInTheDocument()
        expect(screen.queryByText('Payment form')).not.toBeInTheDocument()
        expect(mockPixApi.previewPayment).not.toHaveBeenCalled()
    })

    // Chip on 7462f26c9: a signature that surely sent nothing releases the pin
    it('a dismissed passkey sent nothing: a route that moves to Avenia is followed', async () => {
        mockRoutes = [payRoute('manteca')]
        const dismissed = new Error('The operation either timed out or was not allowed.')
        dismissed.name = 'NotAllowedError'
        fakeClient.account.signUserOperation.mockRejectedValue(dismissed)
        const scan = renderScan()
        await screen.findByText('Payment form')
        await act(async () => {
            await mockSurface!.payQR()
        })
        expect(mockMantecaApi.completeQrPaymentWithSignedTx).not.toHaveBeenCalled()

        scan.rerouted([payRoute('avenia', ACTIVATE)])

        expect(await screen.findByText('Pix setup')).toBeInTheDocument()
    })

    it('a send whose outcome is unknown keeps the flow on Manteca when the route moves', async () => {
        mockRoutes = [payRoute('manteca')]
        mockMantecaApi.completeQrPaymentWithSignedTx.mockRejectedValue(new Error('socket hang up'))
        const scan = renderScan()
        await screen.findByText('Payment form')
        await act(async () => {
            await mockSurface!.payQR()
        })
        expect(mockMantecaApi.completeQrPaymentWithSignedTx).toHaveBeenCalledTimes(1)

        scan.rerouted([payRoute('avenia', ACTIVATE)])
        await act(async () => {})

        expect(screen.queryByText('Pix setup')).not.toBeInTheDocument()
        expect(screen.getByText('Payment form')).toBeInTheDocument()
        expect(mockPixApi.previewPayment).not.toHaveBeenCalled()
    })

    it('before any signature, the route still decides: the page follows it', async () => {
        mockRoutes = [payRoute('manteca')]
        const scan = renderScan()
        await screen.findByText('Payment form')

        scan.rerouted([payRoute('avenia', ACTIVATE)])

        expect(await screen.findByText('Pix setup')).toBeInTheDocument()
    })
})

describe('a Pix payment that is opening keeps its processor when the route moves to Manteca', () => {
    it("Manteca's init is never called while the open is in flight", async () => {
        mockRoutes = [payRoute('avenia')]
        mockPixApi.previewPayment.mockResolvedValue(review)
        mockPixApi.openPayment.mockReturnValue(new Promise(() => {}))
        const scan = renderScan()
        await screen.findByText('Payment form')
        await waitFor(() => expect(mockPixApi.previewPayment).toHaveBeenCalled())

        act(() => {
            void mockSurface!.payQR()
        })
        await waitFor(() => expect(mockPixApi.openPayment).toHaveBeenCalledTimes(1))
        scan.rerouted([payRoute('manteca')])
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 50))
        })

        expect(mockMantecaApi.initiateQrPayment).not.toHaveBeenCalled()
    })
})

// Aleks, 2026-11-15 (staging, Avenia): the "Payment is processing … Check Activity" card showed behind the
// passkey prompt. While this page waits for the passkey on the payment it just opened, the review stays
// with Pay loading; the processing screen follows the signature; a dismissed passkey leaves Pay usable.
describe('an Avenia payment waits on its review while the passkey is open', () => {
    const USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
    const opened = {
        provider: 'avenia',
        intentId: 'pay-1',
        display: review,
        sign: {
            kind: 'deposit-with-id',
            contractAddress: '0x10417734001162Ea139e8b044DFe28DbB8B28ad0',
            tokenAddress: USDC,
            payAmount: review.withdrawUsd,
            payAmountUnits: '8062211',
            commitmentId: '6aeb17ea29f84d1e9b0c3a5d7e2f1c08',
            quoteExpiresAt: new Date(Date.now() + 60_000).toISOString(),
            ticketExpiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
    }
    const surface = () => mockSurface as unknown as { isLoading: boolean; loadingState: string; errorMessage: string }
    let resolveSignature: (result: unknown) => void
    let rejectSignature: (error: Error) => void
    const sendTransactions = jest.fn()

    beforeEach(() => {
        localStorage.clear()
        sessionStorage.clear()
        mockRoutes = [payRoute('avenia')]
        mockPixApi.previewPayment.mockResolvedValue(review)
        mockPixApi.openPayment.mockResolvedValue(opened)
        mockPixApi.readPayment.mockResolvedValue({ provider: 'avenia', intentId: 'pay-1', state: 'processing' })
        mockPixApi.reportPaymentFunding.mockResolvedValue({ status: 'PROCESSING' })
        sendTransactions.mockReset()
        sendTransactions.mockImplementation(
            () =>
                new Promise((resolve, reject) => {
                    resolveSignature = resolve
                    rejectSignature = reject
                })
        )
        mockUseWallet.mockReturnValue({
            address: ACCOUNT,
            balance: 100_000_000n,
            spendableBalance: 100_000_000n,
            sendTransactions,
        })
    })

    const tapPay = async () => {
        renderScan()
        await screen.findByText('Payment form')
        await waitFor(() => expect(mockPixApi.previewPayment).toHaveBeenCalled())
        let payment!: Promise<void>
        act(() => {
            payment = mockSurface!.payQR()
        })
        await waitFor(() => expect(sendTransactions).toHaveBeenCalledTimes(1))
        // wrapped: an async function returning the pending payment would wait for it
        return { payment }
    }

    it('keeps the review with Pay loading until the passkey answers, then shows the processing screen', async () => {
        const { payment } = await tapPay()
        // the passkey prompt is open: the review stays, Pay is loading, no status card and no read yet
        expect(screen.getByText('Payment form')).toBeInTheDocument()
        expect(screen.queryByText('Payment status')).toBeNull()
        expect(surface().isLoading).toBe(true)
        expect(surface().loadingState).toBe('Approve transaction')
        expect(mockPixApi.readPayment).not.toHaveBeenCalled()

        await act(async () => {
            resolveSignature({ receipt: { status: 'success', transactionHash: `0x${'ab'.repeat(32)}`, logs: [] } })
            await payment
        })
        expect(await screen.findByText('Processing payment')).toBeInTheDocument()
        expect(screen.queryByText('Payment status')).toBeNull()
        expect(mockPixApi.reportPaymentFunding).toHaveBeenCalledWith('pay-1', `0x${'ab'.repeat(32)}`)
    })

    // Chip on ui#4106: while the passkey is open the payment read is off, so the provider must come from
    // the open, or the review falls back to the all-in rate and the flat fee and loses its provider row
    it('keeps Avenia’s rate, its fee and the provider row on the review while the passkey is open', async () => {
        const priced = { ...review, exchangeRate: '5.400000', providerFeeBrl: '1.04' }
        mockPixApi.previewPayment.mockResolvedValue(priced)
        mockPixApi.openPayment.mockResolvedValue({ ...opened, display: priced })
        const rows = () =>
            mockSurface as unknown as {
                providerId: string | null
                shownRate: number | null
                hideRate: boolean
                providerFee: string | null
            }
        renderScan()
        await screen.findByText('Payment form')
        await waitFor(() => expect(rows().shownRate).toBe(5.4))
        const before = { ...rows() }
        expect(before).toMatchObject({ providerId: 'avenia-br', hideRate: false, providerFee: 'R$1.04' })

        act(() => {
            void mockSurface!.payQR()
        })
        await waitFor(() => expect(sendTransactions).toHaveBeenCalledTimes(1))
        // the passkey prompt is open: the same figures and the same provider
        expect(surface().loadingState).toBe('Approve transaction')
        expect(rows().providerId).toBe('avenia-br')
        expect(rows().shownRate).toBe(5.4)
        expect(rows().hideRate).toBe(false)
        expect(rows().providerFee).toBe('R$1.04')
    })

    it('a dismissed passkey returns to a usable review, and the next tap signs the same payment', async () => {
        const { payment } = await tapPay()
        const dismissed = Object.assign(new Error('The operation either timed out or was not allowed.'), {
            name: 'NotAllowedError',
        })
        await act(async () => {
            rejectSignature(dismissed)
            await payment
        })
        expect(screen.getByText('Payment form')).toBeInTheDocument()
        expect(screen.queryByText('Payment status')).toBeNull()
        expect(surface().isLoading).toBe(false)
        expect(surface().errorMessage).toBeTruthy()

        let retry!: Promise<void>
        act(() => {
            retry = mockSurface!.payQR()
        })
        await waitFor(() => expect(sendTransactions).toHaveBeenCalledTimes(2))
        // one key per scan and amount: the API answers the same payment, and nothing new is opened
        const [first, second] = mockPixApi.openPayment.mock.calls.map(([request]) => request.idempotencyKey)
        expect(second).toBe(first)
        await act(async () => {
            resolveSignature({ receipt: { status: 'success', transactionHash: `0x${'cd'.repeat(32)}`, logs: [] } })
            await retry
        })
        expect(mockPixApi.reportPaymentFunding).toHaveBeenCalledTimes(1)
        expect(mockPixApi.reportPaymentFunding).toHaveBeenCalledWith('pay-1', `0x${'cd'.repeat(32)}`)
    })
})

// An Avenia QR review shows the review's rate and fee rows (TASK-24967: the variable fees in the rate, the
// flat fee as the row), or neither row; never the market rate. The pair below differs from the legacy
// `rate` and `fixedFeeBrl` on purpose, to prove which fields the flow reads. Manteca's QR form is unchanged.
describe("an Avenia QR review shows the review's rate and fee rows", () => {
    const rows = () =>
        mockSurface as unknown as { shownRate: number | null; hideRate: boolean; providerFee: string | null }

    beforeEach(() => {
        mockRoutes = [payRoute('avenia')]
    })

    it('the review’s exchangeRate and providerFeeBrl, not the legacy rate and fixedFeeBrl', async () => {
        // 8.062211 × 5.40 − 1.04 = R$42.50
        mockPixApi.previewPayment.mockResolvedValue({ ...review, exchangeRate: '5.400000', providerFeeBrl: '1.04' })
        renderScan()
        await screen.findByText('Payment form')
        await waitFor(() => expect(rows().shownRate).toBe(5.4))
        expect(rows().hideRate).toBe(false)
        expect(rows().providerFee).toBe('R$1.04')
    })

    it('neither row when the review carries no pair', async () => {
        mockPixApi.previewPayment.mockResolvedValue(review)
        renderScan()
        await screen.findByText('Payment form')
        await waitFor(() => expect(mockPixApi.previewPayment).toHaveBeenCalled())
        await waitFor(() => expect(rows().hideRate).toBe(true))
        expect(rows().providerFee).toBeNull()
    })
})
