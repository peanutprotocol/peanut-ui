// Verify-once screens (api#1816 contract). /verify reads the questions, the
// plan and the identity status; ?step=<id> opens any question step. The flow
// also needs the client flag: in a non-prod build set
// localStorage['kyc_verify_once'] = 'true' first.
//
// Dependency-free like registry.ts (Playwright loads it).

import type { Fixture } from './types'

// A slice of Rain's 843 titles: enough to search and to show the popular list.
const RAIN_TITLES = [
    'Accountants and Auditors',
    'Actors',
    'Architects, Except Landscape and Naval',
    'Chief Executives',
    'Customer Service Representatives',
    'Dental Hygienists',
    'Electricians',
    'Graphic Designers',
    'Lawyers',
    'Marketing Managers',
    'Other',
    'Registered Nurses',
    'Retail Salespersons',
    'Self-Employee',
    'Software Developers, Applications',
    'Student',
    'Taxi Drivers and Chauffeurs',
    'Teachers and Instructors, All Other',
    'Waiters and Waitresses',
    'Web Developers',
]

// A slice of Bridge's 569 titles (its own list, not Rain's): the bank-account job question.
const BRIDGE_TITLES = [
    'Accountant and auditor',
    'Actor',
    'Cashier',
    'Chief executive',
    'Customer service representative',
    'Dentist',
    'Electrician',
    'Graphic designer',
    'Lawyer',
    'Marketing manager',
    'Registered nurse',
    'Retail salesperson',
    'Software developer',
    'Taxi driver',
    'Waiter or waitress',
    'Web developer',
]
const MONTHLY_PAYMENTS = ['0_4999', '5000_9999', '10000_49999', '50000_plus']
const YES_NO = ['yes', 'no']

const choice = (key: string, options: string[], value: string | null = null) => ({
    key,
    kind: 'choice',
    required: true,
    options,
    value,
})

const CARD_PURPOSES = ['personal_spending', 'travel', 'online_shopping', 'bills', 'business_expenses']
const BANK_PURPOSES = [
    'charitable_donations',
    'ecommerce_retail_payments',
    'investment_purposes',
    'operating_a_company',
    'payments_to_friends_or_family_abroad',
    'personal_or_living_expenses',
    'protect_wealth',
    'purchase_goods_and_services',
    'receive_payment_for_freelancing',
    'receive_salary',
]
const SALARIES = ['under_25k', '25k_50k', '50k_100k', '100k_200k', 'over_200k']
const VOLUMES = ['under_1k', '1k_5k', '5k_10k', 'over_10k']
const EMPLOYMENT = ['employed', 'homemaker', 'retired', 'self_employed', 'student', 'unemployed']
const SOURCES = [
    'company_funds',
    'ecommerce_reseller',
    'gambling_proceeds',
    'gifts',
    'government_benefits',
    'inheritance',
    'investments_loans',
    'pension_retirement',
    'salary',
    'sale_of_assets_real_estate',
    'savings',
    'someone_elses_funds',
]

const address = (residence: string, cardFeature: boolean) => ({
    id: 'address',
    features: ['base'],
    answered: false,
    fields: [
        { key: 'street', kind: 'text', required: true, value: null },
        { key: 'buildingNumber', kind: 'text', required: false, value: null },
        { key: 'town', kind: 'text', required: true, value: null },
        { key: 'state', kind: 'text', required: cardFeature, value: null },
        { key: 'postCode', kind: 'text', required: true, value: null },
        { key: 'country', kind: 'country', required: true, locked: true, value: residence },
    ],
})

