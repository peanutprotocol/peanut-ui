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
})
