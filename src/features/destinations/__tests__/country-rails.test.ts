/**
 * The country pick reads the real catalog, so the catalog is what decides
 * whether a country shows its rail list or skips it. The unit tests above the
 * pick (WithdrawMethodView) mock this helper, so without these cases a catalog
 * change would silently move users onto — or off — the shortcut.
 */
import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import { COUNTRY_SPECIFIC_METHODS } from '@/components/AddMoney/consts'
import { isSendToBankCountry, liveRailsForCountry, sendOffersPix, soleLiveRailForCountry } from '../country-rails'

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

    // TASK-21375: a second "Mercado Pago" row opened the same screen as the bank row
    it('Argentina lists one way in by bank, not a second row into the same screen', () => {
        const rows = COUNTRY_SPECIFIC_METHODS.AR.add.filter((method) => method.id !== 'crypto-add')
        expect(rows.map((method) => [method.id, method.path])).toEqual([
            ['bank-transfer-add', '/add-money/argentina/manteca'],
        ])
    })

    it('Argentina’s one row carries the Mercado Pago icon; other countries keep theirs', () => {
        const bankRow = (country: string) =>
            COUNTRY_SPECIFIC_METHODS[country].add.find((method) => method.id === 'bank-transfer-add')
        expect(bankRow('AR')?.icon).toBe(MERCADO_PAGO)
        for (const country of ['BR', 'DEU', 'US', 'MX']) expect(bankRow(country)?.icon).toBe('bank')
        expect(COUNTRY_SPECIFIC_METHODS.BR.add.find((method) => method.id === 'pix-add')?.icon).toBe(PIX)
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
        expect(isSendToBankCountry({ id: 'DEU', path: 'germany' }, null)).toBe(true)
        expect(isSendToBankCountry({ id: 'PL', path: 'poland' }, null)).toBe(true)
        expect(isSendToBankCountry({ id: 'US', path: 'usa' }, null)).toBe(true)
        expect(isSendToBankCountry({ id: 'CO', path: 'colombia' }, null)).toBe(true)
    })

    it('Brazil, over PIX to a third-party key', () => {
        expect(isSendToBankCountry({ id: 'BR', path: 'brazil' }, null)).toBe(true)
    })

    it('not Argentina: its rails are own-account offramps', () => {
        expect(isSendToBankCountry({ id: 'AR', path: 'argentina' }, null)).toBe(false)
    })

    it('not a country with no rail', () => {
        expect(isSendToBankCountry({ id: 'IN', path: 'india' }, null)).toBe(false)
    })

    // live test on staging, 2026-11-12: a resident picked BRL and reached a block screen with no way on
    describe('a resident of Brazil, whose pay route refuses the residence', () => {
        it('is not offered Brazil', () => {
            expect(isSendToBankCountry({ id: 'BR', path: 'brazil' }, 'residence')).toBe(false)
            expect(sendOffersPix('residence')).toBe(false)
        })

        it('keeps every other answer', () => {
            expect(isSendToBankCountry({ id: 'DEU', path: 'germany' }, 'residence')).toBe(true)
            expect(isSendToBankCountry({ id: 'US', path: 'usa' }, 'residence')).toBe(true)
            expect(isSendToBankCountry({ id: 'AR', path: 'argentina' }, 'residence')).toBe(false)
            expect(isSendToBankCountry({ id: 'IN', path: 'india' }, 'residence')).toBe(false)
        })
    })

    it('the Brazil pause keeps Brazil listed: the pause lifts, and its screen says so', () => {
        expect(isSendToBankCountry({ id: 'BR', path: 'brazil' }, 'paused')).toBe(true)
        expect(sendOffersPix('paused')).toBe(true)
        expect(sendOffersPix(null)).toBe(true)
    })
})
