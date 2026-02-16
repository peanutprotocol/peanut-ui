// Typed wrappers for competitor comparison data.
// Reads from per-competitor directories: peanut-content/competitors/<slug>/
// Public API unchanged from the previous monolithic JSON version.

import { readEntitySeo, readEntityContent, readEntityIndex, isPublished } from '@/lib/content'

export interface Competitor {
    name: string
    tagline: string
    rows: Array<{ feature: string; peanut: string; competitor: string }>
    prosCompetitor: string[]
    consCompetitor: string[]
    verdict: string
    faqs: Array<{ q: string; a: string }>
    image?: string
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
    image?: string
    faqs: Array<{ q: string; a: string }>
}

interface CompetitorIndex {
    competitors: Array<{ slug: string; name: string; status?: string; locales: string[] }>
}

function loadCompetitors(): Record<string, Competitor> {
    const index = readEntityIndex<CompetitorIndex>('competitors')
    if (!index) return {}

    const result: Record<string, Competitor> = {}

    for (const entry of index.competitors) {
        if (!isPublished(entry)) continue
        const { slug } = entry
        const seo = readEntitySeo<CompetitorSeoJson>('competitors', slug)
        const content = readEntityContent<CompetitorFrontmatter>('competitors', slug, 'en')
        if (!seo || !content) continue

        result[slug] = {
            ...seo,
            faqs: content.frontmatter.faqs ?? [],
            image: content.frontmatter.image,
        }
    }

    return result
}

export const COMPETITORS: Record<string, Competitor> = loadCompetitors()
