/**
 * Contract tests for useRainFunding — the user's own consent for Rain's
 * real-time funding. The card is funded only while the smart wallet's ERC20
 * allowance to Rain's operator stands, so "success" here gates card issuance.
 *
 * Locked down:
 *  1. success = sent approve(operator, maxUint256) AND the chain reads it back
 *  2. a rejected passkey / reverted UserOp / unconfirmed allowance is a failure
 *  3. a lost receipt (`receipt: null`) is `pending` unless the chain already
 *     shows the allowance — uncertain, never a blind success or a blind resend
 *  4. wrong chain/token/operator never builds a client; wrong wallet never signs
 *  5. an existing approval is idempotent, and a double tap sends one UserOp
 *  6. a failed funding read is a failure, never a false zero
 *  7. the cached allowance is per user
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { decodeFunctionData, erc20Abi, maxUint256 } from 'viem'
import { peanutPublicClient } from '@/app/actions/clients'
import { rainApi } from '@/services/rain'

const WALLET = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const OTHER_WALLET = '0x1111111111111111111111111111111111111111'
const OPERATOR = '0x5a6E6b0d5Ea051CfFF9b3dcC2Aa8Dac226458f29'
const TOKEN = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: { readContract: jest.fn() } }))
jest.mock('@/services/rain', () => ({ rainApi: { getCardFunding: jest.fn() } }))
let mockUserId = 'user-a'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockUserId } } }),
}))
const mockEnsureClientForChain = jest.fn()
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({ ensureClientForChain: mockEnsureClientForChain }),
}))
const mockHandleSendUserOpEncoded = jest.fn()
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleSendUserOpEncoded: mockHandleSendUserOpEncoded }),
}))

import { useRainFunding } from '../useRainFunding'

const funding = (overrides: Record<string, string> = {}) => ({
    chainId: '42161',
    tokenAddress: TOKEN,
    operatorAddress: OPERATOR,
    walletAddress: WALLET,
    allowance: '0',
    ...overrides,
})

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

const mockGetCardFunding = rainApi.getCardFunding as jest.Mock
const mockReadContract = peanutPublicClient.readContract as jest.Mock

beforeEach(() => {
    jest.clearAllMocks()
    mockUserId = 'user-a'
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockGetCardFunding.mockResolvedValue(funding())
    mockEnsureClientForChain.mockResolvedValue({ account: { address: WALLET } })
    mockHandleSendUserOpEncoded.mockResolvedValue({ userOpHash: '0xhash', receipt: { status: 'success' } })
    mockReadContract.mockResolvedValue(maxUint256)
})

const runApprove = async () => {
    const hook = renderHook(() => useRainFunding({ enabled: false }), { wrapper })
    let out!: Awaited<ReturnType<typeof hook.result.current.approve>>
    await act(async () => {
        out = await hook.result.current.approve()
    })
    return { out, hook }
}

describe('useRainFunding.approve', () => {
    it('sends approve(operator, maxUint256) on the token and succeeds once the chain confirms it', async () => {
        const { out } = await runApprove()

        expect(out).toEqual({ ok: true })
        expect(mockHandleSendUserOpEncoded).toHaveBeenCalledTimes(1)
        const [calls, chainId] = mockHandleSendUserOpEncoded.mock.calls[0]
        expect(chainId).toBe('42161')
        expect(calls).toHaveLength(1)
        expect(calls[0].to).toBe(TOKEN)
        expect(calls[0].value).toBe(0n)
        const decoded = decodeFunctionData({ abi: erc20Abi, data: calls[0].data })
        expect(decoded.functionName).toBe('approve')
        expect(decoded.args).toEqual([OPERATOR, maxUint256])
        // the confirmation read targets this wallet + operator, on the backend's token
        expect(mockReadContract).toHaveBeenCalledWith(
            expect.objectContaining({ address: TOKEN, functionName: 'allowance', args: [WALLET, OPERATOR] })
        )
        // …and only AFTER the UserOp resolved
        expect(mockReadContract.mock.invocationCallOrder[0]).toBeGreaterThan(
            mockHandleSendUserOpEncoded.mock.invocationCallOrder[0]
        )
    })

    it('fails when a receipt came back but the onchain allowance is still insufficient', async () => {
        mockReadContract.mockResolvedValue(1_000_000n)
        const { out, hook } = await runApprove()

        expect(out).toEqual({ ok: false, error: { kind: 'not-confirmed' } })
        expect(hook.result.current.lastError).toEqual({ kind: 'not-confirmed' })
    })

    it('reports a rejected passkey as user-cancelled and never reads success', async () => {
        const rejection = new Error('The operation either timed out or was not allowed.')
        rejection.name = 'NotAllowedError'
        mockHandleSendUserOpEncoded.mockRejectedValue(rejection)
        const { out } = await runApprove()

        expect(out).toEqual({ ok: false, error: { kind: 'user-cancelled' } })
        expect(mockReadContract).not.toHaveBeenCalled()
    })

    it('reports a reverted UserOp (the send helper throws) as a failure', async () => {
        mockHandleSendUserOpEncoded.mockRejectedValue(new Error('UserOperation reverted on-chain (userOpHash 0xhash)'))
        const { out } = await runApprove()

        expect(out.ok).toBe(false)
        expect(!out.ok && out.error.kind).toBe('unexpected')
        expect(mockReadContract).not.toHaveBeenCalled()
    })

    describe('lost receipt (send helper returns receipt: null)', () => {
        beforeEach(() => {
            mockHandleSendUserOpEncoded.mockResolvedValue({ userOpHash: '0xhash', receipt: null })
        })

        it('is pending — not success, not a hard failure — while the chain shows no change', async () => {
            mockReadContract.mockResolvedValue(0n)
            const { out, hook } = await runApprove()

            expect(out).toEqual({ ok: false, error: { kind: 'pending' } })
            expect(hook.result.current.lastError).toEqual({ kind: 'pending' })
        })

        it('succeeds when the chain already shows the allowance', async () => {
            const { out } = await runApprove()
            expect(out).toEqual({ ok: true })
        })

        it('a retry after it landed is idempotent — no second UserOp', async () => {
            mockReadContract.mockResolvedValue(0n)
            const { hook } = await runApprove()
            // the op lands; the backend now reports the allowance
            mockGetCardFunding.mockResolvedValue(funding({ allowance: maxUint256.toString() }))
            let retry!: Awaited<ReturnType<typeof hook.result.current.approve>>
            await act(async () => {
                retry = await hook.result.current.approve()
            })

            expect(retry).toEqual({ ok: true })
            expect(mockHandleSendUserOpEncoded).toHaveBeenCalledTimes(1)
        })
    })

    it('a double tap sends ONE UserOp and both callers get its result', async () => {
        let release!: (v: unknown) => void
        mockHandleSendUserOpEncoded.mockReturnValue(new Promise((resolve) => (release = resolve)))
        const { result } = renderHook(() => useRainFunding({ enabled: false }), { wrapper })

        let first!: ReturnType<typeof result.current.approve>
        let second!: ReturnType<typeof result.current.approve>
        await act(async () => {
            first = result.current.approve()
            second = result.current.approve()
            await waitFor(() => expect(mockHandleSendUserOpEncoded).toHaveBeenCalled())
            release({ userOpHash: '0xhash', receipt: { status: 'success' } })
            await Promise.all([first, second])
        })

        expect(await first).toEqual({ ok: true })
        expect(await second).toEqual({ ok: true })
        expect(mockHandleSendUserOpEncoded).toHaveBeenCalledTimes(1)
    })

    it('refuses to sign when the connected account is not the wallet Rain pulls from', async () => {
        mockEnsureClientForChain.mockResolvedValue({ account: { address: OTHER_WALLET } })
        const { out } = await runApprove()

        expect(out).toEqual({ ok: false, error: { kind: 'wallet-mismatch' } })
        expect(mockHandleSendUserOpEncoded).not.toHaveBeenCalled()
    })

    it.each([
        ['chain', { chainId: '8453' }],
        ['token', { tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' }],
        ['operator (zero address)', { operatorAddress: '0x0000000000000000000000000000000000000000' }],
        ['operator (malformed)', { operatorAddress: '0x1234' }],
    ])('rejects a bad backend %s BEFORE building a client for it', async (_label, overrides) => {
        mockGetCardFunding.mockResolvedValue(funding(overrides))
        const { out } = await runApprove()

        expect(out).toEqual({ ok: false, error: { kind: 'config-mismatch' } })
        expect(mockEnsureClientForChain).not.toHaveBeenCalled()
        expect(mockHandleSendUserOpEncoded).not.toHaveBeenCalled()
    })

    it('is idempotent — an existing approval sends no second UserOp', async () => {
        // USDC lowers a max allowance on every pull; still the approval we set.
        mockGetCardFunding.mockResolvedValue(funding({ allowance: (maxUint256 - 5_000_000_000n).toString() }))
        const { out } = await runApprove()

        expect(out).toEqual({ ok: true })
        expect(mockHandleSendUserOpEncoded).not.toHaveBeenCalled()
    })

    it('treats a failed funding read as a failure, not as a zero allowance', async () => {
        mockGetCardFunding.mockRejectedValue(new Error('Rain upstream error'))
        const { out } = await runApprove()

        expect(out).toEqual({ ok: false, error: { kind: 'funding-unavailable', message: 'Rain upstream error' } })
        expect(mockHandleSendUserOpEncoded).not.toHaveBeenCalled()
    })
})

describe('useRainFunding.revoke', () => {
    const runRevoke = async () => {
        const { result } = renderHook(() => useRainFunding({ enabled: false }), { wrapper })
        let out!: Awaited<ReturnType<typeof result.current.revoke>>
        await act(async () => {
            out = await result.current.revoke()
        })
        return out
    }

    it('sends approve(operator, 0) and succeeds once the allowance reads zero', async () => {
        mockGetCardFunding.mockResolvedValue(funding({ allowance: maxUint256.toString() }))
        mockReadContract.mockResolvedValue(0n)

        expect(await runRevoke()).toEqual({ ok: true })
        const decoded = decodeFunctionData({
            abi: erc20Abi,
            data: mockHandleSendUserOpEncoded.mock.calls[0][0][0].data,
        })
        expect(decoded.args).toEqual([OPERATOR, 0n])
    })

    it('fails while the allowance still stands', async () => {
        mockGetCardFunding.mockResolvedValue(funding({ allowance: maxUint256.toString() }))
        mockReadContract.mockResolvedValue(maxUint256)

        expect(await runRevoke()).toEqual({ ok: false, error: { kind: 'not-confirmed' } })
    })

    it('sends nothing when there is no allowance to remove', async () => {
        expect(await runRevoke()).toEqual({ ok: true })
        expect(mockHandleSendUserOpEncoded).not.toHaveBeenCalled()
    })
})

describe('useRainFunding — allowance read', () => {
    it('is undefined while the allowance is unknown, then reflects the endpoint', async () => {
        const { result } = renderHook(() => useRainFunding(), { wrapper })
        expect(result.current.isApproved).toBeUndefined()
        await waitFor(() => expect(result.current.isApproved).toBe(false))
    })

    it('surfaces a failed read as fundingError and keeps isApproved unknown', async () => {
        mockGetCardFunding.mockRejectedValue(new Error('boom'))
        const { result } = renderHook(() => useRainFunding(), { wrapper })
        await waitFor(() => expect(result.current.fundingError).toBeTruthy())
        expect(result.current.isApproved).toBeUndefined()
    })

    it("never answers one user's allowance from another user's cache", async () => {
        mockGetCardFunding.mockResolvedValue(funding({ allowance: maxUint256.toString() }))
        const { result, rerender } = renderHook(() => useRainFunding(), { wrapper })
        await waitFor(() => expect(result.current.isApproved).toBe(true))

        // account switch on the same QueryClient: user B has approved nothing
        mockUserId = 'user-b'
        mockGetCardFunding.mockResolvedValue(funding({ walletAddress: OTHER_WALLET, allowance: '0' }))
        rerender()
        expect(result.current.isApproved).toBeUndefined()
        await waitFor(() => expect(result.current.isApproved).toBe(false))
    })
})
