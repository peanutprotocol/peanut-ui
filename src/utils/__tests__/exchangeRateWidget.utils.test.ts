import {
    getExchangeRateWidgetRedirectRoute,
    getExchangeRateWidgetRouteMinimum,
    toRoutePayloadAmount,
} from '@/utils/exchangeRateWidget.utils'
import { isCapacitor } from '@/utils/capacitor'
import { BRIDGE_OFFRAMP_MIN_USD } from '@/features/withdraw/amount-validation'
import {
    MIN_MANTECA_QR_PAYMENT_AMOUNT,
    MIN_MANTECA_WITHDRAW_AMOUNT,
    MIN_PIX_AMOUNT_BRL,
} from '@/constants/payment.consts'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))

const mockIsCapacitor = isCapacitor as jest.Mock

// The "Try it!" button routes through this util. In the native static export the
// `[country]` dynamic routes are stripped, so a path-segment URL lands on a
// non-existent route and the app hangs — native must get `?country=` instead.
describe('getExchangeRateWidgetRedirectRoute', () => {
    afterEach(() => mockIsCapacitor.mockReturnValue(false))

    describe('web (path segments)', () => {
        beforeEach(() => mockIsCapacitor.mockReturnValue(false))

        /*
         * The root method screen, not /withdraw/mexico: the country page
         * skips the saved accounts the normal entry offers first, so a saved
         * CBU/CLABE had to be typed again (TASK-22294). The currency rides
         * along to pre-filter the list behind "Select new method".
         */
        it('USD → MXN with balance routes to the withdraw method screen, currency pre-filtered', () => {
            expect(getExchangeRateWidgetRedirectRoute('USD', 'MXN', 100)).toBe('/withdraw?currencyCode=MXN')
        })

        it('USD → ARS with balance takes the same door as Send → Bank (saved accounts first)', () => {
            const route = getExchangeRateWidgetRedirectRoute('USD', 'ARS', 100)
            expect(route).toBe('/withdraw?currencyCode=ARS')
            expect(route).not.toContain('/withdraw/argentina')
        })

        it('USD → MXN with no balance routes to add-money', () => {
            expect(getExchangeRateWidgetRedirectRoute('USD', 'MXN', 0)).toBe('/add-money/usa')
        })

        it('MXN → USD routes to add-money for the source country', () => {
            expect(getExchangeRateWidgetRedirectRoute('MXN', 'USD', 100)).toBe('/add-money/mexico')
        })
    })

    describe('native (query params — the freeze fix)', () => {
        beforeEach(() => mockIsCapacitor.mockReturnValue(true))

        it('USD → MXN with balance stays on the root route (no disabled /withdraw/mexico segment)', () => {
            const route = getExchangeRateWidgetRedirectRoute('USD', 'MXN', 100)
            expect(route).toBe('/withdraw?currencyCode=MXN')
            expect(route).not.toContain('/withdraw/mexico')
        })

        it('USD → MXN with no balance uses /add-money?country=', () => {
            expect(getExchangeRateWidgetRedirectRoute('USD', 'MXN', 0)).toBe('/add-money?country=usa')
        })
    })

    // Add-money must never route through USD→US (USD is the global settlement
    // currency). It's driven by the user's unlocked region via the NON-USD side
    // of the pair; a locked hint region sends the user to the generic picker.
    describe('region-driven add-money (destination-currency hint)', () => {
        it('lands on the non-USD country when its region is unlocked', () => {
            // USD→MXN: hint is MXN (mexico, LATAM), not USD/US.
            expect(getExchangeRateWidgetRedirectRoute('USD', 'MXN', 0, ['latam'])).toBe('/add-money/mexico')
        })

        it('lands on the non-USD country regardless of which side USD is on', () => {
            expect(getExchangeRateWidgetRedirectRoute('BRL', 'USD', 0, ['latam'])).toBe('/add-money/brazil')
        })

        it('resolves a multi-country currency (EUR) to its region representative', () => {
            expect(getExchangeRateWidgetRedirectRoute('USD', 'EUR', 0, ['europe'])).toBe('/add-money/germany')
        })

        it('never sends a USD selection to the US when that region is locked', () => {
            // MXN hint region (LATAM) is locked; must NOT fall back to /add-money/usa.
            const route = getExchangeRateWidgetRedirectRoute('USD', 'MXN', 0, ['north-america'])
            expect(route).toBe('/add-money')
            expect(route).not.toContain('usa')
        })

        it('sends to the generic picker when the hint region is locked', () => {
            expect(getExchangeRateWidgetRedirectRoute('USD', 'EUR', 0, ['latam'])).toBe('/add-money')
        })

        it('sends to the generic picker when no regions are unlocked', () => {
            expect(getExchangeRateWidgetRedirectRoute('USD', 'EUR', 0, [])).toBe('/add-money')
        })

        it('does not touch the withdraw path (positive balance, already verified)', () => {
            expect(getExchangeRateWidgetRedirectRoute('USD', 'MXN', 100, ['europe'])).toBe('/withdraw?currencyCode=MXN')
        })

        it('native: region-driven add-money still uses ?country=', () => {
            mockIsCapacitor.mockReturnValue(true)
            expect(getExchangeRateWidgetRedirectRoute('USD', 'EUR', 0, ['europe'])).toBe('/add-money?country=germany')
        })
    })
})

