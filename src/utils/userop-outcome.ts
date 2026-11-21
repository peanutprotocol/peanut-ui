import { http, type Address, type Hash } from 'viem'
import { createBundlerClient } from 'viem/account-abstraction'
import { PUBLIC_CLIENTS_BY_CHAIN } from '@/app/actions/clients'
import { PEANUT_WALLET_CHAIN, USER_OP_ENTRY_POINT, ZERODEV_RPC_TIMEOUT_MS } from '@/constants/zerodev.consts'
import type { BroadcastUserOp } from '@/hooks/wallet/spendBroadcast'
import { userOperationNonceSpent } from '@/utils/userop-submission'

/**
 * Where a signed user op stands on chain.
 * - `executed`: it ran; the money moved in `txHash`.
 * - `reverted`: it was mined and reverted; its batch moved nothing.
 * - `replaced`: another op spent its nonce, so it can never execute.
 * - `not-found`: every read answered: no receipt, and its nonce is still free.
 *   It may still execute (in the mempool, or dropped but resendable).
 * - `unknown`: a read failed, so nothing is known. Never proof that nothing moved.
 */
export type UserOpOutcome = { executed: Hash } | 'reverted' | 'replaced' | 'not-found' | 'unknown'

const config = PUBLIC_CLIENTS_BY_CHAIN[PEANUT_WALLET_CHAIN.id]
let bundler: ReturnType<typeof createBundlerClient> | undefined
const bundlerClient = () =>
    (bundler ??= createBundlerClient({
        chain: config.chain,
        transport: http(config.bundlerUrl, { timeout: ZERODEV_RPC_TIMEOUT_MS }),
    }))

async function readReceipt(hash: Hash) {
    try {
        return await bundlerClient().getUserOperationReceipt({ hash })
    } catch (error) {
        if ((error as Error)?.name === 'UserOperationReceiptNotFoundError') return null
        throw error
    }
}

/** `sender`: the user's smart account, which sends every op a payment signs. */
export async function readUserOpOutcome(op: BroadcastUserOp, sender: Address): Promise<UserOpOutcome> {
    try {
        const receipt = await readReceipt(op.userOpHash)
        if (receipt) return receipt.success ? { executed: receipt.receipt.transactionHash } : 'reverted'
        if (!(await userOperationNonceSpent(config.client, USER_OP_ENTRY_POINT.address, sender, BigInt(op.nonce)))) {
            return 'not-found'
        }
        // The nonce moved after the first look: this op may be the one that
        // spent it, so its receipt is read again before calling it replaced.
        const late = await readReceipt(op.userOpHash)
        if (late) return late.success ? { executed: late.receipt.transactionHash } : 'reverted'
        return 'replaced'
    } catch {
        return 'unknown'
    }
}
