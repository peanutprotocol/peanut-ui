/**
 * useQrPayFlowController — hook integration for the pre-Pay UserOp
 * preparation and the `qr_payment_stage` telemetry (TASK-22692).
 *
 * The flow controller, useSmartSpendPreparation, useSignSpendBundle and
 * useSignUserOp are REAL; the kernel client, live routing, Rain and the
 * Manteca API are faked at their boundaries. Contracts:
 *  1. mounting on a locked amount prepares the unsigned op once — no
 *     signature, no Rain draft, no completion call, no telemetry,
 *  2. Pay routes on the LIVE strategy, signs exactly once, reuses the
 *     candidate only for smart-only, and sends the attempt id with the request,
 *  3. the stage sequence is complete and ordered on success; failures,
 *     cancellations, pending and unknown outcomes are reported truthfully and
 *     never as success,
 *  4. open-amount QRs mint the attempt id BEFORE the amount init and take
 *     the full path.
 */
import React from 'react'
import posthog from 'posthog-js'
import { act, render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'

const ACCOUNT = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const PAYMASTER = '0x2a1c0c8d0c0f0c8d0c0f0c8d0c0f0c8d0c0f0c8d'
const SERVED_DEPOSIT = '0x49200bF84dC26349C86ce040019063FeCE88CB1c'
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/qr-pay',
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '/mp.png', PIX: '/pix.png' }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1', username: 'tester' } }, fetchUser: jest.fn() }),
}))
const mockUseWallet = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => mockUseWallet() }))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({ overview: { cards: [], balance: { spendingPower: 0 } } }),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('@/hooks/wallet/useStaleSessionGuard', () => ({ useStaleSessionGuard: () => () => false }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/usePointsCalculation', () => ({
    usePointsCalculation: () => ({ pointsData: null, pointsDivRef: { current: null } }),
}))
jest.mock('@/hooks/usePointsConfetti', () => ({ usePointsConfetti: jest.fn() }))
jest.mock('@/hooks/useAppReviewNudge', () => ({ useAppReviewNudge: jest.fn() }))
jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    default: { disabledPaymentProviders: [] as string[] },
}))
jest.mock('@/services/services.types', () => ({ PointsAction: { MANTECA_QR_PAYMENT: 'manteca_qr_payment' } }))
jest.mock('@/app/actions/currency', () => ({ getCurrencyPrice: jest.fn(async () => ({ sell: 1200, buy: 1250 })) }))
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
jest.mock('@/utils/rainWithdraw.utils', () => ({ buildRainWithdrawTypedData: jest.fn(() => ({})) }))
jest.mock('@/services/rain', () => ({ rainApi: { prepareWithdrawal: jest.fn(), cancelPreparation: jest.fn() } }))
jest.mock('@/hooks/wallet/spendPreflight', () => ({
    ...jest.requireActual('@/hooks/wallet/spendPreflight'),
    resolveSpendStrategy: jest.fn(),
    runCollateralSpendPreflight: jest.fn(),
}))
jest.mock('@/utils/webauthn.utils', () => ({ capturePasskeySignFailure: jest.fn() }))
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

import { resolveSpendStrategy, runCollateralSpendPreflight } from '@/hooks/wallet/spendPreflight'
import { rainApi } from '@/services/rain'
import { LoadingStateContextProvider } from '@/context/loadingStates.context'
import { QrPayFlowProvider, useQrPayFlow } from '../QrPayFlowContext'
import type { QrPayFlowSurface } from '../useQrPayFlow'

const mockResolveSpendStrategy = resolveSpendStrategy as jest.Mock
const mockPreflight = runCollateralSpendPreflight as jest.Mock
const mockPrepareWithdrawal = rainApi.prepareWithdrawal as jest.Mock
const mockCapture = posthog.capture as jest.Mock

const RAIN_PREP = {
    preparationId: 'prep-1',
    coordinatorAddress: '0xc0d5bd6307ec8c8da03e7502a00b8cba24eefc06',
    collateralProxy: '0x1111111111111111111111111111111111111111',
    adminAddress: ACCOUNT,
    chainId: '42161',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    amount: '5000000',
    recipientAddress: ACCOUNT,
    directTransfer: false,
    adminSalt: `0x${'3'.repeat(64)}`,
    adminNonce: '1',
    executorSignature: '0x44',
    executorSalt: `0x${'5'.repeat(64)}`,
    expiresAt: 1234567890,
    mixedSpendContract: undefined,
}

