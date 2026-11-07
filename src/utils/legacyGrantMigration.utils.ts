import { encodeFunctionData, isHex, zeroAddress, type Address, type Hex } from 'viem'
import { KernelV3AccountAbi } from '@zerodev/sdk'
import type { RainFundingMigration } from '@/services/rain'
import {
    KernelNonceRepairPendingError,
    KernelNonceRepairUnrepairableError,
    type NoncePublicClient,
} from '@/utils/kernelNonceRepair.utils'
import { beginKernelMigration } from '@/utils/kernelSigningGuard'

/**
 * Retiring a legacy combined card grant (`management.status ===
 * 'migration_required'`), confirmation 1 of 2.
 *
 * Raising the wallet's nonce floor alone leaves the old permission installed,
 * and an installed permission can still sign for the wallet (ERC-1271) whatever
 * the floor says. So the old validations are uninstalled first, then the floor
 * is raised, all in ONE root userOp, so a half-done state cannot exist.
 *
 * The backend names what to uninstall; the client trusts none of it blindly.
 * Every entry must be a permission validation id (type byte 0x02, 21 bytes, so
 * the root validator can never be named) with well-formed deinit data.
 * Anything else stops the migration before any userOp, with nothing signed.
 *
 * Confirmation is by re-reading chain state, never the bundle receipt: a userOp
 * inside a successful bundle can still have reverted.
 */

/** A permission validation id: type byte 0x02 + 20 bytes (the permission id right-padded). */
const PERMISSION_VALIDATION_ID = /^0x02[0-9a-fA-F]{40}$/
const MAX_UNINSTALLS = 8
const MAX_DEINIT_BYTES = 4096
// Kernel v3.1 rejects an invalidateNonce more than 10 above currentNonce.
const MAX_NONCE_INCREMENT_SIZE = 10

/** The backend's migration payload is not one this app will act on. Nothing was sent. */
export class LegacyMigrationPayloadError extends Error {
    constructor(readonly detail: string) {
        super(`Card permission update refused: ${detail}`)
        this.name = 'LegacyMigrationPayloadError'
    }
}

export interface LegacyUninstall {
    validationId: Hex
    deinitData: Hex
}

export interface ParsedLegacyMigration {
    uninstalls: LegacyUninstall[]
    /** The backend's read of currentNonce + 1. Informational: the live chain decides. */
    invalidateNonceFloor: number
}

export function parseLegacyMigration(migration: RainFundingMigration | null | undefined): ParsedLegacyMigration {
    if (!migration || typeof migration !== 'object') throw new LegacyMigrationPayloadError('no migration payload')
    const { uninstall, invalidateNonceFloor } = migration
    if (!Array.isArray(uninstall) || uninstall.length === 0 || uninstall.length > MAX_UNINSTALLS) {
        throw new LegacyMigrationPayloadError('uninstall list is missing, empty or too long')
    }
    if (!Number.isInteger(invalidateNonceFloor) || invalidateNonceFloor <= 0) {
        throw new LegacyMigrationPayloadError('invalid nonce floor')
    }
    const seen = new Set<string>()
    const uninstalls = uninstall.map((entry): LegacyUninstall => {
        const { validationId, deinitData } = entry ?? ({} as Partial<LegacyUninstall>)
        if (typeof validationId !== 'string' || !PERMISSION_VALIDATION_ID.test(validationId)) {
            throw new LegacyMigrationPayloadError('not a permission validation id')
        }
        if (
            typeof deinitData !== 'string' ||
            !isHex(deinitData, { strict: true }) ||
            deinitData.length % 2 !== 0 ||
            deinitData.length <= 2 ||
            (deinitData.length - 2) / 2 > MAX_DEINIT_BYTES
        ) {
            throw new LegacyMigrationPayloadError('malformed deinit data')
        }
        const key = validationId.toLowerCase()
        if (seen.has(key)) throw new LegacyMigrationPayloadError('duplicate validation id')
        seen.add(key)
        return { validationId: validationId as Hex, deinitData: deinitData as Hex }
    })
    return { uninstalls, invalidateNonceFloor }
}

