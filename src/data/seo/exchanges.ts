// Exchange + rail data for the /deposit routes, read from generated content.
//
// Two slug families share content/deposit/{slug}/:
//   - exchanges (binance, coinbase, …) — entity-backed in mono
//   - rails (sepa, ach, arbitrum, …)   — pure content, no entity
//
// We split them by intersecting against RAIL_SLUGS (see ./deposit-rails). Display
// names + recommended network come from content frontmatter fields denormalized
// at generation time (see mono/content/_system/templates/intents/deposit-from.md);
// `recommended_network:` is the editorial pick for the lowest-friction path
// from this exchange to Peanut. Missing `name` falls back to title-casing;
// missing `recommended_network` falls back to `arbitrum`.

import { listContentSlugs, readPageContent } from '@/lib/content'
import { RAIL_SLUGS } from './deposit-rails'
import { displayNameFromContent } from './utils'

export interface Exchange {
    name: string
    recommendedNetwork: string
}

interface DepositFrontmatter {
    name?: unknown
    recommended_network?: unknown
    published?: boolean
}

function pickRecommendedNetwork(fm: DepositFrontmatter | undefined): string {
    const raw = fm?.recommended_network
    if (typeof raw === 'string' && raw.trim().length > 0) return raw
    // No editorial pick yet — return the cheapest default. Once name:/
    // recommended_network: backfill lands, this branch never fires.
    return 'arbitrum'
}

function loadExchanges(): Record<string, Exchange> {
    const result: Record<string, Exchange> = {}
    for (const slug of listContentSlugs('deposit')) {
        if (RAIL_SLUGS.has(slug)) continue
        // Skip slug dirs with no en.md — /deposit/from-{slug} would 404.
        const content = readPageContent<DepositFrontmatter>('deposit', slug, 'en')
        if (!content || content.frontmatter.published === false) continue
        result[slug] = {
            name: displayNameFromContent(slug, content.frontmatter),
            recommendedNetwork: pickRecommendedNetwork(content.frontmatter),
        }
    }
    return result
}

export const EXCHANGES: Record<string, Exchange> = loadExchanges()
