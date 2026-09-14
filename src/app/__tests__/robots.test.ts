jest.mock('@/constants/general.consts', () => ({ BASE_URL: 'https://peanut.me' }))
jest.mock('@/i18n/types', () => ({ SUPPORTED_LOCALES: ['en', 'es-419'] }))

import { GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS, ROBOTS_DISALLOWED_PATHS } from '@/constants/seo-route-policy'
import robots from '../robots'

type RobotsRule = {
    userAgent: string | string[]
    allow?: string | string[]
    disallow?: string | string[]
    crawlDelay?: number
}

// robots() derives production-ness from the RAW env at call time (fail-closed,
// shared with layout.tsx via isProductionDomain) — pin it for the policy suite.
process.env.NEXT_PUBLIC_BASE_URL = 'https://peanut.me'
const rules = robots().rules as RobotsRule[]

function ruleFor(userAgent: string): RobotsRule {
    const rule = rules.find((candidate) => candidate.userAgent === userAgent)
    if (!rule) throw new Error(`Missing robots rule for ${userAgent}`)
    return rule
}

describe('production robots policy', () => {
    it('lets Google recrawl only the exact indexed app shells needed for deindexing', () => {
        const googlebot = ruleFor('Googlebot')

        expect(googlebot.allow).toEqual(['/api/og', ...GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS])
        expect(googlebot.disallow).toEqual(ROBOTS_DISALLOWED_PATHS)
    })

    it('gives generic crawlers the same narrow deindexing exceptions', () => {
        const generic = ruleFor('*')

        expect(generic.allow).toEqual(expect.arrayContaining([...GOOGLE_DEINDEX_CRAWL_ALLOW_PATHS]))
        expect(generic.disallow).toEqual(ROBOTS_DISALLOWED_PATHS)
    })

    it.each(['AhrefsBot', 'SemrushBot', 'MJ12bot'])('%s does not bypass the shared disallow policy', (bot) => {
        const rule = ruleFor(bot)

        expect(rule.disallow).toEqual(ROBOTS_DISALLOWED_PATHS)
        expect(rule.crawlDelay).toBe(10)
    })

    it('keeps Twitterbot unrestricted for shared-link previews', () => {
        expect(ruleFor('Twitterbot')).toMatchObject({ allow: ['/api/og'], disallow: [] })
    })
})

// The old derivation compared BASE_URL, whose production fallback made an
// UNSET environment indexable. The check must fail closed on the raw env.
describe('non-production robots policy fails closed', () => {
    const ORIGINAL_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL

    afterEach(() => {
        if (ORIGINAL_BASE_URL === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
        else process.env.NEXT_PUBLIC_BASE_URL = ORIGINAL_BASE_URL
    })

    it.each([undefined, '', 'https://staging.peanut.me', 'https://peanut.me.evil.example'])(
        'blocks all crawling when the production origin is not explicit (%s)',
        (baseUrl) => {
            if (baseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
            else process.env.NEXT_PUBLIC_BASE_URL = baseUrl

            expect(robots().rules).toEqual([{ userAgent: '*', disallow: ['/'] }])
        }
    )

    it('tolerates a trailing slash on the configured production origin', () => {
        process.env.NEXT_PUBLIC_BASE_URL = 'https://peanut.me/'

        expect(robots().rules).not.toEqual([{ userAgent: '*', disallow: ['/'] }])
    })
})