/** A US remote earner who picked bank + card at signup: SSN, no Bridge extras. */
const US_STEPS = [
    { id: 'purpose', features: ['card'], answered: false, fields: [choice('cardPurpose', CARD_PURPOSES)] },
    {
        id: 'work',
        features: ['card'],
        answered: false,
        fields: [{ key: 'occupation', kind: 'occupation', required: true, options: RAIN_TITLES, value: null }],
    },
    {
        id: 'money',
        features: ['card'],
        answered: false,
        fields: [choice('annualSalary', SALARIES), choice('expectedMonthlyVolume', VOLUMES)],
    },
    {
        id: 'birth',
        features: ['base'],
        answered: false,
        fields: [{ key: 'countryOfBirth', kind: 'country', required: true, value: null }],
    },
    address('US', true),
    {
        id: 'phone',
        features: ['card'],
        answered: false,
        fields: [{ key: 'phone', kind: 'phone', required: true, value: null }],
    },
    {
        id: 'tax',
        features: ['base'],
        answered: false,
        fields: [{ key: 'taxId', kind: 'taxId', required: true, format: 'ssn', value: null }],
    },
]

/** A Philippine resident (Bridge high risk) with bank + card: the most answers per screen. */
const PH_STEPS = [
    {
        id: 'purpose',
        features: ['card', 'bank'],
        answered: false,
        fields: [choice('cardPurpose', CARD_PURPOSES), choice('bankPurpose', BANK_PURPOSES)],
    },
    {
        id: 'work',
        features: ['card', 'bank'],
        answered: false,
        fields: [
            { key: 'occupation', kind: 'occupation', required: true, options: RAIN_TITLES, value: null },
            choice('employmentStatus', EMPLOYMENT),
            { key: 'bankOccupation', kind: 'occupation', required: true, options: BRIDGE_TITLES, value: null },
        ],
    },
    {
        id: 'money',
        features: ['card', 'bank'],
        answered: false,
        fields: [
            choice('annualSalary', SALARIES, '25k_50k'),
            choice('expectedMonthlyVolume', VOLUMES, '1k_5k'),
            choice('sourceOfFunds', SOURCES, 'salary'),
            choice('bankMonthlyPayments', MONTHLY_PAYMENTS),
            choice('actingAsIntermediary', YES_NO),
        ],
    },
    {
        id: 'birth',
        features: ['base'],
        answered: false,
        fields: [{ key: 'countryOfBirth', kind: 'country', required: true, value: 'PH' }],
    },
    address('PH', true),
    {
        id: 'phone',
        features: ['card'],
        answered: false,
        fields: [{ key: 'phone', kind: 'phone', required: true, value: null }],
    },
    {
        id: 'tax',
        features: ['base'],
        answered: false,
        fields: [{ key: 'taxId', kind: 'taxId', required: true, format: null, value: null }],
    },
]

const answered = (steps: typeof US_STEPS) => steps.map((step) => ({ ...step, answered: true }))

const questions = (residence: string, steps: unknown[], firstUnanswered: string | null, attemptId = 'vo-attempt') => ({
    available: true,
    attemptId,
    residence,
    steps,
    firstUnanswered,
    progress: { done: 1, total: (steps as unknown[]).length + 2 },
})

const plan = (
    proofOfAddress: 'suggested' | null = null,
    features = { qr: true, bank: true, local: false, card: true }
) => ({
    available: true,
    activeAttemptId: 'vo-attempt',
    policyVersion: 'fixture-verify-once',
    flow: 'verify-once',
    proofOfAddress,
    features,
    routes: [
        {
            id: 'base',
            documents: [
                {
                    key: 'identity',
                    code: 'IDENTITY',
                    requiredBy: ['SUMSUB'],
                    types: ['PASSPORT', 'ID_CARD', 'DRIVERS', 'RESIDENCE_PERMIT'],
                    countries: ['US', 'PH', 'MX', 'IT', 'DE', 'ES', 'GB', 'AR', 'BR'],
                },
            ],
        },
    ],
})

const profile = (canonicalStatus: string) => ({
    identity: { verificationId: 'vo-identity', applicantId: null, canonicalStatus, status: 'pending' },
    attempts: [],
})