function lockFixture(overrides: Record<string, unknown> = {}) {
    return {
        code: 'LOCK123',
        type: 'QR3_PAYMENT',
        companyId: 'c1',
        userId: 'u1',
        userNumberId: 'un1',
        userExternalId: 'ue1',
        paymentRecipientName: 'Test Merchant',
        paymentRecipientLegalId: 'legal1',
        paymentAssetAmount: '12000',
        paymentAsset: 'ARS',
        paymentPrice: '1200',
        paymentAgainstAmount: '10',
        paymentAgainst: 'USD',
        expireAt: new Date(Date.now() + 120_000).toISOString(),
        creationTime: new Date().toISOString(),
        depositAddress: SERVED_DEPOSIT,
        ...overrides,
    }
}

function paymentFixture(overrides: Record<string, unknown> = {}) {
    return {
        id: 'qp1',
        externalId: 'ext1',
        sessionId: 's1',
        status: 'COMPLETED',
        currentStage: 'done',
        stages: [],
        type: 'QR3_PAYMENT',
        details: {
            depositAddress: SERVED_DEPOSIT,
            paymentAsset: 'ARS',
            paymentAgainst: 'USD',
            paymentAgainstAmount: '10',
            paymentAssetAmount: '12000',
            paymentPrice: '1200',
            priceExpireAt: new Date(Date.now() + 120_000).toISOString(),
            merchant: { name: 'Test Merchant' },
        },
        ...overrides,
    }
}

let surface: QrPayFlowSurface | null = null
function Probe() {
    surface = useQrPayFlow()
    return null
}

function renderFlow(
    scan: { qrCode: string; timestamp: string | null; qrType: string | null } = {
        qrCode: 'mercadopago://pay?id=123',
        timestamp: '1',
        qrType: 'MERCADO_PAGO',
    },
    options: { strict?: boolean } = {}
) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const tree = (
        <IntlWrapper>
            <QueryClientProvider client={queryClient}>
                <LoadingStateContextProvider>
                    <QrPayFlowProvider {...scan}>
                        <Probe />
                    </QrPayFlowProvider>
                </LoadingStateContextProvider>
            </QueryClientProvider>
        </IntlWrapper>
    )
    return render(options.strict ? <React.StrictMode>{tree}</React.StrictMode> : tree)
}

async function waitForLockedForm() {
    await waitFor(() => {
        expect(surface?.paymentLock).not.toBeNull()
        expect(surface?.currencyAmount).toBeTruthy()
    })
}

async function waitForWarmup() {
    await waitFor(() => expect(fakeClient.prepareUserOperation).toHaveBeenCalledTimes(1))
}

async function pay() {
    await act(async () => {
        await surface!.payQR()
    })
}

const stages = () => mockCapture.mock.calls.filter(([event]) => event === 'qr_payment_stage').map(([, props]) => props)
const stageOutline = () => stages().map((s) => [s.stage, s.outcome ?? null])
const completionBody = () => mockMantecaApi.completeQrPaymentWithSignedTx.mock.calls[0][0]

function expectNoSuccessReported() {
    expect(stages().some((s) => s.stage === 'success_committed')).toBe(false)
    expect(stages().filter((s) => s.stage === 'attempt_finished')).toHaveLength(1)
    expect(stages().find((s) => s.stage === 'attempt_finished')?.outcome).not.toBe('success')
    expect(mockCapture).not.toHaveBeenCalledWith('card_withdraw_succeeded', expect.anything())
}

beforeEach(() => {
    jest.clearAllMocks()
    surface = null
    fakeClient = makeFakeClient()
    mockUseWallet.mockReturnValue({ address: ACCOUNT, balance: 100_000_000n, spendableBalance: 100_000_000n })
    mockResolveSpendStrategy.mockResolvedValue({ strategy: 'smart-only', smartBalance: 100_000_000n })
    mockPreflight.mockImplementation(async ({ kernelClient }) => kernelClient)
    mockPrepareWithdrawal.mockResolvedValue(RAIN_PREP)
    mockMantecaApi.initiateQrPayment.mockResolvedValue(lockFixture())
    mockMantecaApi.completeQrPaymentWithSignedTx.mockResolvedValue(paymentFixture())
})

