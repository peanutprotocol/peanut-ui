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
        step1AfterDays: 2,
        step2AfterDays: 6,
        governorDays: 3,
        freshnessDays: 30,
        holdoutFraction: 0.1,
        sendWindowUtc: { startHour: 13, endHour: 21 },
        maxSendsPerCycle: 500,
    },
    welcome: step('lifecycle.welcome'),
    stages: [
        { stage: 'verify', order: 1, predicate: 'p', steps: [step('lifecycle.verify_1'), step('lifecycle.verify_2')] },
        {
            stage: 'first_spend',
            order: 5,
            predicate: 'p',
            steps: [
                step('lifecycle.first_spend_1', { paragraphsWithRewards: ['rewards copy'] }),
                step('lifecycle.first_spend_2', { paragraphsWithRewards: ['rewards copy'] }),
            ],
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
            renderId('lifecycle.verify_2', 0),
            renderId('lifecycle.first_spend_1', 0),
            renderId('lifecycle.first_spend_1', 1),
            renderId('lifecycle.first_spend_2', 0),
            renderId('lifecycle.first_spend_2', 1),
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

    it('flags exactly the two open product decisions', () => {
        expect(decisionFlagFor('lifecycle.first_spend_1')?.label).toMatch(/rewards branch/)
        expect(decisionFlagFor('lifecycle.finish_setup_2')?.label).toMatch(/kill or keep/)
        expect(decisionFlagFor('lifecycle.welcome')).toBeNull()
    })
})
