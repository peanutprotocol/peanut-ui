import type { Address, Hash, Log, TransactionReceipt } from 'viem'
import { encodeAbiParameters, encodeEventTopics } from 'viem'
import { peanutVaultAbi } from '@/utils/peanut-claim.utils'

/** Arbitrum v4.4 vault, as getContractAddress returns it. */
export const VAULT = '0xe8A4c1DC1E30E01b7D9471FE0422A60beE3fa36c' as Address
export const SENDER = '0x48F3bad83D0Aa198852e52834389Ac48154e64f5' as Address
export const OTHER_SENDER = '0x1111111111111111111111111111111111111111' as Address
export const TX_HASH = `0x${'72'.repeat(32)}` as Hash
export const USEROP_HASH = `0x${'ab'.repeat(32)}` as Hash

/** A real DepositEvent log, encoded the way the vault emits it. */
export function depositLog({
    index,
    sender = SENDER,
    address = VAULT,
    amount = 5_000_000n,
}: {
    index: bigint
    sender?: Address
    address?: Address
    amount?: bigint
}): Log {
    return {
        address,
        topics: encodeEventTopics({
            abi: peanutVaultAbi,
            eventName: 'DepositEvent',
            args: { _index: index, _contractType: 1, _senderAddress: sender },
        }) as Log['topics'],
        data: encodeAbiParameters([{ type: 'uint256' }], [amount]),
        blockHash: `0x${'bb'.repeat(32)}`,
        blockNumber: 519841210n,
        logIndex: 25,
        transactionHash: TX_HASH,
        transactionIndex: 1,
        removed: false,
    }
}

export function receiptWith(logs: Log[]): TransactionReceipt {
    return { transactionHash: TX_HASH, logs, status: 'success' } as unknown as TransactionReceipt
}
