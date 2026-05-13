import { shareableUrl } from '@/utils/url.utils'

describe('shareableUrl', () => {
    const originalWindow = global.window
    afterEach(() => {
        global.window = originalWindow
    })

    const setOrigin = (origin: string) => {
        Object.defineProperty(window, 'location', {
            value: new URL(origin),
            writable: true,
        })
    }

    it('prefixes a leading-slash path with the current origin', () => {
        setOrigin('https://staging.peanut.me')
        expect(shareableUrl('/receipt/abc?kind=QR_PAY')).toBe('https://staging.peanut.me/receipt/abc?kind=QR_PAY')
    })

    it('inserts a slash when the path does not start with one', () => {
        setOrigin('https://peanut.me')
        expect(shareableUrl('claim?c=1&v=v4')).toBe('https://peanut.me/claim?c=1&v=v4')
    })

    it('returns absolute http(s) URLs unchanged', () => {
        setOrigin('https://peanut.me')
        expect(shareableUrl('https://external.example.com/x')).toBe('https://external.example.com/x')
        expect(shareableUrl('http://localhost:3050/x')).toBe('http://localhost:3050/x')
    })

    it('keeps a share from staging on staging (the bug this helper fixes)', () => {
        setOrigin('https://staging.peanut.me')
        expect(shareableUrl('/receipt/xyz?kind=QR_PAY').startsWith('https://staging.peanut.me/')).toBe(true)
    })
})
