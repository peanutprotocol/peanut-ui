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

import type { Fixture } from './types'

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

export const FIXTURES: Record<string, Fixture> = {
    // ---------------------------------------------------------------------
    // One per screen — the known-good default for each.
    // ---------------------------------------------------------------------
    home: { route: '/home', about: 'Home: balance, activity and CTAs for a verified user.' },
    profile: { route: '/profile', about: 'Profile menu, verified user, card row present.' },
    'profile-edit': { route: '/profile/edit', about: 'Personal details form, pre-filled.' },
    'identity-verification': {
        route: '/profile/identity-verification',
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
    badges: { route: '/badges', about: 'Badge wall with three earned badges.' },
    history: { route: '/history', about: 'Activity list, four entries, both directions.' },
    'add-money': { route: '/add-money?method=bank', about: 'Add money: the bank-transfer country list.' },
    'add-money-crypto': { route: '/add-money/crypto', about: 'Crypto deposit: the network picker.' },
    withdraw: {
        route: '/withdraw',
        about: 'Withdraw with two saved bank accounts (a Spanish IBAN and a US account).',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT, ...BANK_ACCOUNTS] } },
    },
    limits: { route: '/limits', about: 'Payment limits: the unlocked regions and the crypto note.' },
    send: { route: '/send', about: 'Send: the method picker — link, contacts, bank or Mercado Pago.' },
    request: { route: '/request', about: 'Request money: amount entry.' },

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
        route: '/profile/identity-verification',
        about: 'ID check never started: no region unlocked, all four locked.',
        responses: {
            'GET /users/me': {
                identityVerification: { status: 'not_started' },
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            },
        },
    },
    'kyc-action-required': {
        route: '/profile/identity-verification',
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
        about: 'Re-consent modal over home: two updated documents as bordered link rows.',
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
