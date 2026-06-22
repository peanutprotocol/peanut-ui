// Client-side demo API router. Reached only from callApi (api-fetch.ts) when
// isDemoMode() is true — native-only, gated, never runs on web. Returns synthetic
// data so every screen loads with no JWT and no network. Pure: no writes, no
// side-effects, no real money can move (UserOps are hard-stopped elsewhere).

import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_SYMBOL,
} from '@/constants/zerodev.consts'
import { DEMO_ADDRESS, DEMO_CONTACTS, DEMO_HISTORY_ENTRIES, DEMO_LIMITS, DEMO_USER } from '@/constants/demo-data'

const CHAIN_ID = PEANUT_WALLET_CHAIN.id.toString()
const CREATED_AT = '2026-01-01T00:00:00.000Z'

const soon = () => new Date(Date.now() + 120_000).toISOString()

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data ?? {}), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

function parseBody(options?: RequestInit): Record<string, any> {
    try {
        return typeof options?.body === 'string' ? JSON.parse(options.body) : {}
    } catch {
        return {}
    }
}

type Ctx = { params: Record<string, string>; options?: RequestInit }
type Handler = (ctx: Ctx) => unknown | Response

// ---- fixtures ----

const demoApiUser = (username: string) => ({
    userId: `demo-${username}`,
    username,
    accounts: [{ identifier: username, type: 'peanut-wallet' }],
    fullName: username,
    firstName: username,
    lastName: '',
    showFullName: true,
    totalUsdSentToCurrentUser: '0',
    totalUsdReceivedFromCurrentUser: '0',
    isVerified: true,
})

const demoCounterparty = (userId: string) => ({
    userId,
    email: '',
    profile_picture: null,
    username: 'demo-contact',
    bridgeCustomerId: null,
    fullName: 'Demo Contact',
    telegram: null,
    hasAppAccess: true,
    showFullName: true,
    createdAt: CREATED_AT,
    accounts: [],
    canReceiveBankOfframp: true,
    isVerified: true,
})

const demoRequest = (uuid: string, options?: RequestInit) => {
    const body = parseBody(options)
    const tokenAmount = String(body.tokenAmount ?? body.requestProps?.tokenAmount ?? body.local_price?.amount ?? '0')
    return {
        uuid,
        chainId: CHAIN_ID,
        recipientAddress: DEMO_ADDRESS,
        tokenAmount,
        tokenAddress: PEANUT_WALLET_TOKEN,
        tokenDecimals: PEANUT_WALLET_TOKEN_DECIMALS,
        tokenType: 'erc20',
        tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
        trackId: null,
        reference: body.reference ?? null,
        attachmentUrl: null,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
        charges: [],
        history: [],
        recipientAccount: {
            userId: 'demo-user',
            identifier: DEMO_ADDRESS,
            type: 'peanut-wallet',
            user: { username: 'demo' },
        },
        totalCollectedAmount: 0,
    }
}

const demoSendLink = (pubKey: string) => ({
    pubKey,
    depositIdx: 0,
    chainId: CHAIN_ID,
    contractVersion: 'v4.4',
    status: 'completed',
    createdAt: CREATED_AT,
    senderAddress: DEMO_ADDRESS,
    amount: '0',
    tokenAddress: PEANUT_WALLET_TOKEN,
    tokenDecimals: PEANUT_WALLET_TOKEN_DECIMALS,
    tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
    sender: {
        userId: 'demo-user',
        username: 'demo',
        fullName: 'Demo User',
        bridgeKycStatus: 'approved',
        accounts: [{ identifier: DEMO_ADDRESS, type: 'peanut-wallet' }],
    },
    events: [],
})

const demoMantecaDeposit = () => ({
    id: 'demo-deposit',
    numberId: '1',
    externalId: 'demo',
    userId: 'demo-user',
    userNumberId: '1',
    userExternalId: 'demo',
    status: 'PENDING',
    type: 'RAMP_OPERATION',
    details: {
        depositAddresses: { BANK_TRANSFER: '0000003100010000000001' },
        depositAddress: '0000003100010000000001',
        depositAlias: 'demo.peanut.mp',
        withdrawCostInAgainst: '0',
        withdrawCostInAsset: '0',
        price: '1000',
        priceExpireAt: soon(),
    },
    currentStage: 1,
    stages: {
        '1': { stageType: 'DEPOSIT', asset: 'ARS', thresholdAmount: '0', useOverflow: false, expireAt: soon() },
        '2': {
            stageType: 'EXCHANGE',
            side: 'BUY',
            type: 'MARKET',
            asset: 'USDC',
            against: 'ARS',
            assetAmount: '0',
            price: '1000',
            priceCode: 'demo',
        },
        '3': {
            stageType: 'WITHDRAW',
            network: 'ARBITRUM',
            asset: 'USDC',
            amount: '0',
            to: DEMO_ADDRESS,
            destination: { address: DEMO_ADDRESS, bankCode: '' },
        },
    },
    creationTime: CREATED_AT,
    updatedAt: CREATED_AT,
})

