import { addMoneyRoutesForCountry, hasAddMoneyRoute } from '../countryRoutes'
import type { CountryData } from '@/components/AddMoney/consts'
import type { DepositCorridor } from '@/features/deposit-accounts/types'

const country = (id: string, iso2: string, currency: string, path = id.toLowerCase()): CountryData => ({
    id,
    type: 'country',
    title: id,
    currency,
    path,
    iso2,
})

const BR = country('BR', 'BR', 'BRL', 'brazil')
const CO = country('CO', 'CO', 'COP', 'colombia')
const DE = country('DEU', 'DE', 'EUR', 'germany')
const NG = country('NG', 'NG', 'NGN', 'nigeria')

const routes = (c: CountryData, offered: DepositCorridor[] = [], enabled = true) =>
    addMoneyRoutesForCountry(c, offered, enabled)

describe('addMoneyRoutesForCountry', () => {
    it('offers Brazil both Pix products when the user holds the standing rail', () => {
        expect(routes(BR, ['BANK_TRANSFER_BR'])).toEqual([
            { corridor: 'BANK_TRANSFER_BR', kind: 'standing' },
            { corridor: 'PIX_BR', kind: 'top-up', href: '/add-money/brazil/manteca' },
        ])
    })

    it('leaves Brazil the one-off top-up when the standing rail is not the user’s', () => {
        expect(routes(BR)).toEqual([{ corridor: 'PIX_BR', kind: 'top-up', href: '/add-money/brazil/manteca' }])
    })

    it('does not offer a standing corridor while the deposit-accounts flag is off', () => {
        expect(routes(BR, ['BANK_TRANSFER_BR'], false)).toEqual([
            { corridor: 'PIX_BR', kind: 'top-up', href: '/add-money/brazil/manteca' },
        ])
    })

    it('offers Colombia its Bre-B account, and nothing when the rail is not the user’s', () => {
        expect(routes(CO, ['BANK_TRANSFER_CO'])).toEqual([{ corridor: 'BANK_TRANSFER_CO', kind: 'standing' }])
        expect(routes(CO)).toEqual([])
    })

    it('resolves a euro member through the zone rail', () => {
        expect(routes(DE, ['SEPA_EU'])).toEqual([{ corridor: 'SEPA_EU', kind: 'standing' }])
    })

    it('has no route for a country the catalogue does not name', () => {
        expect(routes(NG, ['SEPA_EU'])).toEqual([])
    })
})

describe('hasAddMoneyRoute', () => {
    it('keeps Brazil and Colombia off the waitlist once they have a route', () => {
        // Brazil's top-up needs no rail of the user's own; Colombia's account does
        expect(hasAddMoneyRoute(BR, [], true)).toBe(true)
        expect(hasAddMoneyRoute(CO, ['BANK_TRANSFER_CO'], true)).toBe(true)
    })

    it('offers the waitlist where there is no corridor and no live bank rail', () => {
        expect(hasAddMoneyRoute(NG, [], true)).toBe(false)
        expect(hasAddMoneyRoute(CO, [], true)).toBe(false)
    })

    it('still counts a live bank rail for a corridor the user has not been offered', () => {
        // Germany's Bridge deposit rail is live for everyone in the list, even
        // before the user is enrolled on the euro corridor
        expect(hasAddMoneyRoute(DE, [], true)).toBe(true)
    })
})
