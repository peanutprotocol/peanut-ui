import { buildEmailRenderList, decisionFlagFor, examplesForStep, renderId } from '../emailReview'
import type { JourneySpec, SpecEmailStep } from '../journeyTypes'

const step = (type: string, extra: Partial<SpecEmailStep> = {}): SpecEmailStep => ({
    type,
    subject: `subject ${type}`,
    preview: 'preview',
    title: 'title',
    paragraphs: ['p'],
    ctaText: 'Go',
    ctaPath: '/home',
    ...extra,
})

const spec = (): JourneySpec => ({
    generatedFrom: 'test',
    rules: {
        cadence: {},
        minGapHours: 20,
        idleMinutes: 30,
        quietHours: { fromMinute: 1290, untilMinute: 480 },
        freshnessDays: 14,
        dormancyDays: 42,
        holdoutFraction: 0,
        maxSendsPerCycle: 100,
        maxSendsPerDay: 200,
    },
    welcome: step('lifecycle.welcome'),
    reminder: step('lifecycle.verify_reminder'),
    stages: [
        {
            stage: 'start_verify',
            order: 1,
            predicate: 'p',
            steps: [step('lifecycle.verify_1')],
        },
        {
            stage: 'first_spend',
            order: 5,
            predicate: 'p',
            steps: [step('lifecycle.first_spend_1')],
        },
    ],
    pushReminders: [],
    emailPreviewBase: '/__dev/email-preview',
})

describe('emailReview', () => {
    it('has no renders until the spec loads', () => {
        expect(buildEmailRenderList(null)).toEqual([])
    })

    it('splits a rewards-branch email into two labelled examples', () => {
        expect(examplesForStep(step('x'))).toEqual([{ index: 0, label: 'default' }])
        expect(examplesForStep(step('x', { paragraphsWithRewards: ['a'] }))).toEqual([
            { index: 0, label: 'plain' },
            { index: 1, label: 'rewards' },
        ])
    })

    it('lists welcome first and every email exactly once, in board order', () => {
        const renders = buildEmailRenderList(spec())
        expect(renders.map((render) => render.id)).toEqual([
            renderId('lifecycle.welcome', 0),
            renderId('lifecycle.verify_1', 0),
            renderId('lifecycle.first_spend_1', 0),
            renderId('lifecycle.verify_reminder', 0),
        ])
    })

    it('still lists emails from a stage the board has not mapped to a column', () => {
        const withUnmapped = spec()
        withUnmapped.stages.push({
            stage: 'brand_new_stage',
            order: 9,
            predicate: 'p',
            steps: [step('lifecycle.brand_new_1')],
        })
        expect(buildEmailRenderList(withUnmapped).map((render) => render.eventType)).toContain('lifecycle.brand_new_1')
    })

    it('returns null when no structural decision flag is active', () => {
        expect(decisionFlagFor('lifecycle.first_spend_1')).toBeNull()
        expect(decisionFlagFor('lifecycle.welcome')).toBeNull()
    })
})
