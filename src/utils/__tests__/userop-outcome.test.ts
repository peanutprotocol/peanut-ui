/**
 * Chip on ui#4198 (userop-outcome.ts:48): a spent nonce with this op's receipt
 * not found is no proof another op spent it; the receipt index may lag behind
 * the op that did (mono ChargeSendFlow.tla, _BuggySpentNonce).
 */
const mockGetReceipt = jest.fn()
const mockNonceSpent = jest.fn()
jest.mock('@/app/actions/clients', () => ({
    PUBLIC_CLIENTS_BY_CHAIN: { 42161: { chain: { id: 42161 }, bundlerUrl: 'http://bundler.test', client: {} } },
}))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    USER_OP_ENTRY_POINT: { address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032' },
    ZERODEV_RPC_TIMEOUT_MS: 1_000,
}))
jest.mock('viem/account-abstraction', () => ({
    createBundlerClient: () => ({ getUserOperationReceipt: (...args: unknown[]) => mockGetReceipt(...args) }),
}))
jest.mock('@/utils/userop-submission', () => ({
    userOperationNonceSpent: (...args: unknown[]) => mockNonceSpent(...args),
}))

import { readUserOpOutcome } from '../userop-outcome'

const OP = { userOpHash: `0x${'ab'.repeat(32)}` as const, nonce: '7' }
const SENDER = '0x2222222222222222222222222222222222222222' as const
const notFound = () => Object.assign(new Error('not found'), { name: 'UserOperationReceiptNotFoundError' })

beforeEach(() => {
    mockGetReceipt.mockReset()
    mockNonceSpent.mockReset()
})

it('a spent nonce without this op receipt is not called replaced', async () => {
    mockGetReceipt.mockRejectedValue(notFound())
    mockNonceSpent.mockResolvedValue(true)
    const outcome = await readUserOpOutcome(OP, SENDER)
    expect(outcome).not.toBe('replaced')
    expect(outcome).toBe('nonce-spent')
})

it('a receipt that appears on the second read is the op that spent the nonce', async () => {
    mockGetReceipt
        .mockRejectedValueOnce(notFound())
        .mockResolvedValue({ success: true, receipt: { transactionHash: '0xmined' } })
    mockNonceSpent.mockResolvedValue(true)
    await expect(readUserOpOutcome(OP, SENDER)).resolves.toEqual({ executed: '0xmined' })
})

it('a free nonce with no receipt is not-found, and a failed read is unknown', async () => {
    mockGetReceipt.mockRejectedValue(notFound())
    mockNonceSpent.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error('rpc down'))
    await expect(readUserOpOutcome(OP, SENDER)).resolves.toBe('not-found')
    await expect(readUserOpOutcome(OP, SENDER)).resolves.toBe('unknown')
})
