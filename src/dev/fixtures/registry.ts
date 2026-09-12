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
import { AVATAR_PICKER_PATH } from '@/components/Avatar/avatar.consts'

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

/**
 * Sandbox opens every account in the user's own name, so each fixture below
 * carries the demo user as the holder and `nameOnAccount: 'user'`. The one
 * exception is DEPOSIT_ACCOUNT_PROVIDER_HELD, which exists to prove the other
 * branch.
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
    matching: { nameOnAccount: 'user', sender: 'anyone', memo: 'none', amount: 'flexible' },
    rules: {
        individualPerPaymentCap: { amount: '4000', currency: 'USD' },
        familySameSurnameExempt: true,
        businessesUnlimited: true,
    },
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
}

/**
 * The same dollar account held by a New York or Texas resident. No third party
 * may pay in at all, so the policy narrows to own-name-only and the terms
 * collapse to the reason.
 */
const DEPOSIT_ACCOUNT_USD_STATE_RESTRICTED = {
    ...DEPOSIT_ACCOUNT_USD,
    id: 'fixture-deposit-usd-state',
    matching: { ...DEPOSIT_ACCOUNT_USD.matching, sender: 'own-name-only' },
    rules: { reason: 'state-restricted' },
}

/** Euros: businesses only until an individual volume is agreed, 1 EUR floor. */
const DEPOSIT_ACCOUNT_EUR = {
    id: 'fixture-deposit-eur',
    railId: 'bridge.sepa_eu',
    country: 'DEU',
    currency: 'EUR',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: 'business-only', memo: 'none', amount: 'flexible' },
    rules: { businessesUnlimited: true, individualsAllowed: false, min: { amount: '1', currency: 'EUR' } },
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
}

/** Sterling: business payments only, and no published terms beyond that. */
const DEPOSIT_ACCOUNT_GBP = {
    id: 'fixture-deposit-gbp',
    railId: 'bridge.faster_payments_gb',
    country: 'GBR',
    currency: 'GBP',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: 'business-only', memo: 'none', amount: 'flexible' },
    instructions: {
        accountHolderName: HOLDER,
        bankName: 'Clear Junction Limited',
        accountNumber: '00000001',
        sortCode: '04-00-53',
        paymentRails: ['faster_payments'],
    },
}

/**
 * Pesos: nothing is published about who may pay in, so the account carries no
 * `rules` and the screens say only what is confirmed. SPEI also returns a
 * CLABE and no bank name, which is why rows follow field presence.
 */
const DEPOSIT_ACCOUNT_MXN = {
    id: 'fixture-deposit-mxn',
    railId: 'bridge.spei_mx',
    country: 'MEX',
    currency: 'MXN',
    status: 'active',
    isPrimary: true,
    matching: { nameOnAccount: 'user', sender: 'unknown', memo: 'none', amount: 'flexible' },
    instructions: {
        accountHolderName: HOLDER,
        clabe: '646180111800000000',
        paymentRails: ['spei'],
    },
}

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
}

/** No bank rail is usable until identity is verified — the gate every bank surface reads. */
const BLOCKED_BANK_CAPABILITIES = {
    rails: [],
    nextActions: [{ kind: 'verify_identity', railIds: [] }],
    restrictions: [],
}

/**
 * A fully verified user, enrolled on every corridor /get-paid offers.
 *
 * The gate is asked one rail id at a time (`railIdFor` in
 * features/deposit-accounts/rails.ts), so a corridor missing from this list
 * renders as needs-enrollment, not as the state the fixture is named for. The
 * demo API enrolls three rails, which is right for the walkthrough and wrong
 * for these screens — hence a per-fixture override rather than a wider default.
 */
