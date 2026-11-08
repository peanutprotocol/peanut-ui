import type { Hash, TransactionReceipt } from 'viem'
import { RpcRequestError } from 'viem'
import type { RpcUserOperation } from 'viem/account-abstraction'
import {
    sendSignedUserOperation,
    SIGNUP_TEST_TX_SUBMISSION,
    submitSignedUserOperation,
    userOpFailureKind,
    userOperationNonceSpent,
    UserOpSubmissionError,
} from '../userop-submission'

const HASH = `0x${'ab'.repeat(32)}` as Hash
const mined = { success: true, receipt: { transactionHash: `0x${'cd'.repeat(32)}` } as TransactionReceipt }

/** The shapes viem gives the bundler's answers: a wrapper whose cause carries the RPC details. */
const bundlerError = (details: string, name = 'UserOperationExecutionError') => {
    const cause = Object.assign(new Error(`An error occurred while executing user operation: ${details}`), {
        name: 'UnknownRpcError',
        shortMessage: 'An unknown RPC error occurred.',
        details,
    })
    return Object.assign(new Error(`Execution failed\n\nRequest Arguments:\n  signature: 0x${'aa24'.repeat(40)}`), {
        name,
        shortMessage: 'Execution failed',
        cause,
    })
}
const timeout = () => Object.assign(new Error('The request took too long to respond.'), { name: 'TimeoutError' })
const receiptTimeout = () =>
    Object.assign(new Error(`Timed out while waiting for User Operation with hash "${HASH}" to be confirmed.`), {
        name: 'WaitForUserOperationReceiptTimeoutError',
    })

type MockDeps = Record<'send' | 'waitForReceipt' | 'getReceipt' | 'sleep', jest.Mock> & {
    nonceSpent?: jest.Mock
    now: () => number
}

function harness(overrides: Partial<MockDeps> = {}) {
    let clock = 0
    const deps: MockDeps = {
        send: jest.fn(async () => HASH),
        waitForReceipt: jest.fn(async () => mined),
        getReceipt: jest.fn(async () => null),
        sleep: jest.fn(async (ms: number) => {
            clock += ms
        }),
        now: () => clock,
        ...overrides,
    }
    const advance = (ms: number) => {
        clock += ms
    }
    return { deps, advance }
}

/** Verbatim shapes from production (Sentry PEANUT-UI-TM0, PEANUT-UI-SYW). */
const productionAlreadyKnown = () => {
    const rpc = Object.assign(new Error('Invalid parameters were provided to the RPC method.'), {
        name: 'InvalidParamsRpcError',
        shortMessage: 'Invalid parameters were provided to the RPC method.',
        details: 'Already known',
        code: -32602,
    })
    const fields = Object.assign(new Error('Invalid fields set on User Operation.'), {
        name: 'InvalidFieldsError',
        shortMessage: 'Invalid fields set on User Operation.',
        details: 'Already known',
        cause: rpc,
    })
    return Object.assign(
        new Error('Invalid fields set on User Operation.\n\nRequest Arguments: ...\n\nDetails: Already known'),
        {
            name: 'UserOperationExecutionError',
            shortMessage: 'Invalid fields set on User Operation.',
            details: 'Already known',
            cause: fields,
        }
    )
}
const productionAa24 = () =>
    Object.assign(new Error('Signature provided for the User Operation is invalid.'), {
        name: 'UserOperationExecutionError',
        shortMessage: 'Signature provided for the User Operation is invalid.',
        cause: Object.assign(new Error('Signature provided for the User Operation is invalid.'), {
            name: 'UserOperationSignatureError',
            shortMessage: 'Signature provided for the User Operation is invalid.',
            details: 'UserOperation reverted with reason: AA24 signature error',
        }),
    })

describe('userOpFailureKind', () => {
    it('reads the production "Already known" and AA24 shapes', () => {
        expect(userOpFailureKind(productionAlreadyKnown())).toBe('already_known')
        expect(userOpFailureKind(productionAa24())).toBe('signature_invalid')
    })

    it.each([
        ['bundler: Already known', bundlerError('Already known'), 'already_known'],
        ['bundler: AA25', bundlerError('AA25 invalid account nonce'), 'nonce_used'],
        [
            'bundler: AA24',
            bundlerError('UserOperation reverted during simulation with reason: AA24 signature error'),
            'signature_invalid',
        ],
        ['bundler: AA32', bundlerError('AA32 paymaster expired or not due'), 'expired'],
        ['transport timeout', timeout(), 'transient'],
        ['receipt wait timeout', receiptTimeout(), 'transient'],
        [
            'HTTP 503',
            Object.assign(new Error('HTTP request failed.'), { name: 'HttpRequestError', status: 503 }),
            'transient',
        ],
        ['fetch failure', new TypeError('Failed to fetch'), 'transient'],
        ['bundler: AA21', bundlerError('AA21 didn\u2019t pay prefund'), 'terminal'],
        ['unknown', new Error('something else'), 'terminal'],
    ])('%s', (_label, error, kind) => {
        expect(userOpFailureKind(error)).toBe(kind)
    })

    it('does not read AA24 out of the hex request arguments viem prints', () => {
        expect(userOpFailureKind(bundlerError('Already known'))).toBe('already_known')
    })
})

