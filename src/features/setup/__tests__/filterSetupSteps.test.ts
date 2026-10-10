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
])('keeps only the sell screens offered in %s, after the payment plan', (residence, expected) => {
    expect(setupFeatureScreensForResidence(restrictions, residence as string)).toEqual(expected)
    const ids = filterSetupStepsForResidence(setupSteps, restrictions, residence as string).map((step) => step.screenId)
    expect(ids.slice(ids.indexOf('payment-plan') + 1, ids.indexOf('notification-email'))).toEqual(expected)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('sign-test-transaction')
})

it('keeps the sign-up order: invite before the username, residence after it', () => {
    const ids = filterSetupStepsForResidence(setupSteps, restrictions, 'PT').map((step) => step.screenId)
    expect(ids).toEqual([
        'landing',
        'invite',
        'signup',
        'residence',
        'payment-plan',
        'advantage-fees',
        'advantage-card',
        'notification-email',
        'notification-permission',
        'advantage-control',
    ])
})
