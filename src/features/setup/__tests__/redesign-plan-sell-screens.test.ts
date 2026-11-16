/**
 * P3-03: the sell screens 05 and 06 follow the expected country (contract P3 § 1.3), and the step list mounts the
 * redesigned screens on dev's screen ids (§ 0.1).
 */
import { setupSteps } from '@/components/Setup/Setup.consts'
import { AccountsScreen } from '@/components/Setup/redesign/Accounts/AccountsScreen'
import { CardScreen } from '@/components/Setup/redesign/Card/CardScreen'
import { PaymentPlanScreen } from '@/components/Setup/redesign/PaymentPlan/PaymentPlanScreen'
import { ResidenceScreen } from '@/components/Setup/redesign/Residence/ResidenceScreen'
import { filterSetupStepsForCountry, setupFeatureScreensForCountry } from '../filterSetupSteps'

const sets = {
    full: new Set(['RU']),
    bankingOnly: new Set(['JP']),
    cardOnly: new Set(['IN']),
    refusedIdIssuers: new Set<string>(),
    bankingNewCustomersOnly: new Set<string>(),
}

describe('P3-03 sell screens per expected country', () => {
    it('shows neither 05 nor 06 when a country is suggested but the restriction lists are unknown', () => {
        expect(setupFeatureScreensForCountry(null, 'XX')).toEqual([])
        expect(setupFeatureScreensForCountry(null, 'PT')).toEqual([])
    })

    it('shows both when no country is suggested, even with unknown lists', () => {
        expect(setupFeatureScreensForCountry(null, null)).toEqual(['advantage-fees', 'advantage-card'])
        expect(setupFeatureScreensForCountry(sets, null)).toEqual(['advantage-fees', 'advantage-card'])
    })

    it('drops 05 for a banking-restricted country and 06 for a card-restricted one', () => {
        expect(setupFeatureScreensForCountry(sets, 'JP')).toEqual(['advantage-card'])
        expect(setupFeatureScreensForCountry(sets, 'IN')).toEqual(['advantage-fees'])
        expect(setupFeatureScreensForCountry(sets, 'RU')).toEqual([])
    })

    it('filters the real step list so 05 and 06 sit between the landing and 07, in that order', () => {
        const ids = filterSetupStepsForCountry(setupSteps, sets, 'PT').map((s) => s.screenId)
        expect(ids.slice(0, 5)).toEqual(['landing', 'advantage-fees', 'advantage-card', 'residence', 'payment-plan'])
        expect(filterSetupStepsForCountry(setupSteps, sets, 'JP').map((s) => s.screenId)).not.toContain(
            'advantage-fees'
        )
    })

    it('mounts the redesigned 05–08 on dev’s screen ids', () => {
        const byId = Object.fromEntries(setupSteps.map((s) => [s.screenId, s.component]))
        expect(byId['advantage-fees']).toBe(AccountsScreen)
        expect(byId['advantage-card']).toBe(CardScreen)
        expect(byId.residence).toBe(ResidenceScreen)
        expect(byId['payment-plan']).toBe(PaymentPlanScreen)
    })
})