/**
 * The floor the widget shows is the one the route behind the CTA enforces —
 * read from the flows' own constants, in the unit that flow states it
 * (TASK-22235, TASK-22297). `exchangeRate` is destination per 1 USD.
 */
describe('getExchangeRateWidgetRouteMinimum', () => {
    it('is the 1 BRL PIX network minimum for Brazil, not the 0.1 USD provider floor beneath it', () => {
        // 1 BRL ≈ 0.19 USD at 5.2, above the 0.1 USD floor — the BRL floor binds
        expect(getExchangeRateWidgetRouteMinimum('USD', 'BRL', 50, 5.2)).toEqual({
            amount: MIN_PIX_AMOUNT_BRL,
            currency: 'BRL',
        })
    })

    it('names the USD provider floor only if the rate ever put 1 BRL beneath it', () => {
        // a hypothetical 20 BRL per USD makes 1 BRL = 0.05 USD, so 0.1 USD binds
        expect(getExchangeRateWidgetRouteMinimum('USD', 'BRL', 50, 20)).toEqual({
            amount: MIN_MANTECA_QR_PAYMENT_AMOUNT,
            currency: 'USD',
        })
    })

    it('keeps the BRL floor while no rate has landed', () => {
        expect(getExchangeRateWidgetRouteMinimum('USD', 'BRL', 50, 0)).toEqual({
            amount: MIN_PIX_AMOUNT_BRL,
            currency: 'BRL',
        })
    })

    it('is the Manteca offramp minimum, in USD, for Argentina', () => {
        expect(getExchangeRateWidgetRouteMinimum('USD', 'ARS', 50, 1350)).toEqual({
            amount: MIN_MANTECA_WITHDRAW_AMOUNT,
            currency: 'USD',
        })
    })

    it('converts a Bridge corridor local minimum the way the amount step does (GB £3 → $4 at 0.79)', () => {
        expect(getExchangeRateWidgetRouteMinimum('USD', 'GBP', 50, 0.79)).toEqual({ amount: 4, currency: 'USD' })
        expect(getExchangeRateWidgetRouteMinimum('USD', 'MXN', 50, 18.5)).toEqual({ amount: 3, currency: 'USD' })
    })

    it('falls back to the Bridge $1 floor for a corridor whose rate has not landed', () => {
        expect(getExchangeRateWidgetRouteMinimum('USD', 'GBP', 50, 0)).toEqual({
            amount: BRIDGE_OFFRAMP_MIN_USD,
            currency: 'USD',
        })
    })

    it('is $1 for the euro area (€1 ≈ $1, no country path)', () => {
        expect(getExchangeRateWidgetRouteMinimum('USD', 'EUR', 50, 0.86)).toEqual({ amount: 1, currency: 'USD' })
    })

    it('has no floor for add-money routes: local → USD, or a zero balance', () => {
        expect(getExchangeRateWidgetRouteMinimum('BRL', 'USD', 50, 0.19)).toBeNull()
        expect(getExchangeRateWidgetRouteMinimum('USD', 'BRL', 0, 5.2)).toBeNull()
    })
})

/** The USD figure a withdraw route can carry: six decimals, truncated, never rounded up. */
describe('toRoutePayloadAmount', () => {
    it('truncates to the token decimals', () => {
        expect(toRoutePayloadAmount(0.9999999)).toBe(0.999999)
        expect(toRoutePayloadAmount(1.0000001)).toBe(1)
        expect(toRoutePayloadAmount(0.995)).toBe(0.995)
    })

    it('does not lose a cent to floating point on plain amounts', () => {
        expect(toRoutePayloadAmount(0.29)).toBe(0.29)
        expect(toRoutePayloadAmount(100)).toBe(100)
        expect(toRoutePayloadAmount(8.56)).toBe(8.56)
    })
})
