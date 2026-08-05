import type { Address, Hex } from 'viem'
import { encodeFunctionData } from 'viem'
import { KernelV3AccountAbi } from '@zerodev/sdk'

/**
 * The 2025-09-18 emergency validator migration left a subset of kernel
 * accounts with `validNonceFrom` AHEAD of `currentNonce` (a revocation floor
 * above the counter — unreachable through Kernel v3.1's own `invalidateNonce`,
 * which syncs the counter up). Kernel.sol rejects every NON-root validation
 * installed below the floor with `InvalidNonce()` (0x756688fe), so any
 * enable-mode approval (the card auto-balance session key) minted for such an
 * account fails on every backend replay, forever — however correctly it was
 * signed. Root-passkey ops are exempt, so the account looks healthy until a
 * card grant.
 *
 * Repair is a single root userOp the user confirms with one passkey tap:
 * `invalidateNonce(validNonceFrom + 1)` on the account itself — the kernel
 * syncs `currentNonce` up to the new floor, unbricking enable mode.
 * (Undeployed pre-cutoff accounts are a different hazard — AA14 from a
 * mismatched initCode — and are handled by `ensureRootValidatorMigrated`,
 * which verifies the migration against ground truth; not here.)
 *
 * Detection is purely on-chain state of the connected wallet — nothing
 * account-specific ships in this repo.
 *
 * Confirmation is by re-reading chain state, never the bundle receipt: a
 * reverted userOp still yields a successful bundle (same rationale as
 * `ensureRootValidatorMigrated`).
 */

// Kernel v3.1 rejects invalidateNonce more than MAX_NONCE_INCREMENT_SIZE (10)
// above currentNonce AND at-or-below validNonceFrom — a floor further than 10
// ahead of the counter has no valid invalidation target at all.
const MAX_NONCE_INCREMENT_SIZE = 10

/** Transient: the repair op hasn't been observed on-chain yet — retrying is correct. */
export class KernelNonceRepairPendingError extends Error {
    constructor() {
        super('Wallet repair did not confirm in time — please retry in a moment')
        this.name = 'KernelNonceRepairPendingError'
    }
}

/** Deterministic: no single invalidateNonce target exists — needs manual intervention. */
export class KernelNonceRepairUnrepairableError extends Error {
    constructor() {
        super('This wallet needs a manual repair — please contact support')
        this.name = 'KernelNonceRepairUnrepairableError'
    }
}

interface NonceState {
    deployed: boolean
    currentNonce: number
    validNonceFrom: number
}

export interface NoncePublicClient {
    getCode(args: { address: Address }): Promise<Hex | undefined>
    readContract(args: { address: Address; abi: unknown; functionName: string }): Promise<unknown>
}

export interface RepairEnableNonceDeps {
    publicClient: NoncePublicClient
    accountAddress: Address
    /** The floor observed by the caller's read — fallback when re-reads flake. */
    validNonceFrom: number
    /** Sends one root userOp through the user's kernel client (one passkey tap). */
    sendUserOp: (call: { to: Hex; value: bigint; data: Hex }) => Promise<unknown>
    /** On-chain confirmation attempts / spacing (overridable for tests). */
    retries?: number
    intervalMs?: number
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function readNonceState(publicClient: NoncePublicClient, address: Address): Promise<NonceState> {
    const code = await publicClient.getCode({ address })
    if (!code || code === '0x') return { deployed: false, currentNonce: 0, validNonceFrom: 0 }
    const [currentNonce, validNonceFrom] = await Promise.all([
        publicClient.readContract({ address, abi: KernelV3AccountAbi, functionName: 'currentNonce' }),
        publicClient.readContract({ address, abi: KernelV3AccountAbi, functionName: 'validNonceFrom' }),
    ])
    return { deployed: true, currentNonce: Number(currentNonce), validNonceFrom: Number(validNonceFrom) }
}

export const buildInvalidateNonceCall = (
    accountAddress: Address,
    validNonceFrom: number
): { to: Hex; value: bigint; data: Hex } => ({
    to: accountAddress,
    value: 0n,
    data: encodeFunctionData({
        abi: KernelV3AccountAbi,
        functionName: 'invalidateNonce',
        args: [validNonceFrom + 1],
    }),
})

/**
 * Sends the invalidateNonce repair userOp for a floored (deployed) account
 * and confirms it against re-read on-chain state. Returns the enable nonce
 * the caller must bind the grant to.
 */
export async function repairEnableNonce(deps: RepairEnableNonceDeps): Promise<{ validatorNonce: number }> {
    const retries = deps.retries ?? 8
    const intervalMs = deps.intervalMs ?? 1500

    // Re-read live state first: a retry after a confirm timeout must not
    // re-send an invalidateNonce the first op already consumed. The caller
    // only enters here after observing a DEPLOYED floored account, so an
    // "undeployed" fresh read can only be a lagging node — retryable, never
    // grounds for the unrepairable verdict.
    const fresh = await readNonceState(deps.publicClient, deps.accountAddress)
    if (!fresh.deployed) throw new KernelNonceRepairPendingError()
    if (fresh.validNonceFrom <= fresh.currentNonce) {
        return { validatorNonce: Math.max(fresh.currentNonce, 1) }
    }
    if (fresh.validNonceFrom + 1 > fresh.currentNonce + MAX_NONCE_INCREMENT_SIZE) {
        throw new KernelNonceRepairUnrepairableError()
    }
    await deps.sendUserOp(buildInvalidateNonceCall(deps.accountAddress, fresh.validNonceFrom))

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const state = await readNonceState(deps.publicClient, deps.accountAddress)
            if (state.deployed && state.validNonceFrom <= state.currentNonce) {
                return { validatorNonce: Math.max(state.currentNonce, 1) }
            }
        } catch {
            // A flaky read after the op was already sent must not abort the
            // poll — the tap and gas are spent; keep confirming.
        }
        if (attempt < retries - 1) await delay(intervalMs)
    }
    throw new KernelNonceRepairPendingError()
}
