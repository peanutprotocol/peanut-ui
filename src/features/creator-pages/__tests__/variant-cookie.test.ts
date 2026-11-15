import { expireVariantCookie, parseVariantCookie, serializeVariantCookie, variantCookieName } from '../variant-cookie'

describe('variant cookie', () => {
    it('parses <experimentId>.<variantId>', () => {
        expect(parseVariantCookie('nita-2026-11-a.g2')).toEqual({ experimentId: 'nita-2026-11-a', variantId: 'g2' })
    })

    it.each([
        undefined,
        null,
        '',
        'g2',
        '.g2',
        'exp.',
        'a.b.c',
        'Exp.g2',
        'exp.g 2',
        'exp.-g2',
        '-exp.g2',
        `exp.${'a'.repeat(33)}`,
    ])('rejects %p', (value) => {
        expect(parseVariantCookie(value)).toBeNull()
    })

    it('serialises a 30-day cookie scoped to /go that parses back', () => {
        const cookie = serializeVariantCookie('juanacervio', { experimentId: 'nita-2026-11-a', variantId: 'a1' })
        expect(cookie).toBe('cpv_juanacervio=nita-2026-11-a.a1; Max-Age=2592000; Path=/go; SameSite=Lax; Secure')
        expect(variantCookieName('juanacervio')).toBe('cpv_juanacervio')
        expect(parseVariantCookie(cookie.split(';')[0].split('=')[1])).toEqual({
            experimentId: 'nita-2026-11-a',
            variantId: 'a1',
        })
    })

    it('expires the cookie under the scope it was written with', () => {
        expect(expireVariantCookie('juanacervio')).toBe('cpv_juanacervio=; Max-Age=0; Path=/go; SameSite=Lax; Secure')
    })
})
