import { resolveSettledTxHash } from '../settled-tx-hash.utils'
import posthog from 'posthog-js'
import type { Hash } from 'viem'

jest.mock('posthog-js', () => ({ capture: jest.fn() }))

const TX_HASH = ('0x' + '11'.repeat(32)) as Hash
const USEROP_HASH = ('0x' + '22'.repeat(32)) as Hash
const COORDINATOR_HASH = ('0x' + '33'.repeat(32)) as Hash

describe('resolveSettledTxHash', () => {
    beforeEach(() => jest.clearAllMocks())

    it('prefers the real transaction hash from the receipt', () => {
        const result = resolveSettledTxHash(
            { receipt: { transactionHash: TX_HASH }, userOpHash: USEROP_HASH },
            'direct-send'
        )
        expect(result).toEqual({ hash: TX_HASH, source: 'receipt' })
        expect(posthog.capture).not.toHaveBeenCalled()
    })

    // BEFORE (main): the inline expression was `receipt?.transactionHash ??
    // userOpHash ?? txHash` — a bundler-internal userOp hash won over the
    // coordinator's REAL transaction hash. AFTER: any real hash wins.
    it('prefers the coordinator txHash over the userOp hash', () => {
        const result = resolveSettledTxHash({ userOpHash: USEROP_HASH, txHash: COORDINATOR_HASH }, 'direct-send')
        expect(result).toEqual({ hash: COORDINATOR_HASH, source: 'txHash' })
        expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('falls back to the userOp hash as last resort and captures the event', () => {
        const result = resolveSettledTxHash({ userOpHash: USEROP_HASH, receipt: null }, 'semantic-request')
        expect(result).toEqual({ hash: USEROP_HASH, source: 'userOpHash' })
        expect(posthog.capture).toHaveBeenCalledWith('send_txhash_fallback', { flow: 'semantic-request' })
    })
})
