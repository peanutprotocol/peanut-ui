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
])('keeps only the sell screens offered in %s, between Welcome and residence', (country, expected) => {
    expect(setupFeatureScreensForCountry(restrictions, country)).toEqual(expected)
    const list = ids(country)
    expect(list.slice(list.indexOf('landing') + 1, list.indexOf('residence'))).toEqual(expected)
    expect(new Set(list).size).toBe(list.length)
    expect(list).not.toContain('sign-test-transaction')
})

it.each([null, '', '  '])('shows both sell screens when no country is suggested (%p)', (country) => {
    expect(setupFeatureScreensForCountry(restrictions, country)).toEqual(['advantage-fees', 'advantage-card'])
})

it('keeps the sign-up order: sell screens, residence, plan, Claim, Invite and Passkey', () => {
    expect(ids('PT')).toEqual([
        'landing',
        'advantage-fees',
        'advantage-card',
        'residence',
        'payment-plan',
        'signup',
        'invite',
        'passkey',
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

it('withholds sell screens for a suggested country until restriction lists are known', () => {
    expect(setupFeatureScreensForCountry(null, 'PT')).toEqual([])
    expect(setupFeatureScreensForCountry(null, null)).toEqual(['advantage-fees', 'advantage-card'])
    const unknown = filterSetupStepsForCountry(setupSteps, null, 'PT').map((step) => step.screenId)
    expect(unknown).toEqual(ids('RU'))
})
