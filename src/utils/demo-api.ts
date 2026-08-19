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
import { PEANUT_API_URL } from '@/constants/general.consts'

const CHAIN_ID = PEANUT_WALLET_CHAIN.id.toString()
const CREATED_AT = '2026-01-01T00:00:00.000Z'
const PASSTHROUGH_TIMEOUT_MS = 10_000

// Public read-only rate endpoints proxied to the real backend so demo shows live
// FX rates. Best-effort: any failure falls through to the canned handler below.
// /tokens/* are public too — the canned {} fallback is NOT a valid shape for
// them (fetchWalletBalances crashed on `{}.balances.filter` in recover-funds).
const PASSTHROUGH_GET = new Set([
    '/bridge/exchange-rate',
    '/manteca/prices',
    '/fx/rate',
    '/tokens/price',
    '/tokens/wallet-portfolio',
])

const EMPTY_GRAPH = {
    nodes: [] as unknown[],
    edges: [] as unknown[],
    p2pEdges: [] as unknown[],
    stats: { totalNodes: 0, totalEdges: 0, totalP2PEdges: 0, usersWithAccess: 0, orphans: 0 },
}

const soon = () => new Date(Date.now() + 120_000).toISOString()

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data ?? {}), {
        status,
        headers: { 'content-type': 'application/json' },
    })
}

type DemoRequestBody = {
    tokenAmount?: string | number
    requestProps?: { tokenAmount?: string | number }
    local_price?: { amount?: string | number }
    reference?: string
    dismissActivationCelebration?: boolean
    username?: string
}

function parseBody(options?: RequestInit): DemoRequestBody {
    // Multipart callers (charges, send-links attachments) reach here through
    // apiFetch's demo routing with a FormData body — read it field-by-field so
    // a caller without an explicit JSON pre-intercept still records real
    // values instead of silently degrading to {} (e.g. amount '0').
    if (options?.body instanceof FormData) {
        const out: Record<string, unknown> = {}
        options.body.forEach((value, key) => {
            if (typeof value !== 'string') return // File/Blob — not body data
            // Only object/array fields arrive JSON-stringified (charges appends
            // non-File objects via JSON.stringify); parse just those. Parsing
            // every string would coerce "123"/"true" into numbers/booleans and
            // violate declared string fields (reference, username) — gating on
            // the first char is simpler and safer than a known-field list.
            const trimmed = value.trim()
            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                    out[key] = JSON.parse(trimmed)
                    return
                } catch {
                    // malformed — keep the raw string
                }
            }
            out[key] = value
        })
        return out as DemoRequestBody
    }
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

// Stateful demo charge store so a freshly-created charge's real amount, time,
// and a random tx hash flow through to the receipt (instead of $0 / fixed date /
// 0xdede). Keyed by the generated charge id; in-memory is enough for the
// post-send receipt (same session).
const demoCharges = new Map<string, { amount: string; createdAt: string; txHash: string }>()

