import { getUserOperationHash, type UserOperation } from 'viem/account-abstraction'
import type { Address, Hash, Hex, TransactionReceipt } from 'viem'
import posthog from 'posthog-js'
import { captureMessage } from '@sentry/nextjs'
import { passkeyFixture, signPasskeyUserOp, sortedClientData } from '@/test-utils/passkey-signature'
import type { SubmissionBudget } from '@/utils/userop-submission'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { runSignupTestTransaction, type SignupTestTxClient } from '../useSignupTestTransaction'
import { SignupTestTxError } from '../signup-test-tx-error'
import {
    canDeferSignupTestTransaction,
    readSignupTestTransaction,
    updateSignupTestTransaction,
} from '../signup-test-transaction'
import { classifySignupTestTxFailure } from '../signup-test-tx-failure'
import {
    retryDeferredSignupTestTransaction,
    type DeferredSignupTestTxBundler,
} from '../deferred-signup-test-transaction'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn(), captureMessage: jest.fn() }))
jest.mock('@/hooks/useZeroDevFlow', () => ({ zeroDevFlowActions: { setIsSendingUserOp: jest.fn() } }))
jest.mock('@/context/kernelClient.context', () => ({ useKernelClient: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useAuth: jest.fn() }))

const USER = 'user-1'
const SENDER = '0x1111111111111111111111111111111111111111' as Address
const ENTRY_POINT = { address: '0x0000000071727De22E5E9d8BAf0edAc6f37da032' as Address, version: '0.7' as const }
const CHAIN_ID = 42161
const FAST: SubmissionBudget = {
    sendAttempts: 2,
    backoffMs: [0],
    receiptWindows: 1,
    receiptWindowMs: 10,
    totalMs: 1_000,
}
const mined = { success: true, receipt: { transactionHash: `0x${'cd'.repeat(32)}` } as TransactionReceipt }
const noSleep = async () => undefined

const bundlerError = (details: string) =>
    Object.assign(new Error('Execution failed'), {
        name: 'UserOperationExecutionError',
        shortMessage: 'Execution failed',
        cause: Object.assign(new Error(details), { name: 'RpcRequestError', details }),
    })
const timeout = () => Object.assign(new Error('The request took too long to respond.'), { name: 'TimeoutError' })

function fakeClient({
    clientData,
    gasSeed = 1n,
}: { clientData?: (challenge: string) => string; gasSeed?: bigint } = {}) {
    const { privateKey, publicKey } = passkeyFixture()
    let prepared = 0
    const client = {
        chainId: CHAIN_ID,
        sender: SENDER,
        entryPoint: ENTRY_POINT,
        encodeCalls: jest.fn(async () => '0xabcd' as Hex),
        prepare: jest.fn(async (callData: Hex): Promise<UserOperation<'0.7'>> => {
            prepared++
            return {
                sender: SENDER,
                nonce: 0n,
                callData,
                callGasLimit: 100_000n + gasSeed + BigInt(prepared),
                verificationGasLimit: 500_000n,
                preVerificationGas: 50_000n,
                maxFeePerGas: 0n,
                maxPriorityFeePerGas: 0n,
                signature: '0x',
            }
        }),
        sign: jest.fn(async (userOperation: UserOperation<'0.7'>) => {
            const userOpHash = getUserOperationHash({
                userOperation,
                entryPointAddress: ENTRY_POINT.address,
                entryPointVersion: '0.7',
                chainId: CHAIN_ID,
            })
            return signPasskeyUserOp({ userOpHash, privateKey, clientData })
        }),
        publicKey: jest.fn(async () => publicKey),
        send: jest.fn(async (): Promise<Hash> => `0x${'00'.repeat(32)}` as Hash),
        waitForReceipt: jest.fn(async () => mined),
        getReceipt: jest.fn(async () => null),
        nonceSpent: jest.fn(async () => false),
    } satisfies SignupTestTxClient
    return client
}

const run = (client: SignupTestTxClient) =>
    runSignupTestTransaction({ userId: USER, client, budget: FAST, sleep: noSleep })

beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
})

