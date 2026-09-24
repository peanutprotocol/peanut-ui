// Named app states for visual checks. Open any of them with
// `<route>?__fixture=<name>`, or browse them at /dev/fixtures.
//
// The baseline is the demo API (utils/demo-api.ts): a verified user with a
// balance, four contacts, four history entries and working rails. A fixture
// only states what differs, so most screen defaults need no overrides at all.
//
// Account shapes below are adapted from the old e2e/utils/mock-api.ts, whose
// responses were checked against production on 2026-04-16. That file is gone;
// this registry replaced it.

import type { Fixture, FixtureReply } from './types'
import {
    CLAIMABLE_EUR,
    CLAIMABLE_USD_PREVIEW,
    DEPOSIT_RAIL_POLICY,
} from '@/features/deposit-accounts/__fixtures__/railPolicy'
import type { DepositAccount } from '@/features/deposit-accounts/types'
import type { paths } from '@/types/api.generated'
import { AVATAR_PICKER_PATH } from '@/components/Avatar/avatar.consts'

type FxRateBody = paths['/fx/rate']['get']['responses'][200]['content']['application/json']

/**
 * A simulated display rate for ONE pair, in the exact GET /fx/rate contract
 * (fetchDisplayRate validates every field). The timestamps are stamped when
 * the request arrives, so the reply is fresh under the shots' frozen clock and
 * under a live one. Any other pair — a swap, say — answers null and falls to
 * the offline demo's 503, so no pair is ever quoted that this fixture did not
 * name. Not a price: a round synthetic figure for screenshots only.
 */
export function simulatedFxRate(from: string, to: string, rate: string): (path: string) => FixtureReply | null {
    return (path) => {
        const query = new URL(path, 'http://fixture.local').searchParams
        if (query.get('from') !== from || query.get('to') !== to) return null
        const now = new Date().toISOString()
        const body: FxRateBody = {
            from,
            to,
            rate,
            basis: 'display_sell',
            indicative: true,
            selection: 'provider_pair',
            fromSource: 'identity',
            toSource: 'manteca',
            generatedAt: now,
            effectiveAt: now,
        }
        return { status: 200, body }
    }
}

/** 5 BRL per USD: round enough that 10 → 50 and 0.1 → 0.5 read at a glance. */
const SIMULATED_USD_BRL = { 'GET /fx/rate': simulatedFxRate('USD', 'BRL', '5') }

type OfframpQuoteBody = paths['/bridge/offramp/quote']['get']['responses'][200]['content']['application/json']
type OfframpRateBody = paths['/bridge/offramp/rate']['get']['responses'][200]['content']['application/json']

