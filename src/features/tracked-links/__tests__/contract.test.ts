/** @jest-environment node */
import {
    bareGoVisit,
    GO_PLACEMENTS,
    type GoVisit,
    goHandoffPath,
    goTouch,
    parseGoRequest,
    parseGoSegment,
    parseGoVisitParams,
} from '../contract'

const request = (path: string, referer?: string) =>
    new Request(`https://peanut.me${path}`, referer ? { headers: { referer } } : undefined)
const visit = (overrides: Partial<GoVisit> = {}): GoVisit => ({ ...bareGoVisit('alice'), ...overrides })
const handoff = (path: string) => Object.fromEntries(new URL(path, 'https://peanut.me').searchParams)

describe('parseGoSegment', () => {
    it.each(Object.keys(GO_PLACEMENTS))('reads placement %s', (placement) => {
        expect(parseGoSegment(placement)).toEqual({ placement, code: null })
    })

    it('lowercases a placement', () => {
        expect(parseGoSegment('IG')).toEqual({ placement: 'ig', code: null })
    })

    it.each([
        ['1', 1],
        ['9999', 9999],
    ])('reads code %s', (segment, code) => {
        expect(parseGoSegment(segment)).toEqual({ placement: null, code })
    })

    it.each(['0', '07', '10000', 'zz', '%C4%80', 'Ā', '', 'constructor', '__proto__', undefined])(
        'treats %p as the bare link',
        (segment) => {
            expect(parseGoSegment(segment)).toEqual({ placement: null, code: null })
        }
    )
})

describe('parseGoRequest', () => {
    it('lowercases the username and segment', () => {
        expect(parseGoRequest(request('/go/Juanacervio/IG'), 'Juanacervio', ['IG'])).toMatchObject({
            username: 'juanacervio',
            placement: 'ig',
        })
    })

    it('rejects an invalid username', () => {
        expect(parseGoRequest(request('/go/a.b'), 'a.b')).toBeNull()
        expect(parseGoRequest(request('/go/x'), 'x'.repeat(65))).toBeNull()
    })

    it('treats more than one extra segment as the bare link', () => {
        expect(parseGoRequest(request('/go/alice/ig/7'), 'alice', ['ig', '7'])).toEqual(bareGoVisit('alice'))
    })

    it('keeps the first value of a duplicate key', () => {
        const parsed = parseGoRequest(request('/go/alice?utm_source=first&utm_source=second'), 'alice')
        expect(parsed?.utm.source).toBe('first')
    })

    it('keeps the four allowlisted utm values', () => {
        const parsed = parseGoRequest(
            request('/go/alice?utm_source=meta&utm_medium=cpc&utm_campaign=ar-push&utm_content=reel+2'),
            'alice'
        )
        expect(parsed?.utm).toEqual({ source: 'meta', medium: 'cpc', campaign: 'ar-push', content: 'reel 2' })
    })

    it.each([
        ['a 65-character value', `utm_campaign=${'a'.repeat(65)}`],
        ['an email', 'utm_campaign=a%40b.com'],
        ['a URL', 'utm_campaign=https%3A%2F%2Fevil.test'],
        ['a UUID', 'utm_campaign=123e4567-e89b-12d3-a456-426614174000'],
    ])('drops %s', (_name, query) => {
        expect(parseGoRequest(request(`/go/alice?${query}`), 'alice')?.utm.campaign).toBeNull()
    })

    it('keeps a 64-character value', () => {
        const value = 'a'.repeat(64)
        expect(parseGoRequest(request(`/go/alice?utm_campaign=${value}`), 'alice')?.utm.campaign).toBe(value)
    })

    it('drops a medium outside the closed list', () => {
        expect(parseGoRequest(request('/go/alice?utm_medium=banner'), 'alice')?.utm.medium).toBeNull()
    })

    it('never carries other query keys into the handoff', () => {
        const parsed = parseGoRequest(
            request(
                '/go/alice?fbclid=x&utm_term=y&tl=mallory&acq_invite=mallory&invite=mallory&code=mallory&badge_campaign=nita'
            ),
            'alice'
        )
        expect(handoff(goHandoffPath(parsed!))).toEqual({ app_entry: '1', tl: 'alice', acq_invite: 'alice' })
    })

    it('keeps an allowed referrer host', () => {
        expect(parseGoRequest(request('/go/alice', 'https://l.instagram.com/x'), 'alice')?.referrerHost).toBe(
            'l.instagram.com'
        )
    })

    it.each([
        'http://localhost:3000/',
        'http://192.168.0.1/',
        'https://peanut.me/invite',
        'https://www.peanut.me/',
        'not a url',
        undefined,
    ])('drops referrer %p', (referer) => {
        expect(parseGoRequest(request('/go/alice', referer), 'alice')?.referrerHost).toBeNull()
    })
})