const asking = (residence: string, steps: unknown[]) => ({
    'GET /users/kyc/questions': questions(residence, steps, 'purpose'),
    'GET /users/kyc/plan': plan(),
    'GET /users/kyc/profile': profile('NOT_STARTED'),
})

export const VERIFY_ONCE_FIXTURES: Record<string, Fixture> = {
    'verify-once-us': {
        route: '/verify',
        about: 'Verify-once questions for a US resident with bank + card; open any step with ?step=work|money|birth|address|phone|tax.',
        responses: asking('US', US_STEPS),
    },
    'verify-once-ph': {
        route: '/verify',
        about: 'Verify-once questions for a Philippine resident (Bridge high risk) with bank + card: two job lists on work, five answers on money.',
        responses: asking('PH', PH_STEPS),
    },
    'verify-once-save-fails': {
        route: '/verify?step=tax',
        about: 'Continue on the tax step when the save answers 5xx: the retry message, the values kept in memory.',
        responses: asking('US', US_STEPS),
        fails: ['PUT /users/kyc/answers/tax'],
    },
    'verify-once-midpoint': {
        route: '/verify',
        about: 'Every question answered: the midpoint, picking the ID type and its issuing country.',
        responses: {
            'GET /users/kyc/questions': questions('US', answered(US_STEPS), null),
            'GET /users/kyc/plan': plan(),
            'GET /users/kyc/profile': profile('NOT_STARTED'),
        },
    },
    'verify-once-review': {
        route: '/verify',
        about: 'ID and selfie submitted: the review is running.',
        responses: {
            'GET /users/kyc/questions': questions('US', answered(US_STEPS), null),
            'GET /users/kyc/plan': plan(),
            'GET /users/kyc/profile': profile('IN_REVIEW'),
        },
    },
    'verify-once-verified': {
        route: '/verify',
        about: 'Approved: "You’re verified!", next stop Home and adding money.',
        responses: {
            'GET /users/kyc/questions': questions('US', answered(US_STEPS), null),
            'GET /users/kyc/plan': plan(),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
    'verify-once-proof-of-address': {
        route: '/verify',
        about: 'Rule 1: approved with an ID from another country than the residence and a bank account picked.',
        responses: {
            'GET /users/kyc/questions': questions('MX', answered(US_STEPS), null),
            'GET /users/kyc/plan': plan('suggested'),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
    'verify-once-add-card': {
        route: '/verify?feature=card',
        about: 'Add-later: a verified user adds the card; one screen with every card answer still missing.',
        responses: {
            'GET /users/kyc/questions': questions(
                'US',
                US_STEPS.filter((step) => step.features.includes('card')),
                'purpose'
            ),
            'GET /users/kyc/plan': plan(null, { qr: true, bank: true, local: false, card: false }),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
    'verify-once-add-bank': {
        route: '/verify?feature=bank',
        about: 'Add-later: a verified Philippine resident adds the bank account; Bridge’s six answers on one screen.',
        responses: {
            'GET /users/kyc/questions': questions(
                'PH',
                [
                    {
                        id: 'purpose',
                        features: ['bank'],
                        answered: false,
                        fields: [choice('bankPurpose', BANK_PURPOSES)],
                    },
                    {
                        id: 'work',
                        features: ['bank'],
                        answered: false,
                        fields: [
                            choice('employmentStatus', EMPLOYMENT),
                            {
                                key: 'bankOccupation',
                                kind: 'occupation',
                                required: true,
                                options: BRIDGE_TITLES,
                                value: null,
                            },
                        ],
                    },
                    {
                        id: 'money',
                        features: ['bank'],
                        answered: false,
                        fields: [
                            choice('sourceOfFunds', SOURCES),
                            choice('bankMonthlyPayments', MONTHLY_PAYMENTS),
                            choice('actingAsIntermediary', YES_NO),
                        ],
                    },
                ],
                'purpose'
            ),
            'GET /users/kyc/plan': plan(null, { qr: true, bank: false, local: false, card: true }),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
}
