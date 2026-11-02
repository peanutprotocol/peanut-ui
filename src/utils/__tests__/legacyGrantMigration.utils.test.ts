/**
 * Retiring a legacy card grant: uninstall each old validation, then raise the
 * nonce floor to live + 1, in ONE root userOp, and trust only chain state
 * re-read afterwards.
 *
 * Raising the floor alone leaves the old permission installed, and an
 * installed permission can still sign for the wallet. Locked down here:
 *  1. every uninstall comes BEFORE invalidateNonce, in a single userOp
 *  2. the target is the LIVE nonce + 1, never the backend's number
 *  3. a payload that cannot be checked (wrong id type, root id, bad data,
 *     duplicates, empty) stops everything before any userOp
 *  4. success is proven by re-reading the chain after the receipt, not by the receipt
 *  5. an unreadable chain, an undeployed wallet or an out-of-range floor sends nothing
 *  6. concurrent signing or spend sessions stop it, and it stops them
 */
import { decodeFunctionData, encodeAbiParameters, zeroAddress, type Hex } from 'viem'

// The repo maps `@zerodev/sdk` to an empty stub for unit tests. The calls built
// here are only meaningful against the REAL kernel ABI, so load that one.
jest.mock('@zerodev/sdk', () => ({
    KernelV3AccountAbi: jest.requireActual(
        '../../../node_modules/@zerodev/sdk/_cjs/accounts/kernel/abi/kernel_v_3_0_0/KernelAccountAbi.js'
    ).KernelV3AccountAbi,
}))

import { KernelV3AccountAbi } from '@zerodev/sdk'
import { LegacyMigrationPayloadError, parseLegacyMigration, retireLegacyGrants } from '../legacyGrantMigration.utils'
import { beginKernelSigning, KernelSigningBusyError } from '../kernelSigningGuard'

const WALLET = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const ID_A = `0x02${'aa'.repeat(20)}` as Hex
const ID_B = `0x02${'bb'.repeat(20)}` as Hex
const MIGRATION = {
    uninstall: [
        { validationId: ID_A, deinitData: '0x1111' },
        { validationId: ID_B, deinitData: '0x2222' },
    ],
    invalidateNonceFloor: 4,
}

describe('parseLegacyMigration', () => {
    it('accepts a permission-id payload and keeps its order', () => {
        expect(parseLegacyMigration(MIGRATION)).toEqual({
            uninstalls: [
                { validationId: ID_A, deinitData: '0x1111' },
                { validationId: ID_B, deinitData: '0x2222' },
            ],
            invalidateNonceFloor: 4,
        })
    })

    it.each([
        ['no payload', null],
        ['an empty list', { ...MIGRATION, uninstall: [] }],
        [
            'too many entries',
            {
                ...MIGRATION,
                uninstall: Array.from({ length: 9 }, (_, i) => ({
                    validationId: `0x02${i.toString(16).padStart(2, '0').repeat(20)}`,
                    deinitData: '0x12',
                })),
            },
        ],
        [
            'the root validator type byte',
            { ...MIGRATION, uninstall: [{ validationId: `0x00${'aa'.repeat(20)}`, deinitData: '0x12' }] },
        ],
        [
            'a plain validator type byte',
            { ...MIGRATION, uninstall: [{ validationId: `0x01${'aa'.repeat(20)}`, deinitData: '0x12' }] },
        ],
        ['a 20-byte id', { ...MIGRATION, uninstall: [{ validationId: `0x${'aa'.repeat(20)}`, deinitData: '0x12' }] }],
        ['odd-length deinit data', { ...MIGRATION, uninstall: [{ validationId: ID_A, deinitData: '0x123' }] }],
        ['empty deinit data', { ...MIGRATION, uninstall: [{ validationId: ID_A, deinitData: '0x' }] }],
        [
            'oversized deinit data',
            { ...MIGRATION, uninstall: [{ validationId: ID_A, deinitData: `0x${'ab'.repeat(4097)}` }] },
        ],
        [
            'a duplicate id in another case',
            {
                ...MIGRATION,
                uninstall: [
                    MIGRATION.uninstall[0],
                    { validationId: ID_A.toUpperCase().replace('0X', '0x'), deinitData: '0x12' },
                ],
            },
        ],
        ['a missing floor', { uninstall: MIGRATION.uninstall }],
        ['a negative floor', { ...MIGRATION, invalidateNonceFloor: -1 }],
    ])('refuses %s', (_name, payload) => {
        expect(() => parseLegacyMigration(payload as never)).toThrow(LegacyMigrationPayloadError)
    })
})