const demoMantecaWithdraw = () => ({
    id: 'demo-withdraw',
    numberId: '1',
    userId: 'demo-user',
    userNumberId: '1',
    userExternalId: 'demo',
    status: 'PENDING',
    type: 'RAMP_OPERATION',
    details: {
        depositAddresses: { ARBITRUM: DEMO_ADDRESS },
        depositAddress: DEMO_ADDRESS,
        depositAvailableNetworks: ['ARBITRUM'],
        withdrawCostInAgainst: '0',
        withdrawCostInAsset: '0',
        price: '1000',
        priceExpireAt: soon(),
    },
    currentStage: 1,
    stages: {
        1: {
            stageType: 'EXCHANGE',
            side: 'SELL',
            type: 'MARKET',
            asset: 'USDC',
            against: 'ARS',
            assetAmount: '0',
            price: '1000',
            priceCode: 'demo',
        },
        2: {
            stageType: 'WITHDRAW',
            asset: 'ARS',
            amount: '0',
            to: 'demo-bank',
            destination: { address: 'demo-bank', bankCode: '' },
        },
    },
    creationTime: CREATED_AT,
    updatedAt: CREATED_AT,
})

// ---- routes (ordered: literal paths before :param paths) ----

const ROUTES: Array<{ method: string; pattern: string; handler: Handler }> = [
    // user
    { method: 'GET', pattern: '/users/me', handler: () => DEMO_USER },
    { method: 'GET', pattern: '/users/contacts', handler: () => ({ contacts: DEMO_CONTACTS, total: DEMO_CONTACTS.length, hasMore: false }) },
    { method: 'GET', pattern: '/users/limits', handler: () => DEMO_LIMITS },
    { method: 'GET', pattern: '/users/history', handler: () => ({ entries: DEMO_HISTORY_ENTRIES, hasMore: false }) },
    { method: 'GET', pattern: '/users/bridge-tos-link', handler: () => ({ tosLink: '' }) },
    { method: 'POST', pattern: '/users/bridge-tos-confirm', handler: () => ({ accepted: true }) },
    { method: 'POST', pattern: '/users/initiate-kyc', handler: () => ({}) },
    { method: 'POST', pattern: '/users/interaction-status', handler: () => ({}) },
    { method: 'POST', pattern: '/users/accounts', handler: () => ({ id: 'demo-bank' }) },
    { method: 'GET', pattern: '/users/username/:username', handler: ({ params }) => demoApiUser(params.username) },
    { method: 'GET', pattern: '/users/:userId/rewards', handler: () => [] },
    { method: 'GET', pattern: '/users/:userId', handler: ({ params }) => demoCounterparty(params.userId) },
    { method: 'POST', pattern: '/update-user', handler: ({ options }) => demoApiUser(parseBody(options).username ?? 'demo') },

    // history detail
    { method: 'GET', pattern: '/history/:entryId', handler: () => DEMO_HISTORY_ENTRIES[0] },

    // requests (search hits GET /requests → 404 → caller treats as "none")
    { method: 'GET', pattern: '/requests', handler: () => json({ error: 'not found' }, 404) },
    { method: 'POST', pattern: '/requests', handler: ({ options }) => demoRequest('demo-request', options) },
    { method: 'GET', pattern: '/requests/:uuid', handler: ({ params }) => demoRequest(params.uuid) },
    { method: 'PATCH', pattern: '/requests/:uuid', handler: ({ params, options }) => demoRequest(params.uuid, options) },
    { method: 'DELETE', pattern: '/requests/:uuid', handler: ({ params }) => demoRequest(params.uuid) },

    // send links
    { method: 'GET', pattern: '/send-links', handler: () => demoSendLink('demo-pubkey') },
    { method: 'POST', pattern: '/send-links', handler: () => demoSendLink('demo-pubkey') },
    { method: 'PATCH', pattern: '/send-links/claim/:txHash/associate-user', handler: () => ({}) },
    { method: 'GET', pattern: '/send-links/:pubKey', handler: ({ params }) => demoSendLink(params.pubKey) },
    { method: 'PATCH', pattern: '/send-links/:pubKey', handler: ({ params }) => demoSendLink(params.pubKey) },

    // charges
    { method: 'GET', pattern: '/charges/:chargeId/payments', handler: () => [] },
    { method: 'GET', pattern: '/charges/:id', handler: () => ({}) },
    { method: 'GET', pattern: '/request-charges/:id', handler: () => ({}) },

    // bridge on/off-ramp
    {
        method: 'GET',
        pattern: '/bridge/exchange-rate',
        handler: () => ({ from: 'USD', to: 'USD', midmarket_rate: '1', buy_rate: '1', sell_rate: '1', updated_at: CREATED_AT }),
    },
    { method: 'POST', pattern: '/bridge/onramp/create', handler: () => ({ success: true }) },
    { method: 'POST', pattern: '/bridge/onramp/create-for-guest', handler: () => ({ success: true }) },
    { method: 'DELETE', pattern: '/bridge/onramp/:transferId/cancel', handler: () => ({ success: true }) },
    {
        method: 'POST',
        pattern: '/bridge/offramp/create',
        handler: () => ({ transferId: 'demo-transfer', depositInstructions: { toAddress: DEMO_ADDRESS, blockchainMemo: '' } }),
    },
    {
        method: 'POST',
        pattern: '/bridge/offramp/create-for-guest',
        handler: () => ({ transferId: 'demo-transfer', depositInstructions: { toAddress: DEMO_ADDRESS, blockchainMemo: '' } }),
    },
    { method: 'POST', pattern: '/bridge/transfers/:transferId/confirm', handler: () => ({ success: true }) },
    { method: 'GET', pattern: '/bridge/customers/:customerId/external-accounts', handler: () => [] },
    { method: 'GET', pattern: '/bridge/customers/:customerId', handler: () => ({}) },

    // manteca
    {
        method: 'GET',
        pattern: '/manteca/prices',
        handler: () => ({
            ticker: 'USDC_ARS',
            buy: '1000',
            sell: '1000',
            timestamp: CREATED_AT,
            variation: { buy: { realtime: '0', daily: '0' }, sell: { realtime: '0', daily: '0' } },
            effectiveBuy: '1000',
            effectiveSell: '1000',
        }),
    },
    { method: 'POST', pattern: '/manteca/deposit', handler: () => demoMantecaDeposit() },
    { method: 'PATCH', pattern: '/manteca/deposit/:depositId/cancel', handler: () => demoMantecaDeposit() },
    { method: 'POST', pattern: '/manteca/withdraw/init', handler: () => ({ priceLockCode: 'demo-lock', price: '1000', expiresAt: soon(), usdAmount: '0', fiatAmount: '0', currency: 'ARS' }) },
    { method: 'POST', pattern: '/manteca/withdraw/complete-with-signed-tx', handler: () => demoMantecaWithdraw() },
    { method: 'POST', pattern: '/manteca/withdraw', handler: () => demoMantecaWithdraw() },
    { method: 'POST', pattern: '/manteca/initiate-onboarding', handler: () => ({ url: '' }) },
    {
        method: 'POST',
        pattern: '/manteca/qr-payment/init',
        handler: () => ({
            code: 'demo-qr',
            type: 'QR3_PAYMENT',
            companyId: 'demo',
            userId: 'demo-user',
            userNumberId: '1',
            userExternalId: 'demo',
            paymentRecipientName: 'Demo Merchant',
            paymentRecipientLegalId: '0',
            paymentAssetAmount: '0',
            paymentAsset: 'USDC',
            paymentPrice: '1000',
            paymentAgainstAmount: '0',
            paymentAgainst: 'ARS',
            expireAt: soon(),
            creationTime: CREATED_AT,
        }),
    },
    {
        method: 'POST',
        pattern: '/manteca/qr-payment/complete-with-signed-tx',
        handler: () => ({
            id: 'demo-qr',
            externalId: 'demo',
            sessionId: 'demo',
            status: 'COMPLETED',
            currentStage: 'DONE',
            stages: [],
            type: 'QR3_PAYMENT',
            details: {
                depositAddress: DEMO_ADDRESS,
                paymentAsset: 'USDC',
                paymentAgainst: 'ARS',
                paymentAgainstAmount: '0',
                paymentAssetAmount: '0',
                paymentPrice: '1000',
                priceExpireAt: soon(),
                merchant: { name: 'Demo Merchant' },
            },
        }),
    },

    // points / perks / rewards
    {
        method: 'GET',
        pattern: '/points',
        handler: () => ({
            userId: 'demo-user',
            directPoints: 120,
            transitivePoints: 30,
            totalPoints: 150,
            currentTier: 2,
            leaderboardRank: 42,
            nextTierThreshold: 300,
            pointsToNextTier: 150,
        }),
    },
    { method: 'POST', pattern: '/points/calculate', handler: () => ({ estimatedPoints: 10 }) },
    { method: 'GET', pattern: '/points/time-leaderboard', handler: () => ({ leaderboard: [], since: CREATED_AT, limit: 10 }) },
    {
        method: 'GET',
        pattern: '/points/cash-status',
        handler: () => ({
            hasCashbackLeft: false,
            lifetimeEarned: 0,
            lifetimeBreakdown: { cashback: 0, inviterRewards: 0, withdrawPerks: 0, depositPerks: 0, other: 0 },
            rewards: { pendingUsd: 0, lifetimeEarnedUsd: 0 },
        }),
    },
    { method: 'GET', pattern: '/perks/pending', handler: () => ({ success: true, perks: [] }) },
    { method: 'POST', pattern: '/perks/claim', handler: () => ({ success: true, perk: { sponsored: false, amountSponsored: 0, discountPercentage: 0 } }) },

    // invites / quests / badges
    { method: 'POST', pattern: '/invites/validate', handler: () => ({ success: true, username: 'demo' }) },
    { method: 'POST', pattern: '/invites/accept', handler: () => ({ success: true }) },
    { method: 'GET', pattern: '/invites/waitlist-position', handler: () => ({ position: null }) },

    // notifications
    { method: 'GET', pattern: '/notifications', handler: () => ({ items: [], nextCursor: null }) },
    { method: 'GET', pattern: '/notifications/unread-count', handler: () => ({ count: 0 }) },
    { method: 'POST', pattern: '/notifications/mark-read', handler: () => ({}) },

    // card
    {
        method: 'GET',
        pattern: '/card',
        handler: () => ({
            hasPurchased: false,
            hasCardAccess: false,
            isEligible: false,
            eligibilityReason: 'demo',
            price: 50,
            currentTier: 1,
            slotsRemaining: 100,
            recentPurchases: 0,
        }),
    },
    {
        method: 'POST',
        pattern: '/card/purchase',
        handler: () => ({
            chargeUuid: 'demo-charge',
            paymentUrl: '',
            price: 50,
            recipientAddress: DEMO_ADDRESS,
            chainId: CHAIN_ID,
            tokenAmount: '50',
            tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
        }),
    },

    // misc
    { method: 'POST', pattern: '/is-valid-bic', handler: () => ({ isValid: true }) },
    { method: 'POST', pattern: '/validate-bank-account-number', handler: () => ({ valid: true }) },
]