const randomHex = (n: number) =>
    Array.from({ length: n }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
const randomTxHash = () => `0x${randomHex(64)}`

const createDemoCharge = (options?: RequestInit) => {
    const body = parseBody(options)
    const amount = String(body.requestProps?.tokenAmount ?? body.tokenAmount ?? body.local_price?.amount ?? '0')
    const id = `demo-charge-${randomHex(12)}`
    demoCharges.set(id, { amount, createdAt: new Date().toISOString(), txHash: randomTxHash() })
    return {
        data: { id, code: 'DEMO', hosted_url: '', created_at: new Date().toISOString(), status: 'NEW' },
        warnings: [],
    }
}

const demoPayment = (chargeUuid: string) => {
    const stored = demoCharges.get(chargeUuid)
    return {
        uuid: 'demo-payment',
        paidTokenAddress: PEANUT_WALLET_TOKEN,
        payerChainId: CHAIN_ID,
        payerTransactionHash: stored?.txHash ?? randomTxHash(),
        createdAt: stored?.createdAt ?? new Date().toISOString(),
        requestCharge: {
            uuid: chargeUuid,
            chainId: CHAIN_ID,
            createdAt: stored?.createdAt ?? new Date().toISOString(),
            tokenAddress: PEANUT_WALLET_TOKEN,
            tokenAmount: stored?.amount ?? '0',
            tokenDecimals: PEANUT_WALLET_TOKEN_DECIMALS,
            requestLink: { recipientAddress: DEMO_ADDRESS },
        },
    }
}

const demoRequestCharge = (id: string) => {
    const stored = demoCharges.get(id)
    const amount = stored?.amount ?? '0'
    const createdAt = stored?.createdAt ?? new Date().toISOString()
    return {
        uuid: id,
        createdAt,
        link: '',
        chainId: CHAIN_ID,
        tokenAmount: amount,
        tokenAddress: PEANUT_WALLET_TOKEN,
        tokenDecimals: PEANUT_WALLET_TOKEN_DECIMALS,
        tokenType: 'erc20',
        tokenSymbol: PEANUT_WALLET_TOKEN_SYMBOL,
        transactionType: 'WITHDRAW',
        updatedAt: createdAt,
        payments: [],
        fulfillmentPayment: null,
        currencyCode: 'USD',
        currencyAmount: amount,
        timeline: [],
        requestLink: {
            uuid: 'demo-request',
            recipientAddress: DEMO_ADDRESS,
            reference: null,
            attachmentUrl: null,
            trackId: null,
            recipientAccount: {
                userId: 'demo-user',
                identifier: DEMO_ADDRESS,
                type: 'peanut-wallet',
                user: { username: 'demo' },
            },
        },
    }
}

const demoDepositAddress = () => ({
    depositAddress: DEMO_ADDRESS,
    minDepositLimitUsd: 10,
    maxDepositLimitUsd: 10000,
    supportedChains: ['arbitrum', 'ethereum', 'base', 'optimism', 'polygon'],
})

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

// Mirrors the server stamping activationCelebratedAt on dismiss. Persisted to
// localStorage so the "You're unlocked" celebration shows once per install —
// the previous in-memory flag reset on every cold start, re-showing the modal
// on every demo launch. The in-memory cache keeps dismissal working within the
// session even when storage throws.
const DEMO_CELEBRATED_AT_KEY = 'peanut_demo_activation_celebrated_at'
let demoActivationCelebratedAt: string | null = null

const getDemoActivationCelebratedAt = (): string | null => {
    if (demoActivationCelebratedAt) return demoActivationCelebratedAt
    try {
        demoActivationCelebratedAt = window.localStorage.getItem(DEMO_CELEBRATED_AT_KEY)
    } catch {}
    return demoActivationCelebratedAt
}

const stampDemoActivationCelebrated = (): void => {
    demoActivationCelebratedAt = new Date().toISOString()
    try {
        window.localStorage.setItem(DEMO_CELEBRATED_AT_KEY, demoActivationCelebratedAt)
    } catch {}
}

// ---- routes (ordered: literal paths before :param paths) ----

const ROUTES: Array<{ method: string; pattern: string; handler: Handler }> = [
    // user
    {
        method: 'GET',
        pattern: '/users/me',
        handler: () => {
            const celebratedAt = getDemoActivationCelebratedAt()
            return celebratedAt
                ? { ...DEMO_USER, user: { ...DEMO_USER.user, activationCelebratedAt: celebratedAt } }
                : DEMO_USER
        },
    },
    {
        method: 'GET',
        pattern: '/users/contacts',
        handler: () => ({ contacts: DEMO_CONTACTS, total: DEMO_CONTACTS.length, hasMore: false }),
    },
    { method: 'GET', pattern: '/users/limits', handler: () => DEMO_LIMITS },
    { method: 'GET', pattern: '/users/history', handler: () => ({ entries: DEMO_HISTORY_ENTRIES, hasMore: false }) },
    { method: 'GET', pattern: '/users/bridge-tos-link', handler: () => ({ tosLink: '' }) },
    { method: 'POST', pattern: '/users/bridge-tos-confirm', handler: () => ({ accepted: true }) },
    { method: 'POST', pattern: '/users/initiate-kyc', handler: () => ({}) },
    { method: 'POST', pattern: '/users/interaction-status', handler: () => ({}) },
    { method: 'POST', pattern: '/users/accounts', handler: () => ({ id: 'demo-bank' }) },
    {
        method: 'GET',
        pattern: '/users/username/:username',
        handler: ({ params }) => {
            // Only the demo cast resolves: the demo user plus the seeded contacts
            // (recipient resolution + profile lookups keep working). Everything
            // else 404s — Signup's availability probe reads 200 as "taken", so a
            // blanket 200 blocked signup for EVERY username when the demo flag
            // was still latched from a 'demo' invite-code entry. Responses carry
            // the CANONICAL record's identity — inventing one via demoApiUser
            // gave 'demo' userId 'demo-demo' instead of 'demo-user'/DEMO_ADDRESS.
            if (params.username === DEMO_USER.user.username) {
                const { userId, username, fullName, showFullName } = DEMO_USER.user
                return {
                    userId,
                    username,
                    accounts: DEMO_USER.accounts.map((a) => ({ identifier: a.identifier, type: a.type })),
                    fullName,
                    firstName: fullName?.split(' ')[0] ?? username,
                    lastName: fullName?.split(' ').slice(1).join(' ') ?? '',
                    showFullName,
                    totalUsdSentToCurrentUser: '0',
                    totalUsdReceivedFromCurrentUser: '0',
                    isVerified: true,
                }
            }
            const contact = DEMO_CONTACTS.find((c) => c.username === params.username)
            if (!contact) return json({ error: 'not found' }, 404)
            return {
                userId: contact.userId,
                username: contact.username,
                // contacts carry no account data — synthesize the same
                // username-keyed peanut-wallet demoApiUser always used
                accounts: [{ identifier: contact.username, type: 'peanut-wallet' }],
                fullName: contact.fullName,
                firstName: contact.fullName?.split(' ')[0] ?? contact.username,
                lastName: contact.fullName?.split(' ').slice(1).join(' ') ?? '',
                showFullName: contact.showFullName,
                totalUsdSentToCurrentUser: '0',
                totalUsdReceivedFromCurrentUser: '0',
                isVerified: contact.isVerified,
            }
        },
    },
    { method: 'GET', pattern: '/users/:userId/rewards', handler: () => [] },
    { method: 'GET', pattern: '/users/:userId', handler: ({ params }) => demoCounterparty(params.userId) },
    {
        method: 'POST',
        pattern: '/update-user',
        handler: ({ options }) => {
            const body = parseBody(options)
            if (body.dismissActivationCelebration) stampDemoActivationCelebrated()
            return demoApiUser(body.username ?? 'demo')
        },
    },

    // history detail
    { method: 'GET', pattern: '/history/:entryId', handler: () => DEMO_HISTORY_ENTRIES[0] },

    // requests (search hits GET /requests → 404 → caller treats as "none")
    { method: 'GET', pattern: '/requests', handler: () => json({ error: 'not found' }, 404) },
    { method: 'POST', pattern: '/requests', handler: ({ options }) => demoRequest('demo-request', options) },
    { method: 'GET', pattern: '/requests/:uuid', handler: ({ params }) => demoRequest(params.uuid) },
    {
        method: 'PATCH',
        pattern: '/requests/:uuid',
        handler: ({ params, options }) => demoRequest(params.uuid, options),
    },
    { method: 'DELETE', pattern: '/requests/:uuid', handler: ({ params }) => demoRequest(params.uuid) },

    // send links
    { method: 'GET', pattern: '/send-links', handler: () => demoSendLink('demo-pubkey') },
    { method: 'POST', pattern: '/send-links', handler: () => demoSendLink('demo-pubkey') },
    { method: 'PATCH', pattern: '/send-links/claim/:txHash/associate-user', handler: () => ({}) },
    { method: 'GET', pattern: '/send-links/:pubKey', handler: ({ params }) => demoSendLink(params.pubKey) },
    { method: 'PATCH', pattern: '/send-links/:pubKey', handler: ({ params }) => demoSendLink(params.pubKey) },

    // charges
    { method: 'POST', pattern: '/charges', handler: ({ options }) => createDemoCharge(options) },
    { method: 'POST', pattern: '/charges/:chargeId/payments', handler: ({ params }) => demoPayment(params.chargeId) },
    { method: 'GET', pattern: '/charges/:chargeId/payments', handler: () => [] },
    { method: 'GET', pattern: '/charges/:id', handler: () => ({}) },
    { method: 'GET', pattern: '/request-charges/:id', handler: ({ params }) => demoRequestCharge(params.id) },

    // Fallback for the /fx/rate passthrough when the live call fails. Without a
    // handler this lands on defaultShape and answers 200 {}, which the response
    // validator then rejects — a contract violation dressed as a success. A
    // canned rate is not an option either: handlers never see the query string,
    // and fetchDisplayRate rejects any payload whose pair does not match what
    // was asked. 503 is the truthful answer, and the hook already fails closed
    // on it rather than showing a stale or invented number.
    {
        method: 'GET',
        pattern: '/fx/rate',
        handler: () => json({ error: 'FX_UNAVAILABLE', message: 'Exchange rates are unavailable.' }, 503),
    },

    // bridge on/off-ramp
    {
        method: 'GET',
        pattern: '/bridge/exchange-rate',
        handler: () => ({
            from: 'USD',
            to: 'USD',
            midmarket_rate: '1',
            buy_rate: '1',
            sell_rate: '1',
            updated_at: CREATED_AT,
        }),
    },
    { method: 'POST', pattern: '/bridge/onramp/create', handler: () => ({ success: true }) },
    { method: 'DELETE', pattern: '/bridge/onramp/:transferId/cancel', handler: () => ({ success: true }) },
    {
        method: 'POST',
        pattern: '/bridge/offramp/create',
        handler: () => ({
            transferId: 'demo-transfer',
            depositInstructions: { toAddress: DEMO_ADDRESS, blockchainMemo: '' },
        }),
    },
    {
        method: 'POST',
        pattern: '/bridge/offramp/create-for-guest',
        handler: () => ({
            transferId: 'demo-transfer',
            depositInstructions: { toAddress: DEMO_ADDRESS, blockchainMemo: '' },
        }),
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
    {
        method: 'POST',
        pattern: '/manteca/withdraw/init',
        handler: () => ({
            priceLockCode: 'demo-lock',
            price: '1000',
            expiresAt: soon(),
            usdAmount: '0',
            fiatAmount: '0',
            currency: 'ARS',
        }),
    },
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
            nextTierThreshold: 300,
            pointsToNextTier: 150,
        }),
    },
    { method: 'POST', pattern: '/points/calculate', handler: () => ({ estimatedPoints: 10 }) },
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
    {
        method: 'POST',
        pattern: '/perks/claim',
        handler: () => ({ success: true, perk: { sponsored: false, amountSponsored: 0, discountPercentage: 0 } }),
    },

    // invites / quests / badges
    { method: 'POST', pattern: '/invites/validate', handler: () => ({ success: true, username: 'demo' }) },
    { method: 'POST', pattern: '/invites/accept', handler: () => ({ success: true }) },
    { method: 'GET', pattern: '/invites/waitlist-position', handler: () => ({ position: null }) },
    // graph endpoints return an OBJECT ({nodes,edges,...}); InvitesGraph derefs
    // .nodes.length, so an array/empty value would crash the rewards screen.
    { method: 'GET', pattern: '/invites/user-graph', handler: () => EMPTY_GRAPH },
    { method: 'GET', pattern: '/invites/graph', handler: () => EMPTY_GRAPH },
    {
        method: 'GET',
        pattern: '/invites/graph/external',
        handler: () => ({ nodes: [], stats: { total: 0, byType: { WALLET: 0, BANK: 0, MERCHANT: 0 } } }),
    },
    {
        method: 'GET',
        pattern: '/points/invites',
        handler: () => ({ invitees: [], summary: { totalInvited: 0, totalPointsEarned: 0 } }),
    },

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
    // useRainCardOverview polls this for every logged-in user; the fallback {}
    // has no `status`/`cards` and crashes consumers that deref them
    // (PEANUT-UI-RM6). hasApplication:false also stops polling in demo.
    {
        method: 'GET',
        pattern: '/rain/cards',
        handler: () => ({ status: { hasApplication: false }, balance: null, cards: [] }),
    },

    // rhino (crypto deposit / cross-chain) — return a believable deposit address
    // (the demo wallet) so the "add money → crypto → choose network" screen renders
    // its QR instead of crashing on an undefined address.
    { method: 'POST', pattern: '/rhino/deposit', handler: () => demoDepositAddress() },
    { method: 'POST', pattern: '/rhino/request-fulfilment', handler: () => demoDepositAddress() },
    { method: 'GET', pattern: '/rhino/status/:depositAddress', handler: () => ({ status: 'pending' }) },
    { method: 'POST', pattern: '/rhino/reset-status/:depositAddress', handler: () => ({ status: 'pending' }) },

    // misc
    // ENS resolves to the demo wallet so address/ENS sends complete in demo.
    { method: 'GET', pattern: '/ens/:name', handler: () => ({ address: DEMO_ADDRESS }) },
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
// undefined.map: collection-ish paths → [], everything else → {}. Note: graph /
// leaderboard endpoints are OBJECT-shaped ({nodes,...}/{leaderboard,...}) and are
// handled explicitly above, so they deliberately fall to {} here.
const LIST_HINTS = /(list|history|accounts|payments|contacts|rewards)$/i
function defaultShape(pathname: string): unknown {
    const last = pathname.split('/').filter(Boolean).pop() ?? ''
    return LIST_HINTS.test(last) ? [] : {}
}