/** The amount syntax the quote accepts (the API's DESTINATION_AMOUNT_PATTERN), in whole cents. */
function toCents(amount: string | null): bigint | null {
    if (!amount || !/^(?=.*[1-9])\d{1,12}(\.\d{1,2})?$/.test(amount)) return null
    const [whole, fraction = ''] = amount.split('.')
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

const fromCents = (cents: bigint): string => `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`

const invalidAmount = (): FixtureReply => ({ status: 400, body: { error: 'Enter an amount with at most 2 decimals.' } })

/**
 * Simulated fees-v2 withdrawal pricing for ONE bank currency, for screenshots
 * only: the signed fixed_output quote, and the public rate it was built from.
 * `rates` are withdrawal rates with Peanut's margin already inside (4
 * decimals), issued in order, one per signed quote; the last one repeats. The
 * public rate and the rate-only quote always name the rate of the latest
 * signed quote, so the widget, the amount step and the review agree.
 *
 * Amounts round as the API does: USDC for a typed bank amount rounds up to
 * the cent, a bank amount for typed USDC rounds down. A request without
 * `pricing=fixed_output` (an older client), or for another currency, answers
 * null and gets the demo's Bridge-rate estimate. Times are stamped on each
 * request, so every answer is fresh. Not a price, and no provider is called.
 */
export function simulatedWithdrawalPricing(currency: string, rates: readonly string[]) {
    let issued = 0
    const latestRate = () => rates[Math.min(Math.max(issued - 1, 0), rates.length - 1)]

    const quote = (path: string): FixtureReply | null => {
        const query = new URL(path, 'http://fixture.local').searchParams
        if (query.get('destinationCurrency') !== currency || query.get('pricing') !== 'fixed_output') return null
        const now = Date.now()
        const typedDestination = query.get('destinationAmount')
        const typedSource = query.get('sourceAmount')
        if (!typedDestination && !typedSource) {
            const body: OfframpQuoteBody = {
                destinationCurrency: currency,
                rate: latestRate(),
                updatedAt: new Date(now).toISOString(),
                pricing: 'fixed_output',
            }
            return { status: 200, body }
        }

        const rate = rates[Math.min(issued, rates.length - 1)]
        const rateUnits = BigInt(rate.replace('.', '')) // 4 decimals
        let sourceCents: bigint
        let destinationCents: bigint
        if (typedDestination) {
            const cents = toCents(typedDestination)
            if (cents === null) return invalidAmount()
            destinationCents = cents
            sourceCents = (cents * 10_000n + rateUnits - 1n) / rateUnits
        } else {
            const cents = toCents(typedSource)
            if (cents === null) return invalidAmount()
            sourceCents = cents
            destinationCents = (cents * rateUnits) / 10_000n
            if (destinationCents === 0n) return { status: 400, body: { error: 'The amount is too small to withdraw.' } }
        }

        issued += 1
        const body: OfframpQuoteBody = {
            destinationCurrency: currency,
            rate,
            updatedAt: new Date(now).toISOString(),
            destinationAmount: fromCents(destinationCents),
            sourceAmount: fromCents(sourceCents),
            pricing: 'fixed_output',
            quoteId: `fixture-quote-${currency}-${issued}`,
            expiresAt: new Date(now + 2 * 60 * 1000).toISOString(),
        }
        return { status: 200, body }
    }

    const publicRate = (path: string): FixtureReply | null => {
        const query = new URL(path, 'http://fixture.local').searchParams
        if (query.get('destinationCurrency') !== currency) return null
        const body: OfframpRateBody = {
            destinationCurrency: currency,
            rate: latestRate(),
            updatedAt: new Date().toISOString(),
            pricing: 'fixed_output',
        }
        return { status: 200, body }
    }

    return {
        'GET /bridge/offramp/quote': quote,
        'GET /bridge/offramp/rate': publicRate,
    }
}

// Bridge 0.9 EUR per USD, less Peanut's 0.30%: 0.8973. The requote case then
// moves to 0.8964, as if Bridge's rate fell to 0.8991 while the quote waited.
const EUR_WITHDRAWAL_RATE = '0.8973'
const EUR_WITHDRAWAL_RATE_AFTER_MOVE = '0.8964'

// Hugo's overflow case: a username no header was designed for, and a points
// total that is nine digits with separators.
const LONG_USERNAME = 'bh12ui2buibui52bi'
const HUGE_POINTS = 1_200_244_192

const LONG_FULL_NAME = 'Maximiliano Alejandro Fernández de la Vega y Santibáñez'

// The withdraw screen reads saved accounts from `user.accounts` — NOT from
// GET /users/accounts, which nothing on that screen calls. Overriding the
// wrong endpoint is why this fixture used to show "No accounts yet".
// Arrays replace on merge, so the wallet row has to be repeated here: useWallet
// matches the balance on it. Same shape as DEMO_USER.accounts[0], copied rather
// than imported — this file stays dependency-free so Playwright can load it.
const WALLET_ACCOUNT = {
    id: 'demo-account',
    userId: 'demo-user',
    bridgeAccountId: '',
    type: 'peanut-wallet',
    identifier: '0xdec0debad1dec0debad1dec0debad1dec0debad1',
    details: { bankName: null, accountOwnerName: 'Demo User', countryCode: '', countryName: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    chainId: '42161',
}

const BANK_ACCOUNTS = [
    {
        id: 'fixture-iban-1',
        userId: 'demo-user',
        bridgeAccountId: '',
        type: 'iban',
        identifier: 'ES27007509842206070802',
        details: { bankName: 'Banco Fixture', accountOwnerName: 'Demo User', countryCode: 'ESP', countryName: 'spain' },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        chainId: null,
    },
    {
        id: 'fixture-us-1',
        userId: 'demo-user',
        bridgeAccountId: '',
        type: 'us',
        identifier: '938636999398030',
        routingNumber: '021000021',
        details: {
            bankName: 'Fixture Bank',
            accountOwnerName: 'Demo User',
            countryCode: 'USA',
            countryName: 'united-states',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        chainId: null,
    },
]

// The same two bank accounts, but named by the user and with a last withdrawal
// on them — what the picker sorts and titles by (TASK-22589). The Spanish one
// was used more recently, so it sorts above the US one that was added later.
const NAMED_BANK_ACCOUNTS = [
    { ...BANK_ACCOUNTS[0], label: 'Payroll', lastUsedAt: '2026-08-12T09:00:00.000Z' },
    { ...BANK_ACCOUNTS[1], label: null, lastUsedAt: '2026-06-02T09:00:00.000Z' },
]

// Fees v2 bank review: a verified Bridge customer whose Spanish IBAN is a
// Bridge account, which is what the submit needs before it asks create:
// identity verified, the EU SEPA rail enabled (the review's withdraw gate reads
// channel 'bank', country 'EU' — the demo user has no EU rail, so without this
// the submit opens the "Unlock Spain" KYC drawer), a Bridge customer id, and the
// account's Bridge id. Synthetic state for browser QA only: nothing here reaches
// a provider or advances anyone's real KYC. Every amount comes from
// simulatedWithdrawalPricing. Arrays replace on merge, so the rails listed are
// the whole list: the demo's US rail, and SEPA.
const FIXED_OUTPUT_WITHDRAW_USER = {
    'GET /users/me': {
        user: { bridgeCustomerId: 'fixture-bridge-customer' },
        accounts: [WALLET_ACCOUNT, { ...BANK_ACCOUNTS[0], bridgeAccountId: 'fixture-bridge-iban' }],
        identityVerification: { status: 'verified' },
        capabilities: {
            rails: [
                {
                    id: 'bridge.ach_us',
                    provider: 'bridge',
                    method: 'ACH_US',
                    channel: 'bank',
                    country: 'US',
                    currency: 'USD',
                    status: 'enabled',
                },
                {
                    id: 'bridge.sepa_eu',
                    provider: 'bridge',
                    method: 'SEPA_EU',
                    channel: 'bank',
                    country: 'EU',
                    currency: 'EUR',
                    status: 'enabled',
                },
            ],
            nextActions: [],
            restrictions: [],
        },
    },
}

// The activity list is not only transactions: it also injects a row per badge
// in `user.badges` and one identity-verification row. An empty state needs all
// three cleared, or "no transactions" still renders four rows.
const NO_TIMELINE_EXTRAS = {
    'GET /users/history': { entries: [], hasMore: false },
    'GET /users/me': { user: { badges: [] }, identityVerification: { status: 'not_started' } },
}

const RICH_POINTS = {
    userId: 'demo-user',
    directPoints: 900_000_000,
    transitivePoints: 300_244_192,
    totalPoints: HUGE_POINTS,
    currentTier: 3,
    nextTierThreshold: 2_000_000_000,
    pointsToNextTier: 799_755_808,
}

const CASH_STATUS_EARNED = {
    hasCashbackLeft: true,
    lifetimeEarned: 25.5,
    lifetimeBreakdown: { cashback: 10, inviterRewards: 10, withdrawPerks: 3, depositPerks: 2, other: 0.5 },
    rewards: { pendingUsd: 5, lifetimeEarnedUsd: 25.5 },
}

const INVITES_ONE = {
    invitees: [
        {
            inviteeId: 'fixture-invitee-1',
            username: 'testfriend1',
            fullName: 'Test Friend',
            kycVerified: true,
            contributedPoints: 50,
            showFullName: false,
            lifetimeEarnedUsd: 0.5,
        },
    ],
    summary: {
        multiplier: 1,
        pendingInvites: 0,
        totalContributedPoints: 50,
        totalDirectPoints: 200,
        totalInvites: 1,
        verifiedInvites: 1,
        totalLifetimeEarnedUsd: 0.5,
        totalPendingUsd: 0,
    },
}

const HUGE_HISTORY_ENTRY = {
    uuid: 'fixture-huge-tx',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-08-01T10:00:00.000Z'),
    amount: '9876543.21',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'COMPLETED',
    userRole: 'RECIPIENT',
    senderAccount: { identifier: LONG_USERNAME, type: 'PEANUT_WALLET', isUser: true, username: LONG_USERNAME },
    recipientAccount: { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' },
    extraData: { kind: 'DIRECT_TRANSFER', usdAmount: '9876543.21' },
    memo: 'Series B wire, split three ways with a memo long enough to wrap',
}

// Peers who have picked an avatar (TASK-22625). The demo cast has none, so the
// baseline only ever shows the letter fallback; these restate the three lists a
// peer appears in. Arrays replace on merge, so each list is given in full.
const PEER = (username: string, fullName: string, avatarKey: string | null) => ({
    identifier: username,
    type: 'PEANUT_WALLET',
    isUser: true,
    username,
    fullName,
    showFullName: true,
    avatarKey,
})

const PEER_HISTORY_ENTRY = (
    uuid: string,
    amount: string,
    memo: string,
    peer: ReturnType<typeof PEER>,
    viewerIsRecipient: boolean
) => ({
    uuid,
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-08-01T10:00:00.000Z'),
    amount,
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'COMPLETED',
    userRole: viewerIsRecipient ? 'RECIPIENT' : 'SENDER',
    senderAccount: viewerIsRecipient
        ? peer
        : { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' },
    recipientAccount: viewerIsRecipient
        ? { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' }
        : peer,
    extraData: { kind: 'DIRECT_TRANSFER', usdAmount: amount },
    memo,
})

const AVATAR_PEERS = [
    PEER('alice', 'Alice Nguyen', 'basic.frog'),
    PEER('bob', 'Bob Carter', 'basic.avocado'),
    PEER('carol', 'Carol Diaz', 'badge.BUG_WHISPERER.beetle'),
    // No pick: the letter sticker of the USERNAME, beside a full name whose
    // initials it deliberately no longer uses.
    PEER('dave', 'Dave Patel', null),
]

const PEER_CONTACT = (peer: (typeof AVATAR_PEERS)[number], relationship: string) => ({
    userId: `demo-${peer.username}`,
    username: peer.username,
    fullName: peer.fullName,
    avatarKey: peer.avatarKey,
    isVerified: true,
    showFullName: true,
    relationshipTypes: [relationship],
    firstInteractionDate: '2026-01-01T00:00:00.000Z',
    lastInteractionDate: '2026-01-01T00:00:00.000Z',
    transactionCount: 1,
})
/**
 * Sandbox opens every account in the user's own name, so each fixture below
 * carries the demo user as the holder and `nameOnAccount: 'user'`. The
 * exceptions are the provider-held and unknown-ownership fixtures, which
 * prove both non-possessive branches.
 *
 * `matching.sender` and `rules` are copied from what the backend returns per
 * rail (peanut-api-ts `src/deposit-accounts/bridge-adapter.ts`). The screens
 * read nothing else, so a fixture IS the corridor as far as they are
 * concerned.
 */
const HOLDER = 'Demo User'

/** Dollars: third-party payments are allowed, on published terms. */
const DEPOSIT_ACCOUNT_USD = {
    id: 'fixture-deposit-usd',
    railId: 'bridge.ach_us',
    country: 'USA',
    currency: 'USD',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: DEPOSIT_RAIL_POLICY.ACH_US.sender },
    rules: DEPOSIT_RAIL_POLICY.ACH_US.rules,
    instructions: {
        accountHolderName: HOLDER,
        bankName: 'Lead Bank',
        bankAddress: '1801 Main St, Kansas City, MO 64108',
        accountNumber: '9600000000000001',
        routingNumber: '101019644',
        beneficiaryName: HOLDER,
        beneficiaryAddress: '1000 Brannan St, San Francisco, CA 94103',
        paymentRails: ['ach_push', 'wire', 'fednow'],
    },
} satisfies DepositAccount

/**
 * The same dollar account held by a New York or Texas resident. No third party
 * may pay in at all, so the policy narrows to own-name-only and the terms
 * collapse to the reason.
 */
const DEPOSIT_ACCOUNT_USD_STATE_RESTRICTED = {
    ...DEPOSIT_ACCOUNT_USD,
    id: 'fixture-deposit-usd-state',
    matching: { ...DEPOSIT_ACCOUNT_USD.matching, sender: 'own-name-only' as const },
    rules: {
        ownAccount: { allowed: true },
        thirdPartyBusiness: 'unavailable',
        thirdPartyIndividual: { policy: 'unavailable' },
        reason: 'state-restricted',
    },
} satisfies DepositAccount

/** Euros: mirrors the US rail — individuals capped under 4,000 EUR, family exempt, 1 EUR floor. */
const DEPOSIT_ACCOUNT_EUR = {
    id: 'fixture-deposit-eur',
    railId: 'bridge.sepa_eu',
    country: 'DEU',
    currency: 'EUR',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: DEPOSIT_RAIL_POLICY.SEPA_EU.sender },
    rules: DEPOSIT_RAIL_POLICY.SEPA_EU.rules,
    instructions: {
        accountHolderName: HOLDER,
        bankName: 'Modern Treasury Bank',
        bankAddress: 'Rue du Commerce 4, 1000 Brussels, Belgium',
        iban: 'DE89 3704 0044 0532 0130 00',
        bic: 'MTBEBEBB',
        beneficiaryName: HOLDER,
        beneficiaryAddress: 'Prinsengracht 263, 1016 GV Amsterdam, Netherlands',
        paymentRails: ['sepa'],
    },
} satisfies DepositAccount

/** Sterling: business payments only, unlimited, with a 2 GBP floor. */
const DEPOSIT_ACCOUNT_GBP = {
    id: 'fixture-deposit-gbp',
    railId: 'bridge.faster_payments_gb',
    country: 'GBR',
    currency: 'GBP',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: DEPOSIT_RAIL_POLICY.FASTER_PAYMENTS_GB.sender },
    rules: DEPOSIT_RAIL_POLICY.FASTER_PAYMENTS_GB.rules,
    instructions: {
        accountHolderName: HOLDER,
        bankName: 'Clear Junction Limited',
        accountNumber: '00000001',
        sortCode: '04-00-53',
        paymentRails: ['faster_payments'],
    },
} satisfies DepositAccount

/**
 * Pesos: third party permitted, individuals capped per payment, businesses
 * unlimited, 50 MXN floor. SPEI also returns a CLABE and no bank name, which
 * is why rows follow field presence.
 */
const DEPOSIT_ACCOUNT_MXN = {
    id: 'fixture-deposit-mxn',
    railId: 'bridge.spei_mx',
    country: 'MEX',
    currency: 'MXN',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: DEPOSIT_RAIL_POLICY.SPEI_MX.sender },
    rules: DEPOSIT_RAIL_POLICY.SPEI_MX.rules,
    instructions: {
        accountHolderName: HOLDER,
        clabe: '646180111800000000',
        paymentRails: ['spei'],
    },
} satisfies DepositAccount

/**
 * Pesos colombianos: Bre-B names the account by a key the payer types, which
 * is a row of its own beside the bank and the holder.
 */
const DEPOSIT_ACCOUNT_COP = {
    id: 'fixture-deposit-cop',
    railId: 'bridge.bank_transfer_co',
    country: 'COL',
    currency: 'COP',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: DEPOSIT_RAIL_POLICY.BANK_TRANSFER_CO.sender },
    instructions: {
        accountHolderName: HOLDER,
        bankName: 'Banco Davivienda',
        breBKey: '@peanut.jordan',
        paymentRails: ['bre_b'],
    },
} satisfies DepositAccount

/**
 * The one fixture where the payer does NOT read the user's name: the account
 * is held by our banking partner on the user's behalf. The holder string is
 * invented and partner-neutral on purpose — the screens must never name a
 * provider, and a fixture is a screenshot waiting to happen.
 */
const DEPOSIT_ACCOUNT_PROVIDER_HELD = {
    ...DEPOSIT_ACCOUNT_EUR,
    id: 'fixture-deposit-provider-held',
    matching: { ...DEPOSIT_ACCOUNT_EUR.matching, nameOnAccount: 'provider' },
    instructions: {
        ...DEPOSIT_ACCOUNT_EUR.instructions,
        accountHolderName: 'Northwind Payments B.V.',
        beneficiaryName: 'Northwind Payments B.V.',
    },
} satisfies DepositAccount

/**
 * Bridge returned the real holder but its verified identity snapshot was not
 * available. The screen keeps the holder row and payer terms, but makes no
 * claim about who legally holds the account.
 */
const DEPOSIT_ACCOUNT_OWNERSHIP_UNKNOWN = {
    ...DEPOSIT_ACCOUNT_EUR,
    id: 'fixture-deposit-ownership-unknown',
    matching: { ...DEPOSIT_ACCOUNT_EUR.matching, nameOnAccount: 'unknown' },
} satisfies DepositAccount

/**
 * The Bridge bank rails, the set a user verified through Bridge carries.
 *
 * The corridor rows come from the user's rails — `corridorsFromRails` in
 * features/deposit-accounts/rails.ts — so this list IS what the hub shows.
 * The Manteca corridors are deliberately absent: they belong to an Argentine
 * or Brazilian user, and the fixture that wants one says so (`get-paid-ar`).
 */
const BRIDGE_BANK_RAILS = [
    { id: 'bridge.ach_us', provider: 'bridge', method: 'ACH_US', channel: 'bank', country: 'US', currency: 'USD' },
    { id: 'bridge.sepa_eu', provider: 'bridge', method: 'SEPA_EU', channel: 'bank', country: 'EU', currency: 'EUR' },
    {
        id: 'bridge.faster_payments_gb',
        provider: 'bridge',
        method: 'FASTER_PAYMENTS_GB',
        channel: 'bank',
        country: 'GB',
        currency: 'GBP',
    },
    { id: 'bridge.spei_mx', provider: 'bridge', method: 'SPEI_MX', channel: 'bank', country: 'MX', currency: 'MXN' },
]

const VA_READY_CAPABILITIES = {
    rails: BRIDGE_BANK_RAILS.map((rail) => ({ ...rail, status: 'enabled' })),
    nextActions: [],
    restrictions: [],
}

/**
 * The same corridors, before identity is verified.
 *
 * The rails are present and `requires-info`: an unverified user still has a
 * region, so the rows exist and the gate says what is missing. An empty rail
 * list is a user with no bank region at all — that is the empty state, not this.
 */
const BLOCKED_BANK_CAPABILITIES = {
    rails: BRIDGE_BANK_RAILS.map((rail) => ({
        ...rail,
        status: 'requires-info',
        blockingActions: ['sumsub:identity'],
        reason: { code: 'identity_not_verified', userMessage: 'Verify your identity to open an account.' },
    })),
    nextActions: [{ key: 'sumsub:identity', kind: 'sumsub', purpose: 'unlock-bank', levelKey: 'identity' }],
    restrictions: [],
}

/** An Argentine user: one Manteca bank rail, and no Bridge corridor at all. */
const MANTECA_AR_CAPABILITIES = {
    rails: [
        {
            id: 'manteca.bank_transfer_ar',
            provider: 'manteca',
            method: 'BANK_TRANSFER_AR',
            channel: 'bank',
            country: 'AR',
            currency: 'ARS',
            status: 'enabled',
        },
    ],
    nextActions: [],
    restrictions: [],
}

/** A Colombian user: one Bre-B corridor and nothing else. */
const BRIDGE_CO_CAPABILITIES = {
    rails: [
        {
            id: 'bridge.bank_transfer_co',
            provider: 'bridge',
            method: 'BANK_TRANSFER_CO',
            channel: 'bank',
            country: 'CO',
            currency: 'COP',
            status: 'enabled',
        },
    ],
    nextActions: [],
    restrictions: [],
}

/** Every verified-user deposit-account fixture answers the gate the same way, rollout included. */
const VA_READY_RESPONSE = {
    'GET /users/me': { capabilities: VA_READY_CAPABILITIES, depositAccounts: { enabled: true } },
}

/** A $250 request, as the payer settles it in dollars and by euro bank transfer. */
const REQUEST_PAY_USD = { amount: '250.00', currency: 'USD', isEstimate: false }
const REQUEST_PAY_EUR = {
    amount: '230.00',
    currency: 'EUR',
    isEstimate: true,
    rate: { from: 'USD', to: 'EUR', rate: '0.92', source: 'fixture', asOf: null },
}

export const FIXTURES: Record<string, Fixture> = {
    'setup-pending': {
        route: '/setup',
        about: 'Resume an unfinished account setup',
        responses: { 'GET /users/me': { user: { hasAppAccess: false }, accounts: [] } },
    },
    // ---------------------------------------------------------------------
    // One per screen — the known-good default for each.
    // ---------------------------------------------------------------------
    'guest-invite': {
        route: '/invite?code=synthetic-invite',
        about: 'Invite before creating an account',
        responses: { 'GET /users/me': null },
    },
    home: { route: '/home', about: 'Home: balance, activity and CTAs for a verified user.' },
    'home-verification-needed': {
        route: '/home',
        about: 'Home: Add, Send and Request beside an additional bank-transfer verification task.',
        responses: {
            'GET /users/me': {
                capabilities: {
                    rails: [
                        {
                            id: 'bridge.ach_us',
                            provider: 'bridge',
                            method: 'ACH_US',
                            channel: 'bank',
                            country: 'US',
                            currency: 'USD',
                            status: 'requires-info',
                            blockingActions: ['bridge-hosted:proof-of-address'],
                        },
                    ],
                    nextActions: [
                        {
                            key: 'bridge-hosted:proof-of-address',
                            kind: 'bridge-hosted',
                            purpose: 'unlock-bridge-ach',
                            requirementKey: 'proof_of_address',
                            currency: 'USD',
                        },
                    ],
                    restrictions: [],
                },
            },
        },
    },
    profile: { route: '/profile', about: 'Profile menu, verified user, card row present.' },
    'profile-edit': {
        route: '/profile/edit',
        about: 'Verified name locked, account email editable.',
        responses: { 'GET /users/me': { profileNameLocked: true }, 'POST /users/email-change': { success: true } },
    },
    'profile-edit-unverified': {
        route: '/profile/edit',
        about: 'Name and email editable before identity verification.',
        responses: {
            'GET /users/me': { identityVerification: { status: 'not_started' }, profileNameLocked: false },
            'POST /users/email-change': { success: true },
        },
    },
    'identity-verification': {
        route: '/profile/accounts-and-payments',
        about: 'Unlocked regions for a user whose ID check passed.',
    },
    'settings-language': { route: '/settings/language', about: 'Language picker, English selected.' },
    rewards: {
        route: '/rewards',
        about: 'Points total, tier badge and invite list.',
        responses: { 'GET /points/cash-status': CASH_STATUS_EARNED, 'GET /points/invites': INVITES_ONE },
    },
    'rewards-invites': {
        route: '/rewards/invites',
        about: 'Invite list with one verified friend.',
        responses: { 'GET /points/invites': INVITES_ONE },
    },
    badges: { route: '/badges', about: 'Three-column badge collection with earned badges first and locked goals.' },
    history: { route: '/history', about: 'Activity list, four entries, both directions.' },
    'add-money': {
        route: '/add-money?method=bank',
        about: 'Add money by bank: the accounts you hold, crypto, and every country you can send from.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_EUR] } },
    },
    'add-money-crypto': { route: '/add-money/crypto', about: 'Crypto deposit: the network picker.' },
    withdraw: {
        route: '/withdraw',
        about: 'Withdraw with two saved bank accounts (a Spanish IBAN and a US account).',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT, ...BANK_ACCOUNTS] } },
    },
    'withdraw-crypto-destination': {
        route: '/withdraw/crypto',
        about: 'Crypto withdrawal: select the token, network and address before entering an amount.',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT, ...BANK_ACCOUNTS] } },
    },
    // Crypto address book beside the saved bank accounts. The three entries hit
    // the three last-used pill tones against the shots' frozen clock
    // (2026-08-15): <7d recent, 7-30d aging, 30+d stale.
    'withdraw-address-book': {
        route: '/withdraw',
        about: 'Withdraw with saved bank accounts and a crypto address book (all three last-used tones).',
        responses: {
            'GET /users/me': { accounts: [WALLET_ACCOUNT, ...BANK_ACCOUNTS] },
            'GET /users/saved-addresses': {
                savedAddresses: [
                    {
                        id: 'fixture-saved-1',
                        address: '0x28c6c06298d514db089934071355e5743bf21d60',
                        chainId: '42161',
                        nickname: 'Binance',
                        lastUsedAt: '2026-08-14T09:00:00.000Z',
                        createdAt: '2026-05-01T00:00:00.000Z',
                    },
                    {
                        id: 'fixture-saved-2',
                        address: '0x8894e0a0c962cb723c1976a4421c95949be2d4e3',
                        chainId: '8453',
                        nickname: 'Ledger',
                        lastUsedAt: '2026-08-03T09:00:00.000Z',
                        createdAt: '2026-04-10T00:00:00.000Z',
                    },
                    {
                        id: 'fixture-saved-3',
                        address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
                        chainId: 'tron',
                        nickname: 'OKX',
                        lastUsedAt: '2026-06-10T09:00:00.000Z',
                        createdAt: '2026-03-01T00:00:00.000Z',
                    },
                ],
            },
        },
    },
    // ?step=form names the screen; the amount is collected after it now.
    'withdraw-bank-form': {
        route: '/withdraw/spain?step=form',
        about: 'Bridge bank-account form for Spain — Field label/error chrome.',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT, ...BANK_ACCOUNTS] } },
    },
    // ---- the pick-first order (TASK-22589) ----
    // The first screen of the flow: pick where the money goes, before any amount.
    'withdraw-pick': {
        route: '/withdraw',
        about: 'Withdraw: the destination pick, saved accounts most-recently-used first.',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT, ...NAMED_BANK_ACCOUNTS] } },
    },
    // Manteca is entered with no amount now and collects it itself, in the
    // local currency — the amount as the last step before the review.
    'withdraw-amount-last': {
        route: '/withdraw/manteca?method=bank-transfer&country=argentina&destination=fixture.account&isSavedAccount=true',
        about: 'Withdraw amount as the last step, in local currency, with its own minimum.',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT, ...NAMED_BANK_ACCOUNTS] } },
    },
    // A saved destination opens amount entry; an amount below the minimum shows the field error.
    'withdraw-amount-error': {
        route: '/withdraw/manteca?method=bank-transfer&country=argentina&destination=fixture.account&isSavedAccount=true&amount=0.01',
        about: 'Withdraw amount step with its inline error — the amount is below the minimum.',
        waitFor: 'p[role="alert"]',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT, ...NAMED_BANK_ACCOUNTS] } },
    },
    // Named bank accounts beside the named address book: destinationLabel on
    // every row, masked identifier underneath.
    'withdraw-destination-names': {
        route: '/withdraw',
        about: 'Saved destinations with the names the user gave them, banks and addresses together.',
        responses: {
            'GET /users/me': { accounts: [WALLET_ACCOUNT, ...NAMED_BANK_ACCOUNTS] },
            'GET /users/saved-addresses': {
                savedAddresses: [
                    {
                        id: 'fixture-saved-1',
                        address: '0x28c6c06298d514db089934071355e5743bf21d60',
                        chainId: '42161',
                        nickname: 'Binance',
                        lastUsedAt: '2026-08-14T09:00:00.000Z',
                        createdAt: '2026-05-01T00:00:00.000Z',
                    },
                ],
            },
        },
    },
    limits: { route: '/limits', about: 'Payment limits: the unlocked regions and the crypto note.' },
    // Masked state only ('****' — same span as the digits). Revealing needs a
    // passkey step-up, which no fixture can answer.
    'card-application': {
        route: '/card',
        about: 'Public card application with unknown residence, no admission badge, and no card balance.',
        responses: {
            'GET /users/me': { user: { badges: [] }, identityVerification: { status: 'not_started' } },
            'GET /card': { isEligible: false, geoProhibited: false },
            'GET /rain/cards': { status: { hasApplication: false }, cards: [], balance: null },
            'POST /rain/cards': { status: 'terms-required', isUsResident: false },
        },
    },
    'card-holder': {
        route: '/card',
        about: 'Existing holder keeps card management even when new issuance is prohibited for their residence.',
        responses: {
            'GET /card': { isEligible: false, geoProhibited: true },
            'GET /rain/cards': {
                status: { hasApplication: true, railStatus: 'ENABLED' },
                balance: null,
                cards: [
                    {
                        id: 'fixture-card',
                        rainCardId: 'fixture-rain',
                        status: 'ACTIVE',
                        last4: '0420',
                        expiryMonth: 6,
                        expiryYear: 2069,
                        network: 'visa',
                        issuedAt: '2026-01-01T00:00:00Z',
                        hasWithdrawApproval: false,
                    },
                ],
            },
        },
    },
    'card-prohibited': {
        route: '/card',
        about: 'Known prohibited residence remains blocked from a new card application.',
        responses: {
            'GET /card': { isEligible: false, geoProhibited: true },
            'GET /rain/cards': { status: { hasApplication: false }, cards: [], balance: null },
        },
    },
    'card-pending': {
        route: '/card',
        about: 'Existing card application keeps its provider review status.',
        responses: {
            'GET /rain/cards': { status: { hasApplication: true, railStatus: 'PENDING' }, cards: [], balance: null },
        },
    },
    'card-pin': {
        route: '/card/pin',
        about: 'Card PIN screen, masked, with an active fake card behind the gate.',
        responses: {
            'GET /rain/cards': {
                status: { hasApplication: true },
                cards: [
                    {
                        id: 'demo-card',
                        rainCardId: 'demo-rain-card',
                        last4: '4242',
                        expiryMonth: 12,
                        expiryYear: 2030,
                        status: 'ACTIVE',
                        network: 'VISA',
                        issuedAt: '2026-01-01T00:00:00.000Z',
                        hasWithdrawApproval: true,
                    },
                ],
            },
        },
    },
    'card-limit': {
        route: '/card/limit',
        // the $500 per-transaction limit itself comes from the demo api's
        // /rain/cards/:cardId/limits handler; this only unlocks the gate.
        about: 'Card limit screen with a $500 per-transaction limit behind the gate.',
        responses: {
            'GET /rain/cards': {
                status: { hasApplication: true },
                cards: [
                    {
                        id: 'demo-card',
                        rainCardId: 'demo-rain-card',
                        last4: '4242',
                        expiryMonth: 12,
                        expiryYear: 2030,
                        status: 'ACTIVE',
                        network: 'VISA',
                        issuedAt: '2026-01-01T00:00:00.000Z',
                        hasWithdrawApproval: true,
                    },
                ],
            },
        },
    },
    send: { route: '/send', about: 'Send: the method picker — link, contacts, bank or Mercado Pago.' },
    request: { route: '/request', about: 'Request money: amount entry.' },
    'request-contact-blocked': {
        route: '/request?recipient=alice',
        about: 'Addressed request blocked for a user without a prior money transfer.',
        responses: { 'GET /users/contacts': { contacts: [], total: 0, hasMore: false } },
    },
    'profile-request-blocked': {
        route: '/profile/view?username=alice',
        about: 'Public profile: Request disabled for a user without a prior money transfer.',
        responses: { 'GET /users/contacts': { contacts: [], total: 0, hasMore: false } },
    },
    'request-contact-received': {
        route: '/request?recipient=alice',
        about: 'Addressed request allowed after receiving money from the contact.',
        responses: {
            'GET /users/contacts': {
                contacts: [
                    {
                        userId: 'demo-alice',
                        username: 'alice',
                        fullName: 'Alice',
                        isVerified: false,
                        showFullName: true,
                        relationshipTypes: ['received_money'],
                        firstInteractionDate: '2026-01-01T00:00:00.000Z',
                        lastInteractionDate: '2026-01-01T00:00:00.000Z',
                        transactionCount: 1,
                    },
                ],
                total: 1,
                hasMore: false,
            },
        },
    },

    // ---------------------------------------------------------------------
    // Rates & fees (TASK-19427). The offline demo answers GET /fx/rate 503, so
    // a quote needs a whole reply. It is scoped to USD → BRL: swapping the pair
    // in the widget asks for BRL → USD, which this fixture does not answer, and
    // the screen falls to "rate unavailable" — the honest answer, not a made-up
    // one. Swaps are covered by the widget's Jest tests.
    // ---------------------------------------------------------------------
    'rates-and-fees': {
        route: '/profile/exchange-rate?from=USD&to=BRL&amount=10',
        about: 'Rates & fees with a simulated 5 BRL/USD quote: 10 USD → 50 BRL, Withdraw now enabled.',
        waitFor: '[data-testid="exchange-rate-pill"]',
        replies: SIMULATED_USD_BRL,
    },
    'rates-and-fees-below-minimum': {
        route: '/profile/exchange-rate?from=USD&to=BRL&amount=0.1',
        about: 'Rates & fees below the PIX floor: 0.1 USD → 0.5 BRL, Withdraw now disabled, "Minimum withdrawal: 1 BRL".',
        waitFor: '[data-testid="exchange-rate-minimum"]',
        replies: SIMULATED_USD_BRL,
    },
    'rates-and-fees-unavailable': {
        route: '/profile/exchange-rate?from=USD&to=BRL&amount=10',
        about: 'Rates & fees when the rate cannot be read: no quote, no fee claim, no delivery time.',
        waitFor: '[data-testid="exchange-rate-pill"]',
    },

    // ---------------------------------------------------------------------
    // Fees v2 withdrawals (TASK-19427): Peanut's 0.30% inside the rate, a
    // signed fixed_output quote at review. Synthetic rates, stamped fresh on
    // every request. The bank review keeps its account in flow memory, so it
    // has no URL of its own: open /withdraw, pick the Spanish IBAN, type 20 EUR
    // and Continue. Rates & fees opens on its own.
    // ---------------------------------------------------------------------
    'rates-withdrawal-fixed-output': {
        route: '/profile/exchange-rate?from=USD&to=EUR&amount=100',
        about: 'Rates & fees on a withdrawal pair: the public rate 0.8973 (Bridge 0.9 less 0.30%), 100 USD → 89.73 EUR, still an estimate.',
        waitFor: '[data-testid="exchange-rate-pill"]',
        replies: simulatedWithdrawalPricing('eur', [EUR_WITHDRAWAL_RATE]),
    },
    'withdraw-bank-fixed-output': {
        route: '/withdraw',
        about: 'Bank review with a signed quote: pick the Spanish IBAN, 20 EUR, Continue — exactly €20 for $22.29 at 0.8973, no "≈".',
        responses: FIXED_OUTPUT_WITHDRAW_USER,
        replies: simulatedWithdrawalPricing('eur', [EUR_WITHDRAWAL_RATE]),
    },
    'withdraw-bank-quote-expired': {
        route: '/withdraw',
        about: 'Bank review whose quote create refuses (409 BRIDGE_QUOTE_EXPIRED): 20 EUR requoted at 0.8964 for $22.32, "Review the updated quote to continue." Nothing is sent.',
        responses: FIXED_OUTPUT_WITHDRAW_USER,
        replies: {
            ...simulatedWithdrawalPricing('eur', [EUR_WITHDRAWAL_RATE, EUR_WITHDRAWAL_RATE_AFTER_MOVE]),
            'POST /bridge/offramp/create': {
                status: 409,
                body: { error: 'This quote has expired. Get a new quote.', code: 'BRIDGE_QUOTE_EXPIRED' },
            },
        },
    },

    // ---------------------------------------------------------------------
    // Hazards — user text and numbers that break layouts.
    // ---------------------------------------------------------------------
    'hugo-long-username': {
        route: '/profile',
        about: `Hugo's case: the ${LONG_USERNAME.length}-character username "${LONG_USERNAME}" in the header and the share-link pill.`,
        responses: {
            'GET /users/me': { user: { username: LONG_USERNAME, fullName: LONG_USERNAME, showFullName: false } },
            'GET /points': RICH_POINTS,
            'GET /points/invites': INVITES_ONE,
        },
    },
    'long-full-name': {
        route: '/profile',
        about: 'Profile header with a 55-character full name shown instead of the username.',
        responses: { 'GET /users/me': { user: { fullName: LONG_FULL_NAME, showFullName: true } } },
    },
    'long-name-history': {
        route: '/history',
        about: 'Activity row where a long counterparty name is clipped by a nine-digit amount.',
        responses: {
            'GET /users/history': { entries: [HUGE_HISTORY_ENTRY], hasMore: false },
        },
    },
    'huge-amount-history': {
        route: '/history',
        about: 'A $9,876,543.21 transfer next to normal amounts.',
        responses: {
            'GET /users/history': {
                entries: [HUGE_HISTORY_ENTRY, { ...HUGE_HISTORY_ENTRY, uuid: 'fixture-small-tx', amount: '1.00' }],
                hasMore: false,
            },
        },
    },
    // /limits is a region list; the numbers live one screen deeper, on the
    // per-provider page. Aim at that page or the big values never reach the shot.
    'huge-limits': {
        route: '/limits/manteca',
        about: 'Eleven-digit ARS monthly caps: checks the number abbreviation and the progress bar.',
        responses: {
            'GET /users/limits': {
                manteca: [
                    {
                        exchangeCountry: 'ARG',
                        type: 'EXCHANGE',
                        asset: 'ARS',
                        yearlyLimit: '999999999999',
                        availableYearlyLimit: '987654321098',
                        monthlyLimit: '99999999999',
                        availableMonthlyLimit: '98765432109',
                    },
                ],
            },
        },
    },
    'huge-rewards-cash': {
        route: '/rewards',
        about: 'Points and cashback both at implausible totals.',
        responses: {
            'GET /points': RICH_POINTS,
            'GET /points/cash-status': {
                hasCashbackLeft: true,
                lifetimeEarned: 1234567.89,
                lifetimeBreakdown: {
                    cashback: 1000000,
                    inviterRewards: 200000,
                    withdrawPerks: 30000,
                    depositPerks: 4000,
                    other: 567.89,
                },
                rewards: { pendingUsd: 98765.43, lifetimeEarnedUsd: 1234567.89 },
            },
        },
    },

    // ---------------------------------------------------------------------
    // Empty states.
    // ---------------------------------------------------------------------
    'empty-history': {
        route: '/history',
        about: 'Nothing on the timeline yet: no transaction, no badge, no ID check.',
        responses: NO_TIMELINE_EXTRAS,
    },
    'empty-home': {
        route: '/home',
        about: 'Fresh account: nothing on the timeline, so the activity block is gone. The balance comes from the demo overlay, not the API.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /points': { totalPoints: 0, directPoints: 0, transitivePoints: 0, currentTier: 0 },
        },
    },
    'empty-invites': {
        route: '/rewards/invites',
        about: 'Nobody invited yet.',
        responses: { 'GET /points/invites': { invitees: [], summary: { totalInvited: 0, totalPointsEarned: 0 } } },
    },
    'empty-accounts': {
        route: '/withdraw',
        about: 'Withdraw with no saved bank account — the add-account path.',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT] } },
    },
    'empty-rewards': {
        route: '/rewards',
        about: 'Zero points, tier 0, no invites.',
        responses: {
            'GET /points': {
                totalPoints: 0,
                directPoints: 0,
                transitivePoints: 0,
                currentTier: 0,
                nextTierThreshold: 100,
                pointsToNextTier: 100,
            },
            'GET /points/invites': { invitees: [], summary: { totalInvited: 0, totalPointsEarned: 0 } },
        },
    },

    // ---------------------------------------------------------------------
    // Verification states.
    //
    // The region screens read `capabilities.rails`, never
    // `identityVerification.status`. Override the rails or the screen shows a
    // fully unlocked user whatever the status says.
    // ---------------------------------------------------------------------
    unverified: {
        route: '/profile/accounts-and-payments',
        about: 'ID check never started: no region unlocked, all four locked.',
        responses: {
            'GET /users/me': {
                identityVerification: { status: 'not_started' },
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            },
        },
    },
    'identity-awaiting-upload': {
        route: '/profile/accounts-and-payments',
        about: 'ID upload still required: no in-review notice or support escalation.',
        responses: {
            'GET /users/me': {
                // The demo baseline is verified; clear its prior decision and
                // submission so this state really represents an unsubmitted upload.
                identityVerification: {
                    status: 'action_required',
                    reviewPending: false,
                    submittedAt: null,
                    reviewedAt: null,
                },
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            },
        },
    },
    'identity-review-overdue': {
        route: '/profile/accounts-and-payments',
        about: 'ID submitted for review over seven days ago: overdue notice with support text link.',
        responses: {
            'GET /users/me': {
                identityVerification: {
                    status: 'processing',
                    reviewPending: true,
                    submittedAt: '2026-08-20T12:00:00.000Z',
                    reviewedAt: null,
                },
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            },
        },
    },
    'kyc-action-required': {
        route: '/profile/accounts-and-payments',
        about: 'Bridge asks for more verification: the task card and its Complete verification button.',
        responses: {
            'GET /users/me': {
                capabilities: {
                    rails: [
                        {
                            id: 'bridge.ach_us',
                            provider: 'bridge',
                            method: 'ACH_US',
                            channel: 'bank',
                            country: 'US',
                            currency: 'USD',
                            status: 'requires-info',
                            blockingActions: ['bridge-hosted:proof-of-address'],
                        },
                    ],
                    nextActions: [
                        {
                            key: 'bridge-hosted:proof-of-address',
                            kind: 'bridge-hosted',
                            purpose: 'unlock-bridge-ach',
                            requirementKey: 'proof_of_address',
                        },
                    ],
                    restrictions: [],
                },
            },
        },
    },

    reconsent: {
        route: '/home',
        about: 'Re-consent modal over home: two updated documents as a centered link line.',
        responses: {
            'GET /users/consent/status': {
                needsReConsent: true,
                documents: [
                    {
                        slug: 'terms',
                        currentVersion: '2026-07-15',
                        acceptedVersion: '2026-01-01',
                        acceptedAt: '2026-01-01T00:00:00.000Z',
                        needsAcceptance: true,
                    },
                    {
                        slug: 'privacy',
                        currentVersion: '2026-07-15',
                        acceptedVersion: '2026-01-01',
                        acceptedAt: '2026-01-01T00:00:00.000Z',
                        needsAcceptance: true,
                    },
                ],
            },
        },
    },

    // ---------------------------------------------------------------------
    // Profile avatars (TASK-22142).
    // ---------------------------------------------------------------------
    'home-avatar': {
        route: '/home',
        about: 'Home top nav: the menu button that replaced the avatar chip — the picked sticker now shows on /profile.',
        responses: { 'GET /users/me': { user: { avatarKey: 'basic.frog' } } },
    },
    'peer-avatars': {
        route: '/history',
        about: 'Peers who picked an avatar (TASK-22625): activity rows, Send → Contacts and a public profile. Dave picked nothing, so he wears his username letter.',
        responses: {
            'GET /users/history': {
                entries: [
                    PEER_HISTORY_ENTRY('fixture-peer-tx-1', '45.00', 'Lunch split', AVATAR_PEERS[0], true),
                    PEER_HISTORY_ENTRY('fixture-peer-tx-2', '120.00', 'Rent share', AVATAR_PEERS[1], false),
                    PEER_HISTORY_ENTRY('fixture-peer-tx-3', '8.50', 'Coffee', AVATAR_PEERS[2], false),
                    PEER_HISTORY_ENTRY('fixture-peer-tx-4', '300.00', 'Invoice #1042', AVATAR_PEERS[3], true),
                ],
                hasMore: false,
            },
            'GET /users/contacts': {
                contacts: [
                    PEER_CONTACT(AVATAR_PEERS[0], 'received_money'),
                    PEER_CONTACT(AVATAR_PEERS[1], 'sent_money'),
                    PEER_CONTACT(AVATAR_PEERS[2], 'sent_money'),
                    PEER_CONTACT(AVATAR_PEERS[3], 'received_money'),
                ],
                total: 4,
                hasMore: false,
            },
            'GET /users/username/alice': { avatarKey: 'basic.frog' },
        },
    },
    'avatar-picker': {
        route: AVATAR_PICKER_PATH,
        about: 'Avatar picker open: 2x2 on a narrow phone, 2x3 from 390px, the initial first and a Bug Whisperer avatar guaranteed, beetle selected.',
        responses: {
            'GET /users/me': {
                user: {
                    avatarKey: 'badge.BUG_WHISPERER.beetle',
                    badges: [
                        {
                            id: 'demo-badge-bug-whisperer',
                            code: 'BUG_WHISPERER',
                            name: 'Bug Whisperer',
                            description: 'You found a real bug, reported it, and stayed. We owe you a beer.',
                            iconUrl: '/badges/bug_whisperer.svg',
                            color: null,
                            earnedAt: '2026-08-30T12:00:00.000Z',
                            isVisible: true,
                        },
                    ],
                },
            },
        },
    },

    'card-access': {
        route: '/home',
        about: 'Card-eligible demo user — the activation spend chooser can open.',
        responses: { 'GET /card': { isEligible: true, geoProhibited: false } },
    },

    'early-user': {
        route: '/home',
        about: 'Early-user reward drawer over home, opened by the user flag.',
        responses: { 'GET /users/me': { showEarlyUserModal: true } },
    },

    // ---------------------------------------------------------------------
    // Standing deposit accounts (the bank hub). One fixture per state a payer or
    // a holder can be looking at — the two policy fields on `matching` are
    // what each screen reads, so the states differ by policy, not by country.
    //
    // The timed-out details screen has no fixture on purpose: it is reached
    // only after the client spends its provisioning poll budget, which no set
    // of mocked responses can produce. `useDepositAccounts.test` covers it.
    // ---------------------------------------------------------------------
    'get-paid': {
        route: '/add-money?method=bank',
        about: 'The hub: one euro account held, the rest open to claim, every country below.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_EUR] } },
    },
    'get-paid-empty': {
        route: '/add-money?method=bank',
        about: 'Nothing claimed yet — every corridor offered, none held, country list below.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [] } },
    },
    'get-paid-blocked': {
        route: '/add-money?method=bank',
        about: 'Identity not verified, so no corridor can be claimed and the gate says why.',
        responses: {
            'GET /users/deposit-accounts': { depositAccounts: [] },
            'GET /users/me': { capabilities: BLOCKED_BANK_CAPABILITIES },
        },
    },
    'get-paid-claim': {
        route: '/add-money?method=bank&step=claim&corridor=ACH_US',
        // The payer terms sit under the benefit rows, below the fold at 375.
        fullPage: true,
        about: 'What the user agrees to before a dollar account is opened, with the state rule still to be confirmed.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': { depositAccounts: [], claimable: [CLAIMABLE_USD_PREVIEW] },
        },
    },
    'get-paid-claim-eur': {
        route: '/add-money?method=bank&step=claim&corridor=SEPA_EU',
        // The payer terms sit under the benefit rows, below the fold at 375.
        fullPage: true,
        about: 'The same step on a corridor whose terms are fully resolved — no state rule to wait for.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': { depositAccounts: [], claimable: [CLAIMABLE_EUR] },
        },
    },
    'get-paid-details-eur': {
        route: '/add-money?method=bank&step=details&corridor=SEPA_EU',
        about: 'Euro details: businesses only until an individual volume is agreed, with a 1 EUR floor.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_EUR] } },
    },
    'get-paid-details-usd': {
        route: '/add-money?method=bank&step=details&corridor=ACH_US',
        about: 'Dollar details: businesses and same-surname family unlimited, anyone else capped.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_USD] } },
    },
    'get-paid-details-usd-state-restricted': {
        route: '/add-money?method=bank&step=details&corridor=ACH_US',
        about: 'The same dollar account for a resident of a state where no third party may pay in.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_USD_STATE_RESTRICTED] },
        },
    },
    'get-paid-details-gbp': {
        route: '/add-money?method=bank&step=details&corridor=FASTER_PAYMENTS_GB',
        about: 'Sterling details, where only a business may pay in, above a floor.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_GBP] } },
    },
    'get-paid-details-mxn': {
        route: '/add-money?method=bank&step=details&corridor=SPEI_MX',
        about: 'Peso details: a per-payment cap on individuals, and a floor under every payment.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_MXN] } },
    },
    'get-paid-details-provider-held': {
        route: '/add-money?method=bank&step=details&corridor=SEPA_EU',
        about: 'The account is held by our banking partner, so the payer reads a name that is not the user.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_PROVIDER_HELD] },
        },
    },
    'get-paid-details-ownership-unknown': {
        route: '/add-money?method=bank&step=details&corridor=SEPA_EU',
        about: 'Euro details with a real holder name but no verified provider identity for an ownership claim.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_OWNERSHIP_UNKNOWN] },
        },
    },
    'get-paid-provisioning': {
        route: '/add-money?method=bank&step=details&corridor=ACH_US',
        about: 'Claimed, waiting on the provider — the skeleton matches the row count to come.',
        isLoadingState: true,
        waitFor: '[data-testid="deposit-details-skeleton"]',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': {
                depositAccounts: [{ ...DEPOSIT_ACCOUNT_USD, status: 'provisioning', instructions: undefined }],
            },
        },
    },
    'get-paid-revoked': {
        route: '/add-money?method=bank&step=details&corridor=ACH_US',
        about: 'The account no longer accepts money and the details are already in a payroll file somewhere.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': { depositAccounts: [{ ...DEPOSIT_ACCOUNT_USD, status: 'revoked' }] },
        },
    },
    'get-paid-share': {
        route: '/add-money?method=bank&step=share&corridor=SEPA_EU',
        about: 'What the payer will see, before the user sends it to them.',
        // The caveats sit under the details card, below the fold.
        fullPage: true,
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_EUR] } },
    },
    'get-paid-cop': {
        route: '/add-money?method=bank&step=details&corridor=BANK_TRANSFER_CO',
        about: 'Colombia: the Bre-B key the payer types, beside the bank and the holder.',
        responses: {
            'GET /users/me': { capabilities: BRIDGE_CO_CAPABILITIES },
            'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_COP] },
        },
    },
    'get-paid-ar': {
        route: '/add-money?method=bank&step=details&corridor=BANK_TRANSFER_AR',
        about: 'Argentina: the provider CVU only credits transfers the user sends themselves, so it is never shared.',
        responses: {
            'GET /users/me': { capabilities: MANTECA_AR_CAPABILITIES },
            'GET /users/deposit-accounts': { depositAccounts: [] },
        },
    },

    // Data titles at their longest: a bank name as the bank prints it, an
    // address saved whole as its own nickname (before nicknames were capped),
    // and a contact whose full name runs past any row. Each stays one line.
    'withdraw-long-destination-names': {
        route: '/withdraw',
        about: 'Saved destinations whose names are data at full length: they truncate to one line.',
        responses: {
            'GET /users/me': {
                accounts: [
                    WALLET_ACCOUNT,
                    {
                        ...BANK_ACCOUNTS[0],
                        id: 'fixture-clabe-long',
                        type: 'clabe',
                        identifier: '646180546701072890',
                        label: null,
                        details: {
                            bankName: 'Sistema de Transferencias y Pagos STP, S.A. de C.V., SOFOM E.N.R.',
                            accountOwnerName: 'Demo User',
                            countryCode: 'MEX',
                            countryName: 'mexico',
                        },
                    },
                ],
            },
            'GET /users/saved-addresses': {
                savedAddresses: [
                    {
                        id: 'fixture-saved-long',
                        address: '0x28c6c06298d514db089934071355e5743bf21d60',
                        chainId: '42161',
                        nickname: '0x28c6c06298d514db089934071355e5743bf21d60',
                        lastUsedAt: '2026-08-14T09:00:00.000Z',
                        createdAt: '2026-05-01T00:00:00.000Z',
                    },
                ],
            },
        },
    },
    'send-contacts-long-names': {
        route: '/send?view=contacts',
        about: 'Contacts with a full name and a username longer than the row: one line each.',
        responses: {
            'GET /users/contacts': {
                contacts: [
                    {
                        ...PEER_CONTACT(AVATAR_PEERS[0], 'sent_money'),
                        username: LONG_USERNAME + LONG_USERNAME,
                        fullName: LONG_FULL_NAME,
                    },
                ],
                total: 1,
                hasMore: false,
            },
        },
    },
    'home-send-drawer': {
        route: '/home?drawer=send',
        about: 'The Send drawer — send to friends, or withdraw to own accounts.',
    },
    'home-add-drawer': {
        route: '/home?drawer=add',
        about: 'The Add drawer — where bank transfer now leads to the standing account.',
    },
    'home-request-drawer': {
        route: '/home?drawer=request',
        about: 'The Request drawer — share a request link, or share standing bank details.',
    },
    'request-with-bank-alternative': {
        route: '/request',
        about: 'Asking one person for one amount, with the standing-details alternative named below it.',
        // The alternative sits under the keypad, below the fold on a small phone.
        fullPage: true,
    },
    'request-pay-by-bank': {
        // `demo-request` is the uuid demo-api answers every request read with,
        // so the overrides below key on it.
        route: '/pay-request?id=demo-request',
        about: 'Paying a request whose requester shares their bank details, so a bank transfer can settle it.',
        // The bank-transfer row sits under the other payment methods.
        fullPage: true,
        responses: {
            'GET /requests/demo-request': { bankInstructionsShared: true, tokenAmount: '250' },
            // What is left to pay on every rail the requester can receive on.
            // The screen waits for this read before it draws the bank rows, so
            // a fixture without it never settles.
            'GET /requests/demo-request/pay-amounts': {
                requestCurrency: 'USD',
                requestAmount: '250.00',
                remainingAmount: '250.00',
                rails: [
                    { kind: 'peanut_balance', payerAmount: REQUEST_PAY_USD },
                    {
                        kind: 'bank',
                        railId: 'bridge.sepa_eu',
                        country: 'DE',
                        reference: 'demo-req',
                        payerAmount: REQUEST_PAY_EUR,
                    },
                ],
            },
            'GET /requests/demo-request/deposit-instructions': {
                depositAccount: DEPOSIT_ACCOUNT_EUR,
                paymentReference: 'demo-req',
                payerAmount: REQUEST_PAY_EUR,
            },
        },
    },

    // ---------------------------------------------------------------------
    // Error states.
    // ---------------------------------------------------------------------
    'error-history': {
        route: '/history',
        about: 'Activity fails to load while the rest of the app works.',
        fails: ['GET /users/history'],
    },
    'error-limits': {
        route: '/limits/manteca',
        about: 'The caps screen when GET /users/limits fails.',
        fails: ['GET /users/limits'],
    },
}
