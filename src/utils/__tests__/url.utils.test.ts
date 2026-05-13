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
})
