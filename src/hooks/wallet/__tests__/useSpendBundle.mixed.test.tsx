/**
 * The mixed spend's one-tap branch (SESSION_KEY_SPEND) is production-reachable
 * once the flag is on. These pin the two money-critical invariants: a settled
 * ephemeral op is what gets returned and stamped, and a failed attempt falls
 * back to the passkey path with the SAME Rain preparation — never a second one.
 */
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import posthog from 'posthog-js'
import { useSpendBundle } from '../useSpendBundle'
import { resolveSpendStrategy, runCollateralSpendPreflight } from '../spendPreflight'
import { tryMixedEphemeralSpend } from '../mixedEphemeralSpend'
import { rainApi } from '@/services/rain'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const ACCOUNT = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const RECIPIENT = '0x4e5b89fd498f333ed7f2a59c5f23d5b5dc41b3de'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
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
const mockSignTypedData = jest.fn()
const mockGetPatchedSudoValidator = jest.fn(async () => ({ validator: 'patched' }))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        getClientForChain: () => ({ account: { address: ACCOUNT, signTypedData: mockSignTypedData } }),
        rebuildClientForChain: jest.fn(),
        getPatchedSudoValidator: () => mockGetPatchedSudoValidator(),
    }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            accounts: [
                { type: jest.requireActual('@/interfaces/interfaces').AccountType.PEANUT_WALLET, identifier: ACCOUNT },
            ],
        },
    }),
}))
const mockSendUserOp = jest.fn()
jest.mock('@/hooks/useZeroDev', () => ({ useZeroDev: () => ({ handleSendUserOpEncoded: mockSendUserOp }) }))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: { cards: [] } }) }))
jest.mock('../useGrantSessionKey', () => ({ useGrantSessionKey: () => ({ grant: jest.fn() }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContextOptional: () => undefined }))
jest.mock('@/utils/rainWithdraw.utils', () => ({ buildRainWithdrawTypedData: jest.fn(() => ({})) }))
jest.mock('@/services/rain', () => ({
    rainApi: { prepareWithdrawal: jest.fn(), stampWithdrawal: jest.fn(async () => undefined) },
}))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: { tag: 'public' } }))
const mockSessionKeySpendEnabled = jest.fn(() => false)
jest.mock('@/constants/session-key-spend.consts', () => ({
    sessionKeySpendEnabled: () => mockSessionKeySpendEnabled(),
}))
jest.mock('../mixedEphemeralSpend', () => ({ tryMixedEphemeralSpend: jest.fn() }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/utils/demo-balance', () => ({ debitDemoBalance: jest.fn() }))
jest.mock('../spendPreflight', () => ({
    ...jest.requireActual('../spendPreflight'),
    resolveSpendStrategy: jest.fn(),
    runCollateralSpendPreflight: jest.fn(),
}))

const mockResolveSpendStrategy = resolveSpendStrategy as jest.Mock
const mockPreflight = runCollateralSpendPreflight as jest.Mock
const mockPrepareWithdrawal = rainApi.prepareWithdrawal as jest.Mock
const mockStampWithdrawal = rainApi.stampWithdrawal as jest.Mock
const mockEphemeral = tryMixedEphemeralSpend as jest.Mock
const mockCapture = posthog.capture as jest.Mock

const PREP = {
    preparationId: 'prep-1',
    coordinatorAddress: '0xc0d5bd6307ec8c8da03e7502a00b8cba24eefc06',
    collateralProxy: '0x1111111111111111111111111111111111111111',
    adminAddress: ACCOUNT,
    chainId: '42161',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    amount: '100000000',
    recipientAddress: ACCOUNT,
    directTransfer: false,
    adminSalt: '0x3333333333333333333333333333333333333333333333333333333333333333',
    adminNonce: '1',
    executorSignature: '0x44',
    executorSalt: '0x5555555555555555555555555555555555555555555555555555555555555555',
    expiresAt: 1234567890,
}
const SETTLED_RECEIPT = { transactionHash: '0xsettled', success: true }

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

async function spendMixed() {
    const { result } = renderHook(() => useSpendBundle(), { wrapper })
    let outcome: Awaited<ReturnType<typeof result.current.spend>> | undefined
    await act(async () => {
        outcome = await result.current.spend({
            requiredUsdcAmount: 150_000_000n, // $150: $50 smart + $100 collateral
            recipient: RECIPIENT,
            rainSpendingPower: 200_000_000n,
            kind: 'P2P_SEND',
        })
    })
    return outcome!
}

beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient()
    mockResolveSpendStrategy.mockResolvedValue({ strategy: 'mixed', smartBalance: 50_000_000n })
    mockPreflight.mockImplementation(async ({ kernelClient }) => kernelClient)
    mockPrepareWithdrawal.mockResolvedValue(PREP)
    mockSignTypedData.mockResolvedValue('0xadminsig')
    mockSendUserOp.mockResolvedValue({ userOpHash: '0xpasskeyop', receipt: SETTLED_RECEIPT })
    mockGetPatchedSudoValidator.mockResolvedValue({ validator: 'patched' })
})

