'use client'

import type { HistoryEntry } from '@/utils/history.utils'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN, PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants/zerodev.consts'

// Persisted log of transactions made during a demo session, so they show up in
// Activity (alongside the static DEMO_HISTORY_ENTRIES) and survive relaunch.
// Lightweight on purpose (no demo-data/viem imports) so it's safe to pull into
// the shared success view and the history hook.
const KEY = 'peanut_demo_transactions'
const CHAIN_ID = PEANUT_WALLET_CHAIN.id.toString()

const SELF = { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo', fullName: 'Demo User' }

function read(): HistoryEntry[] {
    if (typeof window === 'undefined') return []
    try {
        const v = window.localStorage.getItem(KEY)
        if (!v) return []
        return (JSON.parse(v) as HistoryEntry[]).map((e) => ({ ...e, timestamp: new Date(e.timestamp) }))
    } catch {
        return []
    }
}

function write(list: HistoryEntry[]): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(KEY, JSON.stringify(list))
    } catch {}
}

/** Newest-first demo transactions to prepend to the static demo history. */
export function getDemoTransactions(): HistoryEntry[] {
    return read()
}

export interface RecordDemoTxInput {
    amount: string
    recipientName: string
    recipientUsername?: string
    recipientAddress?: string
    txHash: string
    createdAt?: string
    memo?: string
}

export function recordDemoTransaction(input: RecordDemoTxInput): void {
    const list = read()
    if (list.some((e) => e.txHash === input.txHash || e.uuid === input.txHash)) return // dedupe
    const timestamp = input.createdAt ? new Date(input.createdAt) : new Date()
    const entry: HistoryEntry = {
        uuid: input.txHash,
        type: 'TRANSACTION_INTENT',
        timestamp,
        amount: input.amount,
        chainId: CHAIN_ID,
        tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
        tokenAddress: PEANUT_WALLET_TOKEN,
        status: 'COMPLETED',
        userRole: 'SENDER',
        txHash: input.txHash,
        senderAccount: SELF,
        recipientAccount: {
            identifier: input.recipientUsername || input.recipientAddress || input.recipientName,
            type: 'PEANUT_WALLET',
            isUser: !!input.recipientUsername,
            username: input.recipientUsername,
            fullName: input.recipientName,
        },
        extraData: { kind: 'DIRECT_TRANSFER', usdAmount: input.amount },
        memo: input.memo,
        createdAt: timestamp.toISOString(),
    }
    write([entry, ...list])
}