describe('goTouch', () => {
    it('defaults medium and campaign for an untagged visit', () => {
        expect(goTouch(bareGoVisit('alice'))).toEqual({ utmMedium: 'ambassador', utmCampaign: 'go' })
    })

    it('fills every field from the visit', () => {
        expect(
            goTouch(
                visit({
                    placement: 'ig',
                    utm: { source: null, medium: 'cpc', campaign: 'ar-push', content: null },
                    referrerHost: 'l.instagram.com',
                })
            )
        ).toEqual({
            utmSource: 'instagram',
            utmMedium: 'cpc',
            utmCampaign: 'ar-push',
            referrerHost: 'l.instagram.com',
        })
    })

    it('lets the path win over the query for source and content', () => {
        expect(
            goTouch(visit({ placement: 'x', utm: { source: 'meta', medium: null, campaign: null, content: 'reel' } }))
        ).toMatchObject({ utmSource: 'twitter' })
        expect(
            goTouch(visit({ code: 7, utm: { source: 'meta', medium: null, campaign: null, content: 'reel' } }))
        ).toEqual({ utmSource: 'meta', utmMedium: 'ambassador', utmCampaign: 'go', utmContent: 'c7' })
    })

    const utm = (overrides: Partial<GoVisit['utm']>) => ({ ...bareGoVisit('alice').utm, ...overrides })
    it.each<[keyof ReturnType<typeof goTouch>, Partial<GoVisit>, string | undefined]>([
        ['utmSource', { placement: 'tt' }, 'tiktok'],
        ['utmSource', { utm: utm({ source: 'meta' }) }, 'meta'],
        ['utmSource', {}, undefined],
        ['utmMedium', { utm: utm({ medium: 'cpc' }) }, 'cpc'],
        ['utmMedium', {}, 'ambassador'],
        ['utmCampaign', { utm: utm({ campaign: 'ar-push' }) }, 'ar-push'],
        ['utmCampaign', {}, 'go'],
        ['utmContent', { code: 12 }, 'c12'],
        ['utmContent', { utm: utm({ content: 'reel' }) }, 'reel'],
        ['utmContent', {}, undefined],
        ['referrerHost', { referrerHost: 't.co' }, 't.co'],
        ['referrerHost', {}, undefined],
    ])('sets %s from %j to %p', (field, overrides, expected) => {
        expect(goTouch(visit(overrides))[field]).toBe(expected)
    })

    it('uses the query content when the path has no code', () => {
        expect(
            goTouch(visit({ utm: { source: null, medium: null, campaign: null, content: 'reel' } })).utmContent
        ).toBe('reel')
    })
})

describe('goHandoffPath', () => {
    it('carries only the inviter for a bare visit', () => {
        expect(goHandoffPath(bareGoVisit('alice'))).toBe('/home?app_entry=1&tl=alice&acq_invite=alice')
    })

    it('carries every tag in order', () => {
        const path = goHandoffPath(
            visit({
                placement: 'ig',
                utm: { source: 'meta', medium: 'cpc', campaign: 'ar-push', content: 'reel 2' },
                referrerHost: 'l.instagram.com',
            }),
            { variant: 'a1', experimentId: 'n1' }
        )
        expect(path).toBe(
            '/home?app_entry=1&tl=alice&acq_invite=alice&tl_s=ig&utm_source=meta&utm_medium=cpc&utm_campaign=ar-push&utm_content=reel+2&tl_r=l.instagram.com&tl_v=a1&tl_e=n1'
        )
    })

    it('carries a code as tl_s', () => {
        expect(handoff(goHandoffPath(visit({ code: 9999 }))).tl_s).toBe('9999')
    })
})

describe('parseGoVisitParams', () => {
    it('round-trips a handoff', () => {
        const original = visit({
            code: 7,
            utm: { source: 'meta', medium: 'cpc', campaign: 'ar-push', content: 'reel 2' },
            referrerHost: 'l.instagram.com',
        })
        const params = new URL(goHandoffPath(original), 'https://peanut.me').searchParams
        expect(parseGoVisitParams(params)).toEqual(original)
    })

    it('re-checks every value it reads', () => {
        const params = new URLSearchParams(
            'tl=alice&tl_s=zz&utm_medium=banner&utm_campaign=a%40b.com&tl_r=localhost&utm_term=x'
        )
        expect(parseGoVisitParams(params)).toEqual(bareGoVisit('alice'))
    })

    it('returns null without a valid tl', () => {
        expect(parseGoVisitParams(new URLSearchParams('code=alice'))).toBeNull()
        expect(parseGoVisitParams(new URLSearchParams('tl=a.b'))).toBeNull()
        expect(parseGoVisitParams(new URLSearchParams('tl=Alice'))).toBeNull()
    })
})
