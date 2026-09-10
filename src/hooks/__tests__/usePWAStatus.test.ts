import { isStandaloneDisplayMode } from '../usePWAStatus'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))

const setHref = (path: string) => {
    window.history.pushState({}, '', path)
}

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() })),
    })
})

afterEach(() => {
    setHref('/')
})

describe('isStandaloneDisplayMode', () => {
    it('is false in a plain browser tab', () => {
        expect(isStandaloneDisplayMode()).toBe(false)
    })

    it('detects mode=pwa regardless of query-parameter order', () => {
        setHref('/?mode=pwa')
        expect(isStandaloneDisplayMode()).toBe(true)
        setHref('/?utm_source=x&mode=pwa')
        expect(isStandaloneDisplayMode()).toBe(true)
    })

    it('does not match a mode value that merely contains pwa', () => {
        setHref('/?mode=pwabc')
        expect(isStandaloneDisplayMode()).toBe(false)
    })
})