describe('runSignupTestTransaction', () => {
    it('signs once, keeps the signed operation before the first send, and confirms it', async () => {
        const client = fakeClient()
        client.send.mockImplementation(async () => {
            expect(readSignupTestTransaction(USER)).toMatchObject({ mined: false, signatureCheck: 'valid' })
            return readSignupTestTransaction(USER)!.userOpHash
        })
        const result = await run(client)
        expect(client.sign).toHaveBeenCalledTimes(1)
        expect(result).toMatchObject({ reusedSignature: false, sends: 1 })
        expect(readSignupTestTransaction(USER)).toMatchObject({ mined: true })
    })

    it('a reload mid-retry resends the identical operation without a passkey prompt', async () => {
        const first = fakeClient()
        first.send.mockRejectedValue(timeout())
        await expect(run(first)).rejects.toBeInstanceOf(SignupTestTxError)
        const sentBefore = first.send.mock.calls[0]

        const afterReload = fakeClient({ gasSeed: 99n })
        const result = await run(afterReload)
        expect(afterReload.prepare).not.toHaveBeenCalled()
        expect(afterReload.sign).not.toHaveBeenCalled()
        expect(afterReload.send.mock.calls[0]).toEqual(sentBefore)
        expect(result.reusedSignature).toBe(true)
    })

    it('"Already known" on the resend waits for the same operation, never signing a second one', async () => {
        const first = fakeClient()
        first.send.mockRejectedValue(timeout())
        await expect(run(first)).rejects.toThrow()

        const retry = fakeClient()
        retry.send.mockRejectedValue(bundlerError('Already known'))
        const { userOpHash } = readSignupTestTransaction(USER)!
        await expect(run(retry)).resolves.toMatchObject({ userOpHash, reusedSignature: true })
        expect(retry.sign).not.toHaveBeenCalled()
        expect(retry.waitForReceipt).toHaveBeenCalledWith(userOpHash, expect.any(Number))
    })

    it('an expired operation asks for a new signature on the next attempt, and says so', async () => {
        const first = fakeClient()
        first.send.mockRejectedValue(bundlerError('AA32 paymaster expired or not due'))
        const error = await run(first).catch((e: unknown) => e)
        expect(classifySignupTestTxFailure(error).mode).toBe('needs_new_signature')
        const expiredHash = readSignupTestTransaction(USER)!.userOpHash

        const next = fakeClient()
        await run(next)
        expect(next.sign).toHaveBeenCalledTimes(1)
        expect(readSignupTestTransaction(USER)!.userOpHash).not.toBe(expiredHash)
    })

    it('two transient failures with a valid signature make the confirmation deferrable', async () => {
        for (let i = 0; i < 2; i++) {
            const client = fakeClient()
            client.send.mockRejectedValue(timeout())
            const error = await run(client).catch((e: unknown) => e)
            expect(classifySignupTestTxFailure(error).mode).toBe('bundler_transient')
        }
        expect(readSignupTestTransaction(USER)).toMatchObject({ transientFailures: 2, signatureCheck: 'valid' })
        expect(canDeferSignupTestTransaction(readSignupTestTransaction(USER))).toBe(true)
    })

    it('one transient failure is not enough to defer', async () => {
        const client = fakeClient()
        client.send.mockRejectedValue(timeout())
        await run(client).catch(() => undefined)
        expect(canDeferSignupTestTransaction(readSignupTestTransaction(USER))).toBe(false)
    })

    it('AA24 is never deferrable, even after transient failures', async () => {
        for (let i = 0; i < 2; i++) {
            const client = fakeClient()
            client.send.mockRejectedValue(timeout())
            await run(client).catch(() => undefined)
        }
        const rejected = fakeClient()
        rejected.send.mockRejectedValue(bundlerError('UserOperation reverted with reason: AA24 signature error'))
        const error = await run(rejected).catch((e: unknown) => e)
        expect(classifySignupTestTxFailure(error).mode).toBe('signature_invalid')
        expect(readSignupTestTransaction(USER)).toMatchObject({ signatureRejected: true, transientFailures: 2 })
        expect(canDeferSignupTestTransaction(readSignupTestTransaction(USER))).toBe(false)
    })

    it('a signature the deployed validator would reject is not deferrable, even when the bundler only times out', async () => {
        for (let i = 0; i < 3; i++) {
            const client = fakeClient({ clientData: sortedClientData })
            client.send.mockRejectedValue(timeout())
            await run(client).catch(() => undefined)
        }
        expect(readSignupTestTransaction(USER)).toMatchObject({ signatureCheck: 'challenge', transientFailures: 3 })
        expect(canDeferSignupTestTransaction(readSignupTestTransaction(USER))).toBe(false)
    })

    it('a passkey failure is reported as the sign phase and leaves no operation behind', async () => {
        const client = fakeClient()
        client.sign.mockRejectedValue(Object.assign(new Error(''), { name: 'NotAllowedError' }))
        const error = await run(client).catch((e: unknown) => e)
        expect(error).toMatchObject({ phase: 'sign' })
        expect(classifySignupTestTxFailure(error)).toMatchObject({ mode: 'passkey', errorCode: 'LOGIN_CANCELED' })
        expect(readSignupTestTransaction(USER)).toBeNull()
        expect(client.send).not.toHaveBeenCalled()
    })
})

