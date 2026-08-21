import type { Hash, TransactionReceipt } from 'viem'

/**
 * The slice of a bundler client this util needs. `getUserOperationReceipt`
 * throws (UserOperationReceiptNotFoundError) while the userOp is not yet
 * indexed — treated the same as a null result here.
 */
export interface UserOpReceiptReader {
    getUserOperationReceipt(args: { hash: Hash }): Promise<{ receipt: TransactionReceipt } | null>
}

/**
 * Bounded re-poll for a userOp receipt after `waitForUserOperationReceipt`
 * gave up. The wait often fails transiently (bundler receipt endpoint flake,
 * slow indexing) while the transaction actually lands seconds later — and a
 * caller that proceeds without the receipt ends up submitting the userOp
 * hash as a transaction hash, which no RPC can ever resolve (TASK-21147:
 * the backend then burns its whole retry window and marks a SUCCESSFUL
 * payment as failed).
 *
 * Returns the receipt, or null if it never appeared within the budget.
 */
export async function pollForUserOpReceipt(
    client: UserOpReceiptReader,
    userOpHash: Hash,
    { attempts = 6, delayMs = 3000 }: { attempts?: number; delayMs?: number } = {}
): Promise<TransactionReceipt | null> {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const result = await client.getUserOperationReceipt({ hash: userOpHash })
            if (result?.receipt) return result.receipt
        } catch {
            // not indexed yet — same as null
        }
        if (attempt < attempts) {
            await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
    }
    return null
}
