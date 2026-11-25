/** @jest-environment node */
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { CREATOR_PAGE_EXPERIMENTS } from '../experiments'
import { isCreatorPageLabel } from '../label'
import { CREATOR_PAGE_COMPONENTS } from '../page-components'
import { selectCreatorPage } from '../registry'
import { USER_AGENTS } from './user-agents'

const mockCookies = new Map<string, string>()
const mockSet = jest.fn()
let mockRequestHeaders = new Headers()
jest.mock('next/headers', () => ({
    headers: async () => mockRequestHeaders,
    cookies: async () => ({
        get: (name: string) => (mockCookies.has(name) ? { name, value: mockCookies.get(name) } : undefined),
        set: mockSet,
    }),
}))

beforeEach(() => {
    mockCookies.clear()
    mockRequestHeaders = new Headers()
})
afterEach(() => jest.restoreAllMocks())

describe('selectCreatorPage', () => {
    it('returns null for a creator without an experiment, including Object.prototype names', async () => {
        expect(await selectCreatorPage('nobody')).toBeNull()
        expect(await selectCreatorPage('constructor')).toBeNull()
        expect(await selectCreatorPage('tostring')).toBeNull()
    })

    it('keeps the variant from the cookie and never sets a cookie', async () => {
        const { id } = CREATOR_PAGE_EXPERIMENTS.juanacervio
        jest.spyOn(Math, 'random').mockReturnValue(0)
        mockCookies.set('cpv_juanacervio', `${id}.e1`)
        const selection = await selectCreatorPage('juanacervio')
        expect(selection?.Page).toBe(CREATOR_PAGE_COMPONENTS.juanacervio.e1)
        expect(selection?.props).toEqual({
            username: 'juanacervio',
            experimentId: 'nita-2026-11-a',
            variant: 'e1',
            deviceOs: 'other',
            liftCta: false,
            locale: 'en',
        })
        expect(mockSet).not.toHaveBeenCalled()
    })

    it('reads the device and the bottom lift from the user agent', async () => {
        mockRequestHeaders = new Headers({ 'user-agent': USER_AGENTS.instagramIos })
        expect((await selectCreatorPage('juanacervio'))?.props).toMatchObject({ deviceOs: 'ios', liftCta: true })
    })

    it('picks the language by the landing-page rule: cookie, then browser language with the country', async () => {
        const locale = async () => (await selectCreatorPage('juanacervio'))?.props.locale
        mockRequestHeaders = new Headers({ 'user-agent': USER_AGENTS.instagramIos })
        expect(await locale()).toBe('en')
        mockRequestHeaders = new Headers({
            'user-agent': USER_AGENTS.instagramIos,
            'accept-language': 'pt-BR,pt;q=0.9',
        })
        expect(await locale()).toBe('pt-br')
        mockRequestHeaders = new Headers({ 'user-agent': USER_AGENTS.instagramIos, 'accept-language': 'es-419' })
        expect(await locale()).toBe('es-419')
        mockRequestHeaders = new Headers({
            'user-agent': USER_AGENTS.instagramIos,
            'accept-language': 'es-419',
            'x-vercel-ip-country': 'AR',
        })
        expect(await locale()).toBe('es-ar')
        // An unsupported language falls back to English, as on every landing page.
        mockRequestHeaders = new Headers({ 'user-agent': USER_AGENTS.instagramIos, 'accept-language': 'fr-FR' })
        expect(await locale()).toBe('en')
        // The language picked on peanut.me (the shared app-locale cookie) wins.
        mockCookies.set('app-locale', 'pt-BR')
        mockRequestHeaders = new Headers({ 'user-agent': USER_AGENTS.instagramIos, 'accept-language': 'es-AR' })
        expect(await locale()).toBe('pt-br')
    })

    it.each([
        ['an English browser', { 'accept-language': 'en-GB' }],
        ['a Brazilian browser', { 'accept-language': 'pt-BR,pt;q=0.9' }],
        ['a Mexican browser', { 'accept-language': 'es-MX', 'x-vercel-ip-country': 'MX' }],
        ['a Latin American Chrome in Argentina', { 'accept-language': 'es-419', 'x-vercel-ip-country': 'AR' }],
        ['a French browser', { 'accept-language': 'fr-FR' }],
        ['a crawler', { 'accept-language': 'es-AR', 'user-agent': 'facebookexternalhit/1.1' }],
    ])('gives %s the language that peanut.me/ gives it', async (_case, language: Record<string, string>) => {
        const request = { 'user-agent': USER_AGENTS.instagramIos, ...language }
        const { proxy } = await import('@/proxy')
        const { NextRequest } = await import('next/server')
        const landing = proxy(new NextRequest(new URL('https://peanut.me/'), { headers: request }))
        const landingLocale = new URL(landing.headers.get('location') ?? 'https://peanut.me/en').pathname.slice(1)
        mockRequestHeaders = new Headers(request)
        expect((await selectCreatorPage('juanacervio'))?.props.locale).toBe(landingLocale)
    })

    it('picks by weight without a cookie or with one from an older experiment', async () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.5)
        expect((await selectCreatorPage('juanacervio'))?.props.variant).toBe('g2')
        mockCookies.set('cpv_juanacervio', 'nita-2026-10-z.a1')
        expect((await selectCreatorPage('juanacervio'))?.props.variant).toBe('g2')
    })

    it.each(['dnt', 'sec-gpc'])('ignores the cookie on a request that carries %s: 1', async (header) => {
        // The cookie says e1; a visitor who has since refused tracking gets a fresh pick (0.5 → g2).
        jest.spyOn(Math, 'random').mockReturnValue(0.5)
        mockCookies.set('cpv_juanacervio', `${CREATOR_PAGE_EXPERIMENTS.juanacervio.id}.e1`)
        mockRequestHeaders = new Headers({ [header]: '1' })
        expect((await selectCreatorPage('juanacervio'))?.props.variant).toBe('g2')
        mockRequestHeaders = new Headers({ [header]: '0' })
        expect((await selectCreatorPage('juanacervio'))?.props.variant).toBe('e1')
    })

    it('draws once per selection: later random values do not change the pick', async () => {
        const random = jest.spyOn(Math, 'random')
        random.mockReturnValueOnce(0.9).mockReturnValueOnce(0.1).mockReturnValue(0.5)
        expect((await selectCreatorPage('juanacervio'))?.props.variant).toBe('e1')
        random.mockReset().mockReturnValueOnce(0.1).mockReturnValueOnce(0.9).mockReturnValue(0.5)
        expect((await selectCreatorPage('juanacervio'))?.props.variant).toBe('a1')
        random.mockReset().mockReturnValueOnce(0.5).mockReturnValueOnce(0.9).mockReturnValue(0.1)
        expect((await selectCreatorPage('juanacervio'))?.props.variant).toBe('g2')
    })

    it('gives every new visitor a page, in the shares the weights set', async () => {
        const DRAWS = 6000
        const counts: Record<string, number> = {}
        for (let i = 0; i < DRAWS; i++) {
            const variant = (await selectCreatorPage('juanacervio'))?.props.variant ?? 'null'
            counts[variant] = (counts[variant] ?? 0) + 1
        }
        // Real Math.random. One arm of 6,000 equal draws has a standard deviation of 37, so ±250 is
        // more than six of them: the old per-variant draw (33% / 22% / 15% / 30% no page) fails, chance does not.
        expect(Object.keys(counts).sort()).toEqual(['a1', 'e1', 'g2'])
        for (const count of Object.values(counts)) expect(Math.abs(count - DRAWS / 3)).toBeLessThan(250)
    })
})

describe('CREATOR_PAGE_EXPERIMENTS', () => {
    it('has valid ids and weights', () => {
        for (const [username, experiment] of Object.entries(CREATOR_PAGE_EXPERIMENTS)) {
            // The route lowercases the path before the lookup, so a key with a capital never matches.
            expect(username).toMatch(/^[a-z0-9]+$/)
            expect(isCreatorPageLabel(experiment.id)).toBe(true)
            for (const locale of SUPPORTED_LOCALES) expect(experiment.title[locale].trim()).not.toBe('')
            const ids = experiment.variants.map((variant) => variant.id)
            expect(new Set(ids).size).toBe(ids.length)
            for (const variant of experiment.variants) {
                expect(isCreatorPageLabel(variant.id)).toBe(true)
                expect(variant.weight).toBeGreaterThanOrEqual(0)
            }
        }
    })

    it('runs Nita as an equal three-way split', () => {
        expect(CREATOR_PAGE_EXPERIMENTS.juanacervio.id).toBe('nita-2026-11-a')
        expect(CREATOR_PAGE_EXPERIMENTS.juanacervio.variants.map(({ id, weight }) => [id, weight])).toEqual([
            ['a1', 1],
            ['g2', 1],
            ['e1', 1],
        ])
    })
})
