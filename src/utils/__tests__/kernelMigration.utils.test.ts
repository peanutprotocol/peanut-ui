/**
 * Tests for the pre-spend root-validator migration gate.
 *
 * Regression context: mixed spends from unmigrated pre-2025-09-18 accounts
 * deterministically reverted with "Delegatecall failed" because the migration
 * wrapped into the SAME userOp invalidated the pre-signed Rain admin EIP-712
 * signature (routed to the old validator) before `withdrawAsset` verified it
 * via ERC-1271. The gate must: migrate first as its own userOp, then hand the
 * caller a REBUILT client (the old one keeps signing via the old validator).
 */
import type { TransactionReceipt } from 'viem'
import {
    buildMigrationNoopCall,
    ensureRootValidatorMigrated,
    isMigrationWrapperAccount,
    KernelMigrationPendingError,
} from '../kernelMigration.utils'
import { PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'

const ACCOUNT_ADDRESS = '0x70f22a4db066aed9bcd2157a7b19e2e28c10c483' as const

const successReceipt = { status: 'success' } as TransactionReceipt
const revertedReceipt = { status: 'reverted' } as TransactionReceipt

type FakeClient = { account?: unknown; rebuilt?: boolean }

const makeDeps = (opts: { account: unknown; receipt?: TransactionReceipt | null }) => {
    const rebuiltClient: FakeClient = { account: { address: ACCOUNT_ADDRESS }, rebuilt: true }
    const sendNoopUserOp = jest.fn(async () => ({
        receipt: opts.receipt === undefined ? successReceipt : opts.receipt,
    }))
    const rebuildClient = jest.fn(async () => rebuiltClient)
    const events: string[] = []
    return {
        deps: {
            client: { account: opts.account } as FakeClient,
            sendNoopUserOp,
            rebuildClient,
            onEvent: (e: 'attempted' | 'succeeded') => events.push(e),
        },
        sendNoopUserOp,
        rebuildClient,
        rebuiltClient,
        events,
    }
}

const wrapperAccount = (migrated: boolean) => ({
    address: ACCOUNT_ADDRESS,
    getRootValidatorMigrationStatus: jest.fn(async () => migrated),
})

describe('isMigrationWrapperAccount', () => {
    it('detects wrapper accounts by the SDK-added status method', () => {
        expect(isMigrationWrapperAccount(wrapperAccount(false))).toBe(true)
        expect(isMigrationWrapperAccount({ address: ACCOUNT_ADDRESS })).toBe(false)
        expect(isMigrationWrapperAccount(undefined)).toBe(false)
    })
})

describe('buildMigrationNoopCall', () => {
    it('is a zero-value USDC self-transfer (proven-harmless migration payload)', () => {
        const call = buildMigrationNoopCall(ACCOUNT_ADDRESS)
        expect(call.to.toLowerCase()).toBe(PEANUT_WALLET_TOKEN.toLowerCase())
        expect(call.value).toBe(0n)
        // transfer(address,uint256) selector + recipient + amount 0
        expect(call.data.startsWith('0xa9059cbb')).toBe(true)
        expect(call.data.toLowerCase()).toContain(ACCOUNT_ADDRESS.slice(2).toLowerCase())
        expect(call.data.endsWith('0'.repeat(64))).toBe(true)
    })
})

describe('ensureRootValidatorMigrated', () => {
    it('returns the client untouched for plain (already-patched) accounts', async () => {
        const { deps, sendNoopUserOp, rebuildClient } = makeDeps({ account: { address: ACCOUNT_ADDRESS } })
        const result = await ensureRootValidatorMigrated(deps)
        expect(result).toBe(deps.client)
        expect(sendNoopUserOp).not.toHaveBeenCalled()
        expect(rebuildClient).not.toHaveBeenCalled()
    })

    it('rebuilds WITHOUT migrating when the wrapper account is already migrated on-chain', async () => {
        // A wrapper that migrated mid-session still SIGNS via the old validator —
        // returning it unrebuilt would produce rejected EIP-1271 signatures.
        const { deps, sendNoopUserOp, rebuildClient, rebuiltClient } = makeDeps({ account: wrapperAccount(true) })
        const result = await ensureRootValidatorMigrated(deps)
        expect(result).toBe(rebuiltClient)
        expect(sendNoopUserOp).not.toHaveBeenCalled()
        expect(rebuildClient).toHaveBeenCalledTimes(1)
    })

    it('migrates via the no-op userOp, then rebuilds, for unmigrated accounts', async () => {
        const { deps, sendNoopUserOp, rebuildClient, rebuiltClient, events } = makeDeps({
            account: wrapperAccount(false),
        })
        const result = await ensureRootValidatorMigrated(deps)
        expect(sendNoopUserOp).toHaveBeenCalledWith(buildMigrationNoopCall(ACCOUNT_ADDRESS))
        expect(rebuildClient).toHaveBeenCalledTimes(1)
        expect(result).toBe(rebuiltClient)
        expect(events).toEqual(['attempted', 'succeeded'])
    })

    it('throws (and does NOT rebuild) when the migration receipt never confirms', async () => {
        const { deps, rebuildClient, events } = makeDeps({ account: wrapperAccount(false), receipt: null })
        await expect(ensureRootValidatorMigrated(deps)).rejects.toThrow(KernelMigrationPendingError)
        expect(rebuildClient).not.toHaveBeenCalled()
        expect(events).toEqual(['attempted'])
    })

    it('throws when the migration userOp reverts on-chain', async () => {
        const { deps, rebuildClient } = makeDeps({ account: wrapperAccount(false), receipt: revertedReceipt })
        await expect(ensureRootValidatorMigrated(deps)).rejects.toThrow(KernelMigrationPendingError)
        expect(rebuildClient).not.toHaveBeenCalled()
    })
})