// A tiny chain: the kernel's nonces and which validations are installed. A
// userOp applies its calls in order, like the real batch.
const makeChain = (init: { currentNonce?: number; validNonceFrom?: number; installed?: Hex[]; deployed?: boolean }) => {
    const state = {
        currentNonce: init.currentNonce ?? 2,
        validNonceFrom: init.validNonceFrom ?? 1,
        installed: new Set<string>((init.installed ?? [ID_A, ID_B]).map((id) => id.toLowerCase())),
        deployed: init.deployed ?? true,
        readFails: false,
        applyOnSend: true,
        calls: [] as { fn: string; args: readonly unknown[] }[][],
    }
    const publicClient = {
        getCode: jest.fn(async () => (state.deployed ? ('0x60' as Hex) : undefined)),
        readContract: jest.fn(async ({ functionName, args }: { functionName: string; args?: unknown[] }) => {
            if (state.readFails) throw new Error('rpc down')
            if (functionName === 'currentNonce') return state.currentNonce
            if (functionName === 'validNonceFrom') return state.validNonceFrom
            if (functionName === 'validationConfig') {
                const installed = state.installed.has(String(args?.[0]).toLowerCase())
                return [installed ? 1 : 0, installed ? '0x0000000000000000000000000000000000000001' : zeroAddress]
            }
            throw new Error(`unexpected read ${functionName}`)
        }),
    }
    const sendUserOp = jest.fn(async (calls: { to: Hex; value: bigint; data: Hex }[]) => {
        const decoded = calls.map((call) => decodeFunctionData({ abi: KernelV3AccountAbi, data: call.data }))
        state.calls.push(decoded.map((d) => ({ fn: d.functionName, args: d.args ?? [] })))
        if (!state.applyOnSend) return
        for (const d of decoded) {
            if (d.functionName === 'uninstallValidation') state.installed.delete(String(d.args?.[0]).toLowerCase())
            if (d.functionName === 'invalidateNonce') {
                const target = Number(d.args?.[0])
                state.validNonceFrom = target
                state.currentNonce = Math.max(state.currentNonce, target)
            }
        }
    })
    return { state, publicClient, sendUserOp }
}

const retire = (chain: ReturnType<typeof makeChain>, extra: object = {}) =>
    retireLegacyGrants({
        publicClient: chain.publicClient as never,
        accountAddress: WALLET,
        migration: parseLegacyMigration(MIGRATION),
        sendUserOp: chain.sendUserOp,
        retries: 3,
        intervalMs: 0,
        ...extra,
    })

