/**
 * Tests for the grant-preflight enable-nonce repair.
 *
 * Regression context: the 2025-09-18 emergency validator migration left a
 * subset of kernel accounts with `validNonceFrom (3) > currentNonce (2)`.
 * Kernel v3.1 rejects every enable-mode validation installed below the floor
 * with `InvalidNonce()`, so a card session-key approval granted for such an
 * account is dead on arrival — the backend sweep fails hourly forever. The
 * repair must confirm against re-read chain state (never a bundle receipt),
 * refuse un-invalidatable gaps, tolerate flaky reads mid-poll, and never
 * re-send an invalidation a prior attempt already consumed.
 */

// jest.mock is hoisted above module consts — define the mini-ABI inside the
// factory and read it back through the mocked module (the global
// moduleNameMapper stubs @zerodev/sdk with an empty ABI otherwise). Spread
// the shared stub first: the mapper resolves '@zerodev/sdk/constants' to the
// same file, so replacing it wholesale would drop getEntryPoint & friends.
jest.mock('@zerodev/sdk', () => ({
    ...jest.requireActual('@/utils/__mocks__/zerodev-sdk'),
    KernelV3AccountAbi: [
        { type: 'function', name: 'currentNonce', inputs: [], outputs: [{ type: 'uint32' }], stateMutability: 'view' },
        {
            type: 'function',
            name: 'validNonceFrom',
            inputs: [],
            outputs: [{ type: 'uint32' }],
            stateMutability: 'view',
        },
        {
            type: 'function',
            name: 'invalidateNonce',
            inputs: [{ name: 'nonce', type: 'uint32' }],
            outputs: [],
            stateMutability: 'payable',
        },
    ],
}))

import type { Address } from 'viem'
import { encodeFunctionData } from 'viem'
import { KernelV3AccountAbi } from '@zerodev/sdk'
import {
    buildInvalidateNonceCall,
    KernelNonceRepairPendingError,
    KernelNonceRepairUnrepairableError,
    repairEnableNonce,
} from '../kernelNonceRepair.utils'

const ACCOUNT = '0x70f22a4db066aed9bcd2157a7b19e2e28c10c483' as Address

/** Mutable fake chain: reads reflect `state`, sendUserOp can mutate it. */
const makeChain = (initial: { deployed: boolean; cn?: number; vnf?: number }) => {
    const state = { ...initial, failNextRead: false }
    const publicClient = {
        getCode: jest.fn(async () => {
            if (state.failNextRead) {
                state.failNextRead = false
                throw new Error('flaky RPC')
            }
            return state.deployed ? ('0xdeadbeef' as const) : undefined
        }),
        readContract: jest.fn(async ({ functionName }: { functionName: string }) => {
            if (functionName === 'currentNonce') return state.cn
            if (functionName === 'validNonceFrom') return state.vnf
            throw new Error(`unexpected read: ${functionName}`)
        }),
    }
    const sendUserOp = jest.fn(async () => ({}))
    return { state, publicClient, sendUserOp }
}

const deps = (chain: ReturnType<typeof makeChain>, validNonceFrom: number) => ({
    publicClient: chain.publicClient,
    accountAddress: ACCOUNT,
    validNonceFrom,
    sendUserOp: chain.sendUserOp,
    retries: 2,
    intervalMs: 0,
})

describe('repairEnableNonce', () => {
    it('sends invalidateNonce(floor + 1) to the account itself and returns the synced nonce', async () => {
        const chain = makeChain({ deployed: true, cn: 2, vnf: 3 })
        chain.sendUserOp.mockImplementation(async () => {
            chain.state.cn = 4
            chain.state.vnf = 4
            return {}
        })

        const { validatorNonce } = await repairEnableNonce(deps(chain, 3))

        expect(validatorNonce).toBe(4)
        expect(chain.sendUserOp).toHaveBeenCalledWith({
            to: ACCOUNT,
            value: 0n,
            data: encodeFunctionData({ abi: KernelV3AccountAbi, functionName: 'invalidateNonce', args: [4] }),
        })
    })

    it('skips the send entirely when a fresh read shows the floor already cleared (retry safety)', async () => {
        const chain = makeChain({ deployed: true, cn: 4, vnf: 4 })
        const { validatorNonce } = await repairEnableNonce(deps(chain, 3))
        expect(validatorNonce).toBe(4)
        expect(chain.sendUserOp).not.toHaveBeenCalled()
    })

    it('refuses a floor beyond the kernel invalidation cap instead of sending a doomed op', async () => {
        const chain = makeChain({ deployed: true, cn: 2, vnf: 20 })
        await expect(repairEnableNonce(deps(chain, 20))).rejects.toBeInstanceOf(KernelNonceRepairUnrepairableError)
        expect(chain.sendUserOp).not.toHaveBeenCalled()
    })

    it('treats a lagging "undeployed" fresh read as retryable, never unrepairable', async () => {
        // The caller only enters after observing a DEPLOYED floored account —
        // an undeployed read here is a lagging node, not ground truth.
        const chain = makeChain({ deployed: false })
        await expect(repairEnableNonce(deps(chain, 20))).rejects.toBeInstanceOf(KernelNonceRepairPendingError)
        expect(chain.sendUserOp).not.toHaveBeenCalled()
    })

    it('keeps polling through a flaky read after the op was sent (tap and gas already spent)', async () => {
        const chain = makeChain({ deployed: true, cn: 2, vnf: 3 })
        chain.sendUserOp.mockImplementation(async () => {
            chain.state.cn = 4
            chain.state.vnf = 4
            chain.state.failNextRead = true // first poll read flakes; the next must still run
            return {}
        })

        const { validatorNonce } = await repairEnableNonce(deps(chain, 3))
        expect(validatorNonce).toBe(4)
    })

    it('throws the retryable pending error when state never confirms (reverted op in a successful bundle)', async () => {
        const chain = makeChain({ deployed: true, cn: 2, vnf: 3 })
        await expect(repairEnableNonce(deps(chain, 3))).rejects.toBeInstanceOf(KernelNonceRepairPendingError)
        expect(chain.sendUserOp).toHaveBeenCalledTimes(1)
    })
})

describe('buildInvalidateNonceCall', () => {
    it('targets the account itself with the floor + 1 argument', () => {
        const call = buildInvalidateNonceCall(ACCOUNT, 7)
        expect(call.to).toBe(ACCOUNT)
        expect(call.data).toBe(
            encodeFunctionData({ abi: KernelV3AccountAbi, functionName: 'invalidateNonce', args: [8] })
        )
    })
})