const compiled = ROUTES.map((r) => {
    const names: string[] = []
    const regex = new RegExp(
        '^' +
            r.pattern
                .split('/')
                .map((seg) => {
                    if (seg.startsWith(':')) {
                        names.push(seg.slice(1))
                        return '([^/]+)'
                    }
                    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                })
                .join('/') +
            '$'
    )
    return { ...r, regex, names }
})

// Shape-aware fallback so an unmatched route never makes a consumer throw on
// undefined.map: collection-ish paths → [], everything else → {}.
const LIST_HINTS = /(s|list|history|graph|leaderboard|accounts|payments|contacts)$/i
function defaultShape(pathname: string): unknown {
    const last = pathname.split('/').filter(Boolean).pop() ?? ''
    return LIST_HINTS.test(last) ? [] : {}
}

export async function demoRespond(path: string, options?: RequestInit): Promise<Response> {
    const method = (options?.method ?? 'GET').toUpperCase()
    const pathname = path.split('?')[0].replace(/\/+$/, '') || '/'

    for (const route of compiled) {
        if (route.method !== method) continue
        const m = route.regex.exec(pathname)
        if (!m) continue
        const params: Record<string, string> = {}
        route.names.forEach((name, i) => {
            params[name] = decodeURIComponent(m[i + 1])
        })
        const result = route.handler({ params, options })
        return result instanceof Response ? result : json(result)
    }

    if (process.env.NODE_ENV !== 'production') {
        console.debug('[demo-api] unmocked', method, pathname)
    }
    return json(defaultShape(pathname))
}
