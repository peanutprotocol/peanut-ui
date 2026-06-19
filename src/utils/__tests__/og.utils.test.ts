import { buildOgImageUrl } from '@/utils/og.utils'

const SITE_URL = 'https://peanut.me'
const parse = (url: string) => new URL(url)

describe('buildOgImageUrl', () => {
    it('builds an absolute /api/og URL on the given origin', () => {
        const url = parse(buildOgImageUrl({ type: 'send' }, SITE_URL))
        expect(url.origin + url.pathname).toBe('https://peanut.me/api/og')
        expect(url.searchParams.get('type')).toBe('send')
    })

    it('send + amount (unclaimed claim link)', () => {
        const p = parse(
            buildOgImageUrl({ type: 'send', username: 'kkonrad', amount: '100', token: 'USDC' }, SITE_URL)
        ).searchParams
        expect(p.get('type')).toBe('send')
        expect(p.get('username')).toBe('kkonrad')
        expect(p.get('amount')).toBe('100')
        expect(p.get('token')).toBe('USDC')
        expect(p.get('isReceipt')).toBeNull()
    })

    it('send + isReceipt omits amount/token (claimed claim link)', () => {
        const p = parse(buildOgImageUrl({ type: 'send', username: 'kkonrad', isReceipt: true }, SITE_URL)).searchParams
        expect(p.get('isReceipt')).toBe('true')
        expect(p.get('amount')).toBeNull()
        expect(p.get('token')).toBeNull()
    })

    it('request + peanut username + amount 0 (address/profile request)', () => {
        const p = parse(
            buildOgImageUrl({ type: 'request', username: 'kkonrad', amount: '0', isPeanutUsername: true }, SITE_URL)
        ).searchParams
        expect(p.get('type')).toBe('request')
        expect(p.get('amount')).toBe('0')
        expect(p.get('isPeanutUsername')).toBe('true')
    })

    it('invite has no type param and sets isInvite', () => {
        const p = parse(buildOgImageUrl({ username: 'kkonrad', isInvite: true }, SITE_URL)).searchParams
        expect(p.get('type')).toBeNull()
        expect(p.get('isInvite')).toBe('true')
        expect(p.get('username')).toBe('kkonrad')
    })

    it('omits empty amount/token and false flags', () => {
        const p = parse(
            buildOgImageUrl(
                { type: 'send', username: '', amount: '', token: undefined, isReceipt: false, isPeanutUsername: false },
                SITE_URL
            )
        ).searchParams
        expect([...p.keys()]).toEqual(['type'])
    })

    it('includes a numeric zero amount', () => {
        const p = parse(buildOgImageUrl({ type: 'request', amount: 0 }, SITE_URL)).searchParams
        expect(p.get('amount')).toBe('0')
    })
})
