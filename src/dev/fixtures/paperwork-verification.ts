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
    'retired',
    'software_developer_applications',
    'student',
    'taxi_driver',
    'unemployed',
    'waiter_or_waitress',
    'web_developer',
]
const MONTHLY_PAYMENTS = ['0_4999', '5000_9999', '10000_49999', '50000_plus']
const YES_NO = ['yes', 'no']
const USPS_CODES =
    'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR GU VI AS MP'.split(
        ' '
    )

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

const ADD_BANK_MONEY = {
    id: 'money',
    features: ['bank'],
    answered: false,
    fields: [
        choice('sourceOfFunds', SOURCES),
        choice('bankMonthlyPayments', MONTHLY_PAYMENTS),
        choice('actingAsIntermediary', YES_NO),
    ],
}

const address = (residence: string, cardFeature: boolean) => ({
    id: 'address',
    features: ['base'],
    answered: false,
    fields: [
        { key: 'street', kind: 'text', required: true, value: null },
        { key: 'buildingNumber', kind: 'text', required: false, value: null },
        { key: 'town', kind: 'text', required: true, value: null },
        residence === 'US'
            ? { key: 'state', kind: 'choice', required: true, options: USPS_CODES, value: null }
            : { key: 'state', kind: 'text', required: cardFeature, value: null },
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
            {
                key: 'occupation',
                kind: 'occupation',
                required: true,
                options: OCCUPATIONS,
                value: null,
                everyStatus: true,
            },
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

/** A German resident with bank + card: the nationality and Bridge's EEA birth place on top of the card's answers. */
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

// An approved identity leaves no attempt open: the API names only a READY, COLLECTING or IN_REVIEW one.
const approvedPlan = (...args: Parameters<typeof plan>) => ({ ...plan(...args), activeAttemptId: null })

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
    ...Object.fromEntries(
        (
            [
                ['us-address', {}],
                [
                    'us-address-filled',
                    {
                        street: 'Valencia Street',
                        buildingNumber: '1450',
                        town: 'San Francisco',
                        state: 'CA',
                        postCode: '94110',
                    },
                ],
            ] as Array<[string, Record<string, string>]>
        ).map(([name, values]) => [
            `paperwork-verification-${name}`,
            {
                route: '/verify?step=address',
                about: `The US address screen${'state' in values ? ', filled in' : ''}: every field, with the state picked from every USPS state and territory code.`,
                responses: asking('US', [
                    (({ fields, ...step }) => ({
                        ...step,
                        fields: fields.map((field) => ({
                            ...field,
                            value: values[field.key] ?? field.value,
                        })),
                    }))(address('US', false)),
                ]),
            } satisfies Fixture,
        ])
    ),
    ...Object.fromEntries(
        [
            ['residence', 'residence_bank_restricted'],
            ['nationality', 'manteca_us_nationality_restricted'],
            ['tax', 'tax_id_required'],
            ['unknown', 'fixture_unknown_reason'],
        ].map(([category, reason]) => [
            `paperwork-verification-closed-${category}`,
            {
                route: '/verify?step=saved',
                about: `Answers saved: the closed local-transfer feature explains its ${category} reason.`,
                responses: {
                    ...asking('US', answered(US_STEPS)),
                    'GET /users/kyc/questions': {
                        ...questions('US', answered(US_STEPS), null),
                        closed: [{ feature: 'local', reason }],
                    },
                },
            } satisfies Fixture,
        ])
    ),
    'paperwork-verification-policy-hold': {
        route: '/verify',
        about: 'New-flow policy hold asks for another document and offers the replacement entry.',
        responses: {
            ...asking('US', answered(US_STEPS)),
            'GET /users/me': {
                identityVerification: {
                    oneShot: true,
                    status: 'action_required',
                    reason: { code: 'document_policy_hold' },
                    rejectLabels: ['DOCUMENT_POLICY_HOLD'],
                },
            },
            'GET /users/kyc/plan': { ...plan(), activeAttemptId: null },
            'GET /users/kyc/profile': {
                ...profile('ACTION_REQUIRED'),
                attempts: [
                    {
                        id: 'vo-attempt',
                        kind: 'IDENTITY',
                        verificationId: 'vo-identity',
                        status: 'ACTION_REQUIRED',
                        reasonCode: 'document_policy_hold',
                    },
                ],
            },
        },
    },
    'paperwork-verification-rejected': {
        route: '/verify',
        about: 'A rejected new-flow identity remains on the ordinary verification rejection screen.',
        responses: {
            ...asking('US', answered(US_STEPS)),
            'GET /users/me': { identityVerification: { oneShot: true, status: 'failed' } },
            'GET /users/kyc/profile': profile('REJECTED'),
        },
    },
    'paperwork-verification-rejected-not-document': {
        route: '/verify',
        about: 'A final non-document identity rejection explains the decision and directs the user to support.',
        responses: {
            ...asking('US', answered(US_STEPS)),
            'GET /users/me': {
                identityVerification: {
                    oneShot: true,
                    status: 'failed',
                    rejectType: 'FINAL',
                    rejectLabels: ['NOT_DOCUMENT'],
                },
            },
            'GET /users/kyc/profile': profile('REJECTED'),
        },
    },
    'paperwork-verification-ars-setting-up': {
        route: '/add-money/argentina/manteca',
        geoCountry: 'AR',
        about: 'A verified Argentine user waits while their ARS account is being set up.',
        isLoadingState: true,
        responses: {
            'GET /users/me': {
                identityVerification: { oneShot: true, status: 'verified' },
                capabilities: {
                    rails: [],
                    nextActions: [],
                    restrictions: [],
                    features: { local: { state: 'setting_up', accounts: { ARS: { state: 'setting_up' } } } },
                },
            },
        },
    },
    'paperwork-verification-py-postal-refused': {
        route: '/verify?step=address',
        geoCountry: 'PY',
        about: 'A Paraguayan address with an invalid postal code receives the six-digit correction on Continue.',
        responses: asking('PY', [
            {
                ...address('PY', false),
                fields: address('PY', false).fields.map((field) => ({
                    ...field,
                    value:
                        (
                            {
                                street: 'Calle Palma',
                                buildingNumber: '123',
                                town: 'Asuncion',
                                postCode: '12345',
                            } as Record<string, string>
                        )[field.key] ?? field.value,
                })),
            },
        ]),
        rejects: {
            'PUT /users/kyc/answers/address': { status: 422, body: { errors: { postCode: 'invalid_postal_code' } } },
        },
    },
    'paperwork-verification-py-bank-postal-support': {
        route: '/home',
        geoCountry: 'PY',
        balance: '0',
        about: 'A verified Paraguayan user is directed to support to correct their bank account postal code.',
        responses: {
            'GET /card': { isEligible: false, geoProhibited: true },
            'GET /users/me': {
                user: {
                    badges: [],
                    activationMilestone: 'verified',
                    isActivated: false,
                    firstPaymentAt: null,
                    activationCelebratedAt: '2026-09-01T00:00:00Z',
                },
                identityVerification: { oneShot: true, status: 'verified' },
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
                                code: 'invalid_bank_postal_code',
                                userMessage: 'The bank postal code needs correction.',
                            },
                        },
                    ],
                    nextActions: [],
                    restrictions: [],
                },
            },
        },
    },
    'paperwork-verification-outage': {
        route: '/verify',
        about: 'Verification outage: the shared API kill switch stops entry before any SDK opens.',
        responses: {
            ...asking('US', US_STEPS),
            'GET /config/kill-switches': { kycVerificationDown: true },
        },
    },
    'paperwork-verification-restart-foreign': {
        route: '/verify?step=id&restart=1',
        about: 'A Portuguese resident replacing their ID sees their declared German nationality on the document picker.',
        responses: {
            'GET /users/me': {
                identityVerification: { oneShot: true, status: 'action_required' },
                residence: { declared: 'PT', verified: 'PT', pending: null, declaredSecond: null },
            },
            'GET /users/kyc/details': {
                name: { first: null, last: null },
                nationality: 'DE',
                idNationality: 'DE',
                document: null,
                heldBySumsub: [],
            },
            'GET /users/kyc/plan': approvedPlan(),
            'GET /users/kyc/profile': {
                ...profile('ACTION_REQUIRED'),
                attempts: [
                    {
                        id: 'fixture-replacement',
                        kind: 'IDENTITY',
                        verificationId: 'vo-identity',
                        status: 'ACTION_REQUIRED',
                    },
                ],
            },
        },
    },
    'paperwork-verification-needs-signup': {
        route: '/verify',
        about: 'An older account with no residence and no payment plan: signup’s residence screen, then its payment plan, before the questions.',
        responses: {
            'GET /users/kyc/questions': { available: false, residence: null, needs: ['residence', 'features'] },
            'GET /users/kyc/plan': { ...plan(), activeAttemptId: null, needs: ['residence', 'features'] },
            'GET /users/kyc/profile': profile('NOT_STARTED'),
        },
    },
    'paperwork-verification-de': {
        route: '/verify',
        about: 'Smart Paperwork Verification questions for a German resident with bank + card: the nationality beside Bridge’s EEA country of birth.',
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
            'GET /users/kyc/plan': approvedPlan(null, { qr: true, bank: false, local: false, card: true }),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
    'paperwork-verification-us': {
        route: '/verify',
        about: 'Smart Paperwork Verification questions for a US resident with bank + card. Open a question page with ?step=work|money|birth|address|tax. The phone joins the address.',
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
        isLoadingState: true,
        waitFor: '[data-testid="verify-steps"][data-phase="review"] [aria-current="step"] .animate-spin',
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
            'GET /users/kyc/plan': approvedPlan(),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
    'paperwork-verification-verified-card-follow-up': {
        route: '/verify',
        about: 'Approved, and the card application then asks for a proof of address: the verified screen names it.',
        responses: {
            'GET /users/kyc/questions': questions('US', answered(US_STEPS), null),
            'GET /users/kyc/plan': approvedPlan(),
            'GET /users/kyc/profile': profile('APPROVED'),
            'GET /users/me': {
                identityVerification: { oneShot: true, status: 'verified' },
                capabilities: {
                    rails: [
                        {
                            id: 'rain.card_rain',
                            provider: 'rain',
                            method: 'CARD_RAIN',
                            channel: 'card',
                            country: 'GLOBAL',
                            currency: 'USD',
                            status: 'requires-info',
                            blockingActions: ['sumsub:proof_of_address'],
                        },
                    ],
                    nextActions: [
                        {
                            key: 'sumsub:proof_of_address',
                            kind: 'sumsub',
                            purpose: 'rain-card',
                            levelKey: 'proof_of_address',
                        },
                    ],
                    restrictions: [],
                    features: { card: { state: 'action_required', action: 'sumsub:proof_of_address' } },
                },
            },
        },
    },
    'paperwork-verification-proof-of-address': {
        route: '/verify',
        about: 'Rule 1: approved with an ID from another country than the residence and a bank account picked.',
        responses: {
            'GET /users/kyc/questions': questions('MX', answered(US_STEPS), null),
            'GET /users/kyc/plan': approvedPlan('suggested'),
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
            'GET /users/kyc/plan': approvedPlan(null, { qr: true, bank: true, local: false, card: false }),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
    'paperwork-verification-add-bank': {
        route: '/verify?feature=bank',
        about: 'Add-later: a verified Philippine resident adds the bank account. The first of two dropdown pages.',
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
                                everyStatus: true,
                            },
                        ],
                    },
                    ADD_BANK_MONEY,
                ],
                'purpose'
            ),
            'GET /users/kyc/plan': approvedPlan(null, { qr: true, bank: false, local: false, card: true }),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
    'paperwork-verification-add-bank-money': {
        route: '/verify?feature=bank',
        about: 'Add-later bank questionnaire with only Money unanswered. The intermediary choice is selected.',
        waitFor: '[data-testid="verify-pick-actingAsIntermediary"]',
        responses: {
            'GET /users/kyc/questions': questions(
                'PH',
                [
                    {
                        ...ADD_BANK_MONEY,
                        fields: ADD_BANK_MONEY.fields.map((field) =>
                            field.key === 'actingAsIntermediary' ? { ...field, value: 'yes' } : field
                        ),
                    },
                ],
                'money'
            ),
            'GET /users/kyc/plan': approvedPlan(null, { qr: true, bank: false, local: false, card: true }),
            'GET /users/kyc/profile': profile('APPROVED'),
        },
    },
}

