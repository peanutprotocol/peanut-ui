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

import { OPEN_DIALOG, HOME_ADD_DRAWER_CHECKPOINT, type Fixture } from './types'
import ATTENTION_POLICY from '@/features/attention/catalogue.generated.json'
import { DOWNLOAD_PROMPT_FIXTURE } from './active'
import type { RainCardFunding, RainFundingAccess, RainFundingManagementStatus } from '@/services/rain'
import { DEMO_RESIDENCE_RESTRICTIONS } from '@/utils/demo-kyc'
import { suggestionCandidates } from '@/features/setup/username-suggestions'
import {
    CLAIMABLE_COP,
    CLAIMABLE_EUR,
    CLAIMABLE_USD_PREVIEW,
    DEPOSIT_RAIL_POLICY,
} from '@/features/deposit-accounts/__fixtures__/railPolicy'
import type { DepositAccount } from '@/features/deposit-accounts/types'
import { AVATAR_PICKER_PATH } from '@/components/Avatar/avatar.consts'
import { PAPERWORK_VERIFICATION_FIXTURES } from './paperwork-verification'
import { DEMO_ADDRESS, DEMO_PIX_BR_CODE, DEMO_USER } from '@/constants/demo-data'
import {
    EMPTY_PIX_WITHDRAW_DRAFT,
    pixWithdrawDraftKey,
    type PixDraftFlow,
    type PixWithdrawDraft,
} from '@/features/pix/pixWithdrawDraft'

const ROUTES = {
    bank: '/add-money/germany/bank',
    local: '/add-money/argentina/manteca',
    card: '/card?kyc=%7B%7D',
} as const
const PROVIDERS = { bank: 'bridge', local: 'manteca', card: 'rain' } as const
const STATES = [
    'ready',
    'on',
    'setting_up',
    'pending',
    'action_required',
    'refused',
    'failed',
    'questions_missing',
] as const

const BRIDGE_DUPLICATE_SUPPORT = {
    key: 'contact-support:bridge-duplicate',
    kind: 'contact-support',
    purpose: 'bridge-duplicate-review',
} as const
const BRIDGE_DUPLICATE_REASON = {
    code: 'duplicate_customer_detected',
    userMessage:
        'Your details are already linked to another Peanut account. If you can, log in and use that account, otherwise contact support.',
}
/** The `/users/me` of a verify-once user Bridge refused as a duplicate customer (the API's terminal branch). */
const BRIDGE_DUPLICATE_USER = {
    identityVerification: { status: 'verified', oneShot: true },
    capabilities: {
        rails: [
            ['ACH_US', 'US', 'USD'],
            ['SEPA_EU', 'EU', 'EUR'],
            ['FASTER_PAYMENTS_GB', 'GB', 'GBP'],
            ['SPEI_MX', 'MX', 'MXN'],
        ].map(([method, country, currency]) => ({
            id: `bridge.${method.toLowerCase()}`,
            provider: 'bridge',
            method,
            channel: 'bank',
            country,
            currency,
            status: 'blocked',
            reason: BRIDGE_DUPLICATE_REASON,
            blockingActions: [BRIDGE_DUPLICATE_SUPPORT.key],
            resolved: {
                status: 'blocked',
                blocking: { ...BRIDGE_DUPLICATE_REASON, selfHealable: false },
                nextAction: BRIDGE_DUPLICATE_SUPPORT,
            },
        })),
        nextActions: [BRIDGE_DUPLICATE_SUPPORT],
        restrictions: [],
    },
}

const KYC_FEATURE_ACTIVATION_FIXTURES: Record<string, Fixture> = Object.fromEntries(
    Object.entries(ROUTES).flatMap(([feature, route]) =>
        STATES.map((state) => {
            const key = `POST /users/kyc/features/${feature}/activate`
            const provider = PROVIDERS[feature as keyof typeof PROVIDERS]
            return [
                `feature-activation-${feature}-${state.replaceAll('_', '-')}`,
                {
                    route,
                    // ARS Add money starts the peso account on arrival (TASK-25059): only bank waits for the tap
                    capture:
                        feature === 'bank' && !['ready', 'on'].includes(state)
                            ? { actions: [{ clickSelector: '[data-testid="kyc-activation-continue"]' }] }
                            : undefined,
                    // ARS waits on its progress screen, so the shot is of the loader (TASK-25059)
                    ...(feature === 'local' && (state === 'pending' || state === 'setting_up')
                        ? { isLoadingState: true as const, waitFor: '[data-testid="feature-setting-up"]' }
                        : {}),
                    about: `First use ${feature}: ${state}; approved workflow identity, synthetic provider responses only.`,
                    completeResponses: [
                        key,
                        'GET /users/kyc/questions',
                        'GET /users/kyc/plan',
                        'GET /users/kyc/profile',
                        'POST /users/kyc/start-action',
                    ],
                    balance: '20',
                    responses: {
                        ...PAPERWORK_VERIFICATION_FIXTURES['paperwork-verification-verified'].responses,
                        'GET /users/me': {
                            identityVerification: { status: 'verified', oneShot: true },
                            ...(feature === 'card'
                                ? {}
                                : {
                                      // An account already on passes the gate with no tap; any other state asks first.
                                      capabilities: {
                                          features: {
                                              [feature]: {
                                                  ...(state === 'on'
                                                      ? { state: 'on' }
                                                      : { state: 'ready', action: 'activate' }),
                                                  accounts: {
                                                      [feature === 'bank' ? 'EUR' : 'ARS']:
                                                          state === 'on'
                                                              ? { state: 'on' }
                                                              : { state: 'ready', action: 'activate' },
                                                  },
                                              },
                                          },
                                      },
                                  }),
                        },
                        ...(feature === 'card'
                            ? {
                                  'GET /rain/cards': {
                                      status: { hasApplication: false, railStatus: null, applicationStatus: null },
                                      cards: [],
                                      balance: null,
                                  },
                              }
                            : {}),
                        [key]: {
                            state,
                            ...(state === 'action_required' ? { action: `supplement:${provider}` } : {}),
                            ...(state === 'refused' ? { reason: 'identity_document_insufficient' } : {}),
                        },
                        'GET /users/kyc/questions': {
                            available: true,
                            attemptId: null,
                            residence: feature === 'local' ? 'AR' : 'DE',
                            steps: [
                                {
                                    id: 'purpose',
                                    features: [feature],
                                    answered: false,
                                    fields: [
                                        {
                                            key: feature === 'card' ? 'cardPurpose' : 'bankPurpose',
                                            kind: 'choice',
                                            required: true,
                                            options: ['personal_or_living_expenses', 'travel'],
                                            value: null,
                                        },
                                    ],
                                },
                            ],
                            firstUnanswered: 'purpose',
                        },
                    },
                    // the missing answers open the feature's questions on /verify
                    ...(state === 'questions_missing' ? { landsOn: `/verify?feature=${feature}` } : {}),
                    ...(state === 'failed' ? { fails: [key] } : {}),
                    rejects: {
                        'POST /users/kyc/start-action': {
                            status: 503,
                            body: { error: 'Synthetic action unavailable' },
                        },
                        ...(state === 'questions_missing'
                            ? { [key]: { status: 409, body: { code: 'questions_missing', step: 'purpose' } } }
                            : {}),
                    },
                } satisfies Fixture,
            ]
        })
    )
)

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

// A PIX key saved to favorites after a payment, with the bank the PIX directory
// named (TASK-23738). Offered under Send → Bank, never as a withdrawal.
/** The pay:PIX_BR route as the API sends it: paused by the Brazil pause, or refused for a residence. */
const pixPayRoute = (state: 'paused' | 'refused') => ({
    operation: 'pay',
    method: 'PIX_BR',
    provider: state === 'paused' ? 'manteca' : null,
    state,
    reason:
        state === 'paused'
            ? { code: 'residence_paused', userMessage: 'Deposits and withdrawals are paused where you live for now.' }
            : { code: 'residence_not_served', userMessage: 'Pix payments are not available where you live yet.' },
    candidates: [],
})

/** the Brazil pause on for a Brazil resident (TASK-24197): the router pauses the pay route */
const BRAZIL_PAUSED_RESPONSES = {
    'GET /users/me': {
        residence: {
            verified: { country: 'BR', status: 'VERIFIED', updatedAt: null },
            declared: null,
            secondaryDeclaredCountry: null,
        },
        capabilities: { routes: [pixPayRoute('paused')] },
    },
}

/** The backend's Pix routes for a Brazilian resident on Avenia: ready, its account still to open, or opening. */
const aveniaRoutes = (stage: 'enabled' | 'first-use' | 'reviewing') =>
    (['deposit', 'withdraw'] as const).map((operation) => {
        const step =
            stage === 'enabled'
                ? { state: 'ready' }
                : stage === 'reviewing'
                  ? {
                        state: 'pending',
                        reason: { code: 'provider_reviewing', userMessage: 'Avenia is reviewing your verification.' },
                    }
                  : {
                        state: 'action_required',
                        action: 'activate',
                        reason: { code: 'first_use_required', userMessage: 'Set up this payment method to continue.' },
                    }
        return {
            operation,
            method: 'PIX_BR',
            provider: 'avenia',
            ...step,
            // the provider's minimum, as the route states it before any quote: R$20 to add money, R$5 to
            // withdraw or send (the owner's ruling of 15 Nov)
            limits: { minAmount: operation === 'deposit' ? '20' : '5', currency: 'BRL' },
            candidates: [{ provider: 'avenia', ...step }],
        }
    })

/** A Brazilian resident on Avenia Pix: verified in Brazil; the rail exists once the first use opened the account. */
const aveniaResponses = (stage: 'enabled' | 'first-use', overrides: Record<string, unknown> = {}) => ({
    'GET /users/me': {
        user: { fullName: 'Ana Souza' },
        residence: {
            verified: { country: 'BR', status: 'VERIFIED', updatedAt: null },
            declared: null,
            secondaryDeclaredCountry: null,
        },
        capabilities: {
            rails:
                stage === 'enabled'
                    ? [
                          {
                              id: 'avenia.pix_br',
                              provider: 'avenia',
                              method: 'PIX_BR',
                              channel: 'bank',
                              country: 'BR',
                              currency: 'BRL',
                              status: 'enabled',
                              operations: { deposit: 'enabled', withdraw: 'enabled' },
                          },
                      ]
                    : [],
            nextActions: [],
            restrictions: [],
            routes: aveniaRoutes(stage),
        },
    },
    // the amount step's estimate: Avenia's indicative quote for the reais on screen
    'GET /pix/quote': {
        provider: 'avenia',
        operation: 'deposit',
        amountBrl: '100.00',
        usdcAmount: '18.237000',
        rate: '5.442233',
        fixedFeeBrl: '0.75',
        // the variable fees in the rate, the flat fee as the row: (100.00 − 0.75) ÷ 5.442233 = 18.237
        exchangeRate: '5.442233',
        providerFeeBrl: '0.75',
        minAmountBrl: '20',
    },
    ...overrides,
})

/**
 * A resident outside Brazil, whose Pix routes name Manteca: R$1 minimum, Manteca pays any key and
 * cannot tell whose it is, charges no flat fee, and its Pix code has no expiry or payer CPF. The one
 * Pix flow serves it; only the answers differ.
 */
const mantecaPixRoutes = () =>
    (['deposit', 'withdraw', 'pay'] as const).map((operation) => ({
        operation,
        method: 'PIX_BR',
        provider: 'manteca',
        state: 'ready',
        ...(operation === 'pay' ? {} : { limits: { minAmount: '1', currency: 'BRL' } }),
        candidates: [{ provider: 'manteca', state: 'ready' }],
    }))
const mantecaPixResponses = (overrides: Record<string, unknown> = {}) => ({
    'GET /users/me': {
        user: { fullName: 'Ana Souza' },
        residence: {
            verified: { country: 'PT', status: 'VERIFIED', updatedAt: null },
            declared: null,
            secondaryDeclaredCountry: null,
        },
        capabilities: {
            rails: [
                {
                    id: 'manteca.pix_br',
                    provider: 'manteca',
                    method: 'PIX_BR',
                    channel: 'bank',
                    country: 'BR',
                    currency: 'BRL',
                    status: 'enabled',
                    operations: { deposit: 'enabled', withdraw: 'enabled', pay: 'enabled' },
                },
            ],
            nextActions: [],
            restrictions: [],
            routes: mantecaPixRoutes(),
        },
    },
    'GET /pix/quote': {
        provider: 'manteca',
        operation: 'withdraw',
        amountBrl: '100.00',
        usdcAmount: '18.390000',
        rate: '5.437738',
        fixedFeeBrl: '0',
        minAmountBrl: '1',
    },
    ...overrides,
})
const MANTECA_PIX_DEPOSIT_ID = 'fixture-pix-manteca-deposit'

const AVENIA_OWN_KEY = '11144477735'
const AVENIA_OTHER_KEY = '+5511987654321'
const AVENIA_WITHDRAW_ROUTE = '/withdraw/pix'
/** The Pix withdraw form, which lives in the account's session draft and never in the URL. */
const pixWithdrawForm = (fields: Partial<PixWithdrawDraft>, flow: PixDraftFlow = 'withdraw') => ({
    [pixWithdrawDraftKey(DEMO_USER.user.userId, flow)]: JSON.stringify({ ...EMPTY_PIX_WITHDRAW_DRAFT, ...fields }),
})
const AVENIA_OWN_KEY_INFO = {
    provider: 'avenia',
    holderName: 'Ana Souza',
    holderTaxIdMasked: '111.***.***-35',
    bankName: 'Banco Inter',
    ispb: '00416968',
    ownAccount: true,
    blocked: false,
}

/** A Brazilian resident whose Pix routes are in one step: no ready Avenia rail, the route says why. */
const AVENIA_BR_USER = {
    user: { fullName: 'Ana Souza' },
    residence: {
        verified: { country: 'BR', status: 'VERIFIED', updatedAt: null },
        declared: null,
        secondaryDeclaredCountry: null,
    },
}
/** The Pix route's step when Avenia's setup parked on a missing email (api capabilities/resolver.ts). */
const AVENIA_EMAIL_STEP = {
    state: 'action_required',
    action: 'provide-email',
    reason: {
        code: 'email_required',
        userMessage:
            "We need an email address to finish setting up this account. Add one to your profile and we'll retry automatically.",
    },
}
/** The same responses for an account with no email saved, so the email step opens empty. */
const aveniaEmailMissing = <T extends { 'GET /users/me': { user: object } }>(responses: T): T => ({
    ...responses,
    'GET /users/me': { ...responses['GET /users/me'], user: { ...responses['GET /users/me'].user, email: null } },
})
const aveniaRouteResponses = (
    step: { state: string; action?: string; reason: { code: string; userMessage: string }; provider?: null },
    rails: unknown[] = [],
    nextActions: unknown[] = []
) => ({
    'GET /users/me': {
        ...AVENIA_BR_USER,
        capabilities: {
            rails,
            nextActions,
            restrictions: [],
            routes: (['deposit', 'withdraw'] as const).map((operation) => ({
                operation,
                method: 'PIX_BR',
                provider: 'avenia',
                ...step,
                limits: { minAmount: operation === 'deposit' ? '20' : '5', currency: 'BRL' },
                candidates: [{ provider: 'avenia', state: step.state, action: step.action, reason: step.reason }],
            })),
        },
    },
})
/** Brazil's states as the API lists them for Avenia's address step: ISO 3166-2 codes alone, with their names. */
const BR_STATES: Record<string, string> = {
    AC: 'Acre',
    AL: 'Alagoas',
    AP: 'Amapá',
    AM: 'Amazonas',
    BA: 'Bahia',
    CE: 'Ceará',
    DF: 'Distrito Federal',
    ES: 'Espírito Santo',
    GO: 'Goiás',
    MA: 'Maranhão',
    MT: 'Mato Grosso',
    MS: 'Mato Grosso do Sul',
    MG: 'Minas Gerais',
    PA: 'Pará',
    PB: 'Paraíba',
    PR: 'Paraná',
    PE: 'Pernambuco',
    PI: 'Piauí',
    RJ: 'Rio de Janeiro',
    RN: 'Rio Grande do Norte',
    RS: 'Rio Grande do Sul',
    RO: 'Rondônia',
    RR: 'Roraima',
    SC: 'Santa Catarina',
    SP: 'São Paulo',
    SE: 'Sergipe',
    TO: 'Tocantins',
}
const ACTIVATE_PIX = 'POST /users/kyc/features/pix/activate'
/** The one step Avenia still needs from a verified resident of Brazil (TASK-24947): the address or the CPF. */
const AVENIA_MISSING_STEPS = {
    address: {
        id: 'address',
        features: ['local'],
        answered: false,
        fields: [
            { key: 'street', kind: 'text', required: true, value: null },
            { key: 'buildingNumber', kind: 'text', required: false, value: null },
            { key: 'town', kind: 'text', required: true, value: null },
            {
                key: 'state',
                kind: 'choice',
                required: true,
                options: Object.keys(BR_STATES),
                optionLabels: BR_STATES,
                value: null,
            },
            { key: 'postCode', kind: 'text', required: true, value: null },
            { key: 'country', kind: 'country', required: true, locked: true, value: 'BR' },
        ],
    },
    tax: {
        id: 'tax',
        features: ['local'],
        answered: false,
        fields: [{ key: 'taxId', kind: 'taxId', required: true, format: 'cpf', value: null }],
    },
    // After Avenia rejected the CPF and name (TASK-25108): a made-up CPF (111.444.777-35), shown masked.
    cpfRecordName: {
        id: 'cpfRecord',
        features: [],
        answered: false,
        fields: [
            { key: 'taxId', kind: 'taxId', required: true, format: 'cpf', value: '•••• 7735' },
            { key: 'fullName', kind: 'text', required: true, value: 'Ana Souza' },
        ],
    },
    cpfRecordStatus: {
        id: 'cpfRecord',
        features: [],
        answered: false,
        fields: [{ key: 'taxId', kind: 'taxId', required: true, format: 'cpf', value: null }],
    },
} as const
/**
 * Avenia's first use for a verified resident of Brazil whose verification lacks what Avenia needs:
 * the activation answers 409 with the step, and the Pix page asks it in place.
 */
const aveniaMissingResponses = (step: keyof typeof AVENIA_MISSING_STEPS) => ({
    responses: {
        ...aveniaResponses('first-use'),
        'GET /users/kyc/questions': {
            available: true,
            attemptId: null,
            residence: 'BR',
            steps: [AVENIA_MISSING_STEPS[step]],
            firstUnanswered: AVENIA_MISSING_STEPS[step].id,
            progress: { done: 0, total: 1 },
        },
    },
    rejects: {
        [ACTIVATE_PIX]: { status: 409, body: { code: 'questions_missing', step: AVENIA_MISSING_STEPS[step].id } },
    },
})

/** The Avenia rail while Avenia reviews the shared verification, with the route's reason. */
const aveniaPendingRail = (code: string) => ({
    id: 'avenia.pix_br',
    provider: 'avenia',
    method: 'PIX_BR',
    channel: 'bank',
    country: 'BR',
    currency: 'BRL',
    status: 'pending',
    reason: { code, userMessage: 'Avenia is reviewing the verification.' },
})
const aveniaPending = (code: string) =>
    aveniaRouteResponses({ state: 'pending', reason: { code, userMessage: 'Avenia is reviewing the verification.' } }, [
        aveniaPendingRail(code),
    ])

