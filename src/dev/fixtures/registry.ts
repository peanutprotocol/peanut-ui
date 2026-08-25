// Named app states for visual checks. Open any of them with
// `<route>?__fixture=<name>`, or browse them at /dev/fixtures.
//
// The baseline is the demo API (utils/demo-api.ts): a verified user with a
// balance, four contacts, four history entries and working rails. A fixture
// only states what differs, so most screen defaults need no overrides at all.
//
// Account shapes below are adapted from e2e/utils/mock-api.ts, whose responses
// were checked against production on 2026-04-16. The duplication is on purpose
// and temporary — the two systems merge later.

import type { Fixture } from './types'

// Hugo's overflow case: a username no header was designed for, and a points
// total that is nine digits with separators.
const LONG_USERNAME = 'bh12ui2buibui52bi'
const HUGE_POINTS = 1_200_244_192

const LONG_FULL_NAME = 'Maximiliano Alejandro Fernández de la Vega y Santibáñez'

const BANK_ACCOUNTS = [
    {
        account_id: 'fixture-iban-1',
        account_type: 'iban',
        account_identifier: 'ES27 0075 0984 2206 0708 0217',
        asset: 'EUR',
        is_active: true,
        country: 'ES',
    },
    {
        account_id: 'fixture-us-1',
        account_type: 'us',
        account_identifier: '938636999398030',
        asset: 'USD',
        routing_number: '021000021',
        is_active: true,
        country: 'US',
    },
]

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
    settings: { route: '/settings', about: 'Settings list.' },
    'settings-language': { route: '/settings/language', about: 'Language picker, English selected.' },
    notifications: { route: '/notifications', about: 'Notifications list.' },
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
    'add-money': { route: '/add-money', about: 'Add money: country and method picker.' },
    'add-money-crypto': { route: '/add-money/crypto', about: 'Crypto deposit address and network picker.' },
    withdraw: {
        route: '/withdraw',
        about: 'Withdraw with two saved bank accounts (EUR and USD).',
        responses: { 'GET /users/accounts': BANK_ACCOUNTS },
    },
    limits: { route: '/limits', about: 'Per-provider deposit and withdraw caps.' },
    send: { route: '/send', about: 'Send: recipient input with four known contacts.' },
    request: { route: '/request', about: 'Request money: amount entry.' },

    // ---------------------------------------------------------------------
    // Hazards — user text and numbers that break layouts.
    // ---------------------------------------------------------------------
    'hugo-long-username': {
        route: '/profile',
        about: `Hugo's case: username "${LONG_USERNAME}" with ${HUGE_POINTS.toLocaleString('en-US')} points. The username overflows here; the points total shows on /rewards with the same fixture.`,
        responses: {
            'GET /users/me': { user: { username: LONG_USERNAME, fullName: LONG_USERNAME, showFullName: false } },
            'GET /points': RICH_POINTS,
            'GET /points/invites': INVITES_ONE,
        },
    },
    'long-username-home': {
        route: '/home',
        about: 'Home greeting and avatar with the long username.',
        responses: { 'GET /users/me': { user: { username: LONG_USERNAME, showFullName: false } } },
    },
    'long-full-name': {
        route: '/profile',
        about: 'Profile header with a 55-character full name shown instead of the username.',
        responses: { 'GET /users/me': { user: { fullName: LONG_FULL_NAME, showFullName: true } } },
    },
    'long-name-history': {
        route: '/history',
        about: 'Activity rows where the counterparty name and memo both overflow.',
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
    'huge-limits': {
        route: '/limits',
        about: 'Nine-figure caps: checks number formatting and row wrapping.',
        responses: {
            'GET /users/limits': {
                bridge: { onRampPerTransaction: '999999999', offRampPerTransaction: '999999999', asset: 'USD' },
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
        about: 'No transactions yet.',
        responses: { 'GET /users/history': { entries: [], hasMore: false } },
    },
    'empty-home': {
        route: '/home',
        about: 'Fresh account: no activity and no points. The balance comes from the demo overlay, not the API.',
        responses: {
            'GET /users/history': { entries: [], hasMore: false },
            'GET /points': { totalPoints: 0, directPoints: 0, transitivePoints: 0, currentTier: 0 },
        },
    },
    'empty-invites': {
        route: '/rewards/invites',
        about: 'Nobody invited yet.',
        responses: { 'GET /points/invites': { invitees: [], summary: { totalInvited: 0, totalPointsEarned: 0 } } },
    },
    'empty-contacts': {
        route: '/send',
        about: 'Send with no saved contacts.',
        responses: { 'GET /users/contacts': { contacts: [], total: 0, hasMore: false } },
    },
    'empty-accounts': {
        route: '/withdraw',
        about: 'Withdraw with no saved bank account — the add-account path.',
        responses: { 'GET /users/accounts': [] },
    },
    'empty-notifications': {
        route: '/notifications',
        about: 'No notifications.',
        responses: { 'GET /notifications': { items: [], nextCursor: null } },
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
    // ---------------------------------------------------------------------
    unverified: {
        route: '/profile',
        about: 'ID check never started, every rail needs info — KYC gates visible.',
        responses: {
            'GET /users/me': {
                identityVerification: { status: 'not_started' },
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            },
        },
    },
    'kyc-processing': {
        route: '/profile/identity-verification',
        about: 'Documents submitted, decision pending.',
        responses: {
            'GET /users/me': {
                identityVerification: { status: 'processing', submittedAt: '2026-08-01T10:00:00.000Z' },
            },
        },
    },
    'kyc-action-required': {
        route: '/profile/identity-verification',
        about: 'Document rejected: the user must re-submit.',
        responses: {
            'GET /users/me': {
                identityVerification: {
                    status: 'action_required',
                    actionMessage: 'Your proof of address was not readable. Upload a clearer photo.',
                    rejectLabels: ['document_rejected'],
                    submittedAt: '2026-08-01T10:00:00.000Z',
                    reviewedAt: '2026-08-02T10:00:00.000Z',
                },
            },
        },
    },
    'kyc-gated-withdraw': {
        route: '/withdraw',
        about: 'Withdraw for an unverified user: the flow is blocked, not empty.',
        responses: {
            'GET /users/me': {
                identityVerification: { status: 'not_started' },
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            },
            'GET /users/accounts': [],
        },
    },

    // ---------------------------------------------------------------------
    // Error states.
    // ---------------------------------------------------------------------
    'error-user': {
        route: '/home',
        about: 'GET /users/me answers 500 — the backend error screen.',
        fails: ['GET /users/me'],
    },
    'error-history': {
        route: '/history',
        about: 'Activity fails to load while the rest of the app works.',
        fails: ['GET /users/history'],
    },
    'error-limits': {
        route: '/limits',
        about: 'Limits fail to load.',
        fails: ['GET /users/limits'],
    },
}