describe('warmup on a locked amount', () => {
    test('prepares the unsigned op once: no signature, no Rain draft, no completion, no telemetry', async () => {
        renderFlow()
        await waitForLockedForm()
        await waitForWarmup()

        expect(fakeClient.account.encodeCalls).toHaveBeenCalledTimes(1)
        expect(fakeClient.account.signUserOperation).not.toHaveBeenCalled()
        expect(fakeClient.account.signTypedData).not.toHaveBeenCalled()
        expect(mockPrepareWithdrawal).not.toHaveBeenCalled()
        expect(mockGrant).not.toHaveBeenCalled()
        expect(mockMantecaApi.completeQrPaymentWithSignedTx).not.toHaveBeenCalled()
        // only the scan's init — the warmup creates no Manteca synthetic
        expect(mockMantecaApi.initiateQrPayment).toHaveBeenCalledTimes(1)
        expect(stages()).toEqual([])
        expect(mockCapture).not.toHaveBeenCalledWith('card_withdraw_attempted', expect.anything())
        expect(surface?.view).toBe('FORM')
    })

    test('StrictMode replay does not prepare twice', async () => {
        renderFlow(undefined, { strict: true })
        await waitForLockedForm()
        await waitForWarmup()
        await act(async () => {})
        expect(fakeClient.prepareUserOperation).toHaveBeenCalledTimes(1)
        expect(fakeClient.account.signUserOperation).not.toHaveBeenCalled()
    })

    test('a cached smart balance below the amount skips the warmup (candidate could never be smart-only)', async () => {
        mockUseWallet.mockReturnValue({ address: ACCOUNT, balance: 1_000_000n, spendableBalance: 100_000_000n })
        renderFlow()
        await waitForLockedForm()
        await act(async () => {})
        expect(fakeClient.prepareUserOperation).not.toHaveBeenCalled()
    })
})

