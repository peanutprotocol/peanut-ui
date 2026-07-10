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

export class KernelMigrationPendingError extends Error {
    constructor() {
        super('Account security upgrade did not confirm in time — please retry in a moment')
        this.name = 'KernelMigrationPendingError'
    }
}

export interface EnsureMigratedDeps<TClient extends { account?: unknown }> {
    /** The client currently held by the caller (possibly a migration wrapper). */
    client: TClient
    /** Sends the no-op userOp through the wrapper account (which adds the migration). */
    sendNoopUserOp: (call: ReturnType<typeof buildMigrationNoopCall>) => Promise<{ receipt: TransactionReceipt | null }>
    /** Rebuilds the kernel client from scratch so signing routes to the new validator. */
    rebuildClient: () => Promise<TClient>
    /** Optional analytics hook, called with the step outcome. */
    onEvent?: (event: 'attempted' | 'succeeded') => void
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
 * - Wrapper account, unmigrated → sends the migration userOp, waits for the
 *   receipt, then rebuilds.
 */
export async function ensureRootValidatorMigrated<TClient extends { account?: unknown }>(
    deps: EnsureMigratedDeps<TClient>
): Promise<TClient> {
    const account = deps.client.account
    if (!isMigrationWrapperAccount(account)) return deps.client

    const migrated = await account.getRootValidatorMigrationStatus()
    if (!migrated) {
        deps.onEvent?.('attempted')
        const { receipt } = await deps.sendNoopUserOp(buildMigrationNoopCall(account.address))
        if (!receipt || receipt.status !== 'success') {
            throw new KernelMigrationPendingError()
        }
        deps.onEvent?.('succeeded')
    }
    return deps.rebuildClient()
}
