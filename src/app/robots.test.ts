/** @jest-environment node */

import type { MetadataRoute } from 'next'
import { buildRobots } from './robots'
import { BASE_URL } from '@/constants/general.consts'

type ArrayElementOrSelf<T> = T extends readonly (infer Item)[] ? Item : T
type Rule = ArrayElementOrSelf<NonNullable<MetadataRoute.Robots['rules']>>

function rulesFor(userAgent: string): Rule {
    const result = buildRobots(true)
    if (!result.rules) throw new Error('Production robots policy has no rules')
    const rules = (Array.isArray(result.rules) ? result.rules : [result.rules]) as Rule[]
    const rule = rules.find((candidate) => {
        const agents = Array.isArray(candidate.userAgent) ? candidate.userAgent : [candidate.userAgent]
        return agents.includes(userAgent)
    })
    if (!rule) throw new Error(`Missing robots group for ${userAgent}`)
    return rule
}

function values(value: string | string[] | undefined): string[] {
    if (value === undefined) return []
    return Array.isArray(value) ? value : [value]
}

describe('robots policy', () => {
    it('blocks every non-production deployment', () => {
        expect(buildRobots(false)).toEqual({ rules: [{ userAgent: '*', disallow: ['/'] }] })
    })

    it.each([
        'Googlebot',
        'GPTBot',
        'ChatGPT-User',
        'PerplexityBot',
        'ClaudeBot',
        'Google-Extended',
        'Applebot-Extended',
        'AhrefsBot',
        'SemrushBot',
        'MJ12bot',
    ])('%s keeps the complete shared disallow policy', (userAgent) => {
        expect([...values(rulesFor(userAgent).disallow)].sort()).toEqual([...values(rulesFor('*').disallow)].sort())
    })

    it('lets Googlebot fetch OG images without opening the rest of /api', () => {
        const googlebot = rulesFor('Googlebot')
        expect(values(googlebot.allow)).toContain('/api/og')
        expect(values(googlebot.disallow)).toContain('/api/')
    })

    it('deliberately leaves Twitterbot unrestricted for user-shared cards', () => {
        const twitterbot = rulesFor('Twitterbot')
        expect(values(twitterbot.allow)).toContain('/api/og')
        expect(values(twitterbot.disallow)).toEqual([])
    })

    it.each(['AhrefsBot', 'SemrushBot', 'MJ12bot'])('%s remains rate-limited', (userAgent) => {
        expect(rulesFor(userAgent).crawlDelay).toBe(10)
    })

    it('advertises the production sitemap', () => {
        expect(buildRobots(true).sitemap).toBe(`${BASE_URL}/sitemap.xml`)
    })
})