describe('useSpendBundle — mixed, SESSION_KEY_SPEND one-tap branch', () => {
    it('flag off: two-tap passkey path, ephemeral signer never consulted', async () => {
        mockSessionKeySpendEnabled.mockReturnValue(false)
        const outcome = await spendMixed()
        expect(mockEphemeral).not.toHaveBeenCalled()
        expect(mockSignTypedData).toHaveBeenCalledTimes(1)
        expect(outcome).toMatchObject({ strategy: 'mixed', userOpHash: '0xpasskeyop', intentId: 'prep-1' })
    })

    it('flag on, ephemeral op settles: returns and stamps the SETTLED hash, no passkey signatures', async () => {
        mockSessionKeySpendEnabled.mockReturnValue(true)
        mockEphemeral.mockResolvedValue({ ok: true, userOpHash: '0xephemeralop', receipt: SETTLED_RECEIPT })

        const outcome = await spendMixed()

        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
        expect(mockEphemeral).toHaveBeenCalledWith(
            expect.objectContaining({ prep: PREP, recipient: RECIPIENT, requiredUsdcAmount: 150_000_000n })
        )
        expect(outcome).toEqual({
            strategy: 'mixed',
            userOpHash: '0xephemeralop',
            receipt: SETTLED_RECEIPT,
            intentId: 'prep-1',
        })
        // stamped with the receipt's transaction hash, not the userOp hash
        expect(mockStampWithdrawal).toHaveBeenCalledWith({ preparationId: 'prep-1', txHash: '0xsettled' })
        expect(mockSignTypedData).not.toHaveBeenCalled()
        expect(mockSendUserOp).not.toHaveBeenCalled()
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SESSION_KEY_SPEND_ATTEMPTED, { kind: 'P2P_SEND' })
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED, {
            strategy: 'mixed',
            kind: 'P2P_SEND',
            engine: 'session-key',
            receipt: 'settled',
        })
    })

    it('flag on, ephemeral op reverted on-chain: falls back to the passkey path with the SAME prep', async () => {
        mockSessionKeySpendEnabled.mockReturnValue(true)
        mockEphemeral.mockResolvedValue({ ok: false, reason: 'ephemeral userOp reverted on-chain' })

        const outcome = await spendMixed()

        // one preparation for the whole attempt — the coordinator's adminNonce
        // is the mutex that makes the reverted op and the fallback mutually exclusive
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SESSION_KEY_SPEND_FALLBACK, {
            kind: 'P2P_SEND',
            reason: 'ephemeral userOp reverted on-chain',
        })
        expect(mockSignTypedData).toHaveBeenCalledTimes(1)
        expect(mockSendUserOp).toHaveBeenCalledTimes(1)
        const [calls] = mockSendUserOp.mock.calls[0] as [Array<{ to: string }>]
        expect(calls[0].to).toBe(PREP.coordinatorAddress)
        expect(outcome).toEqual({
            strategy: 'mixed',
            userOpHash: '0xpasskeyop',
            receipt: SETTLED_RECEIPT,
            intentId: 'prep-1',
        })
        expect(mockStampWithdrawal).toHaveBeenCalledWith({ preparationId: 'prep-1', txHash: '0xsettled' })
        expect(mockCapture).not.toHaveBeenCalledWith(
            ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED,
            expect.objectContaining({ engine: 'session-key' })
        )
    })

    it('flag on, ephemeral op submitted but receipt unresolved: reported as submitted, NOT stamped with the userOp hash', async () => {
        mockSessionKeySpendEnabled.mockReturnValue(true)
        mockEphemeral.mockResolvedValue({ ok: true, userOpHash: '0xephemeralop', receipt: null })

        const outcome = await spendMixed()

        expect(outcome).toEqual({ strategy: 'mixed', userOpHash: '0xephemeralop', receipt: null, intentId: 'prep-1' })
        expect(mockStampWithdrawal).not.toHaveBeenCalled()
        expect(mockSendUserOp).not.toHaveBeenCalled()
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_WITHDRAW_SUCCEEDED, {
            strategy: 'mixed',
            kind: 'P2P_SEND',
            engine: 'session-key',
            receipt: 'unresolved',
        })
    })

    it('flag on, sudo validator cannot be resolved: falls back to the passkey path instead of failing the spend', async () => {
        mockSessionKeySpendEnabled.mockReturnValue(true)
        mockGetPatchedSudoValidator.mockRejectedValue(new Error('Cannot resolve sudo validator: not authenticated'))

        const outcome = await spendMixed()

        expect(mockEphemeral).not.toHaveBeenCalled()
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SESSION_KEY_SPEND_FALLBACK, {
            kind: 'P2P_SEND',
            reason: 'Cannot resolve sudo validator: not authenticated',
        })
        expect(mockSignTypedData).toHaveBeenCalledTimes(1)
        expect(mockSendUserOp).toHaveBeenCalledTimes(1)
        const [calls] = mockSendUserOp.mock.calls[0] as [Array<{ to: string }>]
        expect(calls[0].to).toBe(PREP.coordinatorAddress)
        expect(outcome).toMatchObject({ strategy: 'mixed', userOpHash: '0xpasskeyop', intentId: 'prep-1' })
    })

    it('flag on, ephemeral preflight fails before broadcast: same fallback, same prep', async () => {
        mockSessionKeySpendEnabled.mockReturnValue(true)
        mockEphemeral.mockResolvedValue({ ok: false, reason: 'ephemeral key: validator nonce floored' })
        await spendMixed()
        expect(mockPrepareWithdrawal).toHaveBeenCalledTimes(1)
        expect(mockSendUserOp).toHaveBeenCalledTimes(1)
    })
})
