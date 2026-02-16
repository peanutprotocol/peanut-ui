// Typed wrappers for competitor comparison data.
// Reads from per-competitor directories: peanut-content/competitors/<slug>/
// Public API unchanged from the previous monolithic JSON version.

import { readEntitySeo, readEntityContent, readEntityIndex } from '@/lib/content'

export interface Competitor {
    name: string
    tagline: string
    rows: Array<{ feature: string; peanut: string; competitor: string }>
    prosCompetitor: string[]
    consCompetitor: string[]
    verdict: string
    faqs: Array<{ q: string; a: string }>
}

interface CompetitorSeoJson {
    name: string
    tagline: string
    rows: Array<{ feature: string; peanut: string; competitor: string }>
    prosCompetitor: string[]
    consCompetitor: string[]
    verdict: string
}

interface CompetitorFrontmatter {
    title: string
    description: string
    faqs: Array<{ q: string; a: string }>
}

interface CompetitorIndex {
    competitors: Array<{ slug: string; name: string; locales: string[] }>
}

function loadCompetitors(): Record<string, Competitor> {
    const index = readEntityIndex<CompetitorIndex>('competitors')
    if (!index) return {}

    const result: Record<string, Competitor> = {}

    for (const { slug } of index.competitors) {
        const seo = readEntitySeo<CompetitorSeoJson>('competitors', slug)
        const content = readEntityContent<CompetitorFrontmatter>('competitors', slug, 'en')
        if (!seo || !content) continue

        result[slug] = {
            ...seo,
            faqs: content.frontmatter.faqs ?? [],
        }
    }

    return result
}

export const COMPETITORS: Record<string, Competitor> = loadCompetitors()
