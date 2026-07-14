/**
 * Tests for useCardSignatureRepair — the /fix-card-signature diagnose/repair hook.
 *
 * Money-path invariant under test: accounts whose kernel has
 * `validNonceFrom > currentNonce` can NEVER validate an enable-mode card
 * approval (Kernel v3.1 rejects installs below the floor with InvalidNonce),
 * and the ONLY unbrick is a root userOp calling
 * `invalidateNonce(validNonceFrom + 1)` on the account itself. Undeployed
 * accounts instead need a deploy (migration no-op). The hook must pick the
 * right repair call for each diagnosis and must confirm the repair against
 * re-read on-chain state, never the bundle receipt.
 */

import { renderHook, act } from '@testing-library/react'
import { encodeFunctionData } from 'viem'

const USER_ADDRESS = '0x00000000000000000000000000000000000000aa'
const USDC = '0x1111111111111111111111111111111111111111'

// Defined inside the factory (jest.mock is hoisted above module consts); the
// test body reads it back through the mocked module.
jest.mock('@zerodev/sdk', () => ({
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
import { KernelV3AccountAbi as KERNEL_ABI } from '@zerodev/sdk'

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: USDC,
}))

const mockGetCode = jest.fn()
const mockReadContract = jest.fn()
jest.mock('@/app/actions/clients', () => ({
    peanutPublicClient: {
        getCode: (...args: unknown[]) => mockGetCode(...args),
        readContract: (...args: unknown[]) => mockReadContract(...args),
    },
}))

const mockSendUserOp = jest.fn()
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ address: USER_ADDRESS, handleSendUserOpEncoded: mockSendUserOp }),
}))

const mockRebuildClient = jest.fn()
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({ rebuildClientForChain: mockRebuildClient }),
}))

import { useCardSignatureRepair } from '../useCardSignatureRepair'

/** Point the on-chain reads at a fake account state. */
const chainState = (state: { deployed: boolean; cn?: number; vnf?: number }) => {
    mockGetCode.mockResolvedValue(state.deployed ? '0xdeadbeef' : undefined)
    mockReadContract.mockImplementation(({ functionName }: { functionName: string }) => {
        if (functionName === 'currentNonce') return Promise.resolve(state.cn)
        if (functionName === 'validNonceFrom') return Promise.resolve(state.vnf)
        return Promise.reject(new Error(`unexpected read: ${functionName}`))
    })
}

beforeEach(() => {
    jest.clearAllMocks()
    mockSendUserOp.mockResolvedValue({ userOpHash: '0xhash', receipt: null })
    mockRebuildClient.mockResolvedValue({})
})

describe('diagnose', () => {
    it('classifies an account with no code as undeployed', async () => {
        chainState({ deployed: false })
        const { result } = renderHook(() => useCardSignatureRepair())
        await act(async () => {
            expect(await result.current.diagnose()).toEqual({ state: 'undeployed' })
        })
        expect(result.current.diagnosis).toEqual({ state: 'undeployed' })
    })

    it('classifies validNonceFrom > currentNonce as nonce-bricked', async () => {
        chainState({ deployed: true, cn: 2, vnf: 3 })
        const { result } = renderHook(() => useCardSignatureRepair())
        await act(async () => {
            await result.current.diagnose()
        })
        expect(result.current.diagnosis).toEqual({ state: 'nonce-bricked', currentNonce: 2, validNonceFrom: 3 })
    })

    it('classifies validNonceFrom <= currentNonce as healthy', async () => {
        chainState({ deployed: true, cn: 1, vnf: 0 })
        const { result } = renderHook(() => useCardSignatureRepair())
        await act(async () => {
            await result.current.diagnose()
        })
        expect(result.current.diagnosis).toEqual({ state: 'healthy', currentNonce: 1, validNonceFrom: 0 })
    })
})

describe('repair', () => {
    it('nonce-bricked → sends invalidateNonce(validNonceFrom + 1) to the account itself, then rebuilds', async () => {
        chainState({ deployed: true, cn: 2, vnf: 3 })
        const { result } = renderHook(() => useCardSignatureRepair())
        await act(async () => {
            await result.current.diagnose()
        })

        // The repair userOp lands and the floor is cleared before the confirm poll.
        mockSendUserOp.mockImplementation(async () => {
            chainState({ deployed: true, cn: 4, vnf: 4 })
            return { userOpHash: '0xhash', receipt: null }
        })

        await act(async () => {
            expect(await result.current.repair()).toEqual({ state: 'healthy', currentNonce: 4, validNonceFrom: 4 })
        })

        expect(mockSendUserOp).toHaveBeenCalledWith(
            [
                {
                    to: USER_ADDRESS,
                    value: 0n,
                    data: encodeFunctionData({ abi: KERNEL_ABI, functionName: 'invalidateNonce', args: [4] }),
                },
            ],
            '42161'
        )
        expect(mockRebuildClient).toHaveBeenCalledWith('42161')
        expect(result.current.diagnosis).toEqual({ state: 'healthy', currentNonce: 4, validNonceFrom: 4 })
    })

    it('undeployed → sends the migration no-op (deploys the account), then rebuilds', async () => {
        chainState({ deployed: false })
        const { result } = renderHook(() => useCardSignatureRepair())
        await act(async () => {
            await result.current.diagnose()
        })

        mockSendUserOp.mockImplementation(async () => {
            chainState({ deployed: true, cn: 1, vnf: 0 })
            return { userOpHash: '0xhash', receipt: null }
        })

        await act(async () => {
            expect(await result.current.repair()).toEqual({ state: 'healthy', currentNonce: 1, validNonceFrom: 0 })
        })

        const [[calls, chainId]] = mockSendUserOp.mock.calls
        expect(chainId).toBe('42161')
        expect(calls).toHaveLength(1)
        // The no-op is a zero-value USDC self-transfer — the SDK wrapper adds the migration.
        expect(calls[0].to).toBe(USDC)
        expect(calls[0].value).toBe(0n)
        expect(mockRebuildClient).toHaveBeenCalledWith('42161')
    })

    it('does nothing when already healthy', async () => {
        chainState({ deployed: true, cn: 1, vnf: 0 })
        const { result } = renderHook(() => useCardSignatureRepair())
        await act(async () => {
            await result.current.diagnose()
            await result.current.repair()
        })
        expect(mockSendUserOp).not.toHaveBeenCalled()
    })

    it('surfaces a retryable error when the repair never confirms on-chain', async () => {
        jest.useFakeTimers()
        try {
            chainState({ deployed: true, cn: 2, vnf: 3 })
            const { result } = renderHook(() => useCardSignatureRepair())
            await act(async () => {
                await result.current.diagnose()
            })

            // The userOp "lands" but state never changes (e.g. reverted userOp
            // inside a successful bundle) — the confirm poll must not trust the
            // receipt and must give up with a retryable error.
            let repaired: unknown
            await act(async () => {
                const promise = result.current.repair()
                await jest.runAllTimersAsync()
                repaired = await promise
            })

            expect(repaired).toBeNull()
            expect(result.current.error).toMatch(/did not confirm/)
            expect(mockRebuildClient).not.toHaveBeenCalled()
        } finally {
            jest.useRealTimers()
        }
    })
})