describe('retireLegacyGrants', () => {
    it('uninstalls every old validation BEFORE invalidateNonce, in one userOp, to live nonce + 1', async () => {
        const chain = makeChain({ currentNonce: 2, validNonceFrom: 1 })
        await retire(chain)

        expect(chain.sendUserOp).toHaveBeenCalledTimes(1)
        const [batch] = chain.state.calls
        expect(batch.map((c) => c.fn)).toEqual(['uninstallValidation', 'uninstallValidation', 'invalidateNonce'])
        expect(batch[0].args).toEqual([ID_A, '0x1111', '0x'])
        expect(batch[1].args).toEqual([ID_B, '0x2222', '0x'])
        // the LIVE nonce (2) + 1, not the backend's floor (4)
        expect(batch[2].args).toEqual([3])
        expect(chain.state.installed.size).toBe(0)
        expect(chain.state.validNonceFrom).toBe(3)
    })

    it('every call targets the wallet itself with zero value', async () => {
        const chain = makeChain({})
        await retire(chain)
        const calls = chain.sendUserOp.mock.calls[0][0]
        expect(calls.every((call) => call.to === WALLET && call.value === 0n)).toBe(true)
    })

    it('reads the live nonce right before building the batch', async () => {
        const chain = makeChain({ currentNonce: 6, validNonceFrom: 1 })
        await retire(chain)
        expect(chain.state.calls[0].at(-1)?.args).toEqual([7])
        // reads happened before the send
        const firstRead = chain.publicClient.readContract.mock.invocationCallOrder[0]
        expect(firstRead).toBeLessThan(chain.sendUserOp.mock.invocationCallOrder[0])
    })

    it('a floored wallet (floor above the counter) targets floor + 1, still inside the kernel bound', async () => {
        const chain = makeChain({ currentNonce: 2, validNonceFrom: 5 })
        await retire(chain)
        expect(chain.state.calls[0].at(-1)?.args).toEqual([6])
    })

    it('proves success from chain state re-read AFTER the userOp, not from the send', async () => {
        const chain = makeChain({})
        const readsBeforeSend = () => chain.publicClient.readContract.mock.invocationCallOrder
        await retire(chain)
        const sendOrder = chain.sendUserOp.mock.invocationCallOrder[0]
        expect(readsBeforeSend().some((order) => order > sendOrder)).toBe(true)
    })

    it('a userOp that "succeeded" but changed nothing on chain is NOT success', async () => {
        const chain = makeChain({})
        chain.state.applyOnSend = false
        await expect(retire(chain)).rejects.toMatchObject({ name: 'KernelNonceRepairPendingError' })
        // it polled the chain instead of trusting the send
        expect(chain.publicClient.readContract.mock.calls.length).toBeGreaterThan(8)
    })

    it('a half-done chain (floor raised, an old validation still installed) is NOT success', async () => {
        const chain = makeChain({})
        chain.sendUserOp.mockImplementation(async () => {
            chain.state.validNonceFrom = 3
            chain.state.currentNonce = 3
        })
        await expect(retire(chain)).rejects.toMatchObject({ name: 'KernelNonceRepairPendingError' })
    })

    it('a flaky read after the send does not abort the confirmation', async () => {
        const chain = makeChain({})
        const send = chain.sendUserOp.getMockImplementation()!
        chain.sendUserOp.mockImplementation(async (calls) => {
            await send(calls)
            chain.state.readFails = true
            setTimeout(() => {
                chain.state.readFails = false
            }, 0)
        })
        await expect(retire(chain, { retries: 6, intervalMs: 5 })).resolves.toBeUndefined()
    })

    it('a retry after a lost confirmation uninstalls only what is still installed', async () => {
        const chain = makeChain({ installed: [ID_B], currentNonce: 2, validNonceFrom: 1 })
        await retire(chain)
        expect(chain.state.calls[0].map((c) => c.fn)).toEqual(['uninstallValidation', 'invalidateNonce'])
        expect(chain.state.calls[0][0].args[0]).toBe(ID_B)
    })

    it('is done, and sends nothing, when nothing is installed and the floor already reached the backend floor', async () => {
        const chain = makeChain({ installed: [], currentNonce: 4, validNonceFrom: 4 })
        await retire(chain)
        expect(chain.sendUserOp).not.toHaveBeenCalled()
    })

    it('still raises the floor when the validations are gone but the floor is not up (saved enable signatures stay dead)', async () => {
        const chain = makeChain({ installed: [], currentNonce: 2, validNonceFrom: 1 })
        await retire(chain)
        expect(chain.state.calls[0].map((c) => c.fn)).toEqual(['invalidateNonce'])
    })

    it('fails closed on an unreadable chain: nothing is sent', async () => {
        const chain = makeChain({})
        chain.state.readFails = true
        await expect(retire(chain)).rejects.toThrow('rpc down')
        expect(chain.sendUserOp).not.toHaveBeenCalled()
    })

    it('sends nothing for a wallet that is not deployed', async () => {
        const chain = makeChain({ deployed: false })
        await expect(retire(chain)).rejects.toMatchObject({ name: 'KernelNonceRepairPendingError' })
        expect(chain.sendUserOp).not.toHaveBeenCalled()
    })

    it('sends nothing when no valid nonce target fits inside the kernel bound', async () => {
        const chain = makeChain({ currentNonce: 1, validNonceFrom: 30 })
        await expect(retire(chain)).rejects.toMatchObject({ name: 'KernelNonceRepairUnrepairableError' })
        expect(chain.sendUserOp).not.toHaveBeenCalled()
    })

    it('a cancelled passkey leaves the chain untouched and nothing held', async () => {
        const chain = makeChain({})
        chain.sendUserOp.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotAllowedError' }))
        await expect(retire(chain)).rejects.toMatchObject({ name: 'NotAllowedError' })
        // the guard was released: another session may start
        const release = beginKernelSigning()
        release()
    })
})