describe('Pay on a locked amount', () => {
    test('smart-only: signs the warmed candidate once with a fresh sponsorship and reports every stage in order', async () => {
        renderFlow()
        await waitForLockedForm()
        await waitForWarmup()
        await pay()

        expect(fakeClient.prepareUserOperation).toHaveBeenCalledTimes(1)
        expect(fakeClient.account.getNonce).toHaveBeenCalledTimes(1)
        expect(fakeClient.paymaster.getPaymasterData).toHaveBeenCalledTimes(1)
        expect(fakeClient.account.signUserOperation).toHaveBeenCalledTimes(1)
        expect(mockPrepareWithdrawal).not.toHaveBeenCalled()

        const body = completionBody()
        expect(body.kind).toBe('userOp')
        expect(body.paymentLockCode).toBe('LOCK123')
        expect(body.clientPaymentAttemptId).toMatch(UUID_V4)
        expect(body.signedUserOp).toMatchObject({ nonce: 7n, paymasterData: '0xf00d', signature: '0x51' })

        await waitFor(() => expect(surface?.isSuccess).toBe(true))
        expect(surface?.view).toBe('SUCCESS')

        expect(stageOutline()).toEqual([
            ['pay_clicked', null],
            ['lock_ready', 'success'],
            ['strategy_ready', null],
            ['preflight_ready', null],
            ['signing_preparation_ready', null],
            ['signature_ready', 'success'],
            ['request_sent', null],
            ['response_received', 'success'],
            ['success_committed', 'success'],
            ['attempt_finished', 'success'],
        ])
        const events = stages()
        expect(new Set(events.map((s) => s.client_payment_attempt_id))).toEqual(new Set([body.clientPaymentAttemptId]))
        expect(events.every((s) => s.schema_version === 1 && s.source === 'client' && s.qr_type === 'QR3')).toBe(true)
        const elapsed = events.map((s) => s.elapsed_ms as number)
        expect(elapsed.every((v, i) => i === 0 || v >= elapsed[i - 1])).toBe(true)
        expect(events.find((s) => s.stage === 'strategy_ready')).toMatchObject({ strategy: 'smart-only' })
        expect(events.find((s) => s.stage === 'attempt_finished')).toMatchObject({ strategy: 'smart-only' })
        expect(events.find((s) => s.stage === 'signing_preparation_ready')).toMatchObject({ preparation: 'reused' })
        // no payload leaks: none of the bounded events carries anything else
        for (const event of events) {
            expect(Object.keys(event).sort()).toEqual(
                expect.arrayContaining(['client_payment_attempt_id', 'elapsed_ms', 'schema_version', 'source', 'stage'])
            )
            expect(
                Object.keys(event).every((k) =>
                    [
                        'schema_version',
                        'client_payment_attempt_id',
                        'source',
                        'stage',
                        'elapsed_ms',
                        'qr_type',
                        'strategy',
                        'outcome',
                        'preparation',
                    ].includes(k)
                )
            ).toBe(true)
        }
        // the historical funnel event is untouched
        expect(mockCapture).toHaveBeenCalledWith('card_withdraw_succeeded', {
            strategy: 'smart-only',
            kind: 'QR_PAY',
            flow: 'sign-only',
        })
    })

    test('nonce moved since warmup: rebuilds the op and still signs exactly once', async () => {
        renderFlow()
        await waitForLockedForm()
        await waitForWarmup()
        fakeClient.account.getNonce.mockResolvedValue(8n)
        await pay()

        expect(fakeClient.prepareUserOperation).toHaveBeenCalledTimes(2)
        expect(fakeClient.account.signUserOperation).toHaveBeenCalledTimes(1)
        expect(stages().find((s) => s.stage === 'signing_preparation_ready')).toMatchObject({ preparation: 'fresh' })
        await waitFor(() => expect(surface?.isSuccess).toBe(true))
    })

    test('warmup failed: Pay takes the original path untouched', async () => {
        fakeClient.prepareUserOperation.mockRejectedValueOnce(new Error('paymaster: policy exhausted'))
        renderFlow()
        await waitForLockedForm()
        await waitForWarmup()
        await pay()

        expect(fakeClient.prepareUserOperation).toHaveBeenCalledTimes(2)
        expect(fakeClient.account.getNonce).not.toHaveBeenCalled()
        expect(fakeClient.account.signUserOperation).toHaveBeenCalledTimes(1)
        expect(stages().find((s) => s.stage === 'signing_preparation_ready')).toMatchObject({ preparation: 'fresh' })
        await waitFor(() => expect(surface?.isSuccess).toBe(true))
    })

    test('live routing picks mixed: the candidate is ignored and the Rain draft + batched op are built at Pay', async () => {
        mockResolveSpendStrategy.mockResolvedValue({ strategy: 'mixed', smartBalance: 5_000_000n })
        renderFlow()
        await waitForLockedForm()
        await waitForWarmup()
        await pay()

        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
        expect(fakeClient.account.signTypedData).toHaveBeenCalledTimes(1)
        // the smart-only candidate never enters the mixed path
        expect(fakeClient.account.getNonce).not.toHaveBeenCalled()
        expect(fakeClient.prepareUserOperation).toHaveBeenCalledTimes(2)
        expect(fakeClient.account.signUserOperation).toHaveBeenCalledTimes(1)
        expect(completionBody()).toMatchObject({ kind: 'userOp', rainPreparationId: 'prep-1' })
        expect(stages().find((s) => s.stage === 'strategy_ready')).toMatchObject({ strategy: 'mixed' })
        expect(stages().find((s) => s.stage === 'signing_preparation_ready')).toMatchObject({ preparation: 'fresh' })
        await waitFor(() => expect(surface?.isSuccess).toBe(true))
    })

    test('passkey dismissed: cancelled, nothing sent, no success', async () => {
        fakeClient.account.signUserOperation.mockRejectedValue(new Error('User action is not allowed'))
        renderFlow()
        await waitForLockedForm()
        await waitForWarmup()
        await pay()

        expect(mockMantecaApi.completeQrPaymentWithSignedTx).not.toHaveBeenCalled()
        expect(stageOutline().slice(-2)).toEqual([
            ['signature_ready', 'cancelled'],
            ['attempt_finished', 'cancelled'],
        ])
        expect(stages().some((s) => s.stage === 'request_sent')).toBe(false)
        expectNoSuccessReported()
        expect(surface?.isSuccess).toBe(false)
        expect(surface?.errorMessage).toBeTruthy()
    })

    test('a 200 with a non-terminal status is pending, not success', async () => {
        mockMantecaApi.completeQrPaymentWithSignedTx.mockResolvedValue(paymentFixture({ status: 'ACTIVE' }))
        renderFlow()
        await waitForLockedForm()
        await waitForWarmup()
        await pay()

        expect(stageOutline().slice(-2)).toEqual([
            ['response_received', 'success'],
            ['attempt_finished', 'pending'],
        ])
        expectNoSuccessReported()
        expect(surface?.isSuccess).toBe(false)
        expect(surface?.view).toBe('STATUS')
    })

    test('a 200 CANCELLED is cancelled', async () => {
        mockMantecaApi.completeQrPaymentWithSignedTx.mockResolvedValue(paymentFixture({ status: 'CANCELLED' }))
        renderFlow()
        await waitForLockedForm()
        await waitForWarmup()
        await pay()
        expect(stageOutline().slice(-1)).toEqual([['attempt_finished', 'cancelled']])
        expectNoSuccessReported()
    })

    test('an unclassified submit error: the response is HTTP-failed, the attempt outcome is unknown', async () => {
        mockMantecaApi.completeQrPaymentWithSignedTx.mockRejectedValue(new Error('boom'))
        renderFlow()
        await waitForLockedForm()
        await waitForWarmup()
        await pay()

        expect(stageOutline().slice(-3)).toEqual([
            ['request_sent', null],
            ['response_received', 'failed'],
            ['attempt_finished', 'unknown'],
        ])
        expectNoSuccessReported()
        expect(surface?.errorMessage).toBeTruthy()
    })

    test('a deterministic rejection (nonce) is failed', async () => {
        mockMantecaApi.completeQrPaymentWithSignedTx.mockRejectedValue(new Error('AA25 invalid account nonce'))
        renderFlow()
        await waitForLockedForm()
        await waitForWarmup()
        await pay()
        expect(stageOutline().slice(-1)).toEqual([['attempt_finished', 'failed']])
        expectNoSuccessReported()
    })

    test('a transport failure after the request left: no response stage at all, outcome unknown', async () => {
        const timeout = new Error('timed out')
        timeout.name = 'ConnectionTimeoutError'
        mockMantecaApi.completeQrPaymentWithSignedTx.mockRejectedValue(timeout)
        renderFlow()
        await waitForLockedForm()
        await waitForWarmup()
        await pay()

        expect(stageOutline().slice(-2)).toEqual([
            ['request_sent', null],
            ['attempt_finished', 'unknown'],
        ])
        expect(stages().some((s) => s.stage === 'response_received')).toBe(false)
        expectNoSuccessReported()
    })
})

