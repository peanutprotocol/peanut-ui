// Typed wrappers for exchange deposit data.
// Reads from per-exchange directories: peanut-content/exchanges/<slug>/
// Public API unchanged from the previous monolithic JSON version.

import { readEntitySeo, readEntityContent, readEntityIndex, isPublished } from '@/lib/content'

export interface Exchange {
    name: string
    recommendedNetwork: string
    alternativeNetworks: string[]
    withdrawalFee: string
    processingTime: string
    networkFee: string
    steps: string[]
    troubleshooting: Array<{ issue: string; fix: string }>
    faqs: Array<{ q: string; a: string }>
    image?: string
}

interface ExchangeSeoJson {
    name: string
    recommendedNetwork: string
    alternativeNetworks: string[]
    withdrawalFee: string
    processingTime: string
    networkFee: string
}

interface ExchangeFrontmatter {
    title: string
    description: string
    image?: string
    steps: string[]
    troubleshooting: Array<{ issue: string; fix: string }>
    faqs: Array<{ q: string; a: string }>
}

interface ExchangeIndex {
    exchanges: Array<{ slug: string; name: string; status?: string; locales: string[] }>
}

function loadExchanges(): Record<string, Exchange> {
    const index = readEntityIndex<ExchangeIndex>('exchanges')
    if (!index) return {}

    const result: Record<string, Exchange> = {}

    for (const entry of index.exchanges) {
        if (!isPublished(entry)) continue
        const { slug } = entry
        const seo = readEntitySeo<ExchangeSeoJson>('exchanges', slug)
        const content = readEntityContent<ExchangeFrontmatter>('exchanges', slug, 'en')
        if (!seo || !content) continue

        result[slug] = {
            ...seo,
            steps: content.frontmatter.steps ?? [],
            troubleshooting: content.frontmatter.troubleshooting ?? [],
            faqs: content.frontmatter.faqs ?? [],
            image: content.frontmatter.image,
        }
    }

    return result
}

export const EXCHANGES: Record<string, Exchange> = loadExchanges()