describe('concurrent signing and spend sessions', () => {
    it('refuses to start while a signing or spend session is open, and sends nothing', async () => {
        const chain = makeChain({})
        const release = beginKernelSigning()
        try {
            await expect(retire(chain)).rejects.toBeInstanceOf(KernelSigningBusyError)
            expect(chain.sendUserOp).not.toHaveBeenCalled()
            expect(chain.publicClient.readContract).not.toHaveBeenCalled()
        } finally {
            release()
        }
        // once the session ends, the migration runs
        await retire(chain)
        expect(chain.sendUserOp).toHaveBeenCalledTimes(1)
    })

    it('blocks a new signing or spend session for as long as the migration runs, then frees it', async () => {
        const chain = makeChain({})
        let duringSend: unknown
        chain.sendUserOp.mockImplementationOnce(async () => {
            try {
                beginKernelSigning()
                duringSend = 'allowed'
            } catch (e) {
                duringSend = e
            }
        })
        await retire(chain).catch(() => undefined)
        expect(duringSend).toBeInstanceOf(KernelSigningBusyError)
        expect((duringSend as KernelSigningBusyError).reason).toBe('migration-running')
        // freed afterwards, even though the migration did not confirm
        expect(() => beginKernelSigning()()).not.toThrow()
    })

    it('two migrations never overlap', async () => {
        const chain = makeChain({})
        let release!: () => void
        chain.sendUserOp.mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    release = resolve
                })
        )
        const first = retire(chain).catch(() => undefined)
        await new Promise((resolve) => setTimeout(resolve, 0))
        await expect(retire(chain)).rejects.toBeInstanceOf(KernelSigningBusyError)
        release()
        await first
    })

    it('a session that is never released frees itself after its lifetime', () => {
        jest.useFakeTimers()
        try {
            beginKernelSigning(1_000)
            jest.advanceTimersByTime(1_001)
            expect(() => beginKernelSigning()()).not.toThrow()
        } finally {
            jest.useRealTimers()
        }
    })
})

// keep the ABI-encoding import honest: the deinit data is passed through as given
it('passes deinit data through unchanged', async () => {
    const data = encodeAbiParameters([{ type: 'uint256' }], [7n])
    const parsed = parseLegacyMigration({
        uninstall: [{ validationId: ID_A, deinitData: data }],
        invalidateNonceFloor: 2,
    })
    expect(parsed.uninstalls[0].deinitData).toBe(data)
})
