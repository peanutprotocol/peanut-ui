import type {
    PaperworkVerificationField,
    PaperworkVerificationQuestions,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import {
    composeScreens,
    openFeatures,
    entryStep,
    fieldErrorKey,
    formatTaxId,
    initialValues,
    looksLikeItin,
    markSaved,
    phoneJoinsAddress,
    resumeStep,
    screenOfStep,
    stepComplete,
    stepPayload,
    stepProgress,
    linkedToUkraine,
    whyKeyOf,
    withEmploymentStatus,
    jobModeOf,
} from '../paperworkVerification.utils'

const field = (key: string, extra: Partial<PaperworkVerificationField> = {}): PaperworkVerificationField => ({
    key,
    kind: 'text',
    required: true,
    value: null,
    ...extra,
})

const questions = (overrides: Partial<PaperworkVerificationQuestions> = {}): PaperworkVerificationQuestions => ({
    available: true,
    attemptId: 'attempt',
    residence: 'US',
    steps: [
        { id: 'purpose', features: ['card'], answered: true, fields: [field('cardPurpose', { kind: 'choice' })] },
        { id: 'money', features: ['card'], answered: false, fields: [field('annualSalary', { kind: 'choice' })] },
        { id: 'tax', features: ['base'], answered: false, fields: [field('taxId', { kind: 'taxId', format: 'ssn' })] },
    ],
    firstUnanswered: 'money',
    progress: { done: 1, total: 5 },
    ...overrides,
})

describe('resumeStep', () => {
    it('resumes where the server says', () => {
        expect(resumeStep(questions())).toBe('money')
    })

    it('falls back to the first open step when the server names none or an unknown one', () => {
        expect(resumeStep(questions({ firstUnanswered: null }))).toBe('money')
        expect(resumeStep(questions({ firstUnanswered: 'phone' }))).toBe('money')
    })

    it('has nothing to resume when every step is answered', () => {
        const all = questions({ firstUnanswered: null })
        all.steps = all.steps.map((s) => ({ ...s, answered: true }))
        expect(resumeStep(all)).toBeNull()
    })
})

describe('entryStep', () => {
    const plan = { proofOfAddress: null } as never
    it('starts at the first open question before the ID', () => {
        expect(entryStep({ questions: questions(), plan, status: 'NOT_STARTED' })).toBe('money')
    })

    it('goes to the midpoint once every question is answered', () => {
        const all = questions({ firstUnanswered: null })
        all.steps = all.steps.map((s) => ({ ...s, answered: true }))
        expect(entryStep({ questions: all, plan, status: undefined })).toBe('id')
    })

    it('shows the review once submitted, and for a review that needs action', () => {
        expect(entryStep({ questions: questions(), plan, status: 'IN_REVIEW' })).toBe('review')
        expect(entryStep({ questions: questions(), plan, status: 'ACTION_REQUIRED' })).toBe('review')
        expect(entryStep({ questions: questions(), plan, status: 'PENDING' }, true)).toBe('review')
    })

    it('ends on verified, or on the proof-of-address suggestion (rule 1)', () => {
        expect(entryStep({ questions: questions(), plan, status: 'APPROVED' })).toBe('verified')
        expect(
            entryStep({ questions: questions(), plan: { proofOfAddress: 'suggested' } as never, status: 'APPROVED' })
        ).toBe('address-proof')
    })
})

const firstIds = (screens: string[][]) => screens.map((ids) => ids[0])

describe('stepProgress', () => {
    it('counts sign-up as the done first step and the ID as the last', () => {
        const ids = firstIds(composeScreens(questions(), false)) as never
        expect(stepProgress(ids, 'purpose')).toEqual({ current: 2, total: 4 })
        expect(stepProgress(ids, 'tax')).toEqual({ current: 3, total: 4 })
    })
})

describe('openFeatures', () => {
    it('turns off what the residence or an answer closed, and keeps the rest', () => {
        const picked = { qr: true, bank: true, card: true, local: false }
        expect(openFeatures(picked, [{ feature: 'bank', reason: 'us_state_unsupported' }])).toEqual({
            ...picked,
            bank: false,
        })
        expect(openFeatures(picked, undefined)).toEqual(picked)
        expect(openFeatures(undefined, [])).toBeUndefined()
    })
})

describe('composeScreens', () => {
    const picker = (id: string, ...kinds: PaperworkVerificationField['kind'][]) => ({
        id,
        features: ['card'],
        answered: false,
        fields: kinds.map((kind, i) => field(`${id}${i}`, { kind })),
    })
    const withSteps = (...steps: ReturnType<typeof picker>[]) => questions({ steps } as never)

    it('puts picker-only steps on one screen and gives typed inputs and toggle rows their own', () => {
        const ar = withSteps(
            picker('purpose', 'choice'),
            picker('work', 'choice', 'occupation'),
            picker('money', 'choice', 'choice'),
            picker('declarations', 'toggle', 'toggle', 'toggle'),
            picker('birth', 'choice'),
            picker('address', 'country', 'text', 'text'),
            picker('tax', 'taxId')
        )
        expect(composeScreens(ar, false)).toEqual([
            ['purpose', 'work', 'money', 'birth'],
            ['declarations'],
            ['address'],
            ['tax'],
        ])
    })

    it('opens a new picker screen past six pickers', () => {
        const ph = withSteps(
            picker('purpose', 'choice'),
            picker('work', 'choice', 'occupation'),
            picker('money', 'choice', 'choice', 'choice', 'choice', 'choice'),
            picker('tax', 'taxId')
        )
        expect(composeScreens(ph, false)).toEqual([['purpose', 'work'], ['money'], ['tax']])
    })

    it('rides the joined phone on the address screen and maps every step to its screen', () => {
        const us = withSteps(
            picker('purpose', 'choice'),
            picker('address', 'text'),
            picker('phone', 'phone'),
            picker('birth', 'country', 'place')
        )
        const screens = composeScreens(us, true)
        expect(screens).toEqual([
            ['purpose', 'birth'],
            ['address', 'phone'],
        ])
        expect(screenOfStep(screens, 'birth')).toBe('purpose')
        expect(screenOfStep(screens, 'phone')).toBe('address')
        expect(screenOfStep(screens, 'id')).toBe('id')
    })
})

describe('the phone on the address screen', () => {
    const withAddress = (addressAnswered: boolean, phoneAnswered: boolean) =>
        questions({
            steps: [
                { id: 'address', features: ['base'], answered: addressAnswered, fields: [field('street')] },
                {
                    id: 'phone',
                    features: ['card'],
                    answered: phoneAnswered,
                    fields: [field('phone', { kind: 'phone' })],
                },
                { id: 'tax', features: ['base'], answered: false, fields: [field('taxId', { kind: 'taxId' })] },
            ],
        })

    it('joins the address screen when both are asked together, and counts as one screen', () => {
        expect(phoneJoinsAddress(withAddress(false, false))).toBe(true)
        expect(phoneJoinsAddress(withAddress(true, true))).toBe(true)
        const screens = firstIds(composeScreens(withAddress(false, false), true)) as never
        expect(screens).toEqual(['address', 'tax'])
        expect(stepProgress(screens, 'tax')).toEqual({ current: 3, total: 4 })
    })

    it('keeps its own screen when the address was given before, or when there is no address', () => {
        expect(phoneJoinsAddress(withAddress(true, false))).toBe(false)
        expect(firstIds(composeScreens(withAddress(true, false), false))).toEqual(['address', 'phone', 'tax'])
        expect(phoneJoinsAddress(questions())).toBe(false)
    })
})

describe('stepPayload and stepComplete', () => {
    const fields = [
        field('street'),
        field('buildingNumber', { required: false }),
        field('country', { kind: 'country', locked: true, value: 'US' }),
        field('phone', { kind: 'phone' }),
    ]

    it('trims, keeps the locked value, drops empty optional fields and strips phone spacing', () => {
        expect(
            stepPayload(fields, {
                street: '  Main St ',
                buildingNumber: '  ',
                country: 'MX',
                phone: '+1 (415) 555-0132',
            })
        ).toEqual({ street: 'Main St', country: 'US', phone: '+14155550132' })
    })

    it('needs every required answer, never the locked or optional ones', () => {
        expect(stepComplete(fields, { street: 'Main St', phone: '+14155550132' })).toBe(true)
        expect(stepComplete(fields, { street: ' ', phone: '+14155550132' })).toBe(false)
    })
})

describe('phone and tax completeness', () => {
    const phone = field('phone', { kind: 'phone' })
    const ssn = field('taxId', { kind: 'taxId', format: 'ssn' })

    it('starts an empty phone with the residence calling code and keeps a saved one', () => {
        expect(initialValues([phone], 'BR')).toEqual({ phone: '+55 ' })
        expect(initialValues([{ ...phone, value: '+14155550132' }], 'BR')).toEqual({ phone: '+14155550132' })
        expect(initialValues([phone], null)).toEqual({ phone: '' })
    })

    it('waits for a full international number', () => {
        expect(stepComplete([phone], { phone: '+55 ' })).toBe(false)
        expect(stepComplete([phone], { phone: '+55 11 91234 5678' })).toBe(true)
    })

    it('never continues with an ITIN', () => {
        expect(stepComplete([ssn], { taxId: '912-70-1234' })).toBe(false)
        expect(stepComplete([ssn], { taxId: '412-55-0198' })).toBe(true)
    })
})

describe('toggles and server-provided fields', () => {
    const elsewhere = field('taxElsewhere', { kind: 'toggle' })
    const foreignCountry = field('foreignTaxCountry', { kind: 'country' })
    const foreignNumber = field('foreignTaxId')
    const fields = [elsewhere, foreignCountry, foreignNumber]

    it('an untouched toggle reads no', () => {
        expect(initialValues([elsewhere])).toEqual({ taxElsewhere: 'no' })
        expect(initialValues([{ ...elsewhere, value: 'yes' }])).toEqual({ taxElsewhere: 'yes' })
    })

    it('every required field the server sends needs an answer', () => {
        const values = { taxElsewhere: 'no', foreignTaxCountry: 'ES', foreignTaxId: 'X1' }
        expect(stepComplete(fields, { taxElsewhere: 'no' })).toBe(false)
        expect(stepPayload(fields, values)).toEqual(values)
    })

    it('all provided fields are sent', () => {
        expect(stepComplete(fields, { taxElsewhere: 'yes', foreignTaxCountry: 'ES' })).toBe(false)
        expect(stepPayload(fields, { taxElsewhere: 'yes', foreignTaxCountry: 'ES', foreignTaxId: ' X1 ' })).toEqual({
            taxElsewhere: 'yes',
            foreignTaxCountry: 'ES',
            foreignTaxId: 'X1',
        })
    })
})

describe('markSaved', () => {
    it('marks the step answered with the saved values, so Back shows them', () => {
        const saved = markSaved(questions(), 'money', { annualSalary: '25k_50k' })
        expect(saved.steps[1]).toEqual(
            expect.objectContaining({ answered: true, fields: [expect.objectContaining({ value: '25k_50k' })] })
        )
        expect(saved.steps[2].answered).toBe(false)
    })
})

describe('fieldErrorKey', () => {
    it.each([
        ['required', 'required'],
        ['invalid_tax_id', 'invalidTaxId'],
        ['itin_not_accepted', 'itinNotAccepted'],
        ['invalid_option', 'invalidOption'],
        ['invalid_phone', 'invalidPhone'],
        ['too_long', 'tooLong'],
        ['invalid_country', 'invalidCountry'],
        ['something_new', 'invalid'],
    ])('%s → %s', (code, key) => {
        expect(fieldErrorKey(code)).toBe(key)
    })
})

describe('tax numbers', () => {
    it('formats the fixed patterns as they are typed', () => {
        expect(formatTaxId('ssn', '412550198')).toBe('412-55-0198')
        expect(formatTaxId('ssn', '4125')).toBe('412-5')
        expect(formatTaxId('cuit', '20123456786')).toBe('20-12345678-6')
        expect(formatTaxId('cpf', '12345678909')).toBe('123.456.789-09')
        expect(formatTaxId(null, 'AB-12')).toBe('AB-12')
    })

    it('spots an ITIN only for an SSN', () => {
        expect(looksLikeItin('ssn', '912-70-1234')).toBe(true)
        expect(looksLikeItin('ssn', '412-55-0198')).toBe(false)
        expect(looksLikeItin('cuit', '912701234')).toBe(false)
    })
})

// Slava, 2026-10-26: temporary protection only with a tie to Ukraine.
describe('linkedToUkraine', () => {
    const residence = (declared: string | null, second: string | null = null) => ({
        verified: null,
        declared: declared
            ? { country: declared, status: 'UNVERIFIED' as const, updatedAt: null, secondCountry: second }
            : null,
    })
    it('is a Ukrainian citizenship, residence, second residence or sign-up location', () => {
        expect(linkedToUkraine('UA', { residence: residence('PL') })).toBe(true)
        expect(linkedToUkraine(null, { residence: residence('UA') })).toBe(true)
        expect(linkedToUkraine(null, { residence: residence('PL', 'UA') })).toBe(true)
        expect(
            linkedToUkraine(null, {
                residence: residence('PL'),
                geo: { signup: { store: { country: 'UA', source: 'google-play', observedAt: '' } } },
            })
        ).toBe(true)
        expect(linkedToUkraine(null, null, 'UA')).toBe(true)
    })

    it('is none of those for anyone else', () => {
        expect(linkedToUkraine('DE', { residence: residence('PL') })).toBe(false)
        expect(linkedToUkraine(null, null)).toBe(false)
    })
})

describe('whyKeyOf', () => {
    it('explains a birth step that asks only the citizenship as the ID picker’s, every other step as its own', () => {
        expect(whyKeyOf({ id: 'birth', features: ['base'] })).toBe('citizenship')
        expect(whyKeyOf({ id: 'birth', features: ['bank', 'base'] })).toBe('birth')
        expect(whyKeyOf({ id: 'address', features: ['base'] })).toBe('address')
    })
})

describe('a work status that names the job', () => {
    const work = [
        field('employmentStatus', { kind: 'choice', options: ['employed', 'retired', 'student', 'unemployed'] }),
        field('occupation', { kind: 'occupation' }),
    ]

    it('answers the job question, and a later status that does not name it clears that answer', () => {
        const retired = withEmploymentStatus(work, { employmentStatus: '', occupation: '' }, 'retired')
        expect(retired).toEqual({ employmentStatus: 'retired', occupation: 'retired' })
        expect(withEmploymentStatus(work, retired, 'employed')).toEqual({
            employmentStatus: 'employed',
            occupation: '',
        })
    })

    it('keeps a job picked for an employed status', () => {
        expect(
            withEmploymentStatus(work, { employmentStatus: 'employed', occupation: 'lawyer' }, 'self_employed')
        ).toEqual({ employmentStatus: 'self_employed', occupation: 'lawyer' })
    })

    it('fills the job from a stored status, and leaves the job alone when the form does not ask it', () => {
        expect(initialValues([{ ...work[0], value: 'student' }, work[1]])).toMatchObject({ occupation: 'student' })
        expect(withEmploymentStatus([work[0]], {}, 'retired')).toEqual({ employmentStatus: 'retired' })
    })
})

// Slava, 2026-10-27: Bridge asks a job of every work status; the status words the question.
describe('the job question when Bridge asks a job of every status', () => {
    const statuses = ['employed', 'self_employed', 'homemaker', 'retired', 'student', 'unemployed']
    const work = [
        field('employmentStatus', { kind: 'choice', options: statuses }),
        field('occupation', { kind: 'occupation', everyStatus: true }),
    ]
    const cardOnly = [work[0], field('occupation', { kind: 'occupation' })]

    it('asks the current job of someone working, the last one of someone not, and the future one of a student', () => {
        expect(statuses.map((status) => jobModeOf(work, status))).toEqual([
            'current',
            'current',
            'last',
            'last',
            'future',
            'last',
        ])
        expect(jobModeOf(work, undefined)).toBe('current')
    })

    it('lets the status answer the job, a homemaker too, when only the card asks it', () => {
        expect(jobModeOf(cardOnly, 'homemaker')).toBe('none')
        expect(withEmploymentStatus(cardOnly, {}, 'homemaker')).toEqual({
            employmentStatus: 'homemaker',
            occupation: 'unemployed',
        })
    })

    it('keeps a named job across statuses and reads "no job" the way the new status asks', () => {
        const retired = withEmploymentStatus(work, { employmentStatus: 'employed', occupation: 'lawyer' }, 'retired')
        expect(retired).toEqual({ employmentStatus: 'retired', occupation: 'lawyer' })
        expect(withEmploymentStatus(work, { employmentStatus: '', occupation: '' }, 'retired')).toEqual({
            employmentStatus: 'retired',
            occupation: '',
        })
        const none = { employmentStatus: 'retired', occupation: 'unemployed' }
        expect(withEmploymentStatus(work, none, 'student')).toEqual({
            employmentStatus: 'student',
            occupation: 'student',
        })
        expect(withEmploymentStatus(work, none, 'employed')).toEqual({ employmentStatus: 'employed', occupation: '' })
    })

    it('shows a stored "no job" as this status\'s own answer', () => {
        expect(
            initialValues([
                { ...work[0], value: 'homemaker' },
                { ...work[1], value: 'retired' },
            ])
        ).toMatchObject({
            occupation: 'unemployed',
        })
        expect(
            initialValues([
                { ...work[0], value: 'student' },
                { ...work[1], value: 'unemployed' },
            ])
        ).toMatchObject({
            occupation: 'student',
        })
        expect(
            initialValues([
                { ...work[0], value: 'retired' },
                { ...work[1], value: 'lawyer' },
            ])
        ).toMatchObject({
            occupation: 'lawyer',
        })
    })
})