const postalSupport = PAPERWORK_VERIFICATION_FIXTURES['paperwork-verification-py-bank-postal-support']
const postalCorrection: (typeof PAPERWORK_VERIFICATION_FIXTURES)[string] = {
    ...postalSupport,
    about: 'A verified user corrects the postal code for a blocked Bridge bank setup.',
    responses: {
        ...postalSupport.responses,
        'GET /users/kyc/bridge-postal-code': { country: 'PY', revision: 'a'.repeat(64) },
        'POST /users/kyc/bridge-postal-code': { status: 'queued' },
    },
}
PAPERWORK_VERIFICATION_FIXTURES['paperwork-verification-bridge-postal-correction'] = postalCorrection
PAPERWORK_VERIFICATION_FIXTURES['paperwork-verification-bridge-postal-refused'] = {
    ...postalCorrection,
    about: 'The Bridge correction keeps the postal code visible when the API rejects it.',
    rejects: {
        'POST /users/kyc/bridge-postal-code': { status: 422, body: { errors: { postCode: 'invalid_postal_code' } } },
    },
}
PAPERWORK_VERIFICATION_FIXTURES['paperwork-verification-bridge-postal-queued'] = {
    ...postalCorrection,
    about: 'The corrected postal code is saved and Bridge setup is queued.',
}
PAPERWORK_VERIFICATION_FIXTURES['paperwork-verification-bridge-postal-temporary'] = {
    ...postalCorrection,
    about: 'A temporary error leaves both retry and support available.',
    rejects: { 'GET /users/kyc/bridge-postal-code': { status: 503, body: { code: 'temporary_failure' } } },
}
PAPERWORK_VERIFICATION_FIXTURES['paperwork-verification-bridge-postal-unavailable'] = {
    ...postalCorrection,
    about: 'A user who cannot use the postal correction can contact support.',
    rejects: { 'GET /users/kyc/bridge-postal-code': { status: 409, body: { code: 'correction_unavailable' } } },
}