/** One Avenia Pix withdrawal's history entry as its owner reads it, for the last step after a reload. */
const AVENIA_WITHDRAWAL_ID = 'fixture-pix-withdrawal'
const aveniaWithdrawal = (status: string) => ({
    uuid: AVENIA_WITHDRAWAL_ID,
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-11-05T10:00:00.000Z'),
    amount: '92.50431',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status,
    userRole: 'SENDER',
    senderAccount: { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' },
    // the API names the Pix key paid, raw, with its holder for the owner (peanut-api-ts#2151)
    recipientAccount: { identifier: '+5511912345678', type: 'BANK_PIX', isUser: false, fullName: 'ANA SOUZA' },
    currency: { amount: '503.00', code: 'BRL' },
    extraData: { kind: 'OFFRAMP', provider: 'AVENIA', usdAmount: '92.50431', pixRecovery: null, paymentMethod: 'PIX' },
})
/**
 * An Avenia Pix payout to another person's key (TASK-24947): the owner's entry names whom it paid
 * (`extraData.pixPayout`, API-CONTRACT-M3 §8), so it reads as a send to them.
 */
const AVENIA_SEND_ID = 'fixture-pix-send'
const aveniaSend = (status: string) => ({
    ...aveniaWithdrawal(status),
    uuid: AVENIA_SEND_ID,
    timestamp: new Date('2026-11-06T10:00:00.000Z'),
    amount: '18.87',
    recipientAccount: { identifier: AVENIA_OTHER_KEY, type: 'BANK_PIX', isUser: false, fullName: 'BRUNO LIMA' },
    currency: { amount: '100.00', code: 'BRL' },
    extraData: {
        kind: 'OFFRAMP',
        provider: 'AVENIA',
        usdAmount: '18.87',
        pixRecovery: null,
        paymentMethod: 'PIX',
        pixPayout: { pixKey: AVENIA_OTHER_KEY, holderName: 'Bruno Lima', bankName: 'Nubank', ownAccount: false },
    },
})
/** Another person's key as Avenia's lookup names it; a foreign holder's payouts are always third-party. */
const AVENIA_OTHER_KEY_INFO = {
    provider: 'avenia',
    holderName: 'Bruno Lima',
    holderTaxIdMasked: '***.456.789-**',
    bankName: 'Nubank',
    ispb: '18236120',
    ownAccount: false,
    blocked: false,
}
/** The quote of a send of R$100 to that key: the review of a payout to another person. */
const AVENIA_SEND_PREVIEW = {
    amountBrl: '100.00',
    pixKey: AVENIA_OTHER_KEY,
    ownAccount: false,
    holderName: 'Bruno Lima',
    holderTaxIdMasked: '***.456.789-**',
    bankName: 'Nubank',
    withdrawUsd: '18.870000',
    rate: '5.339163',
    fixedFeeBrl: '0.75',
    // the variable fees in the rate, the flat fee as the row: 18.87 × 5.339163 − 0.75 = 100.00
    exchangeRate: '5.339163',
    providerFeeBrl: '0.75',
    arrivalEstimateSeconds: 60,
    provider: 'Avenia',
}
/** The Pix-key form as a send (`PIX_SEND_PATH`). */
const AVENIA_SEND_ROUTE = `${AVENIA_WITHDRAW_ROUTE}?sendMethod=bank`

/**
 * A resident of Germany inside Avenia's rollout gate (API-CONTRACT-M3 §1): Pix sends and withdrawals
 * on Avenia, no BRL deposit (ruled), merchant QR on Manteca as before. The withdraw route reads the
 * resident's steps: the account opens at the first send.
 */
const aveniaNonResidentRoutes = (stage: 'enabled' | 'first-use') => {
    const withdraw = aveniaRoutes(stage).find((route) => route.operation === 'withdraw')!
    const notServed = { code: 'residence_not_served', userMessage: 'Pix deposits are not offered where you live.' }
    return [
        {
            operation: 'deposit',
            method: 'PIX_BR',
            provider: null,
            state: 'refused',
            reason: notServed,
            candidates: [
                { provider: 'avenia', state: 'refused', reason: notServed },
                {
                    provider: 'manteca',
                    state: 'refused',
                    reason: { code: 'provider_moved', userMessage: 'Pix moved to another partner.' },
                },
            ],
        },
        withdraw,
        {
            operation: 'pay',
            method: 'PIX_BR',
            provider: 'manteca',
            state: 'ready',
            candidates: [{ provider: 'manteca', state: 'ready' }],
        },
    ]
}
const aveniaNonResidentResponses = (stage: 'enabled' | 'first-use', overrides: Record<string, unknown> = {}) => ({
    'GET /users/me': {
        user: { fullName: 'Lena Fischer' },
        residence: {
            verified: { country: 'DE', status: 'VERIFIED', updatedAt: null },
            declared: null,
            secondaryDeclaredCountry: null,
        },
        capabilities: {
            rails:
                stage === 'enabled'
                    ? [
                          {
                              id: 'avenia.pix_br',
                              provider: 'avenia',
                              method: 'PIX_BR',
                              channel: 'bank',
                              country: 'BR',
                              currency: 'BRL',
                              status: 'enabled',
                              operations: { withdraw: 'enabled' },
                          },
                      ]
                    : [],
            nextActions: [],
            restrictions: [],
            routes: aveniaNonResidentRoutes(stage),
        },
    },
    'GET /pix/quote': {
        provider: 'avenia',
        operation: 'withdraw',
        amountBrl: '100.00',
        usdcAmount: '18.870000',
        rate: '5.339163',
        fixedFeeBrl: '0.75',
        // the variable fees in the rate, the flat fee as the row: 18.87 × 5.339163 − 0.75 = 100.00
        exchangeRate: '5.339163',
        providerFeeBrl: '0.75',
        minAmountBrl: '5',
    },
    ...overrides,
})
const aveniaOutcomeRoute = (intentId: string) => `${AVENIA_WITHDRAW_ROUTE}?step=success&intentId=${intentId}`

/** One Pix deposit as GET /pix/deposit/:intentId reads it; its code lapsed unless overridden. */
const AVENIA_DEPOSIT_ID = 'fixture-pix-deposit'
const AVENIA_DEPOSIT_CODE_ROUTE = `/add-money/pix?step=showQR&intentId=${AVENIA_DEPOSIT_ID}`
const aveniaDepositRead = (overrides: Record<string, unknown> = {}) => ({
    provider: 'avenia',
    intentId: AVENIA_DEPOSIT_ID,
    status: 'AWAITING_USER_ACTION',
    pixReceived: false,
    expiresAt: null,
    amountBrl: '100.00',
    usdcAmount: '18.237000',
    fixedFeeBrl: '0.75',
    // the variable fees in the rate, the flat fee as the row: (100.00 − 0.75) ÷ 5.442233 = 18.237
    exchangeRate: '5.442233',
    providerFeeBrl: '0.75',
    codePayable: false,
    ...overrides,
})
/** The deposit's history entry while its code can still be paid (owner-only pixDeposit). */
const aveniaPayableDeposit = {
    uuid: AVENIA_DEPOSIT_ID,
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-11-06T10:00:00.000Z'),
    amount: '18.237',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'PENDING',
    userRole: 'RECIPIENT',
    // a deposit names no sender, never the inflow address (peanut-api-ts#2151)
    senderAccount: { identifier: '', type: 'address', isUser: false },
    recipientAccount: { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' },
    currency: { amount: '100.00', code: 'BRL' },
    extraData: {
        kind: 'ONRAMP',
        provider: 'AVENIA',
        usdAmount: '18.237',
        paymentMethod: 'PIX',
        pixDeposit: { codePayable: true, expiresAt: null },
    },
}

/** The same deposit once paid and credited: the code is spent. */
const AVENIA_PAID_DEPOSIT = {
    ...aveniaPayableDeposit,
    uuid: 'fixture-avenia-deposit-paid',
    status: 'COMPLETED',
    extraData: {
        ...aveniaPayableDeposit.extraData,
        pixDeposit: { codePayable: false, expiresAt: null },
        // settled: the variable fees in the rate, the flat fee as the row, (100.00 − 0.75) ÷ 5.442233 = 18.237
        receipt: { exchange_rate: '5.442233' },
        providerFeeBrl: '0.75',
    },
}

/**
 * A R$22 Pix deposit Avenia received and gave back: paid from an account not under the user's CPF.
 * The wire status stays FAILED; `pixReturned` says it was returned, to every viewer, and
 * `returnReason` (owner only) says why. Nothing was converted: the
 * amount is the quoted USD and no rate or fee is sent.
 */
const AVENIA_RETURNED_DEPOSIT = {
    ...aveniaPayableDeposit,
    uuid: 'fixture-avenia-deposit-returned',
    timestamp: new Date('2026-11-16T12:00:00.000Z'),
    status: 'FAILED',
    amount: '3.84',
    currency: { amount: '22.00', code: 'BRL' },
    extraData: {
        ...aveniaPayableDeposit.extraData,
        usdAmount: '3.84',
        pixDeposit: { codePayable: false, expiresAt: null },
        // returned, to every viewer; why, to the owner only
        pixReturned: true,
        returnReason: { code: 'third_party', text: null },
    },
}

/** Merchant Pix codes (valid EMV and CRC): one that leaves the amount to the payer, one with R$42.50, one with R$3. */
const PIX_QR_OPEN_AMOUNT =
    '00020101021226680014br.gov.bcb.pix2546pix.example.com/qr/v2/cobv/padaria-pao-dourado5204000053039865802BR5924PADARIA PAO DOURADO LTDA6009SAO PAULO62070503***630409BC'
const PIX_QR_FIXED_AMOUNT =
    '00020101021226680014br.gov.bcb.pix2546pix.example.com/qr/v2/cobv/padaria-pao-dourado520400005303986540542.505802BR5924PADARIA PAO DOURADO LTDA6009SAO PAULO62070503***63043A47'
const PIX_QR_SMALL_AMOUNT =
    '00020101021226680014br.gov.bcb.pix2546pix.example.com/qr/v2/cobv/padaria-pao-dourado52040000530398654043.005802BR5924PADARIA PAO DOURADO LTDA6009SAO PAULO62070503***63044A84'
const AVENIA_QR_PAYMENT_ID = 'fixture-qr-avenia'
/** /qr-pay for a scanned Pix code, as the scanner opens it; `intentId` once a payment is open. */
const qrPayRoute = (code: string, intentId?: string) =>
    `/qr-pay?qrCode=${encodeURIComponent(code)}&type=PIX&t=1${intentId ? `&intentId=${intentId}` : ''}`

/**
 * A resident of Brazil inside the merchant QR gate (API-CONTRACT-M4 §1): the pay route names Avenia,
 * with the R$5 floor the app checks before it calls (Aleks, 2026-11-14). Manteca's candidate moved.
 */
const aveniaPayRoute = (step: Record<string, unknown>) => ({
    operation: 'pay',
    method: 'PIX_BR',
    provider: 'avenia',
    ...step,
    limits: { minAmount: '5', currency: 'BRL' },
    candidates: [
        { provider: 'avenia', ...step },
        {
            provider: 'manteca',
            state: 'refused',
            reason: { code: 'provider_moved', userMessage: 'Pix moved to another partner.' },
        },
    ],
})
const aveniaQrResponses = (
    step: Record<string, unknown> = { state: 'ready' },
    overrides: Record<string, unknown> = {}
) => {
    const base = aveniaResponses('enabled')
    const me = base['GET /users/me']
    return {
        ...base,
        'GET /users/me': {
            ...me,
            capabilities: { ...me.capabilities, routes: [...aveniaRoutes('enabled'), aveniaPayRoute(step)] },
        },
        ...overrides,
    }
}
/** GET /pix/pay/:intentId of the open payment, in one of its states, with the QR reward it earned (M5). */
const aveniaQrRead = (state: string, status: string, perk: Record<string, unknown> | null = null) => ({
    [`GET /pix/pay/${AVENIA_QR_PAYMENT_ID}`]: {
        provider: 'avenia',
        intentId: AVENIA_QR_PAYMENT_ID,
        state,
        status,
        amountBrl: '42.50',
        merchantName: 'PADARIA PAO DOURADO LTDA',
        selfPay: false,
        perk,
    },
})
/** The QR reward of a paid Avenia payment, Manteca's shape (API-CONTRACT-M5 §3). */
const AVENIA_QR_PERK = {
    eligible: true,
    discountPercentage: 0,
    claimed: false,
    sponsoredUsd: 1,
    reason: 'Pix cashback',
    usageId: 'fixture-perk-usage',
    payoutStatus: 'pending',
}
/** Avenia's monthly room on the user's sub-account (GET /users/limits, API-CONTRACT-M5 §5). */
const AVENIA_LIMITS = {
    currency: 'BRL',
    deposit: { brlLeft: '98500.00', usdLeft: '18100.00', blocked: false },
    payout: { brlLeft: '104200.00', usdLeft: '19150.00', blocked: false },
}
/** The payment's history entry (API-CONTRACT-M4 §5): a QR payment to the merchant, provider Avenia. */
const aveniaQrEntry = (status: string) => ({
    uuid: AVENIA_QR_PAYMENT_ID,
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-11-15T12:00:00.000Z'),
    amount: '8.062211',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status,
    userRole: 'SENDER',
    senderAccount: { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' },
    recipientAccount: { identifier: 'PADARIA PAO DOURADO LTDA', type: 'BANK_CBU', isUser: false },
    currency: { amount: '42.50', code: 'BRL' },
    extraData: { kind: 'QR_PAY', provider: 'AVENIA', usdAmount: '8.062211', pixRecovery: null, paymentMethod: 'PIX' },
})

const PIX_FAVORITE = {
    id: 'fixture-pix-favorite-1',
    userId: 'demo-user',
    bridgeAccountId: '',
    type: 'manteca',
    identifier: 'maria@silva.com.br',
    label: 'Maria',
    lastUsedAt: '2026-08-20T09:00:00.000Z',
    details: { bankName: 'NU PAGAMENTOS S.A.', accountOwnerName: '', countryCode: 'BRA', countryName: 'brazil' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    chainId: null,
    isPixRecipient: true,
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
            // A friend who shows their name: the API sends it in fullName.
            fullName: 'Test Friend',
            kycVerified: true,
            contributedPoints: 50,
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

// A friend who never finished signup: no username and no name (TASK-24036).
const INVITES_WITH_UNNAMED = {
    invitees: [
        ...INVITES_ONE.invitees,
        {
            inviteeId: 'fixture-invitee-unnamed',
            username: null,
            fullName: null,
            kycVerified: false,
            contributedPoints: 0,
            showFullName: false,
            lifetimeEarnedUsd: 0,
        },
    ],
    summary: { ...INVITES_ONE.summary, pendingInvites: 1, totalInvites: 2 },
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

// The capture clock is frozen at 2026-09-01 12:00 UTC. This order's
// deadline is still ahead of that clock; the expired variant reports the
// terminal status from the status endpoint instead of inferring it from time.
const ARS_DEPOSIT = {
    id: 'fixture-ars-deposit',
    stages: {
        '1': { thresholdAmount: '10000', asset: 'ARS', expireAt: '2026-09-01T12:30:00.000Z' },
        '3': { amount: '10' },
    },
    details: {
        depositAddress: '0000000000000000000000',
        depositAlias: 'fixture.deposit.test',
        price: '1000',
        priceExpireAt: '2026-09-01T12:30:00.000Z',
        withdrawCostInAsset: '0',
    },
}

const EXPIRED_ARS_DEPOSIT_ENTRY = {
    uuid: 'fixture-expired-ars-deposit',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-09-01T11:00:00.000Z'),
    amount: '10',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'CANCELLED',
    userRole: 'RECIPIENT',
    senderAccount: { identifier: 'bank', type: 'BANK_CBU', isUser: true },
    recipientAccount: { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' },
    currency: { amount: '10000', code: 'ARS' },
    extraData: { kind: 'ONRAMP', provider: 'MANTECA', usdAmount: '10', mantecaDepositExpired: true },
}

const PENDING_EUR_DEPOSIT_ENTRY = {
    ...EXPIRED_ARS_DEPOSIT_ENTRY,
    uuid: 'fixture-pending-eur-deposit',
    status: 'PENDING',
    amount: '24.32',
    senderAccount: { identifier: 'bank', type: 'BANK_IBAN', isUser: true },
    currency: { amount: '21.33', code: 'EUR' },
    extraData: { kind: 'ONRAMP', provider: 'BRIDGE', usdAmount: '24.32' },
}

// A PIX-key payment the payer looked up first (TASK-23198): the API sends the
// owner as fullName beside the key, to the payer only.
const PIX_KEY_PAYMENT_ENTRY = {
    uuid: 'fixture-pix-key-payment',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-09-29T10:00:00.000Z'),
    amount: '10',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'COMPLETED',
    userRole: 'SENDER',
    senderAccount: { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' },
    recipientAccount: { identifier: 'maria@silva.com.br', fullName: 'MARIA DA SILVA', type: 'BANK_CBU', isUser: false },
    currency: { amount: '51.30', code: 'BRL' },
    extraData: { kind: 'QR_PAY', provider: 'MANTECA', usdAmount: '10', paymentMethod: 'PIX' },
}

// An in-person card tap at a coffee shop, settled in USD (same currency, so
// no Visa conversion). Shape follows peanut-api-ts transaction-intent/history.ts
// for CARD_SPEND_CLEAR: the user sends, the merchant receives.
const CARD_SPEND_ENTRY = {
    uuid: 'fixture-card-spend',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-10-20T09:12:00.000Z'),
    amount: '4.5',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'COMPLETED',
    userRole: 'SENDER',
    senderAccount: { identifier: 'demo', type: 'peanut-wallet', isUser: true, username: 'demo' },
    recipientAccount: { identifier: 'Corner Coffee', type: 'merchant', isUser: false },
    currency: { amount: '4.50', code: 'USD' },
    extraData: {
        kind: 'CARD_SPEND_CLEAR',
        provider: 'RAIN',
        usdAmount: '4.5',
        merchantName: 'Corner Coffee',
        merchantCategory: 'Coffee shop',
        merchantMcc: '5814',
        cardAuthAmount: '4.50',
        cardSettledAmount: '4.50',
        settlementAdjusted: false,
    },
}

// Two earlier taps, so the Activity list behind the receipt holds only card rows.
const EARLIER_CARD_SPENDS = [
    { merchant: 'Daily Bread', amount: '7.20', timestamp: '2026-10-19T08:40:00.000Z' },
    { merchant: 'City Books', amount: '18.00', timestamp: '2026-10-18T16:05:00.000Z' },
].map(({ merchant, amount, timestamp }, i) => ({
    ...CARD_SPEND_ENTRY,
    uuid: `fixture-card-spend-earlier-${i + 1}`,
    timestamp: new Date(timestamp),
    amount,
    recipientAccount: { identifier: merchant, type: 'merchant', isUser: false },
    currency: { amount, code: 'USD' },
    extraData: {
        ...CARD_SPEND_ENTRY.extraData,
        usdAmount: amount,
        merchantName: merchant,
        merchantCategory: null,
        merchantMcc: null,
        cardAuthAmount: amount,
        cardSettledAmount: amount,
    },
}))

// A $400 request link paid from an exchange: the payer has no Peanut
// account, so Activity names the sending address (star LP /request-links).
const REQUEST_PAID_EXTERNAL_ENTRY = {
    uuid: 'fixture-request-paid-external',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-10-20T17:34:00.000Z'),
    amount: '400',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'COMPLETED',
    userRole: 'RECIPIENT',
    senderAccount: { identifier: '0x7a3f9c41d2e8b05a6f13c47e92d0ab58e1f491c2', type: 'evm-address', isUser: false },
    recipientAccount: { identifier: 'demo', type: 'peanut-wallet', isUser: true, username: 'demo' },
    extraData: { kind: 'P2P_REQUEST_FULFILL', usdAmount: '400' },
}

// A USD wire withdrawal (TASK-23054): $100 sent, a $20 wire fee withheld.
const WIRE_WITHDRAWAL_ENTRY = {
    uuid: 'fixture-wire-withdrawal',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-08-14T10:00:00.000Z'),
    amount: '100',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'COMPLETED',
    userRole: 'SENDER',
    senderAccount: { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' },
    recipientAccount: { identifier: '938636999398030', type: 'US', isUser: false },
    currency: { amount: '80.00', code: 'USD' },
    extraData: { kind: 'OFFRAMP', provider: 'BRIDGE', usdAmount: '100', payoutFeeUsd: 20, payoutRail: 'wire' },
}

const RECEIPT_ATTACHMENT_ENTRY = {
    uuid: 'fixture-receipt-attachment',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-08-14T10:00:00.000Z'),
    amount: '25.00',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'COMPLETED',
    userRole: 'SENDER',
    senderAccount: { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' },
    recipientAccount: {
        identifier: 'ana',
        type: 'PEANUT_WALLET',
        isUser: true,
        username: 'ana',
        fullName: 'Ana Ruiz',
    },
    memo: 'Dinner',
    extraData: { kind: 'P2P_REQUEST_FULFILL', usdAmount: '25.00' },
    // synthetic url; the focused browser spec supplies the file without contacting s3.
    attachmentUrl: 'https://peanut-notes.s3.eu-north-1.amazonaws.com/fixture-receipt.pdf',
}

// A request paid by bank deposit (TASK-23729): no charge, the deposit matcher
// closed it. €5 asked = $5.64, 5.57 USDC arrived, and it settled in euros, so
// the API sends `completedAt` (the request's `paidAt`) and no `cancelledAt`.
const BANK_PAID_REQUEST_ENTRY = {
    uuid: 'fixture-bank-paid-request',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-08-12T10:00:00.000Z'),
    createdAt: new Date('2026-08-11T09:00:00.000Z'),
    completedAt: new Date('2026-08-12T10:00:00.000Z'),
    amount: '5.64',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'CLOSED',
    userRole: 'RECIPIENT',
    recipientAccount: { identifier: 'demo', type: 'peanut-wallet', isUser: true, username: 'demo' },
    memo: 'Concert ticket',
    extraData: {
        provider: 'PEANUT',
        kind: 'P2P_REQUEST_FULFILL',
        isRequestPotRollup: true,
        source: 'EXTERNAL',
        fulfilledChargeCount: 0,
        totalChargeCount: 0,
        receivedAmount: '5.57',
    },
    isRequestLink: true,
    totalAmountCollected: 5.57,
    charges: [],
}

// A pending request link that accepts bank transfer (TASK-23727): the
// requester's receipt shows the reference and the bank details behind a tap.
const PENDING_BANK_REQUEST_ENTRY = {
    ...BANK_PAID_REQUEST_ENTRY,
    uuid: 'fixture-bank-request',
    timestamp: new Date('2026-10-15T10:00:00.000Z'),
    createdAt: new Date('2026-10-15T10:00:00.000Z'),
    completedAt: null,
    amount: '250',
    status: 'PENDING',
    memo: 'Flat deposit',
    extraData: {
        provider: 'PEANUT',
        kind: 'P2P_REQUEST_FULFILL',
        isRequestPotRollup: true,
        fulfilledChargeCount: 0,
        totalChargeCount: 0,
        bankInstructionsShared: true,
        link: 'https://peanut.me/request/fixture-bank-request',
    },
    totalAmountCollected: 0,
}

// A request pot asked in euros, part paid by two contributors (TASK-23856):
// €88 = $99.16. Hugo paid $40.65 from his balance. A second payer's $58.51
// charge received 33 USDC from an external wallet, so it completed short and
// carries the API's partialPayment flag.
const POT_PAYMENT = (
    chargeUuid: string,
    paidAmountInRequestedToken: string,
    payer: string,
    username: string | null
) => ({
    uuid: `${chargeUuid}-payment`,
    chargeUuid,
    payerTransactionHash: `0x${chargeUuid}`,
    payerChainId: '42161',
    paidTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    paidAmountInRequestedToken,
    payerAddress: payer,
    fulfillmentTransactionHash: null,
    status: 'SUCCESSFUL',
    reason: null,
    createdAt: '2026-10-19T19:36:10.000Z',
    verifiedAt: '2026-10-19T19:36:10.000Z',
    payerAccount: {
        userId: username ? `fixture-${username}` : null,
        identifier: username ?? payer,
        type: username ? 'peanut-wallet' : 'evm-address',
        user: username ? { username, bridgeKycStatus: 'approved', avatarKey: null } : null,
    },
})

const POT_CHARGE = (
    uuid: string,
    tokenAmount: string,
    settledAmount: string,
    payment: ReturnType<typeof POT_PAYMENT>
) => ({
    uuid,
    createdAt: '2026-10-19T19:34:13.000Z',
    tokenAmount,
    tokenDecimals: 6,
    settledAmount,
    status: 'COMPLETED',
    partialPayment: Number(settledAmount) < Number(tokenAmount),
    payments: [payment],
    fulfillmentPayment: payment,
})

const HUGO_CHARGE = POT_CHARGE(
    'fixture-pot-charge-hugo',
    '40.65',
    '40.65',
    POT_PAYMENT('fixture-pot-charge-hugo', '40650000', '0x00000000000000000000000000000000000a11ce', 'hugo')
)
const SHORT_CHARGE = POT_CHARGE(
    'fixture-pot-charge-short',
    '58.51',
    '33',
    POT_PAYMENT('fixture-pot-charge-short', '33000000', '0x00000000000000000000000000000000000b0b0b', null)
)

const PARTIAL_POT_ENTRY = {
    uuid: 'fixture-request-pot-partial',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-10-19T19:36:10.000Z'),
    createdAt: new Date('2026-10-19T19:32:52.000Z'),
    completedAt: null,
    amount: '99.16',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'OPEN',
    userRole: 'RECIPIENT',
    recipientAccount: { identifier: 'demo', type: 'peanut-wallet', isUser: true, username: 'demo' },
    memo: 'Dinner',
    extraData: {
        provider: 'PEANUT',
        kind: 'P2P_REQUEST_FULFILL',
        isRequestPotRollup: true,
        fulfilledChargeCount: 2,
        totalChargeCount: 2,
        requestedAmount: '88',
        requestCurrency: 'EUR',
        link: 'https://peanut.me/request/fixture-request-pot-partial',
    },
    isRequestLink: true,
    totalAmountCollected: 73.65,
    charges: [HUGO_CHARGE, SHORT_CHARGE],
}

// The same pot after the requester closed it: CLOSED with no `completedAt`,
// so $25.51 was never paid.
const CLOSED_SHORT_POT_ENTRY = {
    ...PARTIAL_POT_ENTRY,
    uuid: 'fixture-request-pot-closed-short',
    timestamp: new Date('2026-10-19T19:37:20.000Z'),
    cancelledAt: new Date('2026-10-19T19:37:20.000Z'),
    status: 'CLOSED',
    extraData: { ...PARTIAL_POT_ENTRY.extraData, link: 'https://peanut.me/request/fixture-request-pot-closed-short' },
}

// The payer side of the same pot, as GET /requests/:uuid answers a payer.
// Read through `demo-request`, the uuid demo-api answers every request read
// with; the requester is someone else, so the demo user can pay it.
const PAYER_POT_REQUEST = {
    uuid: 'demo-request',
    status: 'OPEN',
    tokenAmount: '99.16',
    currency: 'EUR',
    requestedAmount: '88',
    reference: 'Dinner',
    recipientAccount: {
        userId: 'fixture-ana',
        identifier: '0x00000000000000000000000000000000000a11ce',
        type: 'peanut-wallet',
        user: { username: 'ana' },
    },
    charges: [HUGO_CHARGE],
    totalCollectedAmount: 40.65,
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

// Receipts the API serves to anyone with the link (TASK-24141): Share receipt
// sends the link, and the PDF actions sit under More actions. A QR payment
// also moves Split this bill there.
const PUBLIC_RECEIPT_SEND_ENTRY = {
    ...PEER_HISTORY_ENTRY('fixture-public-receipt-send', '25', 'Dinner', PEER('ana', 'Ana Ruiz', 'basic.frog'), false),
    // a hash, so the fixture shows the drawer leaving out the Transaction ID row
    txHash: '0x' + '5f1c'.repeat(16),
    extraData: { kind: 'DIRECT_TRANSFER', usdAmount: '25', publicReceipt: true },
}

const PUBLIC_RECEIPT_QR_PAY_ENTRY = {
    uuid: 'fixture-public-receipt-qr-pay',
    type: 'TRANSACTION_INTENT',
    timestamp: new Date('2026-10-28T20:30:00.000Z'),
    amount: '12.4',
    chainId: '42161',
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    status: 'COMPLETED',
    userRole: 'SENDER',
    senderAccount: { identifier: 'demo', type: 'PEANUT_WALLET', isUser: true, username: 'demo' },
    recipientAccount: { identifier: 'La Parrilla de Juan', type: 'BANK_CBU', isUser: false },
    currency: { amount: '15000', code: 'ARS' },
    extraData: {
        kind: 'QR_PAY',
        provider: 'MANTECA',
        usdAmount: '12.4',
        publicReceipt: true,
        receipt: { exchange_rate: '1209.68' },
    },
}

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

/** The pay:PIX_BR route for a user who lives outside Brazil: Manteca pays the code. */
const PIX_PAY_READY_ROUTE = {
    operation: 'pay',
    method: 'PIX_BR',
    provider: 'manteca',
    state: 'ready',
    candidates: [{ provider: 'manteca', state: 'ready' }],
}

/**
 * QR pay closed for this user: the one case the Home checklist has no payment
 * row (QR pay is open to every verified user unless the capabilities block it).
 */
const QR_PAY_BLOCKED_RAIL = {
    id: 'manteca.pix_br',
    provider: 'manteca',
    method: 'PIX_BR',
    channel: 'bank',
    country: 'BR',
    currency: 'BRL',
    status: 'blocked',
    operations: { pay: 'blocked', deposit: 'blocked', withdraw: 'blocked' },
    reason: { code: 'provider_rejected', userMessage: 'QR payments are not available for this account.' },
}

/**
 * QR rails the API paused because the identity behind the approval is not
 * usable (`SUMSUB_IDENTITY_MISSING`), by cause: the fix is the identity restart.
 */
const qrIdentityPausedCapabilities = (code: string, userMessage: string) => ({
    rails: [
        {
            ...QR_PAY_BLOCKED_RAIL,
            blockingActions: ['restart-identity'],
            reason: { code, userMessage },
            resolved: {
                status: 'fixable',
                blocking: { code, userMessage, selfHealable: true, selfHealKind: 'restart-identity' },
                nextAction: { key: 'restart-identity', kind: 'restart-identity', purpose: code },
            },
        },
    ],
    nextActions: [{ key: 'restart-identity', kind: 'restart-identity', purpose: code }],
    restrictions: [],
    // the router reads the paused rail: the pay route asks for the identity restart
    routes: [
        {
            ...PIX_PAY_READY_ROUTE,
            state: 'action_required',
            action: 'restart-identity',
            reason: { code, userMessage },
            candidates: [
                {
                    provider: 'manteca',
                    state: 'action_required',
                    action: 'restart-identity',
                    reason: { code, userMessage },
                },
            ],
        },
    ],
})
const QR_IDENTITY_MISSING_CAPABILITIES = qrIdentityPausedCapabilities(
    'identity_missing',
    'We could not read the name and ID number on your ID. Upload it again to pay by QR.'
)

/** A static Pix QR with no amount: the scan screen's own route. */
const PIX_ELIGIBLE_RESIDENCE = {
    verified: { country: 'PT', status: 'VERIFIED', updatedAt: null },
    declared: null,
    secondaryDeclaredCountry: null,
}

/**
 * A user the pay:PIX_BR route serves. The demo user lives in Brazil, where the route refuses Pix
 * payments, so a Pix payment fixture sends both the residence and the route.
 */
const PIX_ELIGIBLE_USER = { residence: PIX_ELIGIBLE_RESIDENCE, capabilities: { routes: [PIX_PAY_READY_ROUTE] } }

const PIX_QR_ROUTE =
    '/qr-pay?qrCode=00020126400014br.gov.bcb.pix0118maria%40silva.com.br5204000053039865802BR5918MARIA%40SILVA.COM.BR6009SAO%20PAULO62070503***63046DEC&type=PIX&t=1'

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

/** A verified resident of Argentina whose peso top-up is ready: the ARS row on both Add lists. */
const ARS_TOP_UP_RESIDENT = {
    residence: {
        verified: { country: 'AR', status: 'VERIFIED', updatedAt: null },
        declared: null,
        secondaryDeclaredCountry: null,
    },
    capabilities: MANTECA_AR_CAPABILITIES,
}

/**
 * "Your ID is verified" (/verified, add-money proposal): the report right after approval, by account. `wait` is a
 * provider review, `tos` Bridge's terms; the bank feature's USD and EUR accounts share one entry.
 */
const VERIFIED_WAIT = { key: 'provider-wait', kind: 'wait' }
const VERIFIED_TOS = { key: 'bridge-tos', kind: 'accept-tos' }
type VerifiedEntry = { state: string; action?: string }
const verifiedUser = (
    country: 'AR' | 'BR',
    local: Record<string, VerifiedEntry>,
    bank: VerifiedEntry,
    extra: Record<string, unknown> = {}
) => ({
    user: { username: 'lena' },
    identityVerification: { status: 'verified' },
    residence: {
        verified: { country, status: 'VERIFIED', updatedAt: null },
        declared: null,
        secondaryDeclaredCountry: null,
    },
    capabilities: {
        ...MANTECA_AR_CAPABILITIES,
        nextActions: [VERIFIED_WAIT, VERIFIED_TOS],
        ...extra,
        features: {
            qr: { state: 'on' },
            card: { state: 'ready' },
            local: { ...Object.values(local)[0], accounts: local },
            bank: { ...bank, accounts: { USD: bank, EUR: bank } },
        },
    },
})

/** The ARS bank rail waits on the person's Manteca step (questionnaire and phone check), as the API reports it. */
const mantecaArStepCapabilities = (code: 'manteca_action_incomplete' | 'manteca_action_expired') => {
    const userMessage =
        code === 'manteca_action_incomplete'
            ? 'Your bank setup is not finished. Complete the short verification to unlock local deposits and withdrawals.'
            : 'Your bank account setup timed out. Finish the short verification to unlock local deposits and withdrawals.'
    const nextAction = { key: 'manteca-kyc-action:AR', kind: 'sumsub', purpose: 'unlock-manteca-bank' }
    return {
        rails: [
            {
                ...MANTECA_AR_CAPABILITIES.rails[0],
                status: 'requires-info',
                blockingActions: [nextAction.key],
                reason: { code, userMessage },
                resolved: {
                    status: 'fixable',
                    blocking: { code, userMessage, selfHealable: true },
                    nextAction,
                },
            },
        ],
        nextActions: [nextAction],
        restrictions: [],
        features: {
            local: {
                state: 'action_required',
                action: nextAction.key,
                accounts: { ARS: { state: 'action_required', action: nextAction.key } },
            },
        },
    }
}

/**
 * TASK-25345: Manteca parked the ARS bank rail for a missing email (`REQUIRES_SUPPORT` / `NO_EMAIL`),
 * as the API reports it for a user with no email on file (capabilities/resolver.ts, feature-report.ts).
 */
const MANTECA_AR_EMAIL_REQUIRED_CAPABILITIES = (() => {
    const reason = {
        code: 'email_required',
        userMessage:
            "We need an email address to finish setting up this account. Add one to your profile and we'll retry automatically.",
    }
    const nextAction = { key: 'provide-email', kind: 'provide-email', purpose: 'submission-failed-no-email' }
    const entry = { state: 'action_required', reason: reason.code, message: reason.userMessage, action: nextAction.key }
    return {
        rails: [
            {
                ...MANTECA_AR_CAPABILITIES.rails[0],
                status: 'blocked',
                blockingActions: [nextAction.key],
                reason,
                resolved: {
                    status: 'fixable',
                    blocking: { ...reason, selfHealable: true, selfHealKind: 'provide-email' },
                    nextAction,
                },
            },
        ],
        nextActions: [nextAction],
        restrictions: [],
        features: { local: { ...entry, accounts: { ARS: entry } } },
    }
})()

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

/**
 * A verified user whose own payment-partner review holds three corridors, as
 * the capability resolver answers each rail (TASK-23054, C11): EUR waits on
 * the user, USD is under review, MXN was rejected. GBP has no rail at all.
 */
const REVIEW_CAUSE_CAPABILITIES = {
    rails: [
        {
            ...BRIDGE_BANK_RAILS[1],
            status: 'requires-info',
            blockingActions: ['bridge-hosted'],
            reason: { code: 'proof_of_address', userMessage: 'We need a proof of address to finish the check.' },
            resolved: {
                status: 'fixable',
                blocking: {
                    code: 'proof_of_address',
                    userMessage: 'We need a proof of address to finish the check.',
                    selfHealable: true,
                },
                nextAction: { key: 'bridge-hosted', kind: 'bridge-hosted', purpose: 'unlock-bridge' },
            },
        },
        { ...BRIDGE_BANK_RAILS[0], status: 'pending', resolved: { status: 'pending' } },
        {
            ...BRIDGE_BANK_RAILS[3],
            status: 'blocked',
            reason: { code: 'provider_rejected', userMessage: 'We could not finish this check.' },
            resolved: {
                status: 'blocked',
                blocking: {
                    code: 'provider_rejected',
                    userMessage: 'We could not finish this check.',
                    selfHealable: false,
                    selfHealKind: 'contact-support',
                },
            },
        },
    ],
    nextActions: [{ key: 'bridge-hosted', kind: 'bridge-hosted', purpose: 'unlock-bridge', currency: 'EUR' }],
    restrictions: [],
}

const withheldCorridor = (
    method: string,
    country: string,
    currency: string,
    reason: string,
    cause: string
): Record<string, string> => ({
    railId: `bridge.${method.toLowerCase()}`,
    method,
    country,
    currency,
    reason,
    cause,
})

const REVIEW_CAUSE_RESPONSE = {
    'GET /users/me': {
        capabilities: REVIEW_CAUSE_CAPABILITIES,
        depositAccounts: { enabled: true },
        residence: { declared: null, verified: null, pending: null, declaredSecond: null },
    },
    'GET /users/deposit-accounts': {
        depositAccounts: [],
        claimable: [CLAIMABLE_COP],
        unavailable: [
            withheldCorridor('SEPA_EU', 'EU', 'EUR', 'not-offered', 'review-action'),
            withheldCorridor('ACH_US', 'US', 'USD', 'not-offered', 'review-pending'),
            withheldCorridor('SPEI_MX', 'MX', 'MXN', 'support-required', 'review-closed'),
            withheldCorridor('FASTER_PAYMENTS_GB', 'GB', 'GBP', 'not-offered', 'not-open'),
        ],
    },
}

/**
 * A verified user with no approved residence and no address on their identity
 * check (TASK-24662): every bank account asks for the home address, then waits
 * while it is checked. COP needs no residence approval to be offered.
 */
const addressStepResponse = (step: 'required' | 'rejected' | 'in_review') => {
    const entry =
        step === 'in_review'
            ? { state: 'setting_up', reason: 'residence_address_in_review' }
            : { state: 'action_required', reason: 'residence_unresolved', action: 'sumsub:address_of_residence' }
    const cause = step === 'in_review' ? 'address-in-review' : 'address-required'
    return {
        'GET /users/me': {
            capabilities: {
                rails: [],
                restrictions: [],
                nextActions:
                    step === 'in_review'
                        ? []
                        : [
                              {
                                  key: 'sumsub:address_of_residence',
                                  kind: 'sumsub',
                                  purpose:
                                      step === 'rejected' ? 'residence_address_rejected' : 'residence_address_required',
                                  levelKey: 'address_of_residence',
                              },
                          ],
                features: {
                    qr: { state: 'ready' },
                    card: { state: 'ready' },
                    local: { ...entry, accounts: { ARS: entry, BRL: entry } },
                    bank: { ...entry, accounts: { USD: entry, EUR: entry, GBP: entry, MXN: entry } },
                },
            },
            depositAccounts: { enabled: true },
            residence: { declared: null, verified: null, pending: null, declaredSecond: null },
        },
        'GET /users/deposit-accounts': {
            depositAccounts: [],
            claimable: [CLAIMABLE_COP],
            unavailable: [
                withheldCorridor('ACH_US', 'US', 'USD', 'not-offered', cause),
                withheldCorridor('SEPA_EU', 'EU', 'EUR', 'not-offered', cause),
                withheldCorridor('FASTER_PAYMENTS_GB', 'GB', 'GBP', 'not-offered', cause),
                withheldCorridor('SPEI_MX', 'MX', 'MXN', 'not-offered', cause),
            ],
        },
    }
}

/**
 * A verified user whose payment partner asks for one more thing for EUR: the
 * rail's gate reads `fixable-rejection` while the backend still offers the
 * corridor. USD is the same review once the user has answered (the backend
 * says `endorsement-pending`), and COP still waits on the identity.
 */
const PROVIDER_ASK_RESPONSE = {
    'GET /users/me': {
        capabilities: {
            ...REVIEW_CAUSE_CAPABILITIES,
            rails: REVIEW_CAUSE_CAPABILITIES.rails.slice(0, 2),
        },
        depositAccounts: { enabled: true },
        residence: { declared: 'PT', verified: 'PT', pending: null, declaredSecond: null },
    },
    'GET /users/deposit-accounts': {
        depositAccounts: [],
        claimable: [CLAIMABLE_EUR, { ...CLAIMABLE_USD_PREVIEW, blockedBy: 'endorsement-pending' }],
        unavailable: [
            {
                railId: 'bridge.bank_transfer_co',
                method: 'BANK_TRANSFER_CO',
                country: 'COL',
                currency: 'COP',
                reason: 'identity-required',
            },
        ],
    },
}

/**
 * TASK-24909: Bridge reviews the customer. Every Bridge rail waits on the
 * provider, and the backend lists no corridor as offered or withheld. Those
 * rows read "Under review"; they used to read "We cannot open {currency}".
 */
const BRIDGE_REVIEW_WAIT = { key: 'wait:provider-review', kind: 'wait', purpose: 'provider-review' }
const BRIDGE_REVIEW_RESPONSE = {
    'GET /users/me': {
        capabilities: {
            rails: BRIDGE_BANK_RAILS.map((rail) => ({
                ...rail,
                status: 'requires-info',
                blockingActions: [BRIDGE_REVIEW_WAIT.key],
                resolved: { status: 'pending', nextAction: BRIDGE_REVIEW_WAIT },
            })),
            nextActions: [BRIDGE_REVIEW_WAIT],
            restrictions: [],
        },
        identityVerification: { status: 'verified' },
        depositAccounts: { enabled: true },
        residence: { declared: 'US', verified: 'US', pending: null, declaredSecond: null },
    },
    'GET /users/deposit-accounts': { depositAccounts: [], claimable: [], unavailable: [] },
}

/**
 * TASK-24909: Bridge's terms, as the API asks for them. The terms page is a
 * same-origin file, so a capture can post the signature from inside it.
 */
const BRIDGE_TERMS = { key: 'bridge-tos', kind: 'accept-tos', purpose: 'unlock-bridge' }
const bridgeTermsResponse = (confirm: { accepted: boolean }) => ({
    'GET /users/me': {
        capabilities: {
            rails: BRIDGE_BANK_RAILS.map((rail) => ({
                ...rail,
                status: 'requires-info',
                blockingActions: [BRIDGE_TERMS.key],
                resolved: { status: 'fixable', nextAction: BRIDGE_TERMS },
            })),
            nextActions: [BRIDGE_TERMS],
            restrictions: [],
        },
        identityVerification: { status: 'verified' },
        residence: { declared: 'US', verified: 'US', pending: null, declaredSecond: null },
    },
    'GET /users/bridge-tos-link': { tosLink: '/llms.txt' },
    'POST /users/bridge-tos-confirm': confirm,
})

/** Every verified-user deposit-account fixture answers the gate the same way, rollout included. */
const VA_READY_RESPONSE = {
    'GET /users/me': { capabilities: VA_READY_CAPABILITIES, depositAccounts: { enabled: true } },
}

/**
 * A UK top-up as the API returns it: GBP over Faster Payments, so the bank
 * details are a sort code and an account number, not an IBAN and a BIC.
 */
const GBP_ONRAMP = {
    transferId: 'fixture-onramp-gbp',
    depositInstructions: {
        amount: '7.00',
        currency: 'gbp',
        depositMessage: 'BRGFIXTURE7GBP',
        bankName: 'Clear Junction Limited',
        bankAddress: '1 Fixture Street, London EC1A 1AA',
        accountHolderName: 'Fixture Payments Ltd',
        sortCode: '04-00-53',
        accountNumber: '00000001',
    },
}

/**
 * The Accounts page mix (Hugo, 2026-09-25): a verified Portuguese resident.
 * EUR is held and USD can open. The backend's own signals decide the rest
 * (peanut-api-ts `listDepositCorridors`): GBP is `not-offered`, MXN is in
 * neither list because its provider preview failed, and COP asks for
 * verification.
 */
const PROFILE_ACCOUNTS_MIX = {
    'GET /users/me': {
        capabilities: VA_READY_CAPABILITIES,
        depositAccounts: { enabled: true },
        residence: { declared: 'PT', verified: 'PT', pending: null, declaredSecond: null },
    },
    'GET /users/deposit-accounts': {
        depositAccounts: [DEPOSIT_ACCOUNT_EUR],
        claimable: [CLAIMABLE_USD_PREVIEW],
        unavailable: [
            {
                railId: 'bridge.faster_payments_gb',
                method: 'FASTER_PAYMENTS_GB',
                country: 'GBR',
                currency: 'GBP',
                reason: 'not-offered',
            },
            {
                railId: 'bridge.bank_transfer_co',
                method: 'BANK_TRANSFER_CO',
                country: 'COL',
                currency: 'COP',
                reason: 'identity-required',
            },
        ],
    },
}

/**
 * An unverified Bangladesh resident who picked bank accounts. Every Bridge
 * corridor waits on the ID, and the Smart Paperwork Engine (api#1931) refuses
 * USD to the residence: Bridge publishes no USD rail for Bangladesh.
 */
const PAPERWORK_BANGLADESH_RESPONSE = {
    'GET /users/me': {
        capabilities: BLOCKED_BANK_CAPABILITIES,
        depositAccounts: { enabled: true },
        residence: { declared: 'BD', verified: null, pending: null, declaredSecond: null },
    },
    'GET /users/deposit-accounts': {
        depositAccounts: [],
        claimable: [],
        unavailable: [
            {
                railId: 'bridge.sepa_eu',
                method: 'SEPA_EU',
                country: 'EU',
                currency: 'EUR',
                reason: 'identity-required',
            },
            {
                railId: 'bridge.faster_payments_gb',
                method: 'FASTER_PAYMENTS_GB',
                country: 'GB',
                currency: 'GBP',
                reason: 'identity-required',
            },
            { railId: 'bridge.ach_us', method: 'ACH_US', country: 'US', currency: 'USD', reason: 'identity-required' },
            {
                railId: 'bridge.spei_mx',
                method: 'SPEI_MX',
                country: 'MX',
                currency: 'MXN',
                reason: 'identity-required',
            },
        ],
    },
    'GET /users/kyc/paperwork': {
        products: [
            {
                product: 'bridge.usd',
                provider: 'BRIDGE',
                available: false,
                reason: 'account_unavailable_in_residence',
                rule: 'bridge.no-usd',
            },
            { product: 'bridge.eur', provider: 'BRIDGE', available: true },
            { product: 'bridge.gbp', provider: 'BRIDGE', available: true },
            { product: 'bridge.mxn', provider: 'BRIDGE', available: true },
        ],
        requirements: [],
    },
}

/** A $250 request, as the payer settles it in dollars and by euro bank transfer. */
const REQUEST_PAY_USD = { amount: '250.00', currency: 'USD', isEstimate: false }
const REQUEST_PAY_EUR = {
    amount: '230.00',
    currency: 'EUR',
    isEstimate: true,
    rate: { from: 'USD', to: 'EUR', rate: '0.92', source: 'fixture', asOf: null },
}

const CARD_HOLDER_OVERVIEW = {
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
}

/** $25.00 the provider can release; holds already excluded. */
const CARD_HOLDER_COLLATERAL = {
    creditLimit: 2500,
    spendingPower: 2500,
    pendingCharges: 0,
    postedCharges: 0,
    balanceDue: 0,
}

// `GET /rain/cards/funding` for managed card funding. Fake spender, wallet and
// session signer — a fixture never signs. `allowance` is informational only:
// every fixture gives a large one on purpose, because readiness is the
// backend's `management.status` and never the allowance.
// Typed from the API schema, so a change to the funding response breaks this
// file at typecheck instead of drifting.
const cardFunding = (
    status: RainFundingManagementStatus,
    migration: RainCardFunding['management']['migration'] = null
): RainCardFunding => ({
    chainId: '42161',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    spenderAddress: '0x0000000000000000000000000000000000000001',
    walletAddress: DEMO_ADDRESS,
    allowance: '150000000',
    sessionKeyAddress: '0x4300F803a281e257F3C1de001512e68972f8d022',
    permission: {
        scopeVersion: 2,
        ceiling: '300000000',
        termsVersion: 'rtf-2026-09-29',
        authorizationText: 'I authorize transfers according to the Real-Time Funding Terms.',
    },
    management: { status, reason: null, migration, stop: null },
})

// `GET /rain/cards/funding/access`: the server's funding decision, which picks
// the card surfaces. `managed` with `enrollmentAllowed: false` is an accepted
// account whose cohort was closed since: it must still finish. Typed from the
// service, so a change to the response breaks this file at typecheck.
const cardAccess = (fundingMode: RainFundingAccess['fundingMode'], enrollmentAllowed: boolean): RainFundingAccess => ({
    fundingMode,
    enrollmentAllowed,
})

// An account on the existing card permission: collateral contracts on file and
// no stored withdrawal approval, so Home asks for the existing permission.
const LEGACY_CARD_OVERVIEW = {
    ...CARD_HOLDER_OVERVIEW,
    status: {
        ...CARD_HOLDER_OVERVIEW.status,
        contractAddress: '0x2222222222222222222222222222222222222222',
        coordinatorAddress: '0x3333333333333333333333333333333333333333',
    },
}

// The funding wallet matches the demo wallet (see `cardFunding`), so the modals
// can verify the funding response's scope.
const cardStopFunding = (cause: 'card_locked' | 'card_canceled', state: 'pending' | 'confirmed' | 'unavailable') => {
    const base = cardFunding('temporarily_unavailable')
    return {
        ...base,
        walletAddress: DEMO_ADDRESS,
        management: { ...base.management, reason: cause, stop: { cause, state } },
    }
}

// ---------------------------------------------------------------------
// The redesigned sign-up (TASK-25016): one fixture per contract state, named
// `setup-redesign-<screen>-<state>`, on the `setup-redesign-*` surfaces. A
// fixture holds what the API answers; a state that also needs a tap or a
// typed value (a taken name, an open picker) is driven by the visual gate in
// mono _temp/signup-redesign/r2/r9/build/gate (states.mjs), which says which
// states a browser cannot reach (native passkey sheets, the OS prompt).
// Contracts: mono _temp/signup-redesign/r2/r9/build/contract/.
// ---------------------------------------------------------------------
/** An account that has not saved an email yet (the demo user has one, which 09 would prefill). */
const NO_EMAIL = { 'GET /users/me': { user: { email: null } } }
/**
 * The demo API routes GET /users/username/:name only, so the app's HEAD check falls through to a 200 and every
 * name reads as taken. A state that needs a free name says which names are free.
 */
const freeUsernames = (...names: string[]) =>
    Object.fromEntries(names.map((name) => [`HEAD /users/username/${name}`, { status: 404, body: {} }]))
const setupRedesign = (surface: string, about: string, extra: Partial<Fixture> = {}): Fixture => ({
    ...extra,
    route: `/dev/surfaces?s=setup-redesign-${surface}`,
    about,
    responses: {
        'GET /config/residence-restrictions': DEMO_RESIDENCE_RESTRICTIONS,
        ...(surface === 'email' && NO_EMAIL),
        ...extra.responses,
    },
})
/**
 * Every idea 02 can show first or roll to, free in both locales, so the hero card and the field show a checked
 * suggestion (C-05). Without it every check reads taken and 02 opens on an empty field with no card.
 */
const suggestionIdeas = (locale: string) => {
    const names = new Set<string>()
    for (const name of suggestionCandidates(locale, 0)) {
        if (names.has(name)) break
        names.add(name)
    }
    return [...names]
}
const FREE_SUGGESTIONS = freeUsernames(...suggestionIdeas('en'), ...suggestionIdeas('es-AR'))
/** HEAD /users/username/:name answering 200: the name has an account. */
const USERNAME_TAKEN_ANSWER = {}

const SETUP_REDESIGN_FIXTURES: Record<string, Fixture> = {
    'setup-redesign-landing-default': setupRedesign('landing', '01 Landing: Sign up and Log in under the coin bridge.'),
    'setup-redesign-landing-login-failed': setupRedesign(
        'landing',
        '01 Landing after a failed log-in: the recovery link.'
    ),
    'setup-redesign-landing-account-deleted': setupRedesign('landing', '01 Landing: log-in found a deleted account.'),
    'setup-redesign-landing-web-download': setupRedesign(
        'landing',
        '01 Landing on the web without keep-web: the store buttons.'
    ),

    'setup-redesign-username-default': setupRedesign('username', '02 Username: a checked suggestion, button off.', {
        rejects: FREE_SUGGESTIONS,
    }),
    'setup-redesign-username-rolling': setupRedesign('username', '02 Username: the die is rolling.', {
        rejects: FREE_SUGGESTIONS,
    }),
    'setup-redesign-username-rolled': setupRedesign('username', '02 Username: a rolled name landed, button on.', {
        rejects: FREE_SUGGESTIONS,
    }),
    'setup-redesign-username-typing': setupRedesign(
        'username',
        '02 Username: a short typed value, rule line and counter.',
        {
            rejects: FREE_SUGGESTIONS,
        }
    ),
    'setup-redesign-username-too-long': setupRedesign('username', '02 Username: 14 letters, the extra two in red.', {
        rejects: FREE_SUGGESTIONS,
    }),
    'setup-redesign-username-invalid': setupRedesign('username', '02 Username: starts with a digit.', {
        rejects: FREE_SUGGESTIONS,
    }),
    'setup-redesign-username-taken': setupRedesign(
        'username',
        '02 Username: @tiger is taken, two free names offered.',
        {
            responses: {
                'HEAD /users/username/tiger': USERNAME_TAKEN_ANSWER,
                'HEAD /users/username/tigre': USERNAME_TAKEN_ANSWER,
            },
            rejects: FREE_SUGGESTIONS,
        }
    ),
    'setup-redesign-username-available': setupRedesign('username', '02 Username: a typed name is free, button on.', {
        rejects: { ...FREE_SUGGESTIONS, ...freeUsernames('mellowfox', 'lunamate') },
    }),
    'setup-redesign-username-check-failed': setupRedesign('username', '02 Username: the check failed, support link.', {
        rejects: FREE_SUGGESTIONS,
        fails: ['HEAD /users/username/mellowfox', 'HEAD /users/username/lunamate'],
    }),
    'setup-redesign-username-reserved': setupRedesign('username', '02 Username: a reserved name (contains peanut).', {
        rejects: FREE_SUGGESTIONS,
    }),
    'setup-redesign-username-claiming': setupRedesign('username', '02 Username: the reservation is in flight.', {
        rejects: FREE_SUGGESTIONS,
    }),
    'setup-redesign-username-return-taken': setupRedesign(
        'username-return',
        '02 Username opened again on a name someone just registered: taken, field focused.',
        {
            capture: { expectSelector: '[data-setup-stage][data-setup-state="taken"]' },
            responses: { 'HEAD /users/username/luckyotter': USERNAME_TAKEN_ANSWER },
        }
    ),

    'setup-redesign-passkey-default': setupRedesign('passkey', '03 Passkey: create the passkey for @luckyotter.', {
        rejects: freeUsernames('luckyotter', 'tigrefeliz'),
    }),
    'setup-redesign-passkey-prompt': setupRedesign('passkey', '03 Passkey: the OS sheet is open (button busy).', {
        rejects: freeUsernames('luckyotter', 'tigrefeliz'),
    }),
    'setup-redesign-passkey-error-inline': setupRedesign(
        'passkey',
        '03 Passkey: the ceremony was cancelled, inline callout.',
        {
            rejects: freeUsernames('luckyotter', 'tigrefeliz'),
        }
    ),
    'setup-redesign-passkey-taken': setupRedesign('passkey', '03 Passkey: the name was registered meanwhile.', {
        responses: { 'HEAD /users/username/luckyotter': USERNAME_TAKEN_ANSWER },
    }),
    'setup-redesign-passkey-failed-android': setupRedesign(
        'passkey',
        '03 Passkey: Android app could not create a passkey.'
    ),
    'setup-redesign-passkey-failed-ios': setupRedesign('passkey', '03 Passkey: iPhone did not save the passkey.'),
    'setup-redesign-passkey-cannot-create': setupRedesign(
        'passkey',
        '03 Passkey: Android password manager unsupported.'
    ),
    'setup-redesign-passkey-cannot-create-other': setupRedesign(
        'passkey',
        '03 Passkey: another password manager unsupported.'
    ),
    'setup-redesign-passkey-help-drawer': setupRedesign('passkey', '03 Passkey: dev help drawer over the screen.'),

    'setup-redesign-invite-default': setupRedesign('invite', '04 Invite: empty field, Skip under Continue.'),
    'setup-redesign-invite-typing': setupRedesign('invite', '04 Invite: a short value, no lookup yet.'),
    'setup-redesign-invite-checking': setupRedesign('invite', '04 Invite: the lookup is in flight.'),
    'setup-redesign-invite-found': setupRedesign('invite-found', '04 Invite: @fulano found, Continue on.', {
        responses: {
            'POST /invites/validate': {
                success: true,
                username: 'fulano',
                attributionResolved: true,
                onboardingResolved: true,
            },
        },
    }),
    'setup-redesign-invite-not-found': setupRedesign('invite', '04 Invite: nobody by that name.', {
        rejects: { 'POST /invites/validate': { status: 404, body: { error: 'Invite not found' } } },
    }),
    'setup-redesign-invite-not-found-two': setupRedesign(
        'invite',
        '04 Invite: not found with two suggestions (flag on).',
        {
            rejects: { 'POST /invites/validate': { status: 404, body: { error: 'Invite not found' } } },
        }
    ),
    'setup-redesign-invite-self': setupRedesign('invite', '04 Invite: the person typed their own username.'),
    'setup-redesign-invite-check-failed': setupRedesign('invite', '04 Invite: the lookup failed.', {
        fails: ['POST /invites/validate'],
    }),
    'setup-redesign-invite-continuing': setupRedesign('invite', '04 Invite: Continue tapped, the step advances.'),

    'setup-redesign-accounts-default': setupRedesign('accounts', '05 Accounts: USD and EUR bank details.'),
    'setup-redesign-accounts-advancing': setupRedesign('accounts', '05 Accounts: Continue tapped.'),
    'setup-redesign-card-default': setupRedesign('card', '06 Card: the pink Peanut Card.'),
    'setup-redesign-card-advancing': setupRedesign('card', '06 Card: Continue tapped.'),

    'setup-redesign-residence-default': setupRedesign(
        'residence',
        '07 Residence: my residence is in Argentina, my nationality is Argentina.'
    ),
    'setup-redesign-residence-empty': setupRedesign('residence-empty', '07 Residence: nothing chosen yet.'),
    'setup-redesign-residence-picker': setupRedesign('residence', '07 Residence: the residence drawer is open.'),
    'setup-redesign-residence-picker-nationality': setupRedesign('residence', '07 Residence: the nationality drawer.'),
    'setup-redesign-residence-search-empty': setupRedesign('residence', '07 Residence: a search with no country.'),
    'setup-redesign-residence-differ': setupRedesign('residence-differ', '07 Residence: Portugal and Brazil.'),
    'setup-redesign-residence-refused-passport': setupRedesign(
        'residence-refused',
        '07 Residence: a Cuban passport cannot verify; use the Argentine residence card.'
    ),
    'setup-redesign-residence-compare': setupRedesign(
        'residence-differ',
        '07 Residence: pick one of the two countries.'
    ),
    'setup-redesign-residence-compare-equal': setupRedesign(
        'residence',
        '07 Residence: compare where both lists match.'
    ),
    'setup-redesign-residence-compare-loading': setupRedesign(
        'residence-differ',
        '07 Residence: compare while loading.'
    ),
    'setup-redesign-residence-advancing': setupRedesign('residence', '07 Residence: Continue tapped.'),

    'setup-redesign-plan-loading': setupRedesign('plan', '08 Payment plan: the options for Argentina are loading.', {
        isLoadingState: true,
    }),
    'setup-redesign-plan-default': setupRedesign('plan', '08 Payment plan: Argentina, nothing chosen.'),
    'setup-redesign-plan-prefilled': setupRedesign(
        'plan-single',
        '08 Payment plan: Portugal, the one way to spend filled in.'
    ),
    'setup-redesign-plan-picker': setupRedesign('plan', '08 Payment plan: the funding drawer.'),
    'setup-redesign-plan-picker-payment': setupRedesign('plan', '08 Payment plan: the spending drawer.'),
    'setup-redesign-plan-filled': setupRedesign('plan-filled', '08 Payment plan: bank transfer, then QR payments.'),
    'setup-redesign-plan-advancing': setupRedesign('plan-filled', '08 Payment plan: Continue tapped.'),

    'setup-redesign-email-default': setupRedesign('email', '09 Email: empty field, Continue off.'),
    'setup-redesign-email-filled': setupRedesign('email-filled', '09 Email: a valid address, Continue on.'),
    'setup-redesign-email-invalid': setupRedesign('email', '09 Email: an address without a domain, after blur.'),
    'setup-redesign-email-already-registered': setupRedesign(
        'email-filled',
        '09 Email: an established account has the address; log in to it.',
        {
            rejects: {
                'POST /update-user': {
                    status: 409,
                    body: { code: 'EMAIL_ON_ACTIVE_ACCOUNT', message: 'Email already in use' },
                },
            },
        }
    ),
    'setup-redesign-email-save-failed': setupRedesign('email-filled', '09 Email: the save failed, Continue retries.', {
        fails: ['POST /update-user'],
    }),
    'setup-redesign-email-saving': setupRedesign('email-filled', '09 Email: the save is in flight.'),
    'setup-redesign-email-not-ready': setupRedesign('email-filled', '09 Email: Continue before the account loaded.'),
    'setup-redesign-email-kept-current': setupRedesign('email-filled', '09 Email: the change needs a verification.'),

    'setup-redesign-notifications-default': setupRedesign('notifications', '10 Notifications: Turn on, or Not now.'),
    'setup-redesign-notifications-prompt': setupRedesign('notifications', '10 Notifications: the OS prompt is open.'),
    'setup-redesign-notifications-denied': setupRedesign('notifications', '10 Notifications: the OS said no.'),

    'setup-redesign-final-default': setupRedesign('final', '11 Final confirm: Confirm and finish.'),
    'setup-redesign-final-loading-user': setupRedesign('final', '11 Final confirm: the account is still loading.', {
        isLoadingState: true,
    }),
    'setup-redesign-final-prompt': setupRedesign('final', '11 Final confirm: the passkey sheet is open.'),
    'setup-redesign-final-success': setupRedesign('final', '11 Final confirm: signed, finishing.'),
    'setup-redesign-final-network-busy': setupRedesign(
        'final',
        '11 Final confirm: the network is busy, Confirm later.',
        { capture: { expectSelector: '[data-testid="setup-redesign-final-confirm"][data-setup-state="network-busy"]' } }
    ),
    'setup-redesign-final-network-busy-first': setupRedesign('final', '11 Final confirm: the first busy answer.'),
    'setup-redesign-final-setup-failed': setupRedesign('final', '11 Final confirm: the account setup failed.'),
    'setup-redesign-final-what-passkey': setupRedesign('final', '11 Final confirm: the passkey drawer is open.'),
    'setup-redesign-final-error-refresh': setupRedesign('final', '11 Final confirm: the account did not load.', {
        fails: ['GET /users/me'],
    }),
    'setup-redesign-final-error-support': setupRedesign(
        'final',
        '11 Final confirm: an unknown failure, contact support.'
    ),
    'setup-redesign-final-error-provider': setupRedesign(
        'final',
        '11 Final confirm: the password manager signs wrong.'
    ),
    'setup-redesign-final-error-confirm-again': setupRedesign('final', '11 Final confirm: a new signature is needed.'),
    'setup-redesign-final-error-passkey': setupRedesign('final', '11 Final confirm: the passkey was interrupted.'),
    'setup-redesign-final-finish-route': setupRedesign(
        'final-finish',
        '11 Final confirm on /setup/finish, with Log out.',
        {
            responses: { 'GET /users/me': { accounts: [] } },
            capture: { expectSelector: '[data-testid="setup-redesign-below"]' },
        }
    ),

    'setup-redesign-celebration-default': setupRedesign(
        'celebration',
        '12 Celebration: ready to verify and add money.',
        { capture: { expectSelector: '[data-testid="setup-redesign-celebration"]' } }
    ),
    'setup-redesign-celebration-claim-link': setupRedesign('celebration-claim', '12 Celebration after a claim link.', {
        capture: { expectSelector: '[data-testid="setup-redesign-celebration"][data-setup-state="claim-link"]' },
    }),
}

export const FIXTURES: Record<string, Fixture> = {
    ...SETUP_REDESIGN_FIXTURES,
    'setup-signup-reserved': {
        capture: {
            actions: [
                { fill: { selector: '[data-testid="username-input"]', value: 'kimchi' } },
                { clickSelector: '[data-testid="username-claim"]' },
            ],
            expectSelector: '[data-setup-stage][data-setup-state="reserved"]',
        },
        route: '/dev/surfaces?s=06-a-signup',
        about: 'Claim username — reserved-name error returned by the server.',
        rejects: {
            'HEAD /users/username/kimchi': { status: 404, body: {} },
            'POST /users/username/reservations': { status: 400, body: { code: 'USERNAME_RESERVED' } },
        },
    },
    'setup-passkey-username-taken': {
        capture: {
            actions: [{ clickSelector: '[data-testid="passkey-create"]' }],
            expectSelector: '[data-testid="passkey-log-in"]',
        },
        route: '/dev/surfaces?s=06-c-passkey',
        about: 'Create passkey — username taken error with Log in offered.',
        responses: {
            'POST /users/username/reservations': { username: 'kimchi', expiresAt: '2030-01-01T00:00:00.000Z' },
            'HEAD /users/username/kimchi': {},
            'GET /config/residence-restrictions': DEMO_RESIDENCE_RESTRICTIONS,
        },
    },
    'profile-accounts-card-state-blocked': {
        capture: {
            expectSelector: '[role="dialog"][data-state="open"][data-testid="closed-row-drawer"]',
        },
        route: '/dev/surfaces?s=deposit-card-state-blocked',
        about: 'Closed card row drawer — card unavailable in a US resident’s state.',
        responses: {
            'GET /users/me': {
                residence: {
                    declared: { country: 'US', status: 'UNVERIFIED', updatedAt: null, secondCountry: null },
                    verified: { country: 'US', status: 'VERIFIED', updatedAt: null },
                },
                capabilities: { features: { card: { state: 'refused', reason: 'geo-blocked' } } },
            },
            'GET /users/me/verified-address': {
                streetLine1: '350 5th Ave',
                city: 'New York',
                postalCode: '10118',
                subdivisionCode: 'NY',
                countryCode: 'US',
            },
        },
    },
    'setup-passkey': {
        route: '/dev/surfaces?s=06-c-passkey',
        about: 'Create a passkey after choosing kimchi, a Portuguese residence and a bank/card payment plan.',
        // /dev/surfaces is a protected (mobile-ui) route: a null /users/me sends the
        // page to /setup before the step renders. The step reads its username from
        // the setup context and reserves without auth, so the default session is
        // enough, as for every other setup surface.
        responses: {
            'POST /users/username/reservations': { username: 'kimchi', expiresAt: '2030-01-01T00:00:00.000Z' },
            'GET /config/residence-restrictions': DEMO_RESIDENCE_RESTRICTIONS,
        },
    },
    'setup-payment-plan': {
        route: '/dev/surfaces?s=03-c-residence-congrats',
        about: 'Signup funding and payment choices with settled residence eligibility.',
        responses: {
            'GET /config/residence-restrictions': DEMO_RESIDENCE_RESTRICTIONS,
        },
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
    // TASK-25076: a verified balance under $10 moves Add to the centre as the pink button.
    'home-low-balance-top-up': {
        route: '/home',
        balance: '4.20',
        about: 'Verified user who has been paid before, $4.20 left: Send first, the pink Add money button centred, Request at the end.',
    },
    'full-maintenance': {
        route: '/maintenance',
        about: 'Full maintenance is on: every app page sends the user to the maintenance screen.',
        responses: { 'GET /config/kill-switches': { enableFullMaintenance: true } },
    },
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
    profile: { route: '/settings', about: 'Profile menu, verified user, card row present.' },
    'profile-edit': {
        views: [
            {
                id: 'qr-camera-permission',
                name: 'QR scanner — camera permission needed',
                flow: 'Payments',
                route: '/dev/surfaces?s=54-d-qrbottomdrawer',
                camera: 'denied',
                expectSelector: '[data-testid="camera-permission-title"]',
            },
        ],
        route: '/settings/details',
        about: 'Account details with email settings.',
        responses: { 'GET /users/me': { profileNameLocked: true }, 'POST /users/email-change': { success: true } },
    },
    'profile-edit-unverified': {
        route: '/settings/details',
        about: 'Account details before identity verification.',
        responses: {
            'GET /users/me': { identityVerification: { status: 'not_started' }, profileNameLocked: false },
            'POST /users/email-change': { success: true },
        },
    },
    'identity-verification': {
        route: '/profile/accounts',
        about: 'Accounts page for a user whose ID check passed.',
    },
    'settings-language': { route: '/settings/language', about: 'Language picker, English selected.' },
    'settings-notifications': {
        route: '/settings/notifications',
        about: 'Notification settings: Important alerts and Email updates on, Offers and perks not opted in.',
        responses: {
            'GET /notifications/preferences': {
                push: true,
                email: true,
                marketingPush: false,
                emailUpdates: true,
                pushPermission: 'granted',
            },
        },
    },
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
    'rewards-invites-unnamed': {
        route: '/rewards/invites',
        about: 'Invite list with a friend who never finished signup: no name, no profile link.',
        responses: { 'GET /points/invites': INVITES_WITH_UNNAMED },
    },
    badges: {
        route: '/badges',
        about: 'Two-column badge collection, art scaled to the tile, earned badges first and locked goals.',
    },
    history: { route: '/history', about: 'Activity list, four entries, both directions.' },
    'add-money': {
        route: '/add-money?method=bank',
        about: 'Add money by bank: the accounts you hold, crypto, and every country you can send from.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_EUR] } },
    },
    'verified-loading': {
        route: '/verified',
        geoCountry: 'AR',
        isLoadingState: true,
        about: 'Verified page right after approval: the ARS and bank rows load in place, crypto works.',
        responses: { 'GET /users/me': verifiedUser('AR', { ARS: { state: 'pending' } }, { state: 'pending' }) },
    },
    'verified-not-ready': {
        route: '/verified',
        geoCountry: 'AR',
        about: "Verified page: ARS under review by Manteca, the bank row needs Bridge's terms, crypto works now.",
        responses: {
            'GET /users/me': verifiedUser(
                'AR',
                { ARS: { state: 'setting_up', action: VERIFIED_WAIT.key } },
                { state: 'action_required', action: VERIFIED_TOS.key }
            ),
        },
    },
    'verified-after-terms': {
        route: '/verified',
        geoCountry: 'AR',
        about: 'Verified page after the terms: both bank rows under review, crypto works now.',
        responses: {
            'GET /users/me': verifiedUser(
                'AR',
                { ARS: { state: 'setting_up', action: VERIFIED_WAIT.key } },
                { state: 'setting_up', action: VERIFIED_WAIT.key }
            ),
        },
    },
    'verified-ready': {
        route: '/verified',
        geoCountry: 'AR',
        about: 'Verified page once the accounts work: every row opens, the name chip has its green check.',
        responses: { 'GET /users/me': verifiedUser('AR', { ARS: { state: 'on' } }, { state: 'on' }) },
    },
    // slice 5: the page Home (and the bank_ready push) opens once an account opened later. Home only hands over
    // when the device already holds a record (the first load only records), so its unit tests cover that part
    'verified-bank-ready': {
        route: '/verified?variant=bank-ready',
        geoCountry: 'AR',
        balance: '0',
        about: 'Your bank is ready: the accounts that just opened by name, every row opens, the name chip has its check.',
        responses: {
            'GET /users/me': {
                ...verifiedUser('AR', { ARS: { state: 'on' } }, { state: 'on' }),
                user: { username: 'lena', activationMilestone: 'verified', isActivated: false },
            },
        },
    },
    'verified-brazil': {
        route: '/verified',
        geoCountry: 'BR',
        about: "Verified page in Brazil: Pix leads on Avenia's route, the bank row under review by Bridge.",
        responses: {
            'GET /users/me': verifiedUser(
                'BR',
                { BRL: { state: 'on' } },
                { state: 'setting_up', action: VERIFIED_WAIT.key },
                {
                    rails: aveniaResponses('enabled')['GET /users/me'].capabilities.rails,
                    routes: aveniaRoutes('enabled'),
                }
            ),
        },
    },
    'add-money-crypto': { route: '/add-money/crypto', about: 'Crypto deposit: the network picker.' },
    // TASK-21375: Argentina's bank transfer and Mercado Pago open the same
    // screen, so the country offers one row.
    'add-money-argentina': {
        route: '/add-money/argentina',
        about: 'Add money, Argentina: one row for bank or Mercado Pago.',
        responses: { 'GET /users/me': { capabilities: MANTECA_AR_CAPABILITIES } },
    },
    ...Object.fromEntries(
        (['pending', 'expired'] as const).map((status) => [
            `add-money-argentina-deposit-${status}`,
            {
                capture: { actions: [{ clickSelector: '[data-testid="deposit-amount-continue"]' }] },
                route: '/add-money/argentina/manteca?step=inputAmount&amount=10000&currency=ARS',
                geoCountry: 'AR',
                about: `ARS deposit ${status}: continue to ${status === 'pending' ? 'the transfer deadline' : 'the expired order and start-over button'}.`,
                responses: {
                    'GET /users/me': {
                        residence: { declared: 'AR', verified: 'AR', pending: null, declaredSecond: null },
                        capabilities: MANTECA_AR_CAPABILITIES,
                    },
                    'POST /manteca/deposit': ARS_DEPOSIT,
                    'GET /manteca/deposit/fixture-ars-deposit/status':
                        status === 'pending'
                            ? { id: 'fixture-ars-deposit', status: 'PROCESSING', stage: 1, expired: false }
                            : { id: 'fixture-ars-deposit', status: 'CANCELLED', stage: 1, expired: true },
                },
            },
        ])
    ),
    // TASK-25101: the amount step says the CBU and alias come next, and its button leads to them.
    'add-money-argentina-amount': {
        route: '/add-money/argentina/manteca?step=inputAmount&amount=10000&currency=ARS',
        geoCountry: 'AR',
        about: 'ARS amount step for a ready account: the hint and button that lead to the CBU and alias.',
        responses: {
            'GET /users/me': {
                residence: { declared: 'AR', verified: 'AR', pending: null, declaredSecond: null },
                capabilities: MANTECA_AR_CAPABILITIES,
            },
        },
    },
    // A new order makes Manteca cancel the open one, so the amount step offers the open order back.
    'add-money-argentina-deposit-open': {
        route: '/add-money/argentina/manteca?step=inputAmount&currency=ARS',
        geoCountry: 'AR',
        about: 'ARS deposit with an unpaid order still open: the amount step offers its transfer details.',
        responses: {
            'GET /users/me': {
                residence: { declared: 'AR', verified: 'AR', pending: null, declaredSecond: null },
                capabilities: MANTECA_AR_CAPABILITIES,
            },
            'GET /manteca/deposit/open': { data: ARS_DEPOSIT },
            'GET /manteca/deposit/fixture-ars-deposit/status': {
                id: 'fixture-ars-deposit',
                status: 'PROCESSING',
                stage: 1,
                expired: false,
            },
        },
    },
    // The Manteca step is open (before the 72-hour park): the peso screen offers to continue it.
    'add-money-argentina-bank-step-unfinished': {
        route: '/add-money/argentina/manteca?step=inputAmount&currency=ARS',
        geoCountry: 'AR',
        about: 'ARS deposit while the Manteca bank step is unfinished: the page offers to continue it.',
        responses: {
            'GET /users/me': {
                residence: { declared: 'AR', verified: 'AR', pending: null, declaredSecond: null },
                capabilities: mantecaArStepCapabilities('manteca_action_incomplete'),
            },
        },
    },
    // After the 72-hour park the same page explains the step timed out.
    'add-money-argentina-bank-step-expired': {
        route: '/add-money/argentina/manteca?step=inputAmount&currency=ARS',
        geoCountry: 'AR',
        about: 'ARS deposit after the Manteca bank step expired: the page offers to restart it.',
        responses: {
            'GET /users/me': {
                residence: { declared: 'AR', verified: 'AR', pending: null, declaredSecond: null },
                capabilities: mantecaArStepCapabilities('manteca_action_expired'),
            },
        },
    },
    // TASK-25345: the account Manteca parked for a missing email asks for the email, not support.
    'add-money-argentina-email-required': {
        route: '/add-money/argentina/manteca?step=inputAmount&currency=ARS',
        geoCountry: 'AR',
        about: 'ARS deposit while Manteca waits on a missing email: the page asks for the email.',
        responses: {
            'GET /users/me': {
                user: { email: null },
                residence: { declared: 'AR', verified: 'AR', pending: null, declaredSecond: null },
                capabilities: MANTECA_AR_EMAIL_REQUIRED_CAPABILITIES,
            },
        },
    },
    // TASK-23924: Liechtenstein banks in CHF, and a top-up pays EUR, so the
    // amount screen asks for a euro account, as it does for Switzerland.
    'add-money-bank-liechtenstein': {
        route: '/add-money/liechtenstein/bank?step=inputAmount&amount=100',
        about: 'Add money by bank, Liechtenstein: the amount screen asks for a euro account.',
        responses: VA_READY_RESPONSE,
    },
    // TASK-23924: tap Continue, then confirm. The bank details show the sort
    // code, the account number and pounds, read from the API answer.
    'add-money-bank-uk': {
        route: '/add-money/united-kingdom/bank?step=inputAmount&amount=7',
        about: 'Add money by bank, UK: continue to the GBP bank details (sort code and account number).',
        responses: { ...VA_READY_RESPONSE, 'POST /bridge/onramp/create': GBP_ONRAMP },
    },
    // Open /add-money/spain?__fixture=add-money-country-provider-wait and tap
    // "From Bank". The euro rail is under provider review (waiting-on-provider),
    // so the tap opens the "We're reviewing your details" modal (TASK-22153).
    'add-money-country-provider-wait': {
        route: '/add-money/spain',
        about: 'Add money by bank, Spain: the euro rail is under provider review, so "From Bank" opens the wait modal.',
        responses: {
            'GET /users/me': {
                capabilities: {
                    rails: BRIDGE_BANK_RAILS.map((rail) =>
                        rail.id === 'bridge.sepa_eu'
                            ? {
                                  ...rail,
                                  status: 'requires-info',
                                  blockingActions: ['wait:provider-review'],
                                  reason: {
                                      code: 'provider_review',
                                      userMessage: 'Our banking partner is reviewing your euro account details.',
                                  },
                              }
                            : { ...rail, status: 'enabled' }
                    ),
                    nextActions: [{ key: 'wait:provider-review', kind: 'wait', purpose: 'provider-review' }],
                    restrictions: [],
                },
            },
        },
    },
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
    // TASK-23850: every token price lookup fails, as when Mobula refused every
    // call. Pick ETH, then Base, and enter an address: Continue still works,
    // because a withdrawal needs the chain's withdraw list, not a price.
    'withdraw-crypto-eth-no-price': {
        route: '/withdraw/crypto',
        about: 'Crypto withdrawal while every token price lookup fails: ETH on Base still continues.',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT, ...BANK_ACCOUNTS] } },
        fails: ['GET /tokens/price'],
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
    // TASK-23054: a UK IBAN is paid EUR over SEPA; a UK sort-code account GBP.
    // Pick one, type 50 in its currency (or toggle to USD) and continue to the
    // review. The quote answers 0.8955 per USD, and 55.84 USDC for a typed 50.
    'withdraw-payout-currency': {
        route: '/withdraw',
        about: 'Withdraw to a UK IBAN (paid EUR) or a UK sort-code account (paid GBP): the review currency.',
        responses: {
            'GET /users/me': {
                accounts: [
                    WALLET_ACCOUNT,
                    {
                        ...BANK_ACCOUNTS[0],
                        id: 'fixture-iban-gb',
                        identifier: 'GB33BUKB20201555555555',
                        details: { ...BANK_ACCOUNTS[0].details, countryCode: 'GBR', countryName: 'united-kingdom' },
                    },
                    {
                        ...BANK_ACCOUNTS[0],
                        id: 'fixture-gb-1',
                        type: 'gb',
                        identifier: '55555555',
                        sortCode: '202015',
                        details: { ...BANK_ACCOUNTS[0].details, countryCode: 'GBR', countryName: 'united-kingdom' },
                    },
                ],
            },
            'GET /bridge/offramp/quote': { rate: '0.8955', sourceAmount: '55.84' },
        },
    },
    // TASK-23054: a USD withdrawal goes by bank transfer (ACH, with a free
    // same-day option) or wire. Pick the US account, type an amount and
    // continue: the review shows both speeds, the fee and what the bank
    // receives. The fee is the backend's.
    'withdraw-usd-speed': {
        route: '/withdraw',
        about: 'USD withdrawal review: ACH (same day optional) or wire, with the wire fee and what the bank receives.',
        responses: {
            'GET /users/me': { accounts: [WALLET_ACCOUNT, BANK_ACCOUNTS[1]] },
            'GET /bridge/offramp/rail-fees': {
                currency: 'USD',
                minimumAfterFeeUsd: '1.00',
                rails: [
                    { rail: 'ach', feeUsd: '0.00' },
                    { rail: 'ach_same_day', feeUsd: '0.00' },
                    { rail: 'wire', feeUsd: '20.00' },
                ],
            },
        },
    },
    // TASK-24197: a Pix send reached by a link while the Brazil pause is on.
    'withdraw-brazil-paused': {
        route: '/withdraw/manteca?country=brazil&method=pix',
        about: 'A Brazil Pix send during the Brazil pause: the paused screen instead of the key entry.',
        responses: BRAZIL_PAUSED_RESPONSES,
    },
    // ---- Avenia Pix for Brazilian residents (PR C of the Brazil Avenia work) ----
    'pix-first-use': {
        route: '/add-money/pix',
        about: "Avenia's first use (TASK-24947): no tap and no terms, the account opens as the page loads.",
        isLoadingState: true,
        responses: aveniaResponses('first-use', { [ACTIVATE_PIX]: { state: 'setting_up' } }),
    },
    'pix-deposit-amount': {
        route: '/add-money/pix',
        about: 'Avenia Pix deposit: the amount in reais, R$20 minimum, the provider under the button.',
        responses: aveniaResponses('enabled'),
        // the page capture that taps Continue shows the monthly limit
        rejects: {
            'POST /pix/deposit': { status: 422, body: { code: 'PIX_LIMIT_EXCEEDED', error: 'Over the limit' } },
        },
    },
    'pix-withdraw-key': {
        route: AVENIA_WITHDRAW_ROUTE,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY }),
        about: "Avenia Pix withdrawal: the key resolved to the holder and bank, the user's own account.",
        waitFor: '[data-testid="pix-key-holder"]',
        responses: aveniaResponses('enabled', {
            'POST /pix/key': {
                holderName: 'Ana Souza',
                holderTaxIdMasked: '111.***.***-35',
                bankName: 'Banco Inter',
                ispb: '00416968',
                ownAccount: true,
                blocked: false,
            },
        }),
    },
    // TASK-24947: any key continues; the card says whom the money goes to
    'pix-withdraw-key-other': {
        route: AVENIA_SEND_ROUTE,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OTHER_KEY }, 'send'),
        about: "Avenia Pix send: another person's key resolves to the holder, bank and masked CPF; no badge, and Continue is on.",
        waitFor: '[data-testid="pix-key-holder"]',
        responses: aveniaResponses('enabled', { 'POST /pix/key': AVENIA_OTHER_KEY_INFO }),
    },
    'pix-send-review': {
        route: `${AVENIA_SEND_ROUTE}&step=review`,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OTHER_KEY, amountBrl: '100' }, 'send'),
        about: "Avenia Pix send to another person's key: the form leads with Sending, the holder, the phone key punctuated and the bank.",
        responses: aveniaResponses('enabled', { 'POST /pix/withdraw/preview': AVENIA_SEND_PREVIEW }),
    },
    'pix-send-arrived': {
        route: `${aveniaOutcomeRoute(AVENIA_SEND_ID)}&sendMethod=bank`,
        about: 'The last step of a Pix send after a reload, once Avenia paid it: Sent, to the holder by name.',
        responses: aveniaResponses('enabled', { [`GET /history/${AVENIA_SEND_ID}`]: aveniaSend('COMPLETED') }),
    },
    'pix-send-arrived-reward': {
        route: `${aveniaOutcomeRoute(AVENIA_SEND_ID)}&sendMethod=bank`,
        about: "A paid Pix send to another person's key that earned the QR reward (ruling of 15 Nov): the QR success's reward card and hold-to-claim.",
        responses: aveniaResponses('enabled', {
            [`GET /history/${AVENIA_SEND_ID}`]: aveniaSend('COMPLETED'),
            [`GET /pix/withdraw/${AVENIA_SEND_ID}`]: {
                provider: 'avenia',
                intentId: AVENIA_SEND_ID,
                state: 'paid',
                status: 'COMPLETED',
                amountBrl: '100.00',
                holderName: 'Bruno Lima',
                ownAccount: false,
                selfPay: false,
                perk: AVENIA_QR_PERK,
            },
        }),
    },
    'pix-receipt-send': {
        route: `/history?tx=${AVENIA_SEND_ID}`,
        about: "The receipt of a Pix send to another person's key: the holder by name, the Pix key row punctuated, the raw key copied.",
        responses: {
            'GET /users/history': { entries: [aveniaSend('COMPLETED')], hasMore: false },
            [`GET /history/${AVENIA_SEND_ID}`]: aveniaSend('COMPLETED'),
        },
    },
    'pix-receipt-send-returned': {
        route: `/history?tx=${AVENIA_SEND_ID}`,
        about: 'The receipt of a Pix send Avenia refused: the money came back to the wallet.',
        responses: {
            'GET /users/history': { entries: [aveniaSend('REFUNDED')], hasMore: false },
            [`GET /history/${AVENIA_SEND_ID}`]: aveniaSend('REFUNDED'),
        },
    },
    'pix-receipt-withdrawal': {
        route: `/history?tx=${AVENIA_WITHDRAWAL_ID}`,
        about: 'The receipt of a Pix withdrawal to the own key: titled by its method, "Withdrew by Pix", under the Pix logo.',
        responses: {
            'GET /users/history': { entries: [aveniaWithdrawal('COMPLETED')], hasMore: false },
            [`GET /history/${AVENIA_WITHDRAWAL_ID}`]: aveniaWithdrawal('COMPLETED'),
        },
    },
    'pix-receipt-withdrawal-pending': {
        route: `/history?tx=${AVENIA_WITHDRAWAL_ID}`,
        about: 'The receipt of a Pix withdrawal on its way: "Withdrawing by Pix".',
        responses: {
            'GET /users/history': { entries: [aveniaWithdrawal('PENDING')], hasMore: false },
            [`GET /history/${AVENIA_WITHDRAWAL_ID}`]: aveniaWithdrawal('PENDING'),
        },
    },
    'pix-activity-payouts': {
        route: '/history',
        about: 'Activity rows of Pix transactions, as the list sends them (the key paid, the merchant, no deposit sender): a send to another person, two QR payments, a withdrawal to the own key and a deposit, each with the Pix logo.',
        responses: {
            'GET /users/history': {
                entries: [
                    aveniaSend('COMPLETED'),
                    aveniaQrEntry('COMPLETED'),
                    { ...aveniaQrEntry('REFUNDED'), uuid: 'fixture-qr-avenia-2' },
                    aveniaWithdrawal('COMPLETED'),
                    { ...AVENIA_PAID_DEPOSIT, timestamp: new Date('2026-11-04T10:00:00.000Z') },
                ],
                hasMore: false,
            },
        },
    },
    // API-CONTRACT-M3: a resident of Germany inside Avenia's gate sends and withdraws by Pix on Avenia
    'pix-nonresident-send-key': {
        route: AVENIA_SEND_ROUTE,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OTHER_KEY }, 'send'),
        about: 'A non-resident on Avenia: Send to a Pix key reaches the same key step; the holder is named, and Continue is on.',
        waitFor: '[data-testid="pix-key-holder"]',
        responses: aveniaNonResidentResponses('enabled', { 'POST /pix/key': AVENIA_OTHER_KEY_INFO }),
    },
    'pix-nonresident-address': {
        route: AVENIA_SEND_ROUTE,
        about: "A non-resident's first Pix send: Avenia needs an address, asked on the Pix page; no state field outside the countries with clear states.",
        responses: aveniaNonResidentResponses('first-use', {
            'GET /users/kyc/questions': {
                available: true,
                attemptId: null,
                residence: 'DE',
                steps: [
                    {
                        id: 'address',
                        features: ['pix'],
                        answered: false,
                        fields: [
                            { key: 'street', kind: 'text', required: true, value: null },
                            { key: 'buildingNumber', kind: 'text', required: false, value: null },
                            { key: 'town', kind: 'text', required: true, value: null },
                            { key: 'postCode', kind: 'text', required: true, value: null },
                            { key: 'country', kind: 'country', required: true, locked: true, value: 'DE' },
                        ],
                    },
                ],
                firstUnanswered: 'address',
                progress: { done: 0, total: 1 },
            },
        }),
        rejects: { [ACTIVATE_PIX]: { status: 409, body: { code: 'questions_missing', step: 'address' } } },
    },
    'pix-nonresident-send-review': {
        route: `${AVENIA_SEND_ROUTE}&step=review`,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OTHER_KEY, amountBrl: '100' }, 'send'),
        about: 'A non-resident on Avenia: the send review, as for a resident.',
        responses: aveniaNonResidentResponses('enabled', { 'POST /pix/withdraw/preview': AVENIA_SEND_PREVIEW }),
    },
    'pix-withdraw-review': {
        route: `${AVENIA_WITHDRAW_ROUTE}?step=review`,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY, amountBrl: '503' }),
        about: "Avenia Pix withdrawal: the one form, the key's holder and bank, the reais over the USD, the rate with Avenia's variable fees inside and its flat fee as the Provider fee row.",
        responses: aveniaResponses('enabled', {
            'POST /pix/withdraw/preview': {
                amountBrl: '503.00',
                pixKey: AVENIA_OWN_KEY,
                ownAccount: true,
                holderName: 'Ana Souza',
                bankName: 'Banco Inter',
                withdrawUsd: '92.504310',
                rate: '5.445692',
                fixedFeeBrl: '0.75',
                // the variable fees in the rate, the flat fee as the row: 92.504310 × 5.445692 − 0.75 = 503.00
                exchangeRate: '5.445692',
                providerFeeBrl: '0.75',
                arrivalEstimateSeconds: 60,
                provider: 'Avenia',
            },
        }),
    },
    // ---- the Avenia states the Screen Library must show (every changed copy line) ----
    'pix-deposit-minimum': {
        route: '/add-money/pix?amount=10&currency=BRL',
        about: 'Avenia Pix deposit under R$20: the amount step says the minimum.',
        waitFor: '[data-testid="error-alert"]',
        responses: aveniaResponses('enabled'),
    },
    // the code screen as ruled on 13 Nov: the amount, "You get ≈", the code, the timer badge under it
    'pix-deposit-code': {
        route: AVENIA_DEPOSIT_CODE_ROUTE,
        about: "A payable Avenia Pix code: the reais, what the balance gets, the code, a pending badge with the time left, then the rate with Avenia's variable fees inside and its flat fee as the Provider fee row.",
        responses: aveniaResponses('enabled', {
            [`GET /pix/deposit/${AVENIA_DEPOSIT_ID}`]: aveniaDepositRead({
                codePayable: true,
                brCode: DEMO_PIX_BR_CODE,
                // the code lives 10 minutes from when the fixture loads, so the badge always reads a live timer
                expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
                payerCpfMasked: '111.***.***-35',
            }),
        }),
    },
    'pix-deposit-code-unpriced': {
        route: AVENIA_DEPOSIT_CODE_ROUTE,
        about: 'A payable Avenia Pix code whose bridge fee Rhino did not price: the API sends no rate and no fee, so neither row shows.',
        responses: aveniaResponses('enabled', {
            [`GET /pix/deposit/${AVENIA_DEPOSIT_ID}`]: aveniaDepositRead({
                codePayable: true,
                brCode: DEMO_PIX_BR_CODE,
                expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
                payerCpfMasked: '111.***.***-35',
                // the API leaves both out; null replaces the demo answer's pair
                exchangeRate: null,
                providerFeeBrl: null,
            }),
        }),
    },
    'pix-deposit-expired': {
        route: AVENIA_DEPOSIT_CODE_ROUTE,
        about: 'An Avenia Pix code that lapsed: no code is drawn, and a new deposit is offered.',
        responses: aveniaResponses('enabled', { [`GET /pix/deposit/${AVENIA_DEPOSIT_ID}`]: aveniaDepositRead() }),
    },
    'pix-deposit-returned': {
        route: AVENIA_DEPOSIT_CODE_ROUTE,
        about: 'A Pix Avenia sent back to the payer: it says so and offers a new deposit.',
        responses: aveniaResponses('enabled', {
            [`GET /pix/deposit/${AVENIA_DEPOSIT_ID}`]: aveniaDepositRead({ status: 'FAILED', pixReceived: true }),
        }),
    },
    'pix-deposit-processing': {
        route: AVENIA_DEPOSIT_CODE_ROUTE,
        about: "The Pix left the payer's bank: the code screen waits while Avenia credits the deposit.",
        isLoadingState: true,
        responses: aveniaResponses('enabled', {
            [`GET /pix/deposit/${AVENIA_DEPOSIT_ID}`]: aveniaDepositRead({ pixReceived: true }),
        }),
    },
    'pix-deposit-received': {
        route: AVENIA_DEPOSIT_CODE_ROUTE,
        about: 'The Avenia Pix deposit is credited: received, and the balance is updated.',
        responses: aveniaResponses('enabled', {
            [`GET /pix/deposit/${AVENIA_DEPOSIT_ID}`]: aveniaDepositRead({ status: 'COMPLETED', pixReceived: true }),
        }),
    },
    'pix-deposit-quote-failed': {
        route: '/add-money/pix',
        about: 'The deposit amount step when the Pix quote fails: the rate is unavailable, with a retry.',
        responses: aveniaResponses('enabled'),
        fails: ['GET /pix/quote'],
    },
    'pix-withdraw-form': {
        route: `${AVENIA_WITHDRAW_ROUTE}?step=review`,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY }),
        about: 'Avenia Pix withdrawal: the form before an amount, in reais estimated with the Pix quote, R$5 minimum.',
        responses: aveniaResponses('enabled'),
    },
    'pix-withdraw-under-minimum': {
        route: `${AVENIA_WITHDRAW_ROUTE}?step=review`,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY, amountBrl: '3' }),
        about: 'Avenia Pix withdrawal of R$3: under the R$5 minimum (ruling of 15 Nov), the form says so and asks no quote.',
        responses: aveniaResponses('enabled'),
    },
    'pix-withdraw-quote-failed': {
        route: `${AVENIA_WITHDRAW_ROUTE}?step=review`,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY }),
        about: 'The withdrawal form when the Pix quote fails: the rate is unavailable, with a retry.',
        responses: aveniaResponses('enabled'),
        fails: ['GET /pix/quote'],
    },
    'pix-route-paused-deposit': {
        route: '/add-money/pix',
        about: 'The Pix deposit route is paused: the provider-outage screen, no provider flow.',
        responses: aveniaRouteResponses({
            state: 'paused',
            reason: { code: 'provider_paused', userMessage: 'This is paused for a moment. Try again soon.' },
        }),
    },
    // the router pauses every route of a Brazil resident while brazilServicesPaused is on
    'pix-route-residence-paused': {
        route: '/withdraw/pix',
        about: "The residence pause on a Pix route: the residence's own words, no provider flow.",
        responses: aveniaRouteResponses({
            state: 'paused',
            reason: {
                code: 'residence_paused',
                userMessage: 'Deposits and withdrawals are paused where you live for now.',
            },
        }),
    },
    'pix-route-paused-withdraw': {
        route: '/withdraw/pix',
        about: 'The Pix withdraw route is paused: the provider-outage screen, no provider flow.',
        responses: aveniaRouteResponses({
            state: 'paused',
            reason: { code: 'provider_paused', userMessage: 'This is paused for a moment. Try again soon.' },
        }),
    },
    'pix-receipt-pay-code': {
        route: `/history?tx=${AVENIA_DEPOSIT_ID}`,
        about: 'The receipt of a Pix deposit whose code can still be paid opens that code again.',
        waitFor: '[data-testid="pix-pay-code-notice"]',
        responses: {
            'GET /users/history': { entries: [aveniaPayableDeposit], hasMore: false },
            [`GET /history/${AVENIA_DEPOSIT_ID}`]: aveniaPayableDeposit,
        },
    },
    'pix-deposit-receipt-completed': {
        route: `/history?tx=${AVENIA_PAID_DEPOSIT.uuid}`,
        about: 'The receipt of a paid Pix deposit: titled by its method, "Added by Pix".',
        responses: {
            'GET /users/history': { entries: [AVENIA_PAID_DEPOSIT], hasMore: false },
            [`GET /history/${AVENIA_PAID_DEPOSIT.uuid}`]: AVENIA_PAID_DEPOSIT,
        },
    },
    'pix-deposit-receipt-returned': {
        route: `/history?tx=${AVENIA_RETURNED_DEPOSIT.uuid}`,
        about: "The receipt of a Pix deposit Avenia gave back: Returned, with the deposit screen's reason, the estimate in reais, no rate or fee.",
        responses: {
            'GET /users/history': { entries: [AVENIA_RETURNED_DEPOSIT], hasMore: false },
            [`GET /history/${AVENIA_RETURNED_DEPOSIT.uuid}`]: AVENIA_RETURNED_DEPOSIT,
        },
    },
    'pix-deposit-returned-row': {
        route: '/history',
        about: 'The Activity row of a Pix deposit Avenia gave back: "Returned to sender", the amount struck through.',
        waitFor: '[data-testid="transaction-card"]',
        responses: {
            'GET /users/history': { entries: [AVENIA_RETURNED_DEPOSIT, AVENIA_PAID_DEPOSIT], hasMore: false },
        },
    },
    'pix-setup-verify': {
        route: '/add-money/pix',
        about: 'Avenia Pix before the identity check: the step sends the user to verify first.',
        responses: aveniaRouteResponses({
            state: 'action_required',
            action: 'verify',
            reason: { code: 'identity_required', userMessage: 'Verify your identity first.' },
        }),
    },
    'pix-setup-reviewing': {
        route: '/add-money/pix',
        about: 'Avenia Pix while the account opens: the wait while Avenia decides on our verification.',
        isLoadingState: true,
        responses: aveniaPending('provider_reviewing'),
    },
    'pix-setup-address-missing': {
        route: '/add-money/pix',
        about: "Avenia needs an address the verification lacks: the verify flow's address step, the state picked from Brazil's list.",
        ...aveniaMissingResponses('address'),
    },
    'pix-setup-cpf-missing': {
        route: '/add-money/pix',
        about: "Avenia needs a CPF the verification lacks: the verify flow's tax step, asked on the Pix page.",
        ...aveniaMissingResponses('tax'),
    },
    'pix-setup-cpf-record-name': {
        route: '/add-money/pix',
        about: 'Avenia rejected the CPF and name as not matching the Receita Federal record: the CPF record step asks both, prefilled.',
        ...aveniaMissingResponses('cpfRecordName'),
    },
    'pix-setup-cpf-record-status': {
        route: '/add-money/pix',
        about: 'Avenia found the CPF irregular at Receita Federal: the CPF record step asks the CPF again after a gov.br check.',
        ...aveniaMissingResponses('cpfRecordStatus'),
    },
    'pix-setup-cpf-record-retry-later': {
        route: '/add-money/pix',
        about: 'The same irregular CPF again within a day of the rejection: the save answers retry_later and the step says to try again tomorrow.',
        responses: aveniaMissingResponses('cpfRecordStatus').responses,
        rejects: {
            ...aveniaMissingResponses('cpfRecordStatus').rejects,
            'PUT /users/kyc/answers/cpfRecord': { status: 409, body: { code: 'retry_later' } },
        },
    },
    'pix-activation-refused': {
        route: '/add-money/pix',
        about: 'A user Avenia rejected (M5): the activation answers refused at once, and Pix shows its refusal with Contact support, no wait and no fall-back.',
        responses: aveniaResponses('first-use', { [ACTIVATE_PIX]: { state: 'refused', reason: 'provider_rejected' } }),
    },
    'limits-avenia': {
        route: '/limits/manteca',
        about: "A user whose Pix routes name Avenia (M5): Avenia's monthly room for BRL, Pix in and Pix out, in place of Manteca's old BRL limit.",
        responses: aveniaResponses('enabled', {
            // inside the QR gate too: every Pix route, the pay route included, names Avenia
            'GET /users/me': {
                ...aveniaResponses('enabled')['GET /users/me'],
                capabilities: {
                    ...aveniaResponses('enabled')['GET /users/me'].capabilities,
                    routes: [...aveniaRoutes('enabled'), aveniaPayRoute({ state: 'ready' })],
                },
            },
            'GET /users/limits': {
                manteca: [
                    {
                        exchangeCountry: 'BRA',
                        type: 'EXCHANGE',
                        asset: 'BRL',
                        yearlyLimit: '12000',
                        availableYearlyLimit: '12000',
                        monthlyLimit: '1000',
                        availableMonthlyLimit: '1000',
                    },
                ],
                bridge: null,
                avenia: AVENIA_LIMITS,
                unavailable: [],
            },
        }),
    },
    'limits-avenia-qr-on-manteca': {
        route: '/limits/manteca',
        about: "Inside Avenia's Pix gate, outside its QR gate (review 2, finding 5): Avenia's room names add money and withdraw only, and QR payments keep Manteca's BRL limit.",
        responses: aveniaResponses('enabled', {
            'GET /users/me': {
                ...aveniaResponses('enabled')['GET /users/me'],
                capabilities: {
                    ...aveniaResponses('enabled')['GET /users/me'].capabilities,
                    routes: [
                        ...aveniaRoutes('enabled'),
                        {
                            operation: 'pay',
                            method: 'PIX_BR',
                            provider: 'manteca',
                            state: 'ready',
                            candidates: [{ provider: 'manteca', state: 'ready' }],
                        },
                    ],
                },
            },
            'GET /users/limits': {
                manteca: [
                    {
                        exchangeCountry: 'BRA',
                        type: 'EXCHANGE',
                        asset: 'BRL',
                        yearlyLimit: '12000',
                        availableYearlyLimit: '12000',
                        monthlyLimit: '1000',
                        availableMonthlyLimit: '1000',
                    },
                ],
                bridge: null,
                avenia: AVENIA_LIMITS,
                unavailable: [],
            },
        }),
    },
    'pix-setup-open-failed': {
        route: '/add-money/pix',
        about: 'The first use could not reach the API: the activation says so and offers to try again.',
        responses: aveniaResponses('first-use'),
        fails: [ACTIVATE_PIX],
    },
    'pix-route-setup-failed': {
        route: '/withdraw/pix',
        about: "A Pix route refused because our own set-up of the Avenia rail failed (FAILED, REQUIRES_SUPPORT): not available, support's to fix.",
        responses: aveniaRouteResponses({
            provider: null,
            state: 'refused',
            reason: {
                code: 'provider_setup_failed',
                userMessage: 'Something went wrong while we set this up. Message support so we can fix it.',
            },
        }),
    },
    'pix-setup-email-missing': {
        route: '/add-money/pix',
        about: "Avenia's account setup parked on a missing email (TASK-25335): the Pix step asks for the email, not for support.",
        waitFor: '[data-testid="provide-email-form"]',
        responses: aveniaEmailMissing(aveniaRouteResponses(AVENIA_EMAIL_STEP)),
    },
    'pix-route-rejected': {
        route: '/add-money/pix',
        about: "A refused Pix route: the verification was not accepted, in the user's language, with support.",
        responses: aveniaRouteResponses({
            provider: null,
            state: 'refused',
            reason: { code: 'provider_rejected', userMessage: 'Avenia did not accept the verification.' },
        }),
    },
    'pix-route-not-offered': {
        route: '/withdraw/pix',
        about: 'A Pix route not offered to the user (the rollout gate): not on this account yet.',
        responses: aveniaRouteResponses({
            provider: null,
            state: 'refused',
            reason: { code: 'rollout_closed', userMessage: 'Pix is not open to this account yet.' },
        }),
    },
    'pix-route-residence': {
        route: '/add-money/pix',
        about: 'A Pix route refused for the residence: not offered where the user lives, no "try again".',
        responses: aveniaRouteResponses({
            provider: null,
            state: 'refused',
            reason: { code: 'residence_not_served', userMessage: 'This is not available for your country.' },
        }),
    },
    'pix-route-provider-down': {
        route: '/withdraw/pix',
        about: 'A Pix route refused while the provider is down: try again soon.',
        responses: aveniaRouteResponses({
            provider: null,
            state: 'refused',
            reason: { code: 'provider_unavailable', userMessage: 'This is not available right now.' },
        }),
    },
    'pix-route-method-not-served': {
        route: '/add-money/pix',
        about: 'A Pix route no provider serves: Peanut does not offer it.',
        responses: aveniaRouteResponses({
            provider: null,
            state: 'refused',
            reason: { code: 'method_not_served', userMessage: 'This is not available.' },
        }),
    },
    'pix-withdraw-key-code': {
        route: AVENIA_WITHDRAW_ROUTE,
        sessionStorage: pixWithdrawForm({ destination: DEMO_PIX_BR_CODE }),
        about: 'A Pix code pasted where a withdrawal needs a key: the field asks for a key.',
        responses: aveniaResponses('enabled'),
    },
    'pix-withdraw-key-lookup-failed': {
        route: AVENIA_WITHDRAW_ROUTE,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY }),
        about: 'The Pix key lookup failed: the field asks to try again.',
        responses: aveniaResponses('enabled'),
        fails: ['POST /pix/key'],
    },
    'pix-withdraw-key-blocked': {
        route: AVENIA_WITHDRAW_ROUTE,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY }),
        about: "A key at a bank on Avenia's deny-list: withdrawals there are not available.",
        waitFor: '[data-testid="pix-key-holder"]',
        responses: aveniaResponses('enabled', {
            'POST /pix/key': { ...AVENIA_OWN_KEY_INFO, blocked: true },
        }),
    },
    'pix-withdraw-review-limit': {
        route: `${AVENIA_WITHDRAW_ROUTE}?step=review`,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY, amountBrl: '503' }),
        about: 'A withdrawal over the monthly Pix limit: the review says so (PIX_LIMIT_EXCEEDED).',
        responses: aveniaResponses('enabled'),
        rejects: {
            'POST /pix/withdraw/preview': {
                status: 422,
                body: { code: 'PIX_LIMIT_EXCEEDED', error: 'Over the limit' },
            },
        },
    },
    'pix-withdraw-review-in-progress': {
        route: `${AVENIA_WITHDRAW_ROUTE}?step=review`,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY, amountBrl: '503' }),
        about: 'Too many Pix withdrawals still on their way: the review asks to try later.',
        responses: aveniaResponses('enabled'),
        rejects: {
            'POST /pix/withdraw/preview': {
                status: 409,
                body: { code: 'WITHDRAWAL_IN_PROGRESS', error: 'A withdrawal is in progress' },
            },
        },
    },
    'pix-withdraw-review-quote-changed': {
        route: `${AVENIA_WITHDRAW_ROUTE}?step=review`,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY, amountBrl: '503' }),
        about: 'The amount changed while it was quoted (PIX_QUOTE_CHANGED): the review asks to try again.',
        responses: aveniaResponses('enabled'),
        rejects: {
            'POST /pix/withdraw/preview': {
                status: 409,
                body: { code: 'PIX_QUOTE_CHANGED', error: 'Quote changed' },
            },
        },
    },
    'pix-withdraw-arrived': {
        route: aveniaOutcomeRoute(AVENIA_WITHDRAWAL_ID),
        about: 'The last step of a Pix withdrawal after a reload, once Avenia paid the Pix: the shared success view, the key alone.',
        responses: aveniaResponses('enabled', {
            [`GET /history/${AVENIA_WITHDRAWAL_ID}`]: aveniaWithdrawal('COMPLETED'),
        }),
    },
    'pix-withdraw-unconfirmed': {
        route: aveniaOutcomeRoute(AVENIA_WITHDRAWAL_ID),
        about: 'The last step of a Pix withdrawal after a reload, while the entry is pending: not confirmed yet.',
        responses: aveniaResponses('enabled', {
            [`GET /history/${AVENIA_WITHDRAWAL_ID}`]: aveniaWithdrawal('PENDING'),
        }),
    },
    'pix-withdraw-processing': {
        route: aveniaOutcomeRoute(AVENIA_WITHDRAWAL_ID),
        about: 'The last step of a Pix withdrawal after a reload, while Avenia pays the Pix: the shared payment loader.',
        isLoadingState: true,
        responses: aveniaResponses('enabled', {
            [`GET /history/${AVENIA_WITHDRAWAL_ID}`]: {
                ...aveniaWithdrawal('PENDING'),
                extraData: { ...aveniaWithdrawal('PENDING').extraData, intentStatus: 'PROCESSING' },
            },
        }),
    },
    'pix-withdraw-refunded': {
        route: aveniaOutcomeRoute(AVENIA_WITHDRAWAL_ID),
        about: 'A Pix withdrawal the bank did not accept: the money is back in the balance.',
        responses: aveniaResponses('enabled', {
            [`GET /history/${AVENIA_WITHDRAWAL_ID}`]: aveniaWithdrawal('REFUNDED'),
        }),
    },
    'pix-withdraw-not-sent': {
        route: aveniaOutcomeRoute(AVENIA_WITHDRAWAL_ID),
        about: 'An opened withdrawal that was never signed: it did not go through, the balance is unchanged.',
        responses: aveniaResponses('enabled', {
            [`GET /history/${AVENIA_WITHDRAWAL_ID}`]: aveniaWithdrawal('CANCELLED'),
        }),
    },
    'pix-withdraw-not-signed': {
        route: aveniaOutcomeRoute(AVENIA_WITHDRAWAL_ID),
        about: 'After a reload, an opened withdrawal this device never signed: it did not go through, try again.',
        responses: aveniaResponses('enabled', {
            [`GET /history/${AVENIA_WITHDRAWAL_ID}`]: {
                ...aveniaWithdrawal('PENDING'),
                extraData: { ...aveniaWithdrawal('PENDING').extraData, intentStatus: 'AWAITING_USER_ACTION' },
            },
        }),
    },
    // ---- The same Pix flow on Manteca's route (a resident outside Brazil): the answers differ ----
    'pix-manteca-deposit-code': {
        route: `/add-money/pix?step=showQR&intentId=${MANTECA_PIX_DEPOSIT_ID}`,
        about: "A Pix code from Manteca's route: no expiry, no payer CPF and no flat fee, so no line for them.",
        responses: mantecaPixResponses({
            [`GET /pix/deposit/${MANTECA_PIX_DEPOSIT_ID}`]: {
                provider: 'manteca',
                intentId: MANTECA_PIX_DEPOSIT_ID,
                status: 'AWAITING_USER_ACTION',
                codePayable: true,
                pixReceived: false,
                brCode: DEMO_PIX_BR_CODE,
                expiresAt: null,
                amountBrl: '100.00',
                usdcAmount: '18.390000',
                payerCpfMasked: null,
                fixedFeeBrl: null,
            },
        }),
    },
    'pix-manteca-withdraw-key': {
        route: AVENIA_WITHDRAW_ROUTE,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY }),
        about: "A Pix key on Manteca's route: the holder is named, no ownership badge, and the key continues.",
        waitFor: '[data-testid="pix-key-holder"]',
        responses: mantecaPixResponses({
            'POST /pix/key': {
                provider: 'manteca',
                holderName: 'Ana Souza',
                holderTaxIdMasked: '111.***.***-35',
                bankName: null,
                ispb: null,
                ownAccount: null,
                blocked: false,
            },
        }),
    },
    'pix-manteca-withdraw-review': {
        route: `${AVENIA_WITHDRAW_ROUTE}?step=review`,
        sessionStorage: pixWithdrawForm({ destination: AVENIA_OWN_KEY, amountBrl: '503' }),
        about: "A Pix withdrawal review on Manteca's route: the fees in the rate, no flat-fee line, Manteca named.",
        responses: mantecaPixResponses({
            'POST /pix/withdraw/preview': {
                amountBrl: '503.00',
                pixKey: AVENIA_OWN_KEY,
                ownAccount: null,
                holderName: 'Ana Souza',
                bankName: null,
                withdrawUsd: '92.504310',
                rate: '5.437586',
                fixedFeeBrl: '0',
                arrivalEstimateSeconds: 300,
                provider: 'Manteca',
            },
        }),
    },
    // ?step=form names the screen; the amount is collected after it now.
    'withdraw-bank-form': {
        route: '/withdraw/spain?step=form',
        about: 'Bridge bank-account form for Spain — Field label/error chrome.',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT, ...BANK_ACCOUNTS] } },
    },
    // TASK-23054: the bank currency list, titled by currency code alone.
    'withdraw-currency-list': {
        route: '/withdraw?showAll=true&rail=bank',
        about: 'Withdraw to a bank: one row per currency, the code as title and the name under it.',
        responses: { 'GET /users/me': { accounts: [WALLET_ACCOUNT, ...BANK_ACCOUNTS] } },
    },
    // TASK-23054: a US account owned by someone who lives in Portugal (a Wise
    // USD account). The owner's address is theirs, in Portugal, with no state.
    'withdraw-bank-form-us-abroad': {
        route: '/withdraw/usa?step=form',
        about: 'US bank form for a Portuguese resident: country Portugal, address filled in, no state.',
        responses: {
            'GET /users/me': {
                accounts: [WALLET_ACCOUNT, ...BANK_ACCOUNTS],
                residence: { declared: 'PT', verified: 'PT', pending: null, declaredSecond: null },
            },
            'GET /users/me/verified-address': {
                streetLine1: 'Rua Augusta 100',
                city: 'Lisboa',
                postalCode: '1100-053',
                subdivisionCode: null,
                countryCode: 'PT',
            },
        },
    },
    'withdraw-bank-form-us-resident': {
        route: '/withdraw/usa?step=form',
        about: 'US bank form for a US resident: country United States, address and state filled in.',
        responses: {
            'GET /users/me': {
                accounts: [WALLET_ACCOUNT, ...BANK_ACCOUNTS],
                residence: { declared: 'US', verified: 'US', pending: null, declaredSecond: null },
            },
            'GET /users/me/verified-address': {
                streetLine1: '350 5th Ave',
                city: 'New York',
                postalCode: '10118',
                subdivisionCode: 'NY',
                countryCode: 'US',
            },
        },
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
    // ---- merchant Pix QR on Avenia, through the neutral pay routes (TASK-24947 M4) ----
    'qr-pay-avenia-form': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT),
        about: "A Pix code with its own amount on Avenia's pay route: the merchant, bank and CNPJ, the code's reais, the rate, the provider fee and Avenia.",
        responses: aveniaQrResponses(),
    },
    'qr-pay-avenia-open-amount': {
        route: qrPayRoute(PIX_QR_OPEN_AMOUNT),
        about: 'A Pix code without an amount on Avenia: the payer types the reais, and the review names the merchant once it answers.',
        responses: aveniaQrResponses(),
    },
    'qr-pay-avenia-minimum': {
        route: qrPayRoute(PIX_QR_SMALL_AMOUNT),
        about: 'A Pix code of R$3 on Avenia: under the R$5 the route states, the minimum line, and Pay stays off.',
        responses: aveniaQrResponses(),
    },
    'qr-pay-avenia-processing': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT, AVENIA_QR_PAYMENT_ID),
        about: 'An Avenia QR payment whose USDC left the wallet: the processing screen while Avenia pays the merchant.',
        isLoadingState: true,
        responses: aveniaQrResponses({ state: 'ready' }, aveniaQrRead('processing', 'PROCESSING')),
    },
    'qr-pay-avenia-paid': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT, AVENIA_QR_PAYMENT_ID),
        about: 'An Avenia QR payment the merchant received: the QR success screen, the reais and the USD that left.',
        responses: aveniaQrResponses(
            { state: 'ready' },
            {
                ...aveniaQrRead('paid', 'COMPLETED'),
                [`GET /history/${AVENIA_QR_PAYMENT_ID}`]: aveniaQrEntry('COMPLETED'),
            }
        ),
    },
    'qr-pay-avenia-paid-reward': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT, AVENIA_QR_PAYMENT_ID),
        about: "An Avenia QR payment that earned the QR reward (M5): the same reward card and hold-to-claim as Manteca's.",
        responses: aveniaQrResponses(
            { state: 'ready' },
            {
                ...aveniaQrRead('paid', 'COMPLETED', AVENIA_QR_PERK),
                [`GET /history/${AVENIA_QR_PAYMENT_ID}`]: aveniaQrEntry('COMPLETED'),
            }
        ),
    },
    'qr-pay-avenia-quote-changed': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT),
        about: 'A Pix code whose re-quote at Pay would pay other reais (409 PIX_QUOTE_CHANGED, M5): the amount-changed line, and the code reviewed again.',
        responses: aveniaQrResponses(),
        rejects: {
            'POST /pix/pay': {
                status: 409,
                body: { code: 'PIX_QUOTE_CHANGED', error: 'The price changed. Review the payment again.' },
            },
        },
    },
    'qr-pay-avenia-amount-held': {
        capture: {
            actions: [{ clickSelector: '[data-testid="qr-pay-confirm"]' }, { reveal: '[data-testid="error-alert"]' }],
            expectSelector: '[data-testid="error-alert"]',
        },
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT),
        about: 'A Pix code whose amount another open payment of the user still holds (409 WITHDRAWAL_IN_PROGRESS at Pay): the QR line that says so.',
        responses: aveniaQrResponses(),
        // the line sits under Pay, below the fold at 320
        fullPage: true,
        rejects: {
            'POST /pix/pay': {
                status: 409,
                body: {
                    code: 'WITHDRAWAL_IN_PROGRESS',
                    error: 'Another payment of yours still holds this exact amount, and this code’s amount cannot change. Try again later.',
                },
            },
        },
    },
    'qr-pay-avenia-throttled': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT),
        about: "A Pix code read while the user's code-read budget is spent (429 PIX_KEY_LOOKUP_THROTTLED): the wait-a-moment line.",
        responses: aveniaQrResponses(),
        rejects: {
            'POST /pix/pay/preview': {
                status: 429,
                body: { code: 'PIX_KEY_LOOKUP_THROTTLED', error: 'Too many lookups. Try again in a moment.' },
            },
        },
    },
    'qr-pay-brl-switched-off': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT),
        about: "Manteca's BRL switched off (disabledMantecaCurrencies BRL), outside Avenia's gates, no Avenia account: the pay route's pause, as an outage, never Manteca's flow.",
        responses: mantecaPixResponses({
            'GET /users/me': {
                ...mantecaPixResponses()['GET /users/me'],
                capabilities: {
                    ...mantecaPixResponses()['GET /users/me'].capabilities,
                    routes: mantecaPixRoutes().map((route) => ({
                        ...route,
                        state: 'paused',
                        reason: {
                            code: 'provider_paused',
                            userMessage: 'This is paused for a moment. Try again soon.',
                        },
                        candidates: [{ provider: 'manteca', state: 'paused' }],
                    })),
                },
            },
        }),
    },
    'qr-pay-avenia-refunded': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT, AVENIA_QR_PAYMENT_ID),
        about: "An Avenia QR payment that failed after the USDC left: it came back, the QR flow's refunded status.",
        responses: aveniaQrResponses({ state: 'ready' }, aveniaQrRead('refunded', 'REFUNDED')),
    },
    'qr-pay-avenia-needs-support': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT, AVENIA_QR_PAYMENT_ID),
        about: 'An Avenia QR payment a person at Peanut is looking at: the status, and support as the way on.',
        responses: aveniaQrResponses({ state: 'ready' }, aveniaQrRead('needs_support', 'FAILED')),
    },
    'qr-pay-avenia-refused': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT),
        about: "A user Avenia refused: the pay route's refusal and support, no fall-back to another provider.",
        responses: aveniaQrResponses({
            state: 'refused',
            reason: {
                code: 'provider_rejected',
                userMessage:
                    'Our payments partner could not verify your identity. Message support if you think this is a mistake.',
            },
        }),
    },
    'qr-pay-avenia-merchant-blocked': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT),
        about: "A Pix code Avenia does not pay (its bank or holder): the QR flow's card for a merchant it cannot pay.",
        responses: aveniaQrResponses(),
        rejects: { 'POST /pix/pay/preview': { status: 422, body: { code: 'PIX_KEY_BLOCKED', error: 'Blocked' } } },
    },
    'qr-pay-avenia-first-use': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT),
        about: 'Inside the QR gate with no Avenia account yet: the same no-tap opening as the other Pix pages.',
        isLoadingState: true,
        responses: aveniaQrResponses(
            {
                state: 'action_required',
                action: 'activate',
                reason: { code: 'first_use_required', userMessage: 'Set up this payment method to continue.' },
            },
            { [ACTIVATE_PIX]: { state: 'setting_up' } }
        ),
    },
    'qr-pay-avenia-email-missing': {
        route: qrPayRoute(PIX_QR_FIXED_AMOUNT),
        about: 'A scanned Pix code for a user with no email (TASK-25335): the QR page asks for the email, not for support.',
        waitFor: '[data-testid="provide-email-form"]',
        responses: aveniaEmailMissing(aveniaQrResponses(AVENIA_EMAIL_STEP)),
    },
    'qr-pay-avenia-receipt': {
        route: `/history?tx=${AVENIA_QR_PAYMENT_ID}`,
        about: "An Avenia QR payment's receipt: a QR payment to the merchant, the reais, and Avenia on the provider row.",
        responses: {
            'GET /users/history': {
                entries: [aveniaQrEntry('COMPLETED'), { ...aveniaQrEntry('REFUNDED'), uuid: 'fixture-qr-avenia-2' }],
                hasMore: false,
            },
            [`GET /history/${AVENIA_QR_PAYMENT_ID}`]: aveniaQrEntry('COMPLETED'),
        },
    },
    'qr-pay-rate-unavailable': {
        route: '/qr-pay?qrCode=00020126400014br.gov.bcb.pix0118maria%40silva.com.br5204000053039865802BR5918MARIA%40SILVA.COM.BR6009SAO%20PAULO62070503***63046DEC&type=PIX&t=1',
        about: 'An open-amount QR whose live exchange rate failed: Retry remains reachable before currency is set.',
        waitFor: 'div.my-auto button',
        responses: {
            'GET /users/me': PIX_ELIGIBLE_USER,
            'POST /manteca/qr-payment/init': {
                code: '',
                type: 'PIX',
                paymentAsset: 'BRL',
                paymentAssetAmount: '0',
                paymentAgainst: 'USDC',
                paymentAgainstAmount: '0',
                paymentPrice: '0',
            },
        },
        fails: ['GET /manteca/prices'],
    },
    // A PIX-key send after the key screen resolved the owner: the owner's name is
    // the heading, the key with the masked CPF/CNPJ sits underneath, and the bank
    // the PIX directory names comes last (the API sent Manteca the bare key).
    'qr-pay-pix-key-owner': {
        route: '/qr-pay?qrCode=00020126400014br.gov.bcb.pix0118maria%40silva.com.br5204000053039865802BR5918MARIA%40SILVA.COM.BR6009SAO%20PAULO62070503***63046DEC&type=PIX&pixKey=maria%40silva.com.br&t=1',
        about: "PIX-key payment showing the key owner's name, with the key, masked CPF/CNPJ and bank below it.",
        waitFor: 'p.text-body-s.ph-mask',
        responses: {
            'GET /users/me': PIX_ELIGIBLE_USER,
            'POST /manteca/qr-payment/init': {
                type: 'PIX',
                paymentRecipientName: 'MARIA DA SILVA',
                paymentRecipientLegalId: '12*******90',
                paymentRecipientBankName: 'NU PAGAMENTOS S.A.',
                paymentRecipientBankCode: '18236120',
                paymentAsset: 'BRL',
                paymentAgainst: 'USDC',
                paymentPrice: '5.5',
            },
            'POST /manteca/pix-key/owner': { name: 'MARIA DA SILVA', legalIdMasked: '12*******90' },
        },
    },
    // A CPF key is the owner's own tax ID: it shows once, in full, labelled CPF.
    // Its lock names no bank, as when the API had to send the BR Code.
    'qr-pay-pix-key-cpf': {
        route: '/qr-pay?qrCode=00020126330014br.gov.bcb.pix0111123456789095204000053039865802BR5911123456789096009SAO%20PAULO62070503***63047AC2&type=PIX&pixKey=12345678909&t=1',
        about: 'PIX payment to a CPF key: the owner, then the CPF in full, with no masked copy.',
        waitFor: 'p.text-body-s.ph-mask',
        responses: {
            'GET /users/me': PIX_ELIGIBLE_USER,
            'POST /manteca/qr-payment/init': {
                type: 'PIX',
                paymentRecipientName: '12345678909',
                paymentAsset: 'BRL',
                paymentAgainst: 'USDC',
                paymentPrice: '5.5',
            },
            'POST /manteca/pix-key/owner': { name: 'MARIA DA SILVA', legalIdMasked: '12*******09' },
        },
    },
    // The capabilities let the user pay, but the API refuses the scan for
    // identity (TASK-23747): the card starts the verification.
    'qr-pay-payer-blocked': {
        route: PIX_QR_ROUTE,
        about: 'A payer blocked by the payment provider: terminal guidance with support and another payment method.',
        responses: { 'GET /users/me': PIX_ELIGIBLE_USER },
        rejects: {
            'POST /manteca/qr-payment/init': {
                status: 422,
                body: { code: 'PAYER_BLOCKED', error: 'PAYER_BLOCKED', message: 'Payer blocked' },
            },
        },
    },
    'qr-pay-merchant-blocked': {
        route: PIX_QR_ROUTE,
        about: 'A merchant blocked by the payment provider: ask for another QR or payment method.',
        responses: { 'GET /users/me': PIX_ELIGIBLE_USER },
        rejects: {
            'POST /manteca/qr-payment/init': {
                status: 422,
                body: { code: 'MERCHANT_BLOCKED', error: 'MERCHANT_BLOCKED', message: 'Merchant blocked' },
            },
        },
    },
    // A merchant-fixed amount a few cents above the balance (TASK-24621): the
    // amount cannot be lowered, so the field says how much is missing and
    // Add money takes the place of Pay (TASK-25444).
    // The Screen Library answers the API outside the page, where a fixture's `balance` never applies:
    // the amount sits a few cents above the demo balance ($1,250.75) instead.
    'qr-pay-fixed-amount-short': {
        route: PIX_QR_ROUTE,
        about: 'A fixed-amount Pix QR a few cents above the balance: the field error says how much is missing, and Add money takes the place of Pay.',
        waitFor: '[data-testid="error-alert"]',
        responses: {
            'GET /users/me': PIX_ELIGIBLE_USER,
            'POST /manteca/qr-payment/init': {
                type: 'PIX',
                paymentRecipientName: 'PADARIA CENTRAL',
                paymentAsset: 'BRL',
                paymentAssetAmount: '6879.40',
                paymentAgainst: 'USDC',
                paymentAgainstAmount: '1250.80',
                paymentPrice: '5.5',
            },
        },
    },
    'qr-pay-brazil-resident': {
        views: [
            {
                id: 'qr-scanner-brazil-resident',
                name: 'QR scanner — Brazilian resident, Pix hidden',
                flow: 'Payments',
                route: '/dev/surfaces?s=54-d-qrbottomdrawer',
                camera: 'synthetic',
            },
        ],
        route: PIX_QR_ROUTE,
        about: 'A Brazilian resident reaches a Pix deep link: the pay route refuses the residence before init.',
        responses: {
            'GET /users/me': {
                residence: {
                    verified: { country: 'BR', status: 'VERIFIED', updatedAt: null },
                    declared: null,
                    secondaryDeclaredCountry: null,
                },
                capabilities: { routes: [pixPayRoute('refused')] },
            },
        },
    },
    'qr-pay-kyc-required': {
        route: PIX_QR_ROUTE,
        about: 'A scan the API refuses with MANTECA_KYC_REQUIRED: the error card offers Verify identity.',
        responses: { 'GET /users/me': PIX_ELIGIBLE_USER },
        rejects: {
            'POST /manteca/qr-payment/init': {
                status: 400,
                body: {
                    error: 'User KYC not approved',
                    message: 'User KYC not approved',
                    code: 'MANTECA_KYC_REQUIRED',
                },
            },
        },
    },
    // TASK-22698: the restart, not the start route that answers "already approved".
    'qr-pay-identity-missing': {
        route: PIX_QR_ROUTE,
        about: "QR paused: the payment partner can't read the name and ID number on the user's ID. They upload it again.",
        responses: {
            'GET /users/me': { residence: PIX_ELIGIBLE_RESIDENCE, capabilities: QR_IDENTITY_MISSING_CAPABILITIES },
        },
    },
    'qr-pay-identity-restart-pending': {
        route: PIX_QR_ROUTE,
        about: 'QR paused: the user started a new ID check and has not finished it. They continue it.',
        responses: {
            'GET /users/me': {
                residence: PIX_ELIGIBLE_RESIDENCE,
                capabilities: qrIdentityPausedCapabilities(
                    'identity_restart_pending',
                    'Finish your new ID check to pay by QR again.'
                ),
            },
        },
    },
    'qr-pay-identity-document-missing': {
        route: PIX_QR_ROUTE,
        about: 'QR paused: an account imported from Manteca has no ID on file. They upload it and take a selfie.',
        responses: {
            'GET /users/me': {
                residence: PIX_ELIGIBLE_RESIDENCE,
                capabilities: qrIdentityPausedCapabilities(
                    'identity_document_missing',
                    'We need an identity document and a selfie to complete your verification.'
                ),
            },
        },
    },
    // Activity after a PIX-key payment: the owner's name, not the key.
    'history-pix-key-owner': {
        route: '/history',
        about: 'Activity row for a PIX-key payment, named after the key owner.',
        responses: { 'GET /users/history': { entries: [PIX_KEY_PAYMENT_ENTRY], hasMore: false } },
    },
    // Activity after a request link is paid from an exchange (star LP /request-links capture).
    'history-request-paid-external': {
        route: '/history',
        about: 'Activity row for a request paid from an external wallet, named by its address.',
        responses: { 'GET /users/history': { entries: [REQUEST_PAID_EXTERNAL_ENTRY], hasMore: false } },
    },
    // Activity after an in-person card tap (star LP /peanut-card capture).
    'history-card-spend': {
        route: '/history',
        about: 'Activity after in-person Peanut Card purchases in USD: card rows only, no badge rows.',
        responses: {
            'GET /users/history': { entries: [CARD_SPEND_ENTRY, ...EARLIER_CARD_SPENDS], hasMore: false },
            'GET /users/me': { user: { badges: [] } },
        },
    },
    // Send → Bank with a PIX key saved to favorites: the key's row names its bank.
    'send-bank-pix-favorite': {
        route: '/withdraw?method=bank',
        about: 'Send to a bank account, with a PIX key saved to favorites that shows its bank.',
        responses: {
            'GET /users/me': { accounts: [WALLET_ACCOUNT, ...NAMED_BANK_ACCOUNTS, PIX_FAVORITE] },
        },
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
    'card-address-required': {
        route: '/card',
        about: 'Card residence recovery: required.',
        responses: {
            'GET /users/me': {
                identityVerification: { status: 'verified' },
                capabilities: {
                    features: {
                        card: {
                            state: 'action_required',
                            reason: 'residence_unresolved',
                            action: 'sumsub:address_of_residence',
                        },
                    },
                    nextActions: [
                        {
                            key: 'sumsub:address_of_residence',
                            kind: 'sumsub',
                            levelKey: 'address_of_residence',
                            purpose: 'residence_address_required',
                        },
                    ],
                },
            },
            'GET /card': { isEligible: false, geoProhibited: false },
            'GET /rain/cards': { status: { hasApplication: false }, cards: [], balance: null },
        },
    },
    'card-address-rejected': {
        route: '/card',
        about: 'Card residence recovery: rejected.',
        responses: {
            'GET /users/me': {
                identityVerification: { status: 'verified' },
                capabilities: {
                    features: {
                        card: {
                            state: 'action_required',
                            reason: 'residence_unresolved',
                            action: 'sumsub:address_of_residence',
                        },
                    },
                    nextActions: [
                        {
                            key: 'sumsub:address_of_residence',
                            kind: 'sumsub',
                            levelKey: 'address_of_residence',
                            purpose: 'residence_address_rejected',
                        },
                    ],
                },
            },
            'GET /card': { isEligible: false, geoProhibited: false },
            'GET /rain/cards': { status: { hasApplication: false }, cards: [], balance: null },
        },
    },
    'card-address-in-review': {
        route: '/card',
        about: 'Card residence recovery: in_review.',
        responses: {
            'GET /users/me': {
                identityVerification: { status: 'verified' },
                capabilities: {
                    features: { card: { state: 'setting_up', reason: 'residence_address_in_review' } },
                    nextActions: [],
                },
            },
            'GET /card': { isEligible: false, geoProhibited: false },
            'GET /rain/cards': { status: { hasApplication: false }, cards: [], balance: null },
        },
    },
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
    'card-onboarding': {
        route: '/card?card_step=eligibility',
        about: 'Card onboarding: eligibility, with eligible residence and no application.',
        responses: {
            'GET /card': { isEligible: true, geoProhibited: false },
            'GET /rain/cards': { status: { hasApplication: false }, cards: [], balance: null },
            'POST /rain/cards': { status: 'terms-required', isUsResident: false },
        },
    },
    'card-available': {
        route: '/card?card_step=available',
        about: 'Card onboarding: available, with eligible residence and no application.',
        responses: {
            'GET /card': { isEligible: true, geoProhibited: false },
            'GET /rain/cards': { status: { hasApplication: false }, cards: [], balance: null },
            'POST /rain/cards': { status: 'terms-required', isUsResident: false },
        },
    },
    'card-funding': {
        route: '/card?card_step=funding',
        about: 'Card onboarding: funding, with eligible residence and no application.',
        responses: {
            'GET /card': { isEligible: true, geoProhibited: false },
            'GET /rain/cards': { status: { hasApplication: false }, cards: [], balance: null },
            'POST /rain/cards': { status: 'terms-required', isUsResident: false },
        },
    },
    'card-holder': {
        route: '/card',
        about: 'Existing holder keeps card management even when new issuance is prohibited for their residence.',
        responses: {
            'GET /card': { isEligible: false, geoProhibited: true },
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('ready'),
        },
    },
    'card-verification-open': {
        capture: { expectSelector: '[data-testid="card-verification-continue"]' },
        route: '/card',
        about: 'Existing cardholder can complete a pending card verification while card controls remain available.',
        responses: {
            'GET /card': { isEligible: true, geoProhibited: false },
            'GET /rain/cards': {
                ...CARD_HOLDER_OVERVIEW,
                pendingVerification: {
                    kind: 'card_addon',
                    generation: 'capture-generation',
                    entryScope: 'a'.repeat(64),
                },
                verificationContext: { status: 'open', generation: 'capture-generation', entryScope: 'a'.repeat(64) },
            },
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('ready'),
        },
    },
    'card-verification-checking': {
        capture: { expectSelector: '[data-testid="your-card-screen"]' },
        route: '/card',
        about: 'Existing cardholder while a previously opened card verification is being checked.',
        responses: {
            'GET /card': { isEligible: true, geoProhibited: false },
            'GET /rain/cards': {
                ...CARD_HOLDER_OVERVIEW,
                verificationContext: {
                    status: 'checking',
                    generation: 'capture-generation',
                    entryScope: 'a'.repeat(64),
                },
            },
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('ready'),
        },
    },
    'card-verification-unavailable': {
        capture: { expectSelector: '[data-testid="your-card-screen"]' },
        route: '/card',
        about: 'Existing cardholder when the optional card verification status cannot be read.',
        responses: {
            'GET /card': { isEligible: true, geoProhibited: false },
            'GET /rain/cards': { ...CARD_HOLDER_OVERVIEW, verificationContext: { status: 'unavailable' } },
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('ready'),
        },
    },
    'card-holder-collateral': {
        route: '/card',
        about: 'Managed holder with the permission ready and card balance left from before: the collateral note offers Move card balance to wallet.',
        responses: {
            'GET /card': { isEligible: true, geoProhibited: false },
            'GET /rain/cards': { ...CARD_HOLDER_OVERVIEW, balance: CARD_HOLDER_COLLATERAL },
            'GET /rain/cards/funding/access': cardAccess('managed', false),
            'GET /rain/cards/funding': cardFunding('ready'),
        },
    },
    // Card balance on the existing card permission is what card payments use:
    // no note and no move, however much there is.
    'card-holder-collateral-legacy': {
        route: '/card',
        about: 'Holder on the existing card permission with card balance: the screen offers no note and no Move card balance to wallet.',
        responses: {
            'GET /card': { isEligible: true, geoProhibited: false },
            'GET /rain/cards': { ...LEGACY_CARD_OVERVIEW, balance: CARD_HOLDER_COLLATERAL },
            'GET /rain/cards/funding/access': cardAccess('legacy', false),
        },
    },
    // The funding authorization sits on the terms step, one tap in ("Get your
    // card") — e2e/flows/card-public.spec.ts takes that tap and shoots it.
    'card-reissue': {
        route: '/card',
        about: 'Approved holder with no card: the card terms end with one funding authorization.',
        responses: {
            'GET /card': { isEligible: true, geoProhibited: false },
            'GET /rain/cards': {
                status: {
                    hasApplication: true,
                    railStatus: 'ENABLED',
                    contractAddress: '0x2222222222222222222222222222222222222222',
                    coordinatorAddress: '0x3333333333333333333333333333333333333333',
                },
                balance: null,
                cards: [],
            },
            'POST /rain/cards': { status: 'terms-required', isUsResident: false },
            // eligible for managed funding, not accepted yet: the managed terms
            'GET /rain/cards/funding/access': cardAccess('legacy', true),
        },
    },
    'card-reissue-legacy': {
        route: '/card',
        about: 'Approved holder with no card on the existing card permission: the production card terms, with no funding authorization.',
        responses: {
            'GET /card': { isEligible: true, geoProhibited: false },
            'GET /rain/cards': {
                status: {
                    hasApplication: true,
                    railStatus: 'ENABLED',
                    contractAddress: '0x2222222222222222222222222222222222222222',
                    coordinatorAddress: '0x3333333333333333333333333333333333333333',
                },
                balance: null,
                cards: [],
            },
            'POST /rain/cards': { status: 'terms-required', isUsResident: false },
            'GET /rain/cards/funding/access': cardAccess('legacy', false),
        },
    },
    // The Home prompt is today's centered modal for an existing cardholder.
    // Nothing can be signed in a fixture, so Continue's outcome is not shot.
    'card-funding-needed': {
        route: '/home',
        about: 'Managed cardholder whose funding permission is missing: the centered Home prompt with one unchecked authorization.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('required'),
        },
        waitFor: '[data-testid="card-funding-consent"]',
    },
    // Before acceptance the funding read is withheld (`enrollment_required`)
    // and carries no retirement payload.
    'card-funding-enrollment': {
        route: '/home',
        about: 'Cardholder eligible for managed funding who has not accepted yet: the same prompt with one unchecked authorization, nothing retired.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('legacy', true),
            'GET /rain/cards/funding': {
                ...cardFunding('temporarily_unavailable'),
                management: { status: 'temporarily_unavailable', reason: 'enrollment_required', migration: null },
            },
        },
        waitFor: '[data-testid="card-funding-consent"]',
    },
    'card-funding-legacy': {
        route: '/home',
        about: 'Cardholder on the existing card permission that managed funding is not open to: the production permission prompt, no funding authorization.',
        responses: {
            'GET /rain/cards': LEGACY_CARD_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('legacy', false),
        },
    },
    'card-funding-migration': {
        route: '/home',
        about: 'Managed cardholder with a legacy grant to retire: the card payments update prompt.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('migration_required', {
                uninstall: [{ validationId: `0x02${'ab'.repeat(20)}`, deinitData: '0x1234' }],
                invalidateNonceFloor: 3,
            }),
        },
        waitFor: '[data-testid="card-funding-consent"]',
    },
    // Card balance from before goes back to the wallet once the update is
    // confirmed: the update prompt names the amount.
    'card-funding-return': {
        route: '/home',
        about: 'Existing cardholder with card balance and a legacy grant: the card payments update prompt names the amount.',
        responses: {
            'GET /rain/cards': {
                ...CARD_HOLDER_OVERVIEW,
                balance: CARD_HOLDER_COLLATERAL,
                cards: [{ ...CARD_HOLDER_OVERVIEW.cards[0], hasWithdrawApproval: true }],
            },
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('migration_required', {
                uninstall: [{ validationId: `0x02${'ab'.repeat(20)}`, deinitData: '0x1234' }],
                invalidateNonceFloor: 3,
            }),
        },
        waitFor: '[data-testid="card-funding-consent"]',
    },
    'card-funding-withdrawal-in-flight': {
        route: '/home',
        about: 'Existing cardholder with a legacy grant while a card withdrawal still confirms: the same prompt waits, then offers Check status and Skip.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', false),
            'GET /rain/cards/funding': {
                ...cardFunding('temporarily_unavailable'),
                management: { status: 'temporarily_unavailable', reason: 'withdrawal_in_flight', migration: null },
            },
        },
        waitFor: '[data-testid="modal-head"]',
    },
    'card-funding-pending': {
        route: '/home',
        about: 'Existing cardholder whose grant is accepted but not confirmed: a disabled Working… button, then Check status and Skip once the wait window passes.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', false),
            'GET /rain/cards/funding': cardFunding('pending'),
        },
        waitFor: '[data-testid="modal-head"]',
    },
    'card-funding-enabled': {
        route: '/home',
        about: 'Existing cardholder with the permission ready: Home shows no prompt, whatever the allowance is.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', false),
            'GET /rain/cards/funding': cardFunding('ready'),
        },
    },
    'card-funding-unavailable': {
        route: '/home',
        about: 'Existing cardholder whose permission stands but refills are paused: Home never asks for a grant.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('temporarily_unavailable'),
        },
    },
    'card-funding-error': {
        route: '/home',
        about: 'Managed cardholder whose funding state cannot be read: fails closed, Home shows no prompt.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', true),
        },
        fails: ['GET /rain/cards/funding'],
    },
    'card-funding-access-error': {
        route: '/home',
        about: 'Existing cardholder whose funding decision cannot be read: fails closed, Home shows neither permission prompt.',
        responses: {
            'GET /rain/cards': LEGACY_CARD_OVERVIEW,
            'GET /rain/cards/funding': cardFunding('required'),
        },
        fails: ['GET /rain/cards/funding/access'],
    },
    'card-cancel': {
        route: '/card',
        about: 'Existing cardholder on Card settings, to check that cancelling offers no permission-removal step.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('ready'),
        },
    },
    // A card lock or cancel is a wallet-wide stop of managed payments. The card is done at once; whether
    // the wallet stop is confirmed comes from the funding read. One fixture per visible state, static data.
    'card-cancel-stop-pending': {
        route: '/card',
        about: 'Cardholder whose cancel answers "stop in progress": Card canceled, then payments stopping, and the card page banner.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardStopFunding('card_canceled', 'pending'),
            'POST /rain/cards/fixture-card/cancel': {
                status: 'CANCELED',
                fundingStop: { state: 'pending', reason: 'card_canceled' },
            },
        },
    },
    'card-lock-stop-confirmed': {
        route: '/card',
        about: 'Cardholder whose lock is followed by a funding read confirming the wallet stop: "payments stopped".',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', false),
            'GET /rain/cards/funding': cardStopFunding('card_locked', 'confirmed'),
            'POST /rain/cards/fixture-card/lock': {
                status: 'LOCKED',
                fundingStop: { state: 'pending', reason: 'card_locked' },
            },
        },
    },
    'card-lock-stop-unavailable': {
        route: '/card',
        about: 'Cardholder whose lock cannot stop wallet payments (permission unusable): asks for support, never says stopped.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', false),
            'GET /rain/cards/funding': cardStopFunding('card_locked', 'unavailable'),
            'POST /rain/cards/fixture-card/lock': {
                status: 'LOCKED',
                fundingStop: { state: 'unavailable', reason: 'scope_retired' },
            },
        },
    },
    // What a lock or cancel left in the card. The balance on screen reads zero, as it does while the
    // provider holds it back, so nothing is signed and the backend's answer alone decides the copy.
    'card-lock-balance-left': {
        route: '/card',
        about: 'Cardholder whose freeze could not move the card balance: Card frozen, with the amount still in the card and what is reserved for pending payments.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('ready'),
            'POST /rain/cards/fixture-card/lock': {
                status: 'LOCKED',
                fundingStop: { state: 'not_applicable', reason: null },
                collateralReturn: {
                    state: 'waiting',
                    returnedCents: 0,
                    remainingCents: 2000,
                    heldCents: 550,
                    cardCreditCents: 0,
                    retryAfterSec: 420,
                },
            },
        },
    },
    'card-cancel-return-blocked': {
        route: '/card',
        about: 'Cardholder whose cancel waits for the card balance: a countdown in place of the backend sentence, and the slide is held.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('ready'),
        },
        rejects: {
            'POST /rain/cards/fixture-card/cancel': {
                status: 409,
                body: {
                    error: 'Your card balance cannot be returned yet. Try again in 3 minutes.',
                    code: 'CARD_RETURN_BLOCKED',
                    retryAfterSec: 150,
                },
            },
        },
    },
    'card-cancel-credit-left': {
        route: '/card',
        about: 'Cardholder whose cancel leaves a pending payment hold and refund credit: Card canceled, with both named.',
        responses: {
            'GET /rain/cards': CARD_HOLDER_OVERVIEW,
            'GET /rain/cards/funding/access': cardAccess('managed', true),
            'GET /rain/cards/funding': cardFunding('ready'),
            'POST /rain/cards/fixture-card/cancel': {
                status: 'CANCELED',
                fundingStop: { state: 'not_applicable', reason: null },
                collateralReturn: {
                    state: 'returned',
                    returnedCents: 2000,
                    remainingCents: 0,
                    heldCents: 550,
                    cardCreditCents: 1234,
                },
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
        isLoadingState: true,
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
    // Hazards — user text and numbers that break layouts.
    // ---------------------------------------------------------------------
    'hugo-long-username': {
        route: '/settings',
        about: `Hugo's case: the ${LONG_USERNAME.length}-character username "${LONG_USERNAME}" in the header and the share-link pill.`,
        responses: {
            'GET /users/me': { user: { username: LONG_USERNAME, fullName: LONG_USERNAME, showFullName: false } },
            'GET /points': RICH_POINTS,
            'GET /points/invites': INVITES_ONE,
        },
    },
    'long-full-name': {
        route: '/settings',
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
                unavailable: [],
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
    'history-wire-withdrawal': {
        route: '/history',
        about: 'A USD wire withdrawal: its receipt shows the wire fee and what the bank received.',
        responses: { 'GET /users/history': { entries: [WIRE_WITHDRAWAL_ENTRY], hasMore: false } },
    },
    // a bank deposit still on its way keeps the bank wording; a Pix one reads "Adding by Pix"
    'history-bank-deposit-pending': {
        route: '/history?tx=fixture-pending-eur-deposit',
        about: 'A SEPA deposit still on its way: the receipt reads "Adding from bank account".',
        responses: {
            'GET /users/history': { entries: [PENDING_EUR_DEPOSIT_ENTRY], hasMore: false },
            'GET /history/fixture-pending-eur-deposit': PENDING_EUR_DEPOSIT_ENTRY,
        },
    },
    'history-expired-ars-deposit': {
        route: '/history?tx=fixture-expired-ars-deposit',
        about: 'An expired ARS deposit order: the receipt names the expired order.',
        responses: {
            'GET /users/history': { entries: [EXPIRED_ARS_DEPOSIT_ENTRY], hasMore: false },
            'GET /history/fixture-expired-ars-deposit': EXPIRED_ARS_DEPOSIT_ENTRY,
        },
    },
    ...Object.fromEntries(
        (['name_mismatch', 'too_many_recent'] as const).map((reason) => {
            const id = `fixture-returned-deposit-${reason.replaceAll('_', '-')}`
            const entry = {
                ...EXPIRED_ARS_DEPOSIT_ENTRY,
                uuid: id,
                status: 'REFUNDED',
                extraData: { kind: 'ONRAMP', provider: 'BRIDGE', usdAmount: '10', returnReason: { code: reason } },
            }
            return [
                `history-returned-deposit-${reason.replaceAll('_', '-')}`,
                {
                    route: `/history?tx=${id}`,
                    about: `Returned deposit receipt: ${reason.replaceAll('_', ' ')} reason.`,
                    responses: {
                        'GET /users/history': { entries: [entry], hasMore: false },
                        [`GET /history/${id}`]: entry,
                    },
                },
            ]
        })
    ),
    'history-receipt-attachment': {
        route: '/history',
        about: 'A completed request payment with an attachment. Open its receipt to check download states.',
        waitFor: '[data-testid="transaction-card"]',
        responses: {
            'GET /users/history': { entries: [RECEIPT_ATTACHMENT_ENTRY], hasMore: false },
        },
    },
    'history-receipt-no-attachment': {
        route: '/history',
        about: 'The same completed request payment without an attachment. Open its receipt to check the missing row.',
        waitFor: '[data-testid="transaction-card"]',
        responses: {
            'GET /users/history': {
                entries: [{ ...RECEIPT_ATTACHMENT_ENTRY, attachmentUrl: null }],
                hasMore: false,
            },
        },
    },
    'history-bank-paid-request': {
        route: '/history',
        about: 'A request paid by bank deposit a few cents short in USD. Reads Completed, nothing remaining.',
        waitFor: '[data-testid="transaction-card"]',
        responses: {
            'GET /users/history': { entries: [BANK_PAID_REQUEST_ENTRY], hasMore: false },
            'GET /history/fixture-bank-paid-request': BANK_PAID_REQUEST_ENTRY,
        },
    },
    'history-request-pot-partial': {
        route: '/history?tx=fixture-request-pot-partial',
        about: 'A €88 request part paid: one contribution arrived short of its charge. Rows show what each paid; Close request asks first.',
        responses: {
            'GET /users/history': { entries: [PARTIAL_POT_ENTRY], hasMore: false },
            'GET /history/fixture-request-pot-partial': PARTIAL_POT_ENTRY,
        },
    },
    'history-request-pot-closed-short': {
        route: '/history?tx=fixture-request-pot-closed-short',
        about: 'The same request closed by the requester with $25.51 unpaid: neutral Closed badge, "not paid".',
        responses: {
            'GET /users/history': { entries: [CLOSED_SHORT_POT_ENTRY], hasMore: false },
            'GET /history/fixture-request-pot-closed-short': CLOSED_SHORT_POT_ENTRY,
        },
    },
    'history-request-bank-details': {
        route: '/history?tx=fixture-bank-request',
        about: 'A pending request that accepts bank transfer: its receipt shows the payment reference and the bank details.',
        responses: {
            'GET /users/history': { entries: [PENDING_BANK_REQUEST_ENTRY], hasMore: false },
            'GET /history/fixture-bank-request': PENDING_BANK_REQUEST_ENTRY,
            'GET /requests/fixture-bank-request/deposit-instructions': {
                depositAccount: DEPOSIT_ACCOUNT_EUR,
                paymentReference: 'demo-req',
                payerAmount: REQUEST_PAY_EUR,
            },
        },
    },
    'history-receipt-public-link': {
        route: '/history?tx=fixture-public-receipt-send',
        about: 'A P2P send with a public receipt: Share receipt sends the link, the PDF is under More actions.',
        responses: {
            'GET /users/history': { entries: [PUBLIC_RECEIPT_SEND_ENTRY], hasMore: false },
            'GET /history/fixture-public-receipt-send': PUBLIC_RECEIPT_SEND_ENTRY,
        },
    },
    'history-qr-pay-public-link': {
        route: '/history?tx=fixture-public-receipt-qr-pay',
        about: 'A QR payment with a public receipt: Share receipt sends the link, Split this bill is under More actions.',
        responses: {
            'GET /users/history': { entries: [PUBLIC_RECEIPT_QR_PAY_ENTRY], hasMore: false },
            'GET /history/fixture-public-receipt-qr-pay': PUBLIC_RECEIPT_QR_PAY_ENTRY,
        },
    },
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
        route: '/profile/accounts',
        about: 'ID check never started: no region unlocked, all four locked.',
        responses: {
            'GET /users/me': {
                identityVerification: { status: 'not_started' },
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            },
        },
    },
    'identity-awaiting-upload': {
        route: '/profile/accounts',
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
        route: '/profile/accounts',
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
    'identity-document-missing': {
        route: '/add-money/argentina/manteca',
        about: 'Approved with no identity document on file: the ARS top-up asks for an ID and a selfie and restarts the identity check, while the pool rail still pays.',
        responses: {
            'GET /users/me': {
                // the AR residence keeps the residence gate out of the way
                residence: { declared: 'AR', verified: 'AR', pending: null, declaredSecond: null },
                // what api#1776 answers for a marked approval: the identity asks
                // for a document, the rails keep their status, and the restart
                // is a top-level action attached to no rail
                identityVerification: {
                    status: 'action_required',
                    actionMessage: 'We need an identity document and a selfie to complete your verification.',
                    reviewPending: false,
                    submittedAt: null,
                    reviewedAt: '2026-07-20T10:00:00.000Z',
                },
                capabilities: {
                    rails: [
                        {
                            id: 'manteca.bank_transfer_ar',
                            provider: 'manteca',
                            method: 'BANK_TRANSFER_AR',
                            channel: 'bank',
                            country: 'AR',
                            currency: 'ARS',
                            status: 'enabled',
                            operations: { deposit: 'requires-info', withdraw: 'requires-info', pay: 'enabled' },
                        },
                    ],
                    nextActions: [
                        { key: 'restart-identity', kind: 'restart-identity', purpose: 'identity_document_missing' },
                    ],
                    restrictions: [],
                },
            },
        },
    },
    // TASK-20344: the provider refuses the ARS top-up for the account. Tap
    // Continue: the screen shows the refusal copy, not "Unexpected error".
    'add-money-provider-rejected': {
        route: '/add-money/argentina/manteca?step=inputAmount&amount=10000&currency=ARS',
        about: 'ARS top-up the provider refuses (PROVIDER_REJECTED): Continue shows the refusal copy.',
        responses: {
            'GET /users/me': {
                residence: { declared: 'AR', verified: 'AR', pending: null, declaredSecond: null },
                capabilities: MANTECA_AR_CAPABILITIES,
            },
        },
        rejects: {
            'POST /manteca/deposit': {
                status: 422,
                body: {
                    error: 'Unexpected error',
                    message: 'Failed to create price lock: User needs extra doc.',
                    code: 'PROVIDER_REJECTED',
                },
            },
        },
    },
    // TASK-24909: it used to ask for "a clearer photo of your ID".
    'add-money-bank-provider-ask-unknown': {
        route: '/add-money/germany/bank?step=verify',
        about: 'The API asks for something the app has no step for, with no message: the document request says only that more information is needed.',
        responses: {
            'GET /users/me': {
                capabilities: {
                    rails: BRIDGE_BANK_RAILS.map((rail) => ({ ...rail, status: 'requires-info' })),
                    nextActions: [],
                    restrictions: [],
                    features: {
                        qr: { state: 'on' },
                        card: { state: 'ready' },
                        local: { state: 'ready', accounts: {} },
                        bank: {
                            state: 'action_required',
                            accounts: {
                                USD: { state: 'action_required' },
                                EUR: { state: 'action_required' },
                                GBP: { state: 'action_required' },
                                MXN: { state: 'action_required' },
                            },
                        },
                    },
                },
                identityVerification: { status: 'verified' },
                residence: { declared: 'DE', verified: 'DE', pending: null, declaredSecond: null },
            },
        },
    },
    'kyc-action-required': {
        route: '/profile/accounts',
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

    'bank-proof-of-address-supplement': {
        route: '/profile/accounts',
        about: 'Identity approved with bank accounts ticked: Bridge waits for a proof of address, collected on its supplement action after the identity.',
        responses: {
            'GET /users/me': {
                // what api#1816 answers right after the approval: the rail is
                // parked REQUIREMENTS_MISSING and names supplement:bridge
                capabilities: {
                    rails: [
                        {
                            id: 'bridge.sepa_eu',
                            provider: 'bridge',
                            method: 'SEPA_EU',
                            channel: 'bank',
                            country: 'EU',
                            currency: 'EUR',
                            status: 'blocked',
                            reason: {
                                code: 'requirements_missing',
                                userMessage: 'We need one more document to finish setting this up.',
                            },
                            blockingActions: ['supplement:bridge'],
                            resolved: {
                                status: 'fixable',
                                blocking: {
                                    code: 'requirements_missing',
                                    userMessage: 'We need one more document to finish setting this up.',
                                    selfHealable: true,
                                    selfHealKind: 'document-resubmit',
                                },
                                nextAction: {
                                    key: 'supplement:bridge',
                                    kind: 'sumsub',
                                    purpose: 'requirements_missing',
                                },
                            },
                        },
                    ],
                    nextActions: [{ key: 'supplement:bridge', kind: 'sumsub', purpose: 'requirements_missing' }],
                    restrictions: [],
                },
            },
        },
    },

    reconsent: {
        capture: { expectSelector: '[data-testid="reconsent-documents"]' },
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
        capture: { requiresSource: 'src/components/Avatar/AvatarPicker.tsx' },
        route: AVATAR_PICKER_PATH,
        about: 'Avatar picker open: one 3x3 screen on every phone, the initial first, a Bug Whisperer avatar guaranteed, beetle selected, the die last.',
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

    [DOWNLOAD_PROMPT_FIXTURE]: {
        route: '/home',
        about: 'The web "The Peanut app is here" prompt over home; every other fixture hides it.',
    },

    'early-user': {
        capture: { expectSelector: '[data-testid="early-user-content"]' },
        route: '/home',
        about: 'Early-user reward drawer over home, opened by the user flag.',
        responses: {
            'GET /users/me': { showEarlyUserModal: true },
            // the announcement waits for a quiet third session; the server's policy lets a capture's first one open it
            'GET /users/me/attention': {
                catalogueVersion: ATTENTION_POLICY.catalogueVersion,
                settings: ATTENTION_POLICY.settings,
                catalogue: ATTENTION_POLICY.catalogue.map((row) =>
                    row.id === 'early-user' ? { ...row, tier: 1, rank: 0, policy: { interrupt: 'always' } } : row
                ),
            },
        },
    },

    // Arrival prompt (TASK-23251). The app must resolve a country first (the
    // edge, else ipapi); with none it makes no call and shows nothing.
    'arrival-qr-ar': {
        route: '/home',
        about: 'Arrival drawer over home: in Argentina, pay a Mercado Pago QR.',
        geoCountry: 'AR',
        waitFor: '[role="dialog"] img[src$="/flags/ar.svg"]',
        responses: { 'POST /users/me/arrival': { prompt: 'qr_ar' } },
    },
    'arrival-pix-br': {
        route: '/home',
        about: 'Arrival drawer over home: in Brazil, pay a Pix QR.',
        geoCountry: 'BR',
        waitFor: '[role="dialog"] img[src$="/flags/br.svg"]',
        responses: { 'POST /users/me/arrival': { prompt: 'pix_br' } },
    },
    'arrival-card': {
        route: '/home',
        about: 'Arrival drawer over home: abroad with an active card.',
        responses: { 'POST /users/me/arrival': { prompt: 'card' } },
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
    'profile-details': {
        route: '/settings/details',
        about: 'Profile details for a verified Portuguese resident: the name and answers read live from Sumsub, the address and tax number kept only there.',
        responses: {
            'GET /users/me': PROFILE_ACCOUNTS_MIX['GET /users/me'],
            'GET /users/kyc/details': {
                name: { first: 'Ana', last: 'Teste' },
                nationality: 'PT',
                idNationality: 'PT',
                document: { country: 'PRT', type: 'PASSPORT' },
                address: {
                    street: 'Rua de Teste',
                    buildingNumber: '10',
                    postCode: '1000-001',
                    town: 'Lisboa',
                    country: 'PT',
                },
                taxId: '000000000',
                stored: {
                    dateOfBirth: '1990-05-14',
                    countryOfBirth: 'PT',
                    cityOfBirth: 'Lisboa',
                    phone: '+351912345678',
                    occupation: 'software_developer_applications',
                    employmentStatus: 'employed',
                    annualSalary: '25k_50k',
                    expectedMonthlyVolume: '1k_5k',
                    cardPurpose: 'personal_spending',
                    sourceOfFunds: 'salary',
                },
            },
        },
    },
    'profile-accounts': {
        route: '/profile/accounts',
        about: 'Accounts page, a Portuguese resident: EUR held; in the fold USD opens, GBP is not offered where they live, MXN could not be checked (no verdict), COP needs verification.',
        responses: PROFILE_ACCOUNTS_MIX,
    },
    'profile-accounts-no-residence': {
        route: '/profile/accounts',
        about: 'The same mix with no residence set: GBP asks for a residence instead.',
        responses: {
            ...PROFILE_ACCOUNTS_MIX,
            'GET /users/me': {
                ...PROFILE_ACCOUNTS_MIX['GET /users/me'],
                residence: { declared: null, verified: null, pending: null, declaredSecond: null },
            },
        },
    },
    'profile-accounts-two-held': {
        route: '/profile/accounts',
        about: 'Accounts page: euro and peso accounts held under a raised limit of three, the fold closing the card.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': {
                depositAccounts: [DEPOSIT_ACCOUNT_EUR, DEPOSIT_ACCOUNT_MXN],
                accountLimit: 3,
            },
        },
    },
    'profile-accounts-at-limit': {
        route: '/profile/accounts',
        about: 'Accounts page at the limit: two of two held; the fold stays, and every row in it says the limit is reached.',
        responses: {
            'GET /users/me': PROFILE_ACCOUNTS_MIX['GET /users/me'],
            'GET /users/deposit-accounts': {
                depositAccounts: [DEPOSIT_ACCOUNT_EUR, DEPOSIT_ACCOUNT_MXN],
                claimable: [{ ...CLAIMABLE_USD_PREVIEW, blockedBy: 'account-limit' }],
                accountLimit: 2,
            },
        },
    },
    'profile-accounts-none-held': {
        route: '/profile/accounts',
        about: 'Accounts page with no account held: every account to open listed, nothing folded.',
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [] } },
    },
    'profile-accounts-review-causes': {
        route: '/profile/accounts',
        about: 'A verified user whose own review holds EUR (action), USD (under review) and MXN (support); GBP is not open yet. No residence on file, and nothing asks for one.',
        responses: REVIEW_CAUSE_RESPONSE,
    },
    'profile-accounts-provider-reviewing': {
        route: '/profile/accounts',
        about: 'Bridge reviews the customer: every Bridge account reads "Under review", and a tap opens the wait drawer (TASK-24909).',
        responses: BRIDGE_REVIEW_RESPONSE,
    },
    // Tap "Review terms", Continue, then post `{ signedAgreementId }` from the frame.
    'profile-accounts-terms-unconfirmed': {
        route: '/profile/accounts',
        about: 'Bridge has the signature, the account still asks for terms: the step says "Terms sent" and offers no new page (TASK-24909).',
        responses: bridgeTermsResponse({ accepted: true }),
    },
    'profile-accounts-terms-confirm-failed': {
        route: '/profile/accounts',
        about: 'The terms confirm request fails: the step says so and offers a retry (TASK-24909).',
        responses: bridgeTermsResponse({ accepted: false }),
        fails: ['POST /users/bridge-tos-confirm'],
    },
    'profile-accounts-provider-asks': {
        route: '/profile/accounts',
        about: 'A verified user whose payment partner asks for one more thing for EUR ("Action needed"), has answered for USD ("Under review"), and still has COP waiting on the ID ("Verify").',
        responses: PROVIDER_ASK_RESPONSE,
    },
    'profile-accounts-residence-restricted': {
        route: '/profile/accounts',
        about: 'A resident of a country barred from banking: every account says so, with no support and no "or not yet".',
        responses: {
            'GET /users/me': {
                capabilities: VA_READY_CAPABILITIES,
                depositAccounts: { enabled: true },
                residence: { declared: 'CN', verified: 'CN', pending: null, declaredSecond: null },
                residenceRestrictions: { banking: true, card: true },
            },
            'GET /users/deposit-accounts': {
                depositAccounts: [],
                claimable: [],
                unavailable: [
                    withheldCorridor('ACH_US', 'US', 'USD', 'not-offered', 'residence-restricted'),
                    withheldCorridor('SEPA_EU', 'EU', 'EUR', 'not-offered', 'residence-restricted'),
                    withheldCorridor('FASTER_PAYMENTS_GB', 'GB', 'GBP', 'not-offered', 'residence-restricted'),
                    withheldCorridor('SPEI_MX', 'MX', 'MXN', 'not-offered', 'residence-restricted'),
                    withheldCorridor('BANK_TRANSFER_CO', 'CO', 'COP', 'not-offered', 'residence-restricted'),
                ],
            },
        },
    },
    'profile-accounts-address-required': {
        route: '/profile/accounts',
        about: 'A verified user with no approved residence: USD, EUR, GBP and MXN say "Action needed" and ask for the home address; COP opens as usual.',
        responses: addressStepResponse('required'),
    },
    'add-money-ars-address-required': {
        route: '/add-money/argentina/manteca',
        about: 'An ARS user needs the home address before making a local deposit.',
        responses: addressStepResponse('required'),
    },
    'add-money-address-in-review': {
        route: '/add-money?method=bank',
        about: 'Add money while the home address is with our verification partner: the four accounts say "Under review".',
        responses: addressStepResponse('in_review'),
    },
    'get-paid-address-required': {
        route: '/add-money?method=bank&step=claim&corridor=ACH_US',
        about: 'The USD row of a user with no approved residence: one step for the home address, never "Not available".',
        responses: addressStepResponse('required'),
    },
    'get-paid-address-retry': {
        route: '/add-money?method=bank&step=claim&corridor=SEPA_EU',
        about: 'The EUR row after the address was not accepted: send it again.',
        responses: addressStepResponse('rejected'),
    },
    'get-paid-address-in-review': {
        route: '/add-money?method=bank&step=claim&corridor=ACH_US',
        about: 'The USD row while the address is checked: nothing to do, the page updates by itself.',
        responses: addressStepResponse('in_review'),
    },
    'get-paid-review-action': {
        route: '/add-money?method=bank&step=claim&corridor=SEPA_EU',
        about: 'The EUR row of a user whose own review waits on them: the extra check, never "Verify identity first".',
        responses: REVIEW_CAUSE_RESPONSE,
    },
    'profile-payments': {
        route: '/profile/payments',
        about: 'Payments page: residence, the card and QR payments, then the Peanut rows.',
        responses: VA_READY_RESPONSE,
    },
    'profile-accounts-br-resident': {
        views: [
            {
                id: 'profile-brazil-qr-details',
                name: 'Brazilian resident — Argentina QR payments remain available',
                flow: 'Payments',
                route: '/profile/payments',
                clickTestIds: ['method-row-qr-pay'],
                expectSelector: '[role="dialog"][data-state="open"] [data-testid="payment-method-details-title"]',
            },
        ],
        route: '/profile/accounts',
        about: "Accounts page, a Brazilian resident whose Pix deposit route is Avenia's: no BRL row, Pix leads Home's Add money drawer instead (Aleks, 2026-11-12 and 2026-11-14).",
        responses: {
            'GET /users/me': {
                residence: {
                    verified: { country: 'BR', status: 'VERIFIED', updatedAt: null },
                    declared: null,
                    secondaryDeclaredCountry: null,
                },
                capabilities: { routes: [...aveniaRoutes('enabled'), pixPayRoute('refused')] },
            },
        },
    },
    'profile-accounts-br-pix-refused': {
        views: [
            {
                id: 'profile-brazil-bank-details',
                name: "Brazilian resident — BRL row closed by its refused Pix route, the drawer says the route's reason",
                flow: 'Payments',
                route: '/profile/accounts',
                clickTestIds: ['bank-row-brl'],
                // the open drawer's own title; a bare [role="dialog"] can match a hidden one first
                expectSelector: '[role="dialog"][data-state="open"] [data-testid="closed-row-title"]',
            },
        ],
        route: '/profile/accounts',
        about: "Accounts page, a Brazilian resident whose Pix deposit route is refused: the BRL row stays, closed, and its drawer says the route's reason.",
        responses: (() => {
            const refused = aveniaRouteResponses({
                provider: null,
                state: 'refused',
                reason: { code: 'provider_unavailable', userMessage: 'This is not available right now.' },
            })
            // A resident of Brazil outside Avenia's QR gate: the pay route refuses the residence
            // (API-CONTRACT-M4 §1), so the closed BRL row is not turned into the Pix key send.
            return {
                'GET /users/me': {
                    ...refused['GET /users/me'],
                    capabilities: {
                        ...refused['GET /users/me'].capabilities,
                        routes: [...refused['GET /users/me'].capabilities.routes, pixPayRoute('refused')],
                    },
                },
            }
        })(),
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
    'bank-account-verify-drawer': {
        route: '/add-money?method=bank&step=claim&corridor=SEPA_EU&returnTo=%2Fprofile%2Faccounts',
        about: 'Bank account Verify: the currency drawer keeps the Bank account list behind it, without Add money search or discovery.',
        waitFor: '[data-testid="corridor-gate-drawer"][data-state="open"]',
        responses: {
            'GET /users/deposit-accounts': { depositAccounts: [] },
            'GET /users/me': {
                identityVerification: { status: 'not_started' },
                capabilities: BLOCKED_BANK_CAPABILITIES,
                depositAccounts: { enabled: true },
            },
        },
    },
    'get-paid-usd-closed-bangladesh': {
        route: '/add-money?method=bank',
        about: 'An unverified Bangladesh resident: the paperwork engine refuses USD, so USD reads Not available while EUR, GBP and MXN still ask for the ID.',
        responses: PAPERWORK_BANGLADESH_RESPONSE,
    },
    'get-paid-usd-closed-bangladesh-claim': {
        route: '/add-money?method=bank&step=claim&corridor=ACH_US',
        about: 'A link straight to the USD claim for a Bangladesh resident: the drawer says USD is not available where they live, with no ID check offered.',
        responses: PAPERWORK_BANGLADESH_RESPONSE,
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
    'get-paid-claim-cop': {
        route: '/add-money?method=bank&step=claim&corridor=BANK_TRANSFER_CO',
        about: 'The same step on the Bre-B peso corridor: a business may pay, other people not yet, with a floor.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': { depositAccounts: [], claimable: [CLAIMABLE_COP] },
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
        capture: { expectSelector: OPEN_DIALOG },
        route: '/home?drawer=send',
        about: 'The Send drawer — send to friends, or withdraw to own accounts.',
    },
    'home-add-drawer': {
        capture: { expectSelector: HOME_ADD_DRAWER_CHECKPOINT },
        route: '/home?drawer=add',
        about: 'Returning user with a usable EUR account and a completed peer payment.',
        responses: {
            ...PROFILE_ACCOUNTS_MIX,
            'GET /users/me': {
                ...PROFILE_ACCOUNTS_MIX['GET /users/me'],
                user: { firstPaymentAt: '2026-09-15T00:00:00Z' },
            },
        },
    },
    'add-money-picker-first-time': {
        capture: { expectSelector: '[data-testid="add-money-method-crypto"]' },
        route: '/add-money',
        balance: '0',
        about: 'First-time Add money picker for a resident of Portugal, with Crypto available before identity verification, and no Pix row (the owner, 15 Nov).',
        responses: {
            'GET /users/me': {
                user: { activationMilestone: 'registered', isActivated: false, firstPaymentAt: null },
                identityVerification: { status: 'not_started' },
                capabilities: BLOCKED_BANK_CAPABILITIES,
                depositAccounts: { enabled: true },
                residence: { declared: { country: 'PT' }, verified: null },
            },
            'GET /users/deposit-accounts': { depositAccounts: [], claimable: [] },
        },
    },
    'add-money-picker-pix': {
        route: '/add-money',
        about: 'The Add picker for a resident of Brazil on Avenia: Pix leads, as on the Home drawer (the owner, 15 Nov).',
        responses: aveniaResponses('enabled'),
    },
    'home-add-drawer-pix': {
        capture: { expectSelector: '[role="dialog"][data-state="open"] [data-testid="home-drawer-add-pix"]' },
        route: '/home?drawer=add',
        about: 'The Add drawer for a resident of Brazil on Avenia: Pix leads, bank transfer next, crypto last (Aleks, 2026-11-12 and 2026-11-14).',
        responses: {
            ...aveniaResponses('enabled'),
            'GET /users/me': {
                ...aveniaResponses('enabled')['GET /users/me'],
                user: { fullName: 'Ana Souza', firstPaymentAt: '2026-09-15T00:00:00Z' },
            },
        },
    },
    // The owner, 24 Nov (TASK-25350): ARS leads both Add lists for a resident of Argentina.
    'add-money-picker-ars': {
        capture: { expectSelector: '[data-testid="add-money-method-ars"]' },
        route: '/add-money',
        geoCountry: 'AR',
        about: 'The Add picker for a resident of Argentina: ARS leads and opens the peso top-up directly (the owner, 24 Nov).',
        responses: { 'GET /users/me': { ...ARS_TOP_UP_RESIDENT, user: { fullName: 'Lucía Gómez' } } },
    },
    'home-add-drawer-ars': {
        capture: { expectSelector: '[role="dialog"][data-state="open"] [data-testid="home-drawer-add-ars"]' },
        route: '/home?drawer=add',
        geoCountry: 'AR',
        about: 'The Add drawer for a returning resident of Argentina: ARS leads, bank accounts next, then crypto and more ways (the owner, 24 Nov).',
        responses: {
            'GET /users/me': {
                ...ARS_TOP_UP_RESIDENT,
                user: { fullName: 'Lucía Gómez', firstPaymentAt: '2026-09-15T00:00:00Z' },
            },
        },
    },
    'home-add-drawer-pix-paused': {
        capture: { expectSelector: OPEN_DIALOG },
        route: '/home?drawer=add',
        about: 'The Add drawer for a returning resident of Brazil under the Brazil pause: no Pix row; bank accounts, crypto and more ways (the owner, 15 Nov).',
        responses: {
            'GET /users/me': {
                ...aveniaResponses('first-use')['GET /users/me'],
                user: { fullName: 'Ana Souza', firstPaymentAt: '2026-09-15T00:00:00Z' },
                capabilities: {
                    rails: [],
                    nextActions: [],
                    restrictions: [],
                    routes: (['deposit', 'withdraw'] as const).map((operation) => ({
                        operation,
                        method: 'PIX_BR',
                        provider: null,
                        state: 'paused',
                        reason: {
                            code: 'residence_paused',
                            userMessage: 'Deposits and withdrawals are paused where you live for now.',
                        },
                        candidates: [],
                    })),
                },
            },
        },
    },
    'add-money-options-account-none': {
        route: '/add-money/options?method=account',
        about: "Bank accounts from Home's Add drawer for a user who holds none: the accounts they can open (the owner, 15 Nov).",
        responses: { ...VA_READY_RESPONSE, 'GET /users/deposit-accounts': { depositAccounts: [] } },
    },
    'home-request-drawer': {
        capture: { expectSelector: OPEN_DIALOG },
        route: '/home?drawer=request',
        about: 'The Request drawer — share a request link, or share standing bank details.',
    },

    // ---------------------------------------------------------------------
    // Home onboarding checklist (TASK-23054): Create account · Verify identity ·
    // Add money · First payment, until the first payment.
    // ---------------------------------------------------------------------
    'home-new-user': {
        route: '/home',
        balance: '0',
        about: 'New user, card offered: ID check not started, nothing received, the first payment offers QR or card (any country).',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /users/me': {
                user: { badges: [], activationMilestone: 'registered', isActivated: false, firstPaymentAt: null },
                identityVerification: { status: 'not_started' },
                capabilities: BLOCKED_BANK_CAPABILITIES,
            },
        },
    },
    'home-verify-processing': {
        route: '/home',
        balance: '0',
        about: 'ID check in review: the verify row shows an In review pill, Add money is next.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /users/me': {
                user: { badges: [], activationMilestone: 'registered', isActivated: false, firstPaymentAt: null },
                identityVerification: { status: 'processing' },
                capabilities: BLOCKED_BANK_CAPABILITIES,
            },
        },
    },
    'home-verified-unfunded': {
        route: '/home',
        balance: '0',
        about: 'Home for a verified user with no money received yet (API milestone verified).',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /users/me': {
                user: {
                    badges: [],
                    activationMilestone: 'verified',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
                identityVerification: { status: 'verified' },
            },
        },
    },
    'home-verified-unfunded-no-card': {
        route: '/home',
        balance: '0',
        about: 'Verified, $0, card not offered for the residence: the first payment is QR only.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /card': { isEligible: false, geoProhibited: true },
            'GET /users/me': {
                user: {
                    badges: [],
                    activationMilestone: 'verified',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
                identityVerification: { status: 'verified' },
            },
        },
    },
    'home-verified-crypto-dust': {
        route: '/home',
        balance: '0.17',
        about: 'Verified, $0.17 arrived by crypto and the ledger has not booked it yet (milestone verified): Add money is done.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /users/me': {
                user: {
                    badges: [],
                    activationMilestone: 'verified',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
                identityVerification: { status: 'verified' },
            },
        },
    },
    'home-money-before-verify': {
        route: '/home',
        balance: '20',
        about: 'Money received before the ID check (milestone funded, not verified): Add money is done, Verify identity is next.',
        responses: {
            'GET /users/me': {
                user: { activationMilestone: 'funded', isActivated: false, firstPaymentAt: null },
                identityVerification: { status: 'not_started' },
                capabilities: BLOCKED_BANK_CAPABILITIES,
            },
        },
    },
    'home-funded': {
        route: '/home',
        balance: '50',
        about: 'Verified, funded by a bank top-up, card and Pix QR open: the first payment is next and opens the chooser.',
        responses: {
            'GET /users/me': {
                user: {
                    activationMilestone: 'funded',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
                capabilities: {
                    rails: [
                        {
                            id: 'manteca.pix_br',
                            provider: 'manteca',
                            method: 'PIX_BR',
                            channel: 'bank',
                            country: 'BR',
                            currency: 'BRL',
                            status: 'enabled',
                            operations: { deposit: 'enabled', withdraw: 'enabled', pay: 'enabled' },
                        },
                    ],
                    nextActions: [],
                    restrictions: [],
                },
            },
        },
    },
    'home-funded-qr': {
        route: '/home',
        balance: '50',
        about: 'Funded, no card for the residence, Pix QR pay open: the first payment opens the QR scanner.',
        responses: {
            'GET /card': { isEligible: false, geoProhibited: true },
            'GET /users/me': {
                user: {
                    activationMilestone: 'funded',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
                capabilities: {
                    rails: [
                        {
                            id: 'manteca.pix_br',
                            provider: 'manteca',
                            method: 'PIX_BR',
                            channel: 'bank',
                            country: 'BR',
                            currency: 'BRL',
                            status: 'enabled',
                            operations: { deposit: 'enabled', withdraw: 'enabled', pay: 'enabled' },
                        },
                    ],
                    nextActions: [],
                    restrictions: [],
                },
            },
        },
    },
    'home-qr-blocked-unfunded': {
        route: '/home',
        balance: '0',
        about: 'Verified, $0, no card, QR pay blocked, bank rail working: three rows, Add money next.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /card': { isEligible: false, geoProhibited: true },
            'GET /users/me': {
                user: {
                    badges: [],
                    activationMilestone: 'verified',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
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
                        QR_PAY_BLOCKED_RAIL,
                    ],
                    nextActions: [],
                    restrictions: [],
                },
            },
        },
    },
    // Stuck states (TASK-23054): the ones a user can sit in for days.
    'home-verify-processing-long': {
        route: '/home',
        balance: '0',
        about: 'ID check in review for two weeks: the verify row keeps saying In review, Add money stays open.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /users/me': {
                user: { badges: [], activationMilestone: 'registered', isActivated: false, firstPaymentAt: null },
                identityVerification: { status: 'processing', submittedAt: '2026-09-11T10:00:00Z' },
                capabilities: BLOCKED_BANK_CAPABILITIES,
            },
        },
    },
    'home-card-application-pending': {
        route: '/home',
        balance: '40',
        about: 'Verified, funded, card application in review: the payment row says to pay with the card or a QR.',
        responses: {
            'GET /rain/cards': { status: { hasApplication: true, railStatus: 'PENDING' }, cards: [], balance: null },
            'GET /users/me': {
                user: {
                    activationMilestone: 'funded',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
                capabilities: {
                    rails: [
                        {
                            id: 'rain.card_rain',
                            provider: 'rain',
                            method: 'CARD_RAIN',
                            channel: 'card',
                            country: 'GLOBAL',
                            currency: 'USD',
                            status: 'pending',
                        },
                        {
                            id: 'manteca.pix_br',
                            provider: 'manteca',
                            method: 'PIX_BR',
                            channel: 'bank',
                            country: 'BR',
                            currency: 'BRL',
                            status: 'enabled',
                            operations: { deposit: 'requires-info', withdraw: 'requires-info', pay: 'enabled' },
                        },
                    ],
                    nextActions: [],
                    restrictions: [],
                },
            },
        },
    },
    'home-card-info-failed': {
        route: '/home',
        balance: '40',
        about: 'Verified and funded, but card eligibility failed to load: the payment row falls back to the QR answer.',
        fails: ['GET /card'],
        waitFor: '[data-testid="checklist-first-payment"]',
        responses: {
            'GET /users/me': {
                user: {
                    activationMilestone: 'funded',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
            },
        },
    },
    'home-money-in-out-only': {
        route: '/home',
        balance: '12',
        about: 'Verified, money in and out (sends, withdrawals), no card or QR spend yet: the Hide link shows.',
        responses: {
            'GET /users/me': {
                user: {
                    activationMilestone: 'funded',
                    isActivated: false,
                    firstPaymentAt: '2026-09-15T00:00:00Z',
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
            },
        },
    },
    'home-funded-no-spend-path': {
        route: '/home',
        balance: '50',
        about: 'Verified, funded, no card, QR pay blocked: three rows, all done, so the carousel shows.',
        responses: {
            'GET /card': { isEligible: false, geoProhibited: true },
            'GET /users/me': {
                user: {
                    activationMilestone: 'funded',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
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
                        QR_PAY_BLOCKED_RAIL,
                    ],
                    nextActions: [],
                    restrictions: [],
                },
            },
        },
    },
    'home-collateral-only': {
        route: '/home',
        balance: '0',
        about: 'Card holder whose only money is card collateral (wallet 0, milestone verified): Add money is done.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /rain/cards': {
                status: { hasApplication: true, railStatus: 'ENABLED' },
                balance: { spendingPower: 2500, inTransitToCollateralCents: 0 },
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
            'GET /users/me': {
                user: {
                    badges: [],
                    activationMilestone: 'verified',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
                identityVerification: { status: 'verified' },
                // the holder's card rail: the payment row says to pay with the card
                capabilities: {
                    rails: [
                        {
                            id: 'rain.card_rain',
                            provider: 'rain',
                            method: 'CARD_RAIN',
                            channel: 'card',
                            country: 'GLOBAL',
                            currency: 'USD',
                            status: 'enabled',
                            operations: { pay: 'enabled' },
                        },
                        {
                            id: 'manteca.pix_br',
                            provider: 'manteca',
                            method: 'PIX_BR',
                            channel: 'bank',
                            country: 'BR',
                            currency: 'BRL',
                            status: 'enabled',
                            operations: { deposit: 'requires-info', withdraw: 'requires-info', pay: 'enabled' },
                        },
                    ],
                    nextActions: [],
                    restrictions: [],
                },
            },
        },
    },
    'home-provider-rejection': {
        route: '/home',
        balance: '0',
        about: 'Verified, but the bank partner declined: the verification-issue card replaces the checklist.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /card': { isEligible: false, geoProhibited: true },
            'GET /users/me': {
                user: {
                    badges: [],
                    activationMilestone: 'verified',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
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
                            status: 'blocked',
                            reason: {
                                code: 'provider_rejected',
                                userMessage: 'The bank partner declined the application.',
                            },
                        },
                    ],
                    nextActions: [],
                    restrictions: [],
                },
            },
        },
    },
    'home-region-restricted': {
        route: '/home',
        balance: '0',
        about: 'ID check ended on a restricted region: the region card replaces the checklist.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /users/me': {
                user: { badges: [], activationMilestone: 'registered', isActivated: false, firstPaymentAt: null },
                identityVerification: { status: 'failed', reason: { code: 'identity_region_restricted' } },
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            },
        },
    },
    'home-identity-final-rejected': {
        route: '/home',
        balance: '0',
        about: 'ID check ended on a final decision (not region), no rail works: the verification-issue card replaces the checklist.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /users/me': {
                user: { badges: [], activationMilestone: 'registered', isActivated: false, firstPaymentAt: null },
                identityVerification: {
                    status: 'failed',
                    canRetry: false,
                    rejectLabels: ['FORGERY'],
                    reviewedAt: '2026-09-20T10:00:00Z',
                },
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            },
        },
    },
    'home-identity-action-required': {
        route: '/home',
        balance: '0',
        about: 'ID check needs a new document: the Verify row says Action needed and opens the status drawer with Resubmit.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /users/me': {
                user: { badges: [], activationMilestone: 'registered', isActivated: false, firstPaymentAt: null },
                identityVerification: {
                    status: 'action_required',
                    actionMessage: 'We need a bit more to verify your identity. Please resubmit your documents.',
                    rejectLabels: ['BAD_PROOF_OF_IDENTITY'],
                    rejectType: 'RETRY',
                },
                capabilities: BLOCKED_BANK_CAPABILITIES,
            },
        },
    },
    'home-transacting-without-id-check': {
        route: '/home',
        balance: '20',
        about: 'Moves money on a bank rail a partner verified before the one ID check: the Verify row counts as done.',
        responses: {
            'GET /users/me': {
                user: {
                    activationMilestone: 'funded',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
                identityVerification: { status: 'not_started' },
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
                    ],
                    nextActions: [],
                    restrictions: [],
                },
            },
        },
    },
    'home-card-application-rejected': {
        route: '/home',
        balance: '40',
        about: 'Verified, funded, card application rejected: the payment row offers QR only, not the card.',
        responses: {
            'GET /rain/cards': { status: { hasApplication: true, railStatus: 'REJECTED' }, cards: [], balance: null },
            'GET /users/me': {
                user: {
                    activationMilestone: 'funded',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
                identityVerification: { status: 'verified' },
                capabilities: {
                    rails: [
                        {
                            id: 'rain.card_rain',
                            provider: 'rain',
                            method: 'CARD_RAIN',
                            channel: 'card',
                            country: 'GLOBAL',
                            currency: 'USD',
                            status: 'blocked',
                            operations: { pay: 'blocked' },
                            reason: { code: 'card_rejected', userMessage: 'The card issuer declined the application.' },
                        },
                        {
                            id: 'manteca.pix_br',
                            provider: 'manteca',
                            method: 'PIX_BR',
                            channel: 'bank',
                            country: 'BR',
                            currency: 'BRL',
                            status: 'enabled',
                            operations: { deposit: 'requires-info', withdraw: 'requires-info', pay: 'enabled' },
                        },
                    ],
                    nextActions: [],
                    restrictions: [],
                },
            },
        },
    },
    'home-banking-restricted-resident': {
        route: '/home',
        balance: '0',
        about: 'Unverified, residence closed to bank rails but open to the card: the Verify row opens /card.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /users/me': {
                user: { badges: [], activationMilestone: 'registered', isActivated: false, firstPaymentAt: null },
                identityVerification: { status: 'not_started' },
                residence: { declared: 'JP', verified: null, pending: null, declaredSecond: null },
                residenceRestrictions: { banking: true, card: false },
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            },
        },
    },
    'home-fully-restricted-resident': {
        route: '/home',
        balance: '0',
        about: 'Unverified, residence closed to bank rails and the card: the checklist shows, and Verify starts the QR ID check.',
        responses: {
            ...NO_TIMELINE_EXTRAS,
            'GET /card': { isEligible: false, geoProhibited: true },
            'GET /users/me': {
                user: { badges: [], activationMilestone: 'registered', isActivated: false, firstPaymentAt: null },
                identityVerification: { status: 'not_started' },
                residence: { declared: 'CN', verified: null, pending: null, declaredSecond: null },
                residenceRestrictions: { banking: true, card: true },
                capabilities: { rails: [], nextActions: [], restrictions: [] },
            },
        },
    },
    'home-activated': {
        route: '/home',
        balance: '50',
        about: 'Activated (first card or QR spend done): the carousel replaces the checklist.',
        responses: {
            'GET /users/me': {
                user: {
                    activationMilestone: 'activated',
                    isActivated: true,
                    activatedAt: '2026-09-10T00:00:00Z',
                    firstPaymentAt: '2026-09-10T00:00:00Z',
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
            },
        },
    },
    'request-with-bank-alternative': {
        route: '/request',
        about: 'Asking one person for one amount, with the standing-details alternative named below it.',
        // The alternative sits under the keypad, below the fold on a small phone.
        fullPage: true,
    },
    'request-created-bank-details': {
        // Tap Create request: demo-api creates every request as `demo-request`.
        route: '/request?amount=50',
        about: 'A new request that accepts bank transfer: the created screen shows the payment reference and the bank details.',
        responses: {
            ...VA_READY_RESPONSE,
            'GET /users/deposit-accounts': { depositAccounts: [DEPOSIT_ACCOUNT_EUR] },
            'GET /requests/demo-request/deposit-instructions': {
                depositAccount: DEPOSIT_ACCOUNT_EUR,
                paymentReference: 'demo-req',
                payerAmount: REQUEST_PAY_EUR,
            },
        },
    },
    'request-pay-open-amount': {
        // The override keys on this charge id, so the route names it.
        route: '/pay-request?chargeId=demo-open-charge',
        about: 'Paying a request sent with no amount: the requestee types one before paying (TASK-22123).',
        responses: {
            'GET /request-charges/demo-open-charge': {
                transactionType: 'REQUEST',
                tokenAmount: null,
                currencyAmount: null,
                openAmount: true,
                requestLink: {
                    recipientAddress: '0x00000000000000000000000000000000000a11ce',
                    recipientAccount: {
                        userId: 'demo-alice',
                        identifier: '0x00000000000000000000000000000000000a11ce',
                        user: { username: 'alice' },
                    },
                },
            },
        },
    },
    // TASK-23850: a request is paid in USDC or USDT only. A link that asks for
    // ETH is refused and says why; it is never paid in USDC instead. Opened
    // through /send?recipient=, the route a native app and a scan use.
    'pay-request-eth-link': {
        route: '/send?recipient=0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed%40base%2F0.1eth',
        about: 'A request link that asks for ETH: refused, requests are paid in USDC or USDT only.',
    },
    // An ETH request made before TASK-23850, opened by its charge id, which
    // skips the URL parser: it can't be paid anymore and never opens Confirm.
    'pay-request-eth-charge': {
        route: '/pay-request?chargeId=demo-eth-charge',
        about: "An ETH request opened by its charge id: it can't be paid anymore (TASK-23850).",
        responses: {
            'GET /request-charges/demo-eth-charge': {
                transactionType: 'REQUEST',
                chainId: '8453',
                tokenAddress: '0x0000000000000000000000000000000000000000',
                tokenSymbol: 'ETH',
                tokenDecimals: 18,
                tokenType: 'native',
                tokenAmount: '0.01',
                currencyAmount: '25',
                requestLink: { recipientAddress: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed' },
            },
        },
    },
    // Tap Token: the request payment offers USDC and USDT, never ETH (TASK-23850).
    // Cross-chain send is on here: its kill switch (on by default) locks the
    // picker to USDC on Arbitrum.
    'pay-request-address-tokens': {
        route: '/send?recipient=0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        about: 'Paying a request to an address: the token picker offers USDC and USDT, not ETH.',
        responses: { 'GET /config/kill-switches': { disableXchainSend: false } },
    },
    'pay-request-pot-partial-success': {
        // The pay screen of a part-paid €88 pot. Tap External wallet: about
        // 15 s later the deposit poll answers completed and the charge reads
        // back 33 USDC booked of $58.51, so the deposit card states what
        // arrived and what is still needed.
        route: '/pay-request?id=demo-request',
        about: 'Paying a part-paid pot from an external wallet when the deposit arrives short (tap External wallet, wait ~15 s).',
        responses: {
            'GET /requests/demo-request': PAYER_POT_REQUEST,
            'GET /requests/demo-request/pay-amounts': {
                requestCurrency: 'EUR',
                requestAmount: '88.00',
                remainingAmount: '51.93',
                rails: [{ kind: 'peanut_balance', payerAmount: { ...REQUEST_PAY_USD, amount: '58.51' } }],
            },
            // demo-api names every new charge at random; the read-back below keys on this one
            'POST /charges': { data: { id: 'fixture-partial-charge' } },
            'GET /request-charges/fixture-partial-charge': {
                tokenAmount: '58.51',
                currencyAmount: '58.51',
                transactionType: 'REQUEST',
                status: 'COMPLETED',
                settledAmount: '33',
                partialPayment: true,
                requestLink: { uuid: 'demo-request' },
            },
            'GET /rhino/status/0xdec0debad1dec0debad1dec0debad1dec0debad1': { status: 'completed', amount: 33 },
        },
        // The card then clears the address status to watch for the rest. The
        // status above always answers completed, so the clear has to fail here
        // or the card would read the same deposit again every few seconds.
        fails: ['POST /rhino/reset-status/0xdec0debad1dec0debad1dec0debad1dec0debad1'],
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

    ...PAPERWORK_VERIFICATION_FIXTURES,
    ...KYC_FEATURE_ACTIVATION_FIXTURES,
    // The local account refused because the residence's Pix comes from its route (M5): under the ARS title the
    // line names the residence, not Pix (a Brazil resident on the Argentina page).
    'feature-activation-local-served-elsewhere': {
        ...KYC_FEATURE_ACTIVATION_FIXTURES['feature-activation-local-refused'],
        about: 'First use local on the ARS page: refused because the Pix route serves the residence (local_served_elsewhere): the line names the residence.',
        responses: {
            ...KYC_FEATURE_ACTIVATION_FIXTURES['feature-activation-local-refused'].responses,
            'POST /users/kyc/features/local/activate': { state: 'refused', reason: 'local_served_elsewhere' },
        },
    },
    // TASK-24968: Bridge refused the customer as a duplicate; the bank screens name it and offer support.
    'withdraw-bank-bridge-duplicate': {
        route: '/withdraw/us/bank',
        about: 'Verify-once user whose bank accounts Bridge refused as a duplicate customer: the reason, then support.',
        balance: '20',
        responses: { 'GET /users/me': BRIDGE_DUPLICATE_USER },
    },
    'paperwork-verification-verified-bank-refused': {
        route: '/verify',
        about: 'Approved, but Bridge refused the bank accounts as a duplicate customer: the verified screen says so.',
        responses: {
            ...PAPERWORK_VERIFICATION_FIXTURES['paperwork-verification-verified'].responses,
            'GET /users/me': BRIDGE_DUPLICATE_USER,
        },
    },
}
