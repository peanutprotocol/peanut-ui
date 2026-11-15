/**
 * signKernelPermission — a repair inside the signer never sends for a user or
 * wallet that is no longer current.
 *
 * The nonce repair (`repairEnableNonce`) and the deploy gate
 * (`ensureRootValidatorMigrated`) both read chain state before they send their
 * root userOp, so a check made before calling them does not cover that read.
 * The signer checks again inside each sending callback, right before the send.
 * The real helpers run here; only the SDK, the public client and the passkey
 * are faked.
 */
import type { Address } from 'viem'

// The repair encodes `invalidateNonce`, which needs the real kernel ABI; the
// repo maps `@zerodev/sdk` to a stub with an empty one.
jest.mock('@zerodev/sdk', () => ({
    ...jest.requireActual('@/utils/__mocks__/zerodev-sdk'),
    KernelV3AccountAbi: jest.requireActual(
        '../../../../node_modules/@zerodev/sdk/_cjs/accounts/kernel/abi/kernel_v_3_0_0/KernelAccountAbi.js'
    ).KernelV3AccountAbi,
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: { getCode: jest.fn(), readContract: jest.fn() } }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    withCeremonyPurpose: (_purpose: string, fn: () => Promise<unknown>) => fn(),
}))
jest.mock('@zerodev/permissions', () => ({
    toPermissionValidator: jest.fn(() => Promise.resolve({ address: '0xperm' })),
    serializePermissionAccount: jest.fn(() => Promise.resolve('SERIALIZED_PERMISSION')),
}))
jest.mock('@zerodev/permissions/signers', () => ({ toECDSASigner: jest.fn(() => Promise.resolve({})) }))

import { createKernelAccount, getPluginsEnableTypedData } from '@zerodev/sdk'
import { peanutPublicClient } from '@/app/actions/clients'
import { PermissionWalletMismatchError, signKernelPermission } from '../signKernelPermission'

const ACCOUNT = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553' as Address
const SESSION_KEY = '0x4300F803a281e257F3C1de001512e68972f8d022' as Address

const getCode = peanutPublicClient.getCode as jest.Mock
const readContract = peanutPublicClient.readContract as jest.Mock

/** Waits (bounded) until the signer has reached the held read. */
const reached = async (condition: () => boolean) => {
    for (let i = 0; i < 50 && !condition(); i++) await new Promise((resolve) => setTimeout(resolve, 0))
    expect(condition()).toBe(true)
}

const gate = () => {
    let release!: () => void
    const promise = new Promise<void>((resolve) => (release = resolve))
    return { promise, release }
}

let current: boolean
let chain: { deployed: boolean; currentNonce: number; validNonceFrom: number }
let signTypedData: jest.Mock
let sendUserOp: jest.Mock

const run = (account: Record<string, unknown> = { address: ACCOUNT }) =>
    signKernelPermission({
        policies: [] as never,
        sessionKeyAddress: SESSION_KEY,
        expectedAccount: ACCOUNT,
        isCurrent: () => current,
        kernel: {
            ensureClientForChain: jest.fn(async () => ({ account })) as never,
            getPatchedSudoValidator: jest.fn(async () => ({ address: '0xpatched', signTypedData })) as never,
            rebuildClientForChain: jest.fn(async () => ({ account: { address: ACCOUNT } })) as never,
        },
        sendUserOp: sendUserOp as never,
    })

beforeEach(() => {
    jest.clearAllMocks()
    current = true
    signTypedData = jest.fn(async () => '0xENABLESIG')
    ;(createKernelAccount as jest.Mock).mockImplementation(async () => ({
        address: ACCOUNT,
        kernelPluginManager: { getAction: () => ({}), hook: undefined },
    }))
    ;(getPluginsEnableTypedData as jest.Mock).mockResolvedValue({})
    getCode.mockImplementation(async () => (chain.deployed ? '0xdeadbeef' : undefined))
    readContract.mockImplementation(async ({ functionName }: { functionName: string }) => {
        if (!chain.deployed) throw new Error('not deployed')
        if (functionName === 'currentNonce') return BigInt(chain.currentNonce)
        if (functionName === 'validNonceFrom') return BigInt(chain.validNonceFrom)
        throw new Error(`unexpected read ${functionName}`)
    })
})

// validNonceFrom ahead of currentNonce: the signer repairs it with one root userOp first.
describe('signKernelPermission — the nonce repair', () => {
    beforeEach(() => {
        chain = { deployed: true, currentNonce: 1, validNonceFrom: 5 }
        sendUserOp = jest.fn(async () => {
            chain.currentNonce = 6
            return { userOpHash: '0xhash', receipt: null }
        })
    })

    it('repairs, then signs bound to the repaired nonce', async () => {
        await expect(run()).resolves.toBe('SERIALIZED_PERMISSION')
        expect(sendUserOp).toHaveBeenCalledTimes(1)
        expect(getPluginsEnableTypedData).toHaveBeenCalledWith(expect.objectContaining({ validatorNonce: 6 }))
        expect(signTypedData).toHaveBeenCalledTimes(1)
    })

    it('a switch while the repair reads the wallet state sends nothing and prompts no passkey', async () => {
        // the signer's own read passes; the repair's fresh read is held
        const held = gate()
        getCode
            .mockImplementationOnce(async () => '0xdeadbeef')
            .mockImplementationOnce(async () => {
                await held.promise
                return '0xdeadbeef'
            })
        const pending = run()
        await reached(() => getCode.mock.calls.length >= 2)
        current = false
        held.release()
        await expect(pending).rejects.toBeInstanceOf(PermissionWalletMismatchError)
        expect(sendUserOp).not.toHaveBeenCalled()
        expect(signTypedData).not.toHaveBeenCalled()
    })
})

// An undeployed pre-cutoff wallet: the signer deploys it through the migration gate first.
describe('signKernelPermission — the deploy gate', () => {
    let migrated: boolean
    const wrapperAccount = () => ({
        address: ACCOUNT,
        getRootValidatorMigrationStatus: jest.fn(async () => migrated),
    })

    beforeEach(() => {
        chain = { deployed: false, currentNonce: 0, validNonceFrom: 0 }
        migrated = false
        sendUserOp = jest.fn(async () => {
            migrated = true
            chain = { deployed: true, currentNonce: 1, validNonceFrom: 0 }
            return { userOpHash: '0xhash', receipt: { status: 'success' } }
        })
    })

    it('deploys, then signs', async () => {
        await expect(run(wrapperAccount())).resolves.toBe('SERIALIZED_PERMISSION')
        expect(sendUserOp).toHaveBeenCalledTimes(1)
        expect(signTypedData).toHaveBeenCalledTimes(1)
    })

    it('a switch while the gate reads the migration state sends nothing and prompts no passkey', async () => {
        const held = gate()
        const account = wrapperAccount()
        account.getRootValidatorMigrationStatus.mockImplementationOnce(async () => {
            await held.promise
            return false
        })
        const pending = run(account)
        await reached(() => account.getRootValidatorMigrationStatus.mock.calls.length >= 1)
        current = false
        held.release()
        await expect(pending).rejects.toBeInstanceOf(PermissionWalletMismatchError)
        expect(sendUserOp).not.toHaveBeenCalled()
        expect(signTypedData).not.toHaveBeenCalled()
    })
})
