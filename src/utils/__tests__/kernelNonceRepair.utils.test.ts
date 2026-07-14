/**
 * Tests for the grant-preflight enable-nonce repair.
 *
 * Regression context: the 2025-09-18 root-validator migration batch left a
 * subset of kernel accounts with `validNonceFrom (3) > currentNonce (2)`.
 * Kernel v3.1 rejects every enable-mode validation installed below the floor
 * with `InvalidNonce()`, so a card session-key approval granted for such an
 * account is dead on arrival — the backend sweep fails hourly forever. The
 * repair must: pick the correct root userOp per mode, confirm against
 * re-read chain state (never a bundle receipt), refuse un-invalidatable
 * gaps, and not re-send an invalidation a prior attempt already consumed.
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
import { PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import {
    buildInvalidateNonceCall,
    KernelNonceRepairPendingError,
    KernelNonceRepairUnrepairableError,
    repairEnableNonce,
} from '../kernelNonceRepair.utils'

const ACCOUNT = '0x70f22a4db066aed9bcd2157a7b19e2e28c10c483' as Address

/** Mutable fake chain: reads reflect `state`, sendUserOp can mutate it. */
const makeChain = (initial: { deployed: boolean; cn?: number; vnf?: number }) => {
    const state = { ...initial }
    const publicClient = {
        getCode: jest.fn(async () => (state.deployed ? ('0xdeadbeef' as const) : undefined)),
        readContract: jest.fn(async ({ functionName }: { functionName: string }) => {
            if (functionName === 'currentNonce') return state.cn
            if (functionName === 'validNonceFrom') return state.vnf
            throw new Error(`unexpected read: ${functionName}`)
        }),
    }
    const sendUserOp = jest.fn(async () => ({}))
    return { state, publicClient, sendUserOp }
}

const deps = (chain: ReturnType<typeof makeChain>, mode: 'invalidate' | 'deploy', validNonceFrom?: number) => ({
    publicClient: chain.publicClient,
    accountAddress: ACCOUNT,
    mode,
    validNonceFrom,
    sendUserOp: chain.sendUserOp,
    retries: 2,
    intervalMs: 0,
})

describe('repairEnableNonce — invalidate mode (floored account)', () => {
    it('sends invalidateNonce(floor + 1) to the account itself and returns the synced nonce', async () => {
        const chain = makeChain({ deployed: true, cn: 2, vnf: 3 })
        chain.sendUserOp.mockImplementation(async () => {
            chain.state.cn = 4
            chain.state.vnf = 4
            return {}
        })

        const { validatorNonce } = await repairEnableNonce(deps(chain, 'invalidate', 3))

        expect(validatorNonce).toBe(4)
        expect(chain.sendUserOp).toHaveBeenCalledWith({
            to: ACCOUNT,
            value: 0n,
            data: encodeFunctionData({ abi: KernelV3AccountAbi, functionName: 'invalidateNonce', args: [4] }),
        })
    })

    it('skips the send entirely when a fresh read shows the floor already cleared (retry safety)', async () => {
        const chain = makeChain({ deployed: true, cn: 4, vnf: 4 })
        const { validatorNonce } = await repairEnableNonce(deps(chain, 'invalidate', 3))
        expect(validatorNonce).toBe(4)
        expect(chain.sendUserOp).not.toHaveBeenCalled()
    })

    it('refuses a floor beyond the kernel invalidation cap instead of sending a doomed op', async () => {
        const chain = makeChain({ deployed: true, cn: 2, vnf: 20 })
        await expect(repairEnableNonce(deps(chain, 'invalidate', 20))).rejects.toBeInstanceOf(
            KernelNonceRepairUnrepairableError
        )
        expect(chain.sendUserOp).not.toHaveBeenCalled()
    })

    it('throws the retryable pending error when state never confirms (reverted op in a successful bundle)', async () => {
        const chain = makeChain({ deployed: true, cn: 2, vnf: 3 })
        await expect(repairEnableNonce(deps(chain, 'invalidate', 3))).rejects.toBeInstanceOf(
            KernelNonceRepairPendingError
        )
        expect(chain.sendUserOp).toHaveBeenCalledTimes(1)
    })
})

describe('repairEnableNonce — deploy mode (undeployed pre-cutoff account)', () => {
    it('sends the migration no-op (zero-value USDC self-transfer) and returns the fresh nonce', async () => {
        const chain = makeChain({ deployed: false })
        chain.sendUserOp.mockImplementation(async () => {
            chain.state.deployed = true
            chain.state.cn = 1
            chain.state.vnf = 0
            return {}
        })

        const { validatorNonce } = await repairEnableNonce(deps(chain, 'deploy'))

        expect(validatorNonce).toBe(1)
        const [[call]] = chain.sendUserOp.mock.calls as unknown as [[{ to: string; value: bigint }]]
        expect(call.to).toBe(PEANUT_WALLET_TOKEN)
        expect(call.value).toBe(0n)
    })

    it('throws the retryable pending error when the deploy never appears on-chain', async () => {
        const chain = makeChain({ deployed: false })
        await expect(repairEnableNonce(deps(chain, 'deploy'))).rejects.toBeInstanceOf(KernelNonceRepairPendingError)
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
