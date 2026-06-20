// Static balance + history overlaid in demo mode (utils/demo.ts). Native-only.

import { parseUnits } from 'viem'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_SYMBOL,
} from '@/constants/zerodev.consts'
// Type-only: importing the enum values would cause a runtime import cycle.
import type { HistoryEntry } from '@/utils/history.utils'

/** Demo smart-account balance in token base units (USDC, 6 decimals). */
export const DEMO_BALANCE_UNITS = parseUnits('1250.75', PEANUT_WALLET_TOKEN_DECIMALS)

const CHAIN_ID = PEANUT_WALLET_CHAIN.id.toString()

const account = (username: string, fullName: string) => ({
    identifier: username,
    type: 'PEANUT_WALLET',
    isUser: true,
    username,
    fullName,
})

const SELF = account('demo', 'Demo User')

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

export const DEMO_HISTORY_ENTRIES: HistoryEntry[] = [
    {
        uuid: 'demo-tx-1',
        type: 'TRANSACTION_INTENT',
        timestamp: daysAgo(0),
        amount: '45.00',
        chainId: CHAIN_ID,
        tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
        tokenAddress: PEANUT_WALLET_TOKEN,
        status: 'COMPLETED',
        userRole: 'RECIPIENT',
        senderAccount: account('alice', 'Alice Nguyen'),
        recipientAccount: SELF,
        extraData: { kind: 'DIRECT_TRANSFER' },
        memo: 'Lunch split',
    },
    {
        uuid: 'demo-tx-2',
        type: 'TRANSACTION_INTENT',
        timestamp: daysAgo(1),
        amount: '120.00',
        chainId: CHAIN_ID,
        tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
        tokenAddress: PEANUT_WALLET_TOKEN,
        status: 'COMPLETED',
        userRole: 'SENDER',
        senderAccount: SELF,
        recipientAccount: account('bob', 'Bob Carter'),
        extraData: { kind: 'DIRECT_TRANSFER' },
        memo: 'Rent share',
    },
    {
        uuid: 'demo-tx-3',
        type: 'TRANSACTION_INTENT',
        timestamp: daysAgo(3),
        amount: '8.50',
        chainId: CHAIN_ID,
        tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
        tokenAddress: PEANUT_WALLET_TOKEN,
        status: 'COMPLETED',
        userRole: 'SENDER',
        senderAccount: SELF,
        recipientAccount: account('carol', 'Carol Diaz'),
        extraData: { kind: 'DIRECT_TRANSFER' },
        memo: 'Coffee',
    },
    {
        uuid: 'demo-tx-4',
        type: 'TRANSACTION_INTENT',
        timestamp: daysAgo(6),
        amount: '300.00',
        chainId: CHAIN_ID,
        tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
        tokenAddress: PEANUT_WALLET_TOKEN,
        status: 'COMPLETED',
        userRole: 'RECIPIENT',
        senderAccount: account('dave', 'Dave Patel'),
        recipientAccount: SELF,
        extraData: { kind: 'DIRECT_TRANSFER' },
        memo: 'Invoice #1042',
    },
]
