import { entryPoint07Address, getUserOperationHash } from 'viem/account-abstraction'
import { ApiError } from '@/services/api-error'
import { createStaleSessionError } from '@/utils/walletCredential.utils'
import {
    describeSignedUserOp,
    isDefinitiveSendRefusal,
    markSpendMayHaveBroadcast,
    spendMayHaveBroadcast,
} from '../spendBroadcast'

const account = {
    address: '0x2222222222222222222222222222222222222222' as const,
    entryPoint: { address: entryPoint07Address, version: '0.7' as const, abi: [] as never },
}
const preparedOp = {
    nonce: 42n,
    callData: '0x1234' as const,
    callGasLimit: 100_000n,
    verificationGasLimit: 200_000n,
    preVerificationGas: 50_000n,
    maxFeePerGas: 1_000_000n,
    maxPriorityFeePerGas: 1_000n,
}

describe('describeSignedUserOp', () => {
    it('states the hash the bundler will report, and the nonce as a string', () => {
        const op = describeSignedUserOp(account, 42161, preparedOp, '0xbeef')
        expect(op).toEqual({
            userOpHash: getUserOperationHash({
                chainId: 42161,
                entryPointAddress: entryPoint07Address,
                entryPointVersion: '0.7',
                userOperation: { ...preparedOp, sender: account.address, signature: '0xbeef' },
            }),
            nonce: '42',
        })
    })

    it('returns null instead of breaking the send when the op cannot be hashed', () => {
        expect(describeSignedUserOp(account, 42161, {}, '0xbeef')).toBeNull()
    })
})

describe('the may-have-broadcast tag', () => {
    it('keeps the original error, so existing checks on it still hold', () => {
        const original = new TypeError('Failed to fetch')
        const tagged = markSpendMayHaveBroadcast(original)
        expect(tagged).toBe(original)
        expect(spendMayHaveBroadcast(tagged)).toBe(true)
        expect(spendMayHaveBroadcast(new Error('other'))).toBe(false)
    })
})

describe('isDefinitiveSendRefusal', () => {
    const rpc = (message: string) =>
        Object.assign(new Error(message), {
            name: 'UserOperationExecutionError',
            cause: Object.assign(new Error(message), { name: 'RpcRequestError', code: -32500 }),
        })

    it.each([
        ['a bundler validation error', rpc('AA21 did not pay prefund')],
        ['an invalid signature (AA24)', rpc('AA24 signature error')],
        ['a stale session', createStaleSessionError()],
        ['a refused payload (400)', new ApiError('bad request', { status: 400 })],
        ['an out-of-date preparation (410)', new ApiError('start again', { status: 410 })],
        [
            'a stale card approval (409 STALE_CARD_APPROVAL)',
            new ApiError('re-enable your card', { status: 409, code: 'STALE_CARD_APPROVAL' }),
        ],
    ])('%s is a refusal', (_label, error) => {
        expect(isDefinitiveSendRefusal(error)).toBe(true)
    })

    it.each([
        ['a timeout', Object.assign(new Error('took too long'), { name: 'TimeoutError' })],
        ['a dropped connection', new TypeError('Failed to fetch')],
        ['an op the bundler already holds', rpc('already known')],
        ['a spent nonce (this op may have spent it)', rpc('AA25 invalid account nonce')],
        ['a 5xx from the backend', new ApiError('bad gateway', { status: 502 })],
        // Chip on ui#4198: a gateway can answer 408 after /submit was accepted
        ['a submit timeout (408)', new ApiError('request timeout', { status: 408 })],
        [
            'a send still confirming (409 WITHDRAWAL_PENDING_CONFIRMATION)',
            new ApiError('still confirming', { status: 409, code: 'WITHDRAWAL_PENDING_CONFIRMATION' }),
        ],
        [
            'a 409 without a code ("Intent already completed")',
            new ApiError('Intent already completed', { status: 409 }),
        ],
    ])('%s is not', (_label, error) => {
        expect(isDefinitiveSendRefusal(error)).toBe(false)
    })
})
