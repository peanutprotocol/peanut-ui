import { setupSteps } from '@/components/Setup/Setup.consts'
import { filterSetupStepsForResidence, setupFeatureScreensForResidence } from '../filterSetupSteps'

const restrictions = { full: new Set(['RU']), bankingOnly: new Set(['JP']), cardOnly: new Set(['IN']) }
it.each([
    ['PT', ['advantage-fees', 'advantage-card']],
    ['AR', ['advantage-fees', 'advantage-card']],
    [' pt ', ['advantage-fees', 'advantage-card']],
    ['IN', ['advantage-fees']],
    ['JP', ['advantage-card']],
    ['RU', []],
    ['', []],
])('keeps only the sell screens offered in %s, between residence and the payment plan', (residence, expected) => {
    expect(setupFeatureScreensForResidence(restrictions, residence as string)).toEqual(expected)
    const ids = filterSetupStepsForResidence(setupSteps, restrictions, residence as string).map((step) => step.screenId)
    expect(ids.slice(ids.indexOf('residence') + 1, ids.indexOf('payment-plan'))).toEqual(expected)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('sign-test-transaction')
})

it('keeps the sign-up order: invite before the username, the sell screens before the payment plan', () => {
    const ids = filterSetupStepsForResidence(setupSteps, restrictions, 'PT').map((step) => step.screenId)
    expect(ids).toEqual([
        'landing',
        'invite',
        'signup',
        'residence',
        'advantage-fees',
        'advantage-card',
        'payment-plan',
        'notification-email',
        'notification-permission',
        'advantage-control',
    ])
})

it.each([
    ['PT', ['residence', 'advantage-fees', 'advantage-card', 'payment-plan']],
    ['IN', ['residence', 'advantage-fees', 'payment-plan']],
    ['RU', ['residence', 'payment-plan']],
])('shows the card before the plan asks how to spend (%s)', (residence, expected) => {
    const ids = filterSetupStepsForResidence(setupSteps, restrictions, residence).map((step) => step.screenId)
    expect(ids.slice(ids.indexOf('residence'), ids.indexOf('payment-plan') + 1)).toEqual(expected)
})
