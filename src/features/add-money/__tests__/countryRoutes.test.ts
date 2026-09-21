import { addMoneyRoutesForCountry, corridorTopUpHref, hasAddMoneyRoute, prefersStandingAccount } from '../countryRoutes'
import type { ClaimableCorridor, DepositAccountView } from '@/features/deposit-accounts/types'
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
    /**
     * Brazil has one way in by bank: the Pix top-up. Reais stay on the
     * per-payment code, so there is no standing corridor beside it to choose
     * between, with the accounts flag on or off.
     */
    it.each([[true], [false]])('sends Brazil to the Pix top-up (accounts flag %s)', (enabled) => {
        expect(routes(BR, [], enabled)).toEqual([
            { corridor: 'PIX_BR', kind: 'top-up', href: '/add-money/brazil/manteca' },
        ])
    })

    /**
     * COP is endorsement-gated, not residence-gated, so Colombia follows the
     * ordinary rule: the corridor is a route where the user's rails name it.
     */
    it('offers Colombia its Bre-B account only where the rail is the user’s', () => {
        expect(routes(CO, ['BANK_TRANSFER_CO'])).toEqual([{ corridor: 'BANK_TRANSFER_CO', kind: 'standing' }])
        expect(routes(CO)).toEqual([])
    })

    /**
     * Both ways in, not one. This used to answer with the standing account
     * alone, on the reading that an account is always the better answer. It is
     * not always an AVAILABLE one — at the account cap the user holds none and
     * can open none — and dropping the top-up left them with no route at all,
     * while the transfer they send themselves kept working the whole time.
     */
    it('offers a euro member both the standing account and the transfer it needs no account for', () => {
        expect(routes(DE, ['SEPA_EU'])).toEqual([
            { corridor: 'SEPA_EU', kind: 'standing' },
            { corridor: 'SEPA_EU', kind: 'top-up', href: '/add-money/germany/bank' },
        ])
    })

    // The capped user's route. They are offered the corridor, so the old rule
    // gave them the standing account and nothing else; `useDepositCountryRouting`
    // then had no fallback to reach. The top-up is what they can actually use.
    it('keeps the transfer for a user who is offered the corridor but holds no account', () => {
        expect(routes(DE, ['SEPA_EU'])).toContainEqual({
            corridor: 'SEPA_EU',
            kind: 'top-up',
            href: '/add-money/germany/bank',
        })
    })

    // Not offered the corridor at all: the transfer is still the whole answer,
    // and it was there before standing accounts existed.
    it('offers the transfer alone where the user has no rail for the corridor', () => {
        expect(routes(DE)).toEqual([{ corridor: 'SEPA_EU', kind: 'top-up', href: '/add-money/germany/bank' }])
    })

    // Brazil's two routes are the same href — the Pix top-up is both the
    // corridor's own flow and the country's live rail — so it appears once.
    it('does not offer one flow twice where the corridor and the country name the same href', () => {
        expect(routes(BR, [], true)).toHaveLength(1)
    })

    it('has no route for a country the catalogue does not name', () => {
        expect(routes(NG, ['SEPA_EU'])).toEqual([])
    })
})

describe('prefersStandingAccount', () => {
    const account = (status: string) => ({ status }) as DepositAccountView
    const terms = (blockedBy?: string) => ({ blockedBy }) as unknown as ClaimableCorridor

    it('prefers the account the user holds and can be paid into', () => {
        expect(prefersStandingAccount(account('active'), undefined)).toBe(true)
        expect(prefersStandingAccount(account('provisioning'), undefined)).toBe(true)
        expect(prefersStandingAccount(account('retiring'), undefined)).toBe(true)
    })

    it('prefers a corridor the user can open on this tap', () => {
        expect(prefersStandingAccount(undefined, terms(undefined))).toBe(true)
    })

    /**
     * The headline case. At the cap the user holds no account for the corridor
     * and the tap cannot produce one, so the standing account is not an answer
     * to "how do I add money" — the transfer is.
     */
    it('does not prefer a corridor the backend offers but blocks', () => {
        expect(prefersStandingAccount(undefined, terms('account-limit'))).toBe(false)
        expect(prefersStandingAccount(undefined, terms('endorsement-required'))).toBe(false)
        expect(prefersStandingAccount(undefined, terms('endorsement-pending'))).toBe(false)
    })

    it('does not prefer an account that cannot take money', () => {
        expect(prefersStandingAccount(account('revoked'), undefined)).toBe(false)
        expect(prefersStandingAccount(account('unavailable'), undefined)).toBe(false)
    })

    it('prefers nothing when the backend has said nothing', () => {
        expect(prefersStandingAccount(undefined, undefined)).toBe(false)
    })
})

describe('corridorTopUpHref', () => {
    it('sends a single-country corridor to that country’s own bank flow', () => {
        expect(corridorTopUpHref('ACH_US')).toBe('/add-money/usa/bank')
        expect(corridorTopUpHref('SPEI_MX')).toBe('/add-money/mexico/bank')
    })

    // The euro corridor covers every member, so the user's own residence picks
    // which one opens rather than an arbitrary first entry in the catalogue.
    it('picks the euro member the user lives in', () => {
        expect(corridorTopUpHref('SEPA_EU', ['PT'])).toBe('/add-money/portugal/bank')
        expect(corridorTopUpHref('SEPA_EU', ['de'])).toBe('/add-money/germany/bank')
    })

    it('still answers for a euro user we know no residence for', () => {
        expect(corridorTopUpHref('SEPA_EU')).toMatch(/^\/add-money\/[a-z-]+\/bank$/)
    })

    // Colombia's deposit rail is not live, so there is no transfer to offer and
    // no screen may pretend otherwise.
    it('offers nothing where the corridor has no live country behind it', () => {
        expect(corridorTopUpHref('BANK_TRANSFER_CO')).toBeUndefined()
    })

    it('answers a corridor nobody can hold with its own flow', () => {
        expect(corridorTopUpHref('PIX_BR')).toBe('/add-money/brazil/manteca')
        expect(corridorTopUpHref('BANK_TRANSFER_AR')).toBe('/add-money/argentina/manteca')
    })
})

describe('hasAddMoneyRoute', () => {
    it('keeps Brazil off the waitlist, rail of its own or not', () => {
        expect(hasAddMoneyRoute(BR, [], true)).toBe(true)
    })

    // Colombia has no legacy bank rail behind it, so the COP corridor is the
    // whole answer: offered, it is a route; not offered, the row waitlists.
    it('answers Colombia with the corridor the user is offered, and nothing else', () => {
        expect(hasAddMoneyRoute(CO, ['BANK_TRANSFER_CO'], true)).toBe(true)
        expect(hasAddMoneyRoute(CO, [], true)).toBe(false)
    })

    it('offers the waitlist where there is no corridor and no live bank rail', () => {
        expect(hasAddMoneyRoute(NG, [], true)).toBe(false)
    })

    it('still counts a live bank rail for a corridor the user has not been offered', () => {
        // Germany's Bridge deposit rail is live for everyone in the list, even
        // before the user is enrolled on the euro corridor
        expect(hasAddMoneyRoute(DE, [], true)).toBe(true)
    })
})
