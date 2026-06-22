// Static balance + history overlaid in demo mode (utils/demo.ts). Native-only.

import { parseUnits, type Address } from 'viem'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_SYMBOL,
} from '@/constants/zerodev.consts'
// Type-only: importing the enum values would cause a runtime import cycle.
import type { HistoryEntry } from '@/utils/history.utils'
import type { AccountType, IUserProfile } from '@/interfaces/interfaces'

/** Demo smart-account balance in token base units (USDC, 6 decimals). */
export const DEMO_BALANCE_UNITS = parseUnits('1250.75', PEANUT_WALLET_TOKEN_DECIMALS)

const CHAIN_ID = PEANUT_WALLET_CHAIN.id.toString()

// Synthetic kernel address for demo mode, pinned to DEMO_USER's PEANUT_WALLET account so useWallet's address-match passes.
export const DEMO_ADDRESS = '0xdec0debad1dec0debad1dec0debad1dec0debad1' as Address

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

// Synthetic backend-free user for demo mode; satisfies the route guards (hasAppAccess + a PEANUT_WALLET account pinned to DEMO_ADDRESS).
const DEMO_CREATED_AT = '2026-01-01T00:00:00.000Z'

export const DEMO_USER: IUserProfile = {
    streak: 0,
    pwQueue: { totalUsers: 0, userPosition: null },
    totalPoints: 0,
    contacts: [],
    rails: [],
    invitesSent: [],
    showEarlyUserModal: false,
    invitedBy: null,
    accounts: [
        {
            id: 'demo-account',
            userId: 'demo-user',
            bridgeAccountId: '',
            type: 'peanut-wallet' as AccountType,
            identifier: DEMO_ADDRESS,
            details: {
                bankName: null,
                accountOwnerName: 'Demo User',
                countryCode: '',
                countryName: '',
            },
            createdAt: DEMO_CREATED_AT,
            updatedAt: DEMO_CREATED_AT,
            chainId: CHAIN_ID,
        },
    ],
    user: {
        userId: 'demo-user',
        email: 'demo@peanut.me',
        profile_picture: null,
        username: 'demo',
        bridgeCustomerId: null,
        fullName: 'Demo User',
        telegram: null,
        hasAppAccess: true,
        showFullName: false,
        createdAt: DEMO_CREATED_AT,
        accounts: [],
    },
}