export async function demoRespond(path: string, options?: RequestInit): Promise<Response> {
    const method = (options?.method ?? 'GET').toUpperCase()
    const pathname = path.split('?')[0].replace(/\/+$/, '') || '/'

    // Live-rate passthrough to the real backend (best-effort).
    let passthroughFailed = false
    if (method === 'GET' && PASSTHROUGH_GET.has(pathname)) {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), PASSTHROUGH_TIMEOUT_MS)
        try {
            const res = await fetch(`${PEANUT_API_URL}${path}`, {
                headers: { accept: 'application/json' },
                signal: controller.signal,
            })
            if (res.ok) return res
        } catch {
            // fall through to the canned handler below (the FX trio has one)
        } finally {
            clearTimeout(timeout)
        }
        passthroughFailed = true
    }

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

    // A failed passthrough with no canned fallback (e.g. /tokens/*) must NOT
    // degrade to the 200 defaultShape below — callers would parse {} as success
    // and crash on missing fields (the recover-funds balances TypeError).
    // Surface a real failure so their error paths run instead.
    if (passthroughFailed) {
        return json({ error: 'demo passthrough unavailable' }, 503)
    }

    if (process.env.NODE_ENV !== 'production') {
        console.debug('[demo-api] unmocked', method, pathname)
    }
    return json(defaultShape(pathname))
}