describe('retryDeferredSignupTestTransaction', () => {
    async function deferAfterTwoTimeouts() {
        for (let i = 0; i < 2; i++) {
            const client = fakeClient()
            client.send.mockRejectedValue(timeout())
            await run(client).catch(() => undefined)
        }
        updateSignupTestTransaction(USER, { deferred: true })
    }

    const bundler = (overrides: Partial<DeferredSignupTestTxBundler> = {}): DeferredSignupTestTxBundler => ({
        send: jest.fn(async (record) => record.userOpHash),
        waitForReceipt: jest.fn(async () => mined),
        getReceipt: jest.fn(async () => null),
        nonceSpent: jest.fn(async () => false),
        ...overrides,
    })

    it('resends the signed operation later and clears the pending marker once it lands', async () => {
        await deferAfterTwoTimeouts()
        const signed = readSignupTestTransaction(USER)!
        const later = bundler()
        await expect(retryDeferredSignupTestTransaction(USER, later, { sleep: noSleep })).resolves.toBe('mined')
        expect(later.send).toHaveBeenCalledWith(expect.objectContaining({ userOperation: signed.userOperation }))
        expect(readSignupTestTransaction(USER)).toBeNull()
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_TEST_TX_DEFERRED_RESOLVED, {
            outcome: 'mined',
            retries: 1,
        })
    })

    it('records a reverted confirmation as reverted, not mined', async () => {
        await deferAfterTwoTimeouts()
        const reverted = { ...mined, success: false }
        const later = bundler({ waitForReceipt: jest.fn(async () => reverted) })
        await expect(retryDeferredSignupTestTransaction(USER, later, { sleep: noSleep })).resolves.toBe('reverted')
        expect(readSignupTestTransaction(USER)).toBeNull()
        expect(posthog.capture).toHaveBeenCalledWith(ANALYTICS_EVENTS.SIGNUP_TEST_TX_DEFERRED_RESOLVED, {
            outcome: 'reverted',
            retries: 1,
        })
        expect(posthog.capture).not.toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_TEST_TX_DEFERRED_RESOLVED,
            expect.objectContaining({ outcome: 'mined' })
        )
        expect(captureMessage).toHaveBeenCalledWith(
            'Deferred signup confirmation reverted on chain',
            expect.objectContaining({ tags: { error_type: 'signup_deferred_reverted' } })
        )
    })

    it('keeps the marker through a still-stalled bundler, then gives up after the retry limit', async () => {
        await deferAfterTwoTimeouts()
        const stalled = bundler({ send: jest.fn().mockRejectedValue(timeout()) })
        const outcomes = []
        for (let i = 0; i < 5; i++)
            outcomes.push(await retryDeferredSignupTestTransaction(USER, stalled, { sleep: noSleep }))
        expect(outcomes).toEqual(['pending', 'pending', 'pending', 'pending', 'gave_up'])
        expect(readSignupTestTransaction(USER)).toBeNull()
    })

    it('does nothing for a confirmation that was not deferred', async () => {
        const client = fakeClient()
        client.send.mockRejectedValue(timeout())
        await run(client).catch(() => undefined)
        const later = bundler()
        await expect(retryDeferredSignupTestTransaction(USER, later)).resolves.toBeNull()
        expect(later.send).not.toHaveBeenCalled()
    })
})