describe('submitSignedUserOperation', () => {
    it('"Already known" waits on the same operation and never sends a second one', async () => {
        const { deps } = harness({ send: jest.fn().mockRejectedValueOnce(bundlerError('Already known')) })
        const outcome = await submitSignedUserOperation(HASH, deps)
        expect(deps.send).toHaveBeenCalledTimes(1)
        expect(deps.waitForReceipt).toHaveBeenCalledWith(HASH, SIGNUP_TEST_TX_SUBMISSION.receiptWindowMs)
        expect(outcome).toMatchObject({ userOpHash: HASH, success: true, sends: 1, recovered: ['already_known'] })
    })

    it('a bundler timeout resends the identical operation after backoff, then succeeds', async () => {
        const { deps } = harness({
            send: jest.fn().mockRejectedValueOnce(timeout()).mockRejectedValueOnce(timeout()).mockResolvedValue(HASH),
        })
        const outcome = await submitSignedUserOperation(HASH, deps)
        expect(deps.send).toHaveBeenCalledTimes(3)
        expect(deps.sleep.mock.calls.map(([ms]: [number]) => ms)).toEqual([2_000, 5_000])
        expect(outcome).toMatchObject({ success: true, sends: 3, recovered: ['transient', 'transient'] })
    })

    it('a timed-out first send that the bundler did accept resolves through "Already known"', async () => {
        const { deps } = harness({
            send: jest.fn().mockRejectedValueOnce(timeout()).mockRejectedValueOnce(bundlerError('already known')),
        })
        await expect(submitSignedUserOperation(HASH, deps)).resolves.toMatchObject({ success: true, sends: 2 })
        expect(deps.waitForReceipt).toHaveBeenCalledTimes(1)
    })

    it('gives up after the send budget with a transient error', async () => {
        const { deps } = harness({ send: jest.fn().mockRejectedValue(timeout()) })
        const error = await submitSignedUserOperation(HASH, deps).catch((e: unknown) => e)
        expect(error).toBeInstanceOf(UserOpSubmissionError)
        expect(error).toMatchObject({
            kind: 'transient',
            sends: SIGNUP_TEST_TX_SUBMISSION.sendAttempts,
            accepted: false,
        })
        expect(deps.waitForReceipt).not.toHaveBeenCalled()
    })

    it('a stalled receipt resends the same operation once and waits a second window', async () => {
        const { deps } = harness({
            waitForReceipt: jest.fn().mockRejectedValueOnce(receiptTimeout()).mockResolvedValue(mined),
            send: jest.fn().mockResolvedValueOnce(HASH).mockRejectedValueOnce(bundlerError('Already known')),
        })
        const outcome = await submitSignedUserOperation(HASH, deps)
        expect(deps.send).toHaveBeenCalledTimes(2)
        expect(deps.waitForReceipt).toHaveBeenCalledTimes(2)
        expect(new Set(deps.waitForReceipt.mock.calls.map(([hash]: [Hash]) => hash))).toEqual(new Set([HASH]))
        expect(outcome.recovered).toEqual(['transient', 'already_known'])
    })

    it('stops within the wall clock even when every wait stalls', async () => {
        const { deps, advance } = harness()
        deps.waitForReceipt.mockImplementation(async (_hash: Hash, ms: number) => {
            advance(ms)
            throw receiptTimeout()
        })
        await expect(submitSignedUserOperation(HASH, deps)).rejects.toMatchObject({ kind: 'transient', accepted: true })
        expect(deps.waitForReceipt).toHaveBeenCalledTimes(SIGNUP_TEST_TX_SUBMISSION.receiptWindows)
        const waited = deps.waitForReceipt.mock.calls.reduce((sum: number, [, ms]: [Hash, number]) => sum + ms, 0)
        expect(waited).toBeLessThanOrEqual(SIGNUP_TEST_TX_SUBMISSION.totalMs)
        expect(deps.getReceipt).toHaveBeenCalledWith(HASH)
    })

    it('a spent nonce is success only when this very operation spent it', async () => {
        const nonceUsed = bundlerError('AA25 invalid account nonce')
        const landed = harness({ send: jest.fn().mockRejectedValue(nonceUsed), getReceipt: jest.fn(async () => mined) })
        await expect(submitSignedUserOperation(HASH, landed.deps)).resolves.toMatchObject({ success: true })
        expect(landed.deps.waitForReceipt).not.toHaveBeenCalled()

        const other = harness({ send: jest.fn().mockRejectedValue(nonceUsed) })
        await expect(submitSignedUserOperation(HASH, other.deps)).rejects.toMatchObject({ kind: 'nonce_used' })
    })

    it('a signature the validator rejects fails at once, without a resend', async () => {
        const { deps } = harness({ send: jest.fn().mockRejectedValue(bundlerError('AA24 signature error')) })
        await expect(submitSignedUserOperation(HASH, deps)).rejects.toMatchObject({
            kind: 'signature_invalid',
            sends: 1,
        })
        expect(deps.sleep).not.toHaveBeenCalled()
    })

    it.each([true, false])('uses a late receipt with success %s after the nonce is spent', async (success) => {
        const receipt = { ...mined, success }
        const { deps } = harness({
            send: jest.fn().mockRejectedValue(productionAlreadyKnown()),
            waitForReceipt: jest.fn().mockRejectedValue(receiptTimeout()),
            getReceipt: jest.fn().mockResolvedValue(receipt),
            nonceSpent: jest.fn().mockResolvedValue(true),
        })
        const outcome = await submitSignedUserOperation(HASH, deps)
        expect(outcome).toMatchObject(receipt)
        expect(deps.waitForReceipt).toHaveBeenCalledTimes(SIGNUP_TEST_TX_SUBMISSION.receiptWindows)
        expect(deps.getReceipt).toHaveBeenCalledWith(HASH)
        expect(deps.send).toHaveBeenCalledTimes(1)
    })

    it('keeps a spent nonce with no receipt unresolved and stops resubmission', async () => {
        const { deps } = harness({
            send: jest.fn().mockRejectedValue(productionAlreadyKnown()),
            waitForReceipt: jest.fn().mockRejectedValue(receiptTimeout()),
            nonceSpent: jest.fn().mockResolvedValue(true),
        })
        await expect(submitSignedUserOperation(HASH, deps)).rejects.toMatchObject({ kind: 'transient' })
        expect(deps.send).toHaveBeenCalledTimes(1)
        expect(deps.getReceipt).toHaveBeenCalledWith(HASH)
    })

    it('without a nonce check, a stalled sibling ends as a transient failure', async () => {
        const { deps } = harness({
            send: jest.fn().mockRejectedValue(productionAlreadyKnown()),
            waitForReceipt: jest.fn().mockRejectedValue(receiptTimeout()),
        })
        await expect(submitSignedUserOperation(HASH, deps)).rejects.toMatchObject({ kind: 'transient' })
    })
})