const VA_READY_CAPABILITIES = {
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
        {
            id: 'bridge.faster_payments_gb',
            provider: 'bridge',
            method: 'FASTER_PAYMENTS_GB',
            channel: 'bank',
            country: 'GB',
            currency: 'GBP',
            status: 'enabled',
        },
        {
            id: 'bridge.spei_mx',
            provider: 'bridge',
            method: 'SPEI_MX',
            channel: 'bank',
            country: 'MX',
            currency: 'MXN',
            status: 'enabled',
        },
        {
            id: 'manteca.pix_br',
            provider: 'manteca',
            method: 'PIX_BR',
            channel: 'bank',
            country: 'BR',
            currency: 'BRL',
            status: 'enabled',
        },
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

/** Every verified-user get-paid fixture answers the gate the same way. */
const VA_READY_RESPONSE = { 'GET /users/me': { capabilities: VA_READY_CAPABILITIES } }

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
    // ?method=crypto is send's hand-off: the flow commits the crypto method and
    // lands straight on the shared amount step (TASK-21816 URL stepper).
    'withdraw-amount': {
        route: '/withdraw?method=crypto',
        about: 'Withdraw amount step (crypto): USD amount entry with balance and Continue.',
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
    // ?view=form names the screen; the amount is collected after it now.
    'withdraw-bank-form': {
        route: '/withdraw/spain?view=form',
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
        route: '/withdraw/manteca?method=bank-transfer&country=argentina',
        about: 'Withdraw amount as the last step, in local currency, with its own minimum.',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT, ...NAMED_BANK_ACCOUNTS] } },
    },
    // Over the balance, so the inline error under the input is on screen.
    'withdraw-amount-error': {
        route: '/withdraw?method=crypto&step=amount&amount=999999',
        about: 'Withdraw amount step with its inline error — the amount is above the balance.',
        // the error is validated on a 300ms debounce, so the shot waits for it
        waitFor: '[data-testid="error-alert"]',
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
    'avatar-picker': {
        route: AVATAR_PICKER_PATH,
        about: 'Avatar picker open: a hand of eight with the initial first and a Bug Whisperer avatar guaranteed, beetle selected.',
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
        about: 'Demo user with card access granted — the activation spend chooser can open.',
        responses: { 'GET /card': { hasCardAccess: true } },
    },

    'early-user': {
        route: '/home',
        about: 'Early-user reward drawer over home, opened by the user flag.',
        responses: { 'GET /users/me': { showEarlyUserModal: true } },
    },

    // ---------------------------------------------------------------------
    // Standing deposit accounts (/get-paid). One fixture per state a payer or
    // a holder can be looking at — the four policy fields on `matching` are
    // what each screen reads, so the states differ by policy, not by country.
    // ---------------------------------------------------------------------
    'get-paid': {
        route: '/get-paid',
        about: 'The hub: one euro account held, the rest open to claim.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_EUR] } },
    },
    'get-paid-empty': {
        route: '/get-paid',
        about: 'Nothing claimed yet — every corridor offered, none held.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [] } },
    },
    'get-paid-blocked': {
        route: '/get-paid',
        about: 'Identity not verified, so no corridor can be claimed and the gate says why.',
        responses: {
            'GET /users/deposit-accounts': { depositAccounts: [] },
            'GET /users/me': { capabilities: BLOCKED_BANK_CAPABILITIES },
        },
    },
    'get-paid-claim': {
        route: '/get-paid?screen=claim&corridor=ACH_US',
        about: 'What the user agrees to before an account is opened in their name.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [] } },
    },
    'get-paid-details-eur': {
        route: '/get-paid?screen=details&corridor=SEPA_EU',
        about: 'Euro details: businesses only until an individual volume is agreed, with a 1 EUR floor.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_EUR] } },
    },
    'get-paid-details-usd': {
        route: '/get-paid?screen=details&corridor=ACH_US',
        about: 'Dollar details: businesses and same-surname family unlimited, anyone else capped.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_USD] } },
    },
    'get-paid-details-usd-state-restricted': {
        route: '/get-paid?screen=details&corridor=ACH_US',
        about: 'The same dollar account for a resident of a state where no third party may pay in.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_USD_STATE_RESTRICTED] },
        },
    },
    'get-paid-details-gbp': {
        route: '/get-paid?screen=details&corridor=FASTER_PAYMENTS_GB',
        about: 'Sterling details, where only a business may pay in and nothing else is published.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_GBP] } },
    },
    'get-paid-details-mxn': {
        route: '/get-paid?screen=details&corridor=SPEI_MX',
        about: 'Peso details: no terms are published, so the screen says only what is confirmed.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_MXN] } },
    },
    'get-paid-details-provider-held': {
        route: '/get-paid?screen=details&corridor=SEPA_EU',
        about: 'The account is held by our banking partner, so the payer reads a name that is not the user.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_PROVIDER_HELD] },
        },
    },
    'get-paid-provisioning': {
        route: '/get-paid?screen=details&corridor=ACH_US',
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
    'get-paid-failed': {
        route: '/get-paid?screen=details&corridor=ACH_US',
        about: 'Opening the account did not complete; the user can try again.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': {
                depositAccounts: [{ ...DEPOSIT_ACCOUNT_USD, status: 'failed', instructions: undefined }],
            },
        },
    },
    'get-paid-revoked': {
        route: '/get-paid?screen=details&corridor=ACH_US',
        about: 'The account no longer accepts money and the details are already in a payroll file somewhere.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': { depositAccounts: [{ ...DEPOSIT_ACCOUNT_USD, status: 'revoked' }] },
        },
    },
    'get-paid-share': {
        route: '/get-paid?screen=share&corridor=SEPA_EU',
        about: 'What the payer will see, before the user sends it to them.',
        // The caveats sit under the details card, below the fold.
        fullPage: true,
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_EUR] } },
    },
    'get-paid-ar': {
        route: '/get-paid?screen=details&corridor=BANK_TRANSFER_AR',
        about: 'Argentina: the provider CVU only credits transfers the user sends themselves, so it is never shared.',
    },

    'home-add-drawer': {
        route: '/home?drawer=add',
        about: 'The Add drawer — where bank transfer now leads to the standing account.',
    },
    'request-with-bank-alternative': {
        route: '/request',
        about: 'Asking one person for one amount, with the standing-details alternative named below it.',
        // The alternative sits under the keypad, below the fold on a small phone.
        fullPage: true,
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
