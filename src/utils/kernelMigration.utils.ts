import type { Address, Hex, TransactionReceipt } from 'viem'
import { encodeFunctionData, erc20Abi } from 'viem'
import { PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'

/**
 * Pre-2025-09-18 accounts run on the unpatched v0.0.2 passkey validator until
 * their first root-validated userOp, which the SDK auto-wraps in a
 * `migrateWithCall` that swaps the root validator to v0.0.3 BEFORE executing
 * the wrapped calls. Any EIP-1271 signature produced before that userOp (the
 * Rain admin EIP-712 in a `mixed` spend) is routed to v0.0.2 and becomes
 * invalid the instant the migration inside the same userOp runs — the whole
 * op reverts with "Delegatecall failed", deterministically.
 *
 * Fix: when the account is still unmigrated and the flow carries a pre-signed
 * EIP-1271 signature, run the migration as its own no-op userOp first, then
 * rebuild the kernel client so all subsequent signatures route to v0.0.3.
 * See ops/notify/zerodev-v002-stuck-card-withdrawals-2026-07-06.md (mono).
 */

/** Shape added by `createKernelMigrationAccount` — absent on plain accounts. */
export interface MigrationCapableAccount {
    address: Address
    getRootValidatorMigrationStatus?: () => Promise<boolean>
}

export const isMigrationWrapperAccount = (account: unknown): account is Required<MigrationCapableAccount> =>
    typeof (account as MigrationCapableAccount)?.getRootValidatorMigrationStatus === 'function'

/**
 * The payload for the standalone migration userOp: a zero-value USDC
 * self-transfer. The SDK wraps it in `migrateWithCall`; the migration is the
 * point, the transfer is a proven-harmless no-op (verified by on-chain
 * simulation of the affected account — see the RCA above).
 */
export const buildMigrationNoopCall = (accountAddress: Address): { to: Hex; value: bigint; data: Hex } => ({
    to: PEANUT_WALLET_TOKEN as Hex,
    value: 0n,
    data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [accountAddress, 0n],
    }),
})

/** Transient: the migration hasn't been observed on-chain yet — retrying is correct. */
export class KernelMigrationPendingError extends Error {
    constructor() {
        super('Account security upgrade did not confirm in time — please retry in a moment')
        this.name = 'KernelMigrationPendingError'
    }
}

/** Deterministic: the migration userOp reverted on-chain — retrying cannot succeed. */
export class KernelMigrationFailedError extends Error {
    constructor() {
        super('Account security upgrade failed — please contact support')
        this.name = 'KernelMigrationFailedError'
    }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface EnsureMigratedDeps<TClient extends { account?: unknown }> {
    /** The client currently held by the caller (possibly a migration wrapper). */
    client: TClient
    /** Sends the no-op userOp through the wrapper account (which adds the migration). */
    sendNoopUserOp: (call: ReturnType<typeof buildMigrationNoopCall>) => Promise<{ receipt: TransactionReceipt | null }>
    /** Rebuilds the kernel client from scratch so signing routes to the new validator. */
    rebuildClient: () => Promise<TClient>
    /** Optional analytics hook, called with the step outcome. */
    onEvent?: (event: 'attempted' | 'succeeded') => void
    /** On-chain status verification attempts / spacing (overridable for tests). */
    statusRetries?: number
    statusIntervalMs?: number
}

/**
 * Guarantees the account behind `client` is on the patched root validator
 * before the caller produces any EIP-1271 signature that will be verified
 * inside its own (otherwise migration-wrapped) userOp.
 *
 * - Plain (already-patched / post-cutoff) account → returns `client` untouched.
 * - Wrapper account, already migrated on-chain (e.g. migrated earlier this
 *   session) → rebuilds only: the wrapper still SIGNS via the old validator
 *   even after migration, so its signatures would be rejected.
 * - Wrapper account, unmigrated → sends the migration userOp, verifies the
 *   migration against the ON-CHAIN root validator (never the bundle receipt —
 *   4337 reverts still produce successful bundles), then rebuilds and asserts
 *   the wrapper is gone.
 */
export async function ensureRootValidatorMigrated<TClient extends { account?: unknown }>(
    deps: EnsureMigratedDeps<TClient>
): Promise<TClient> {
    const account = deps.client.account
    if (!isMigrationWrapperAccount(account)) return deps.client
    const retries = deps.statusRetries ?? 5
    const intervalMs = deps.statusIntervalMs ?? 1500

    const migrated = await account.getRootValidatorMigrationStatus()
    if (!migrated) {
        deps.onEvent?.('attempted')
        const { receipt } = await deps.sendNoopUserOp(buildMigrationNoopCall(account.address))
        if (receipt?.status === 'reverted') {
            // The bundle itself reverted — deterministic; retrying cannot help.
            throw new KernelMigrationFailedError()
        }
        // ERC-4337: a REVERTED userOp still yields a SUCCESSFUL bundle receipt
        // (the EntryPoint's handleOps tx succeeds; only the userOp-level
        // `success` flag is false, and handleSendUserOpEncoded drops it). The
        // receipt is therefore NOT proof of migration — verify against ground
        // truth by re-reading the on-chain root validator, with a short poll
        // to ride out RPC propagation. A null receipt (timeout) takes the same
        // path: if the op actually landed, the status flips and we proceed.
        let confirmed = false
        for (let attempt = 0; attempt < retries && !confirmed; attempt++) {
            confirmed = await account.getRootValidatorMigrationStatus()
            if (!confirmed && attempt < retries - 1) await delay(intervalMs)
        }
        if (!confirmed) throw new KernelMigrationPendingError()
        deps.onEvent?.('succeeded')
    }

    // Rebuild — and verify the wrapper is actually gone. The rebuild re-reads
    // the root validator through the public RPC, which can lag the bundler
    // that confirmed the migration; a lagging node hands back another
    // v0.0.2-signing wrapper whose signatures would revert exactly like the
    // bug this gate exists to fix. Fail closed rather than sign wrong.
    let rebuilt = await deps.rebuildClient()
    if (isMigrationWrapperAccount(rebuilt.account)) {
        await delay(intervalMs)
        rebuilt = await deps.rebuildClient()
        if (isMigrationWrapperAccount(rebuilt.account)) throw new KernelMigrationPendingError()
    }
    return rebuilt
}
