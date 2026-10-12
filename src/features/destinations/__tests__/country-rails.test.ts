/**
 * The country pick reads the real catalog, so the catalog is what decides
 * whether a country shows its rail list or skips it. The unit tests above the
 * pick (WithdrawMethodView) mock this helper, so without these cases a catalog
 * change would silently move users onto — or off — the shortcut.
 */
import { COUNTRY_SPECIFIC_METHODS } from '@/components/AddMoney/consts'
import { isSendToBankCountry, liveRailsForCountry, soleLiveRailForCountry } from '../country-rails'

describe('liveRailsForCountry — withdraw', () => {
    it('a SEPA country has one rail: the bank transfer', () => {
        const rails = liveRailsForCountry('DEU', 'withdraw')
        expect(rails.map((rail) => rail.id)).toEqual(['deu-default-bank-withdraw'])
    })

    it('the US has one rail — Cash App and Venmo are not live', () => {
        expect(soleLiveRailForCountry('US', 'withdraw')?.id).toBe('us-default-bank-withdraw')
    })

    it('Argentina has one bank/wallet rail, including Mercado Pago', () => {
        const rails = liveRailsForCountry('AR', 'withdraw')
        expect(rails.map((rail) => rail.title)).toEqual(['To Bank'])
        expect(soleLiveRailForCountry('AR', 'withdraw')?.path).toBe(
            '/withdraw/manteca?method=bank-transfer&country=argentina'
        )
    })

    it('Brazil has one, and it routes to its own flow', () => {
        const rail = soleLiveRailForCountry('BR', 'withdraw')
        expect(rail?.title).toBe('Pix')
        expect(rail?.path).toContain('/withdraw/manteca')
    })

    it('a country with no live rail keeps its list, which shows the coming-soon state', () => {
        expect(liveRailsForCountry('IN', 'withdraw')).toEqual([])
        expect(soleLiveRailForCountry('IN', 'withdraw')).toBeNull()
    })

    it('crypto never counts — it sits beside the country list', () => {
        const rails = liveRailsForCountry('DEU', 'withdraw')
        expect(rails.some((rail) => rail.id === 'crypto-withdraw')).toBe(false)
    })
})

describe('liveRailsForCountry — add', () => {
    it('only the bank rail counts, because the user already chose "Bank"', () => {
        const rail = soleLiveRailForCountry('DEU', 'add')
        expect(rail?.id).toBe('bank-transfer-add')
        expect(rail?.path).toBe('/add-money/germany/bank')
    })

    it('a Manteca country sends the deposit to its own screen', () => {
        expect(soleLiveRailForCountry('AR', 'add')?.path).toBe('/add-money/argentina/manteca')
    })

    it('a country where bank deposits are not live yet keeps its per-country screen', () => {
        expect(soleLiveRailForCountry('IN', 'add')).toBeNull()
    })
})

it('never offers crypto again inside any country withdrawal list', () => {
    for (const methods of Object.values(COUNTRY_SPECIFIC_METHODS)) {
        expect(methods.withdraw.some((method) => method.id === 'crypto-withdraw')).toBe(false)
    }
})

describe('isSendToBankCountry — who a send-to-bank can pay', () => {
    it('a Bridge bank corridor, by 2- or 3-letter id', () => {
        expect(isSendToBankCountry({ id: 'DEU', path: 'germany' })).toBe(true)
        expect(isSendToBankCountry({ id: 'PL', path: 'poland' })).toBe(true)
        expect(isSendToBankCountry({ id: 'US', path: 'usa' })).toBe(true)
        expect(isSendToBankCountry({ id: 'CO', path: 'colombia' })).toBe(true)
    })

    it('Brazil, over PIX to a third-party key', () => {
        expect(isSendToBankCountry({ id: 'BR', path: 'brazil' })).toBe(true)
    })

    it('not Argentina: its rails are own-account offramps', () => {
        expect(isSendToBankCountry({ id: 'AR', path: 'argentina' })).toBe(false)
    })

    it('not a country with no rail', () => {
        expect(isSendToBankCountry({ id: 'IN', path: 'india' })).toBe(false)
    })
})
