import { setupSteps } from '@/components/Setup/Setup.consts'
import {
    filterSetupStepsForInvite,
    filterSetupStepsForResidence,
    setupFeatureScreensForResidence,
} from '../filterSetupSteps'

const restrictions = { full: new Set(['RU']), bankingOnly: new Set(['JP']), cardOnly: new Set(['IN']) }
it.each([
    ['PT', ['advantage-fees', 'advantage-card']],
    ['AR', ['advantage-fees', 'advantage-card']],
    [' pt ', ['advantage-fees', 'advantage-card']],
    ['IN', ['advantage-fees']],
    ['JP', ['advantage-card']],
    ['RU', []],
    ['', []],
])('keeps only the sell screens offered in %s, between the inviter and the payment plan', (residence, expected) => {
    expect(setupFeatureScreensForResidence(restrictions, residence as string)).toEqual(expected)
    const ids = filterSetupStepsForResidence(setupSteps, restrictions, residence as string).map((step) => step.screenId)
    expect(ids.slice(ids.indexOf('invite') + 1, ids.indexOf('payment-plan'))).toEqual(expected)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('sign-test-transaction')
})

it('keeps the sign-up order: the username first, the inviter after registration, the sell screens before the payment plan', () => {
    const ids = filterSetupStepsForResidence(setupSteps, restrictions, 'PT').map((step) => step.screenId)
    expect(ids).toEqual([
        'landing',
        'signup',
        'residence',
        'invite',
        'advantage-fees',
        'advantage-card',
        'payment-plan',
        'notification-email',
        'notification-permission',
        'advantage-control',
    ])
})

it.each([
    ['PT', ['residence', 'invite', 'advantage-fees', 'advantage-card', 'payment-plan']],
    ['IN', ['residence', 'invite', 'advantage-fees', 'payment-plan']],
    ['RU', ['residence', 'invite', 'payment-plan']],
])('shows the card before the plan asks how to spend (%s)', (residence, expected) => {
    const ids = filterSetupStepsForResidence(setupSteps, restrictions, residence).map((step) => step.screenId)
    expect(ids.slice(ids.indexOf('residence'), ids.indexOf('payment-plan') + 1)).toEqual(expected)
})

it('asks for an inviter only when the signup has none', () => {
    const ids = (hasInvite: boolean) => filterSetupStepsForInvite(setupSteps, hasInvite).map((step) => step.screenId)
    expect(ids(false)).toContain('invite')
    expect(ids(true)).not.toContain('invite')
    expect(ids(true)).toEqual(ids(false).filter((id) => id !== 'invite'))
})