interface RetireDeps {
    publicClient: NoncePublicClient
    accountAddress: Address
    migration: ParsedLegacyMigration
    /** Sends ONE root userOp with all calls, through the user's kernel client (one passkey confirmation). */
    sendUserOp: (calls: { to: Hex; value: bigint; data: Hex }[]) => Promise<unknown>
    /** On-chain confirmation attempts / spacing (overridable for tests). */
    retries?: number
    intervalMs?: number
}

interface ChainState {
    deployed: boolean
    currentNonce: number
    validNonceFrom: number
    /** Per requested validation id, whether it is still installed (its hook is set). */
    installed: boolean[]
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function readState(
    publicClient: NoncePublicClient,
    account: Address,
    uninstalls: LegacyUninstall[]
): Promise<ChainState> {
    const code = await publicClient.getCode({ address: account })
    if (!code || code === '0x') {
        return { deployed: false, currentNonce: 0, validNonceFrom: 0, installed: uninstalls.map(() => false) }
    }
    const read = (functionName: string, args?: unknown[]) =>
        (publicClient.readContract as (a: unknown) => Promise<unknown>)({
            address: account,
            abi: KernelV3AccountAbi,
            functionName,
            ...(args ? { args } : {}),
        })
    const [currentNonce, validNonceFrom, configs] = await Promise.all([
        read('currentNonce'),
        read('validNonceFrom'),
        Promise.all(uninstalls.map((u) => read('validationConfig', [u.validationId]))),
    ])
    return {
        deployed: true,
        currentNonce: Number(currentNonce),
        validNonceFrom: Number(validNonceFrom),
        installed: configs.map((config) => {
            const hook = Array.isArray(config) ? config[1] : (config as { hook?: unknown } | null)?.hook
            return typeof hook === 'string' && hook.toLowerCase() !== zeroAddress
        }),
    }
}

/**
 * Sends the migration userOp and confirms it on chain. Reads the live nonce
 * right before building (a failed read stops here), uninstalls each old
 * validation that is still installed, then `invalidateNonce(live + 1)`, in
 * that order, in one userOp.
 *
 * Idempotent after a lost confirmation: validations already gone are not
 * uninstalled again (that would revert the whole batch), and a wallet whose
 * floor already reached the backend's floor with nothing left installed is done.
 *
 * Refuses (`KernelSigningBusyError`) while another signing or spend session is
 * open on the kernel, and blocks new ones until it is confirmed.
 */
export async function retireLegacyGrants(deps: RetireDeps): Promise<void> {
    const { publicClient, accountAddress, migration, sendUserOp } = deps
    const retries = deps.retries ?? 8
    const intervalMs = deps.intervalMs ?? 1500

    const release = beginKernelMigration()
    try {
        const before = await readState(publicClient, accountAddress, migration.uninstalls)
        // Nothing to retire on a wallet that is not deployed yet: the payload cannot describe it.
        if (!before.deployed) throw new KernelNonceRepairPendingError()

        const stillInstalled = migration.uninstalls.filter((_, index) => before.installed[index])
        if (stillInstalled.length === 0 && before.validNonceFrom >= migration.invalidateNonceFloor) return

        const target = Math.max(before.currentNonce, before.validNonceFrom) + 1
        if (target > before.currentNonce + MAX_NONCE_INCREMENT_SIZE) throw new KernelNonceRepairUnrepairableError()

        await sendUserOp([
            ...stillInstalled.map((u) => ({
                to: accountAddress as Hex,
                value: 0n,
                data: encodeFunctionData({
                    abi: KernelV3AccountAbi,
                    functionName: 'uninstallValidation',
                    args: [u.validationId as Hex, u.deinitData, '0x'],
                }),
            })),
            {
                to: accountAddress as Hex,
                value: 0n,
                data: encodeFunctionData({ abi: KernelV3AccountAbi, functionName: 'invalidateNonce', args: [target] }),
            },
        ])

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const after = await readState(publicClient, accountAddress, migration.uninstalls)
                if (
                    after.deployed &&
                    after.installed.every((installed) => !installed) &&
                    after.validNonceFrom >= target
                ) {
                    return
                }
            } catch {
                // The confirmation and gas are spent; a flaky read must not abort the poll.
            }
            if (attempt < retries - 1) await delay(intervalMs)
        }
        throw new KernelNonceRepairPendingError()
    } finally {
        release()
    }
}
