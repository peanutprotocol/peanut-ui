// Smart Paperwork Verification screens (api#1816 contract). /verify reads the questions, the
// plan and the identity status; ?step=<id> opens any question step.
//
// Dependency-free like registry.ts (Playwright loads it).

import type { Fixture } from './types'

// A slice of the 858 Peanut job codes (one list for Rain and Bridge): enough to search and to show the popular list.
const OCCUPATIONS = [
    'accountant_and_auditor',
    'actor',
    'architect',
    'cashier',
    'chief_executive',
    'customer_service_representative',
    'dental_hygienist',
    'electrician',
    'graphic_designer',
    'lawyer',
    'marketing_manager',
    'registered_nurse',
    'retail_salesperson',
    'software_developer_applications',
    'student',
    'taxi_driver',
    'waiter_or_waitress',
    'web_developer',
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
        fields: [{ key: 'occupation', kind: 'occupation', required: true, options: OCCUPATIONS, value: null }],
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
            { key: 'occupation', kind: 'occupation', required: true, options: OCCUPATIONS, value: null },
            choice('employmentStatus', EMPLOYMENT),
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

const toggle = (key: string, value: string | null = null) => ({ key, kind: 'toggle', required: true, value })
const MARITAL = ['single', 'married', 'divorced', 'widowed']

/** A German resident with bank + card: Bridge's EEA citizenship on top of the card's answers. */
const DE_STEPS = [
    {
        id: 'purpose',
        features: ['card', 'bank'],
        answered: false,
        fields: [choice('cardPurpose', CARD_PURPOSES), choice('bankPurpose', BANK_PURPOSES)],
    },
    {
        id: 'work',
        features: ['card'],
        answered: false,
        fields: [{ key: 'occupation', kind: 'occupation', required: true, options: OCCUPATIONS, value: null }],
    },
    {
        id: 'money',
        features: ['card'],
        answered: false,
        fields: [choice('annualSalary', SALARIES), choice('expectedMonthlyVolume', VOLUMES)],
    },
    {
        id: 'birth',
        features: ['base', 'bank'],
        answered: false,
        fields: [
            { key: 'countryOfBirth', kind: 'country', required: true, value: 'DE' },
            { key: 'cityOfBirth', kind: 'place', required: true, countryField: 'countryOfBirth', value: null },
            { key: 'nationality', kind: 'country', required: true, value: null },
        ],
    },
    address('DE', true),
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

const MANTECA_BIRTH = {
    id: 'birth',
    features: ['base', 'local'],
    answered: false,
    fields: [choice('maritalStatus', MARITAL)],
}
const DECLARATIONS = {
    id: 'declarations',
    features: ['local'],
    answered: false,
    fields: [toggle('isFatca'), toggle('isPep'), toggle('isFep')],
}

/** An Argentine resident with local transfers + card: Manteca's answers (the declarations right after the card's taps, US question first, then marital status and CUIT; no job, which Manteca takes from the CUIT). */
const AR_STEPS = [
    { id: 'purpose', features: ['card'], answered: false, fields: [choice('cardPurpose', CARD_PURPOSES)] },
    {
        id: 'work',
        features: ['card'],
        answered: false,
        fields: [{ key: 'occupation', kind: 'occupation', required: true, options: OCCUPATIONS, value: null }],
    },
    {
        id: 'money',
        features: ['card'],
        answered: false,
        fields: [choice('annualSalary', SALARIES), choice('expectedMonthlyVolume', VOLUMES)],
    },
    DECLARATIONS,
    MANTECA_BIRTH,
    address('AR', true),
    {
        id: 'phone',
        features: ['card', 'local'],
        answered: false,
        fields: [{ key: 'phone', kind: 'phone', required: true, value: null }],
    },
    {
        id: 'tax',
        features: ['base', 'local'],
        answered: false,
        fields: [{ key: 'taxId', kind: 'taxId', required: true, format: 'cuit', value: null }],
    },
]

/** A Brazilian resident with local transfers + card: Manteca's table adds the sex on the ID beside the marital status. */
const BR_STEPS = AR_STEPS.map((step) => {
    if (step === MANTECA_BIRTH)
        return { ...step, fields: [choice('sex', ['female', 'male', 'other']), choice('maritalStatus', MARITAL)] }
    if (step === DECLARATIONS) return { ...step, fields: [toggle('isFatca'), toggle('isPep')] }
    if (step.id === 'address') return address('BR', true)
    if (step.id === 'tax')
        return { ...step, fields: [{ key: 'taxId', kind: 'taxId', required: true, format: 'cpf', value: null }] }
    return step
})

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
    policyVersion: 'fixture-paperwork-verification',
    flow: 'verify-once',
    proofOfAddress,
    proofOfAddressIdCountries: ['PH'],
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

export const PAPERWORK_VERIFICATION_FIXTURES: Record<string, Fixture> = {
    'paperwork-verification-de': {
        route: '/verify',
        about: 'Smart Paperwork Verification questions for a German resident with bank + card: Bridge’s EEA citizenship beside the country of birth.',
        responses: {
            ...asking('DE', DE_STEPS),
            'POST /users/kyc/places/search': {
                places: [
                    { name: 'Munich', region: 'Bavaria' },
                    { name: 'Münster', region: 'North Rhine-Westphalia' },
                    { name: 'Mülheim', region: 'North Rhine-Westphalia' },
                ],
            },
        },
    },
    'paperwork-verification-ar': {
        route: '/verify',
        about: 'Smart Paperwork Verification questions for an Argentine resident with local transfers + card: Manteca’s marital status, declarations and CUIT.',
        responses: asking('AR', AR_STEPS),
    },
    'paperwork-verification-br': {
        route: '/verify?step=birth',
        about: 'Smart Paperwork Verification questions for a Brazilian resident with local transfers + card: the sex on the ID and the marital status.',
        responses: asking('BR', BR_STEPS),
    },
    'paperwork-verification-add-local': {
        route: '/verify?feature=local',
        about: 'Add-later: a verified Argentine resident adds local transfers; Manteca’s missing answers on one screen.',
        responses: {
            'GET /users/kyc/questions': questions('AR', [DECLARATIONS, MANTECA_BIRTH], 'declarations'),
            'GET /users/kyc/plan': plan(null, { qr: true, bank: false, local: false, card: true }),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
    'paperwork-verification-us': {
        route: '/verify',
        about: 'Smart Paperwork Verification questions for a US resident with bank + card; open any step with ?step=work|money|birth|address|tax (the phone shares the address screen).',
        responses: asking('US', US_STEPS),
    },
    'paperwork-verification-ph': {
        route: '/verify',
        about: 'Smart Paperwork Verification questions for a Philippine resident (Bridge high risk) with bank + card: two job lists on work, five answers on money.',
        responses: asking('PH', PH_STEPS),
    },
    'paperwork-verification-save-fails': {
        route: '/verify?step=tax',
        about: 'Continue on the tax step when the save answers 5xx: the retry message, the values kept in memory.',
        responses: asking('US', US_STEPS),
        fails: ['PUT /users/kyc/answers/tax'],
    },
    'paperwork-verification-midpoint': {
        route: '/verify',
        about: 'Every question answered: the midpoint, picking the ID type and its issuing country.',
        responses: {
            'GET /users/kyc/questions': questions('US', answered(US_STEPS), null),
            'GET /users/kyc/plan': plan(),
            'GET /users/kyc/profile': profile('NOT_STARTED'),
        },
    },
    'paperwork-verification-review': {
        route: '/verify',
        about: 'ID and selfie submitted: the review is running.',
        responses: {
            'GET /users/kyc/questions': questions('US', answered(US_STEPS), null),
            'GET /users/kyc/plan': plan(),
            'GET /users/kyc/profile': profile('IN_REVIEW'),
        },
    },
    'paperwork-verification-verified': {
        route: '/verify',
        about: 'Approved: "You’re verified!", next stop Home and adding money.',
        responses: {
            'GET /users/kyc/questions': questions('US', answered(US_STEPS), null),
            'GET /users/kyc/plan': plan(),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
    'paperwork-verification-proof-of-address': {
        route: '/verify',
        about: 'Rule 1: approved with an ID from another country than the residence and a bank account picked.',
        responses: {
            'GET /users/kyc/questions': questions('MX', answered(US_STEPS), null),
            'GET /users/kyc/plan': plan('suggested'),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
    'paperwork-verification-add-card': {
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
    'paperwork-verification-add-bank': {
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
                                key: 'occupation',
                                kind: 'occupation',
                                required: true,
                                options: OCCUPATIONS,
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