describe('open-amount QR (no lock until Pay)', () => {
    test('nothing is warmed up; the attempt id is minted before the amount init and the full path signs once', async () => {
        mockMantecaApi.initiateQrPayment.mockResolvedValueOnce(lockFixture({ code: '', paymentAgainstAmount: '0' }))
        renderFlow()
        await waitFor(() => expect(surface?.paymentLock).not.toBeNull())
        await act(async () => {
            surface!.handleCurrencyAmountChange('5000')
        })
        await waitFor(() => expect(surface?.currencyAmount).toBe('5000'))
        expect(fakeClient.prepareUserOperation).not.toHaveBeenCalled()

        mockMantecaApi.initiateQrPayment.mockResolvedValueOnce(lockFixture({ paymentAgainstAmount: '4.17' }))
        await pay()

        expect(mockMantecaApi.initiateQrPayment).toHaveBeenCalledTimes(2)
        expect(mockMantecaApi.initiateQrPayment.mock.calls[1][0]).toMatchObject({ amount: '5000' })
        // pay_clicked was captured before the amount init was requested
        const payClickedOrder =
            mockCapture.mock.invocationCallOrder[
                mockCapture.mock.calls.findIndex(([e, p]) => e === 'qr_payment_stage' && p.stage === 'pay_clicked')
            ]
        expect(payClickedOrder).toBeLessThan(mockMantecaApi.initiateQrPayment.mock.invocationCallOrder[1])

        expect(fakeClient.prepareUserOperation).toHaveBeenCalledTimes(1)
        expect(fakeClient.account.signUserOperation).toHaveBeenCalledTimes(1)
        expect(stageOutline().slice(0, 2)).toEqual([
            ['pay_clicked', null],
            ['lock_ready', 'success'],
        ])
        expect(stages().find((s) => s.stage === 'signing_preparation_ready')).toMatchObject({ preparation: 'fresh' })
        expect(completionBody().clientPaymentAttemptId).toBe(stages()[0].client_payment_attempt_id)
        await waitFor(() => expect(surface?.isSuccess).toBe(true))
    })

    test('the amount init is refused: lock_ready failed, attempt failed, nothing signed', async () => {
        mockMantecaApi.initiateQrPayment.mockResolvedValueOnce(lockFixture({ code: '', paymentAgainstAmount: '0' }))
        renderFlow()
        await waitFor(() => expect(surface?.paymentLock).not.toBeNull())
        await act(async () => {
            surface!.handleCurrencyAmountChange('5000')
        })
        await waitFor(() => expect(surface?.currencyAmount).toBe('5000'))

        mockMantecaApi.initiateQrPayment.mockRejectedValueOnce(new Error('init failed'))
        await pay()

        expect(stageOutline()).toEqual([
            ['pay_clicked', null],
            ['lock_ready', 'failed'],
            ['attempt_finished', 'failed'],
        ])
        expect(fakeClient.account.signUserOperation).not.toHaveBeenCalled()
        expect(mockMantecaApi.completeQrPaymentWithSignedTx).not.toHaveBeenCalled()
    })
})
