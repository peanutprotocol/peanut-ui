import { setupSteps } from '@/components/Setup/Setup.consts'
import {
    filterSetupStepsForCountry,
    filterSetupStepsForInvite,
    setupFeatureScreensForCountry,
} from '../filterSetupSteps'

const restrictions = {
    full: new Set(['RU']),
    bankingOnly: new Set(['JP']),
    cardOnly: new Set(['IN']),
    refusedIdIssuers: new Set<string>(),
    bankingNewCustomersOnly: new Set<string>(),
}
const ids = (country: string | null) =>
    filterSetupStepsForCountry(setupSteps, restrictions, country).map((step) => step.screenId)

it.each([
    ['PT', ['advantage-fees', 'advantage-card']],
    ['AR', ['advantage-fees', 'advantage-card']],
    [' pt ', ['advantage-fees', 'advantage-card']],
    ['IN', ['advantage-fees']],
    ['JP', ['advantage-card']],
    ['RU', []],
])('keeps only the sell screens offered in %s, between the inviter and residence', (country, expected) => {
    expect(setupFeatureScreensForCountry(restrictions, country)).toEqual(expected)
    const list = ids(country)
    expect(list.slice(list.indexOf('invite') + 1, list.indexOf('residence'))).toEqual(expected)
    expect(new Set(list).size).toBe(list.length)
    expect(list).not.toContain('sign-test-transaction')
})

it.each([null, '', '  '])('shows both sell screens when no country is suggested (%p)', (country) => {
    expect(setupFeatureScreensForCountry(restrictions, country)).toEqual(['advantage-fees', 'advantage-card'])
})

it('keeps the sign-up order: username, inviter, sell screens, then residence and the plan', () => {
    expect(ids('PT')).toEqual([
        'landing',
        'signup',
        'invite',
        'advantage-fees',
        'advantage-card',
        'residence',
        'payment-plan',
        'notification-email',
        'notification-permission',
        'advantage-control',
    ])
})

it('asks for an inviter only when the signup has none', () => {
    const list = (hasInvite: boolean) => filterSetupStepsForInvite(setupSteps, hasInvite).map((step) => step.screenId)
    expect(list(false)).toContain('invite')
    expect(list(true)).not.toContain('invite')
    expect(list(true)).toEqual(list(false).filter((id) => id !== 'invite'))
})