describe('userOperationNonceSpent', () => {
    it('reads the stored operation key and compares the sequence under that key', async () => {
        const sender = '0x1111111111111111111111111111111111111111'
        const entryPoint = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
        const nonce = (7n << 64n) + 3n
        const readContract = jest
            .fn()
            .mockResolvedValueOnce(8n << 64n)
            .mockResolvedValueOnce(nonce + 1n)
        await expect(userOperationNonceSpent({ readContract }, entryPoint, sender, nonce)).resolves.toBe(false)
        await expect(userOperationNonceSpent({ readContract }, entryPoint, sender, nonce)).resolves.toBe(true)
        expect(readContract).toHaveBeenCalledWith(
            expect.objectContaining({ address: entryPoint, functionName: 'getNonce', args: [sender, 7n] })
        )
    })
})

describe('sendSignedUserOperation', () => {
    const op = {
        sender: '0x1111111111111111111111111111111111111111',
        nonce: '0x0',
        callData: '0x',
        callGasLimit: '0x1',
        verificationGasLimit: '0x1',
        preVerificationGas: '0x1',
        maxFeePerGas: '0x0',
        maxPriorityFeePerGas: '0x0',
        signature: '0x01',
    } as RpcUserOperation
    const ENTRY_POINT = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'
    const rejecting = (code: number, message: string) => ({
        request: jest.fn().mockRejectedValue(
            new RpcRequestError({
                body: { method: 'eth_sendUserOperation' },
                error: { code, message },
                url: 'https://bundler',
            })
        ),
    })

    it('sends the stored operation unchanged, without transport retries', async () => {
        const client = { request: jest.fn().mockResolvedValue(HASH) }
        await expect(sendSignedUserOperation(client, op, ENTRY_POINT)).resolves.toBe(HASH)
        expect(client.request).toHaveBeenCalledWith(
            { method: 'eth_sendUserOperation', params: [op, ENTRY_POINT] },
            { retryCount: 0 }
        )
    })

    it('gives bundler rejections the shape viem gives them, which the classifier reads', async () => {
        const known = await sendSignedUserOperation(rejecting(-32602, 'Already known'), op, ENTRY_POINT).catch((e) => e)
        expect(known.name).toBe('UserOperationExecutionError')
        expect(userOpFailureKind(known)).toBe('already_known')

        const aa24 = await sendSignedUserOperation(
            rejecting(-32507, 'UserOperation reverted with reason: AA24 signature error'),
            op,
            ENTRY_POINT
        ).catch((e) => e)
        expect(userOpFailureKind(aa24)).toBe('signature_invalid')
    })
})
