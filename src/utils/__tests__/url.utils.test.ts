import { shareableUrl } from '@/utils/url.utils'

describe('shareableUrl', () => {
    const originalLocation = window.location

    afterEach(() => {
        Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
    })

    const setOrigin = (origin: string) => {
        Object.defineProperty(window, 'location', { value: new URL(origin), writable: true })
    }

    it('prefixes a leading-slash path with the current origin', () => {
        setOrigin('https://staging.peanut.me')
        expect(shareableUrl('/receipt/abc?kind=QR_PAY')).toBe('https://staging.peanut.me/receipt/abc?kind=QR_PAY')
    })

    it('keeps a share from staging on staging (the bug this helper fixes)', () => {
        setOrigin('https://staging.peanut.me')
        expect(shareableUrl('/receipt/xyz?kind=QR_PAY').startsWith('https://staging.peanut.me/')).toBe(true)
    })

    it('uses the public BASE_URL in Capacitor, not the localhost WebView origin', () => {
        jest.resetModules()
        jest.doMock('@/utils/capacitor', () => ({ isCapacitor: () => true }))
        setOrigin('https://localhost')
        const { shareableUrl: scoped } = require('@/utils/url.utils')
        const link = scoped('/invite?code=demo')
        expect(link).not.toContain('localhost')
        expect(link.endsWith('/invite?code=demo')).toBe(true)
        jest.dontMock('@/utils/capacitor')
        jest.resetModules()
    })
})
