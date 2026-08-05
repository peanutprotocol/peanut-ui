import { getExchangeRateWidgetRedirectRoute } from '@/utils/exchangeRateWidget.utils'
import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))

const mockIsCapacitor = isCapacitor as jest.Mock

// The "Try it!" button routes through this util. In the native static export the
// `[country]` dynamic routes are stripped, so a path-segment URL lands on a
// non-existent route and the app hangs — native must get `?country=` instead.
describe('getExchangeRateWidgetRedirectRoute', () => {
    afterEach(() => mockIsCapacitor.mockReturnValue(false))

    describe('web (path segments)', () => {
        beforeEach(() => mockIsCapacitor.mockReturnValue(false))

        it('USD → MXN with balance routes to the withdraw country page', () => {
            expect(getExchangeRateWidgetRedirectRoute('USD', 'MXN', 100)).toBe('/withdraw/mexico')
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

        it('USD → MXN with balance uses ?country= (not the disabled /withdraw/mexico route)', () => {
            const route = getExchangeRateWidgetRedirectRoute('USD', 'MXN', 100)
            expect(route).toBe('/withdraw?country=mexico')
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
            expect(getExchangeRateWidgetRedirectRoute('USD', 'MXN', 100, ['europe'])).toBe('/withdraw/mexico')
        })

        it('native: region-driven add-money still uses ?country=', () => {
            mockIsCapacitor.mockReturnValue(true)
            expect(getExchangeRateWidgetRedirectRoute('USD', 'EUR', 0, ['europe'])).toBe('/add-money?country=germany')
        })
    })
})
