// Exchange + rail data for the /deposit routes, read from generated content.
//
// Two slug families share content/deposit/{slug}/:
//   - exchanges (binance, coinbase, …) — entity-backed in mono
//   - rails (sepa, ach, arbitrum, …)   — pure content, no entity
//
// We split them by intersecting against the static rail list below. Display
// names + recommended network come from content frontmatter fields denormalized
// at generation time (see mono/content/_system/templates/intents/deposit-from.md);
// `recommended_network:` is the editorial pick for the lowest-friction path
// from this exchange to Peanut. Absent values fall through to title-casing.

import { listContentSlugs, readPageContent } from '@/lib/content'
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

/** Crypto networks + fiat rails served at /deposit/via-{slug}. Hardcoded
 *  because rails have no entity data — they're purely a content-page concept.
 *
 *  TODO(reorg): two missing fiat keys need to be added during the next pass:
 *      'faster-payments': 'Faster Payments',  // UK — GBP via Bridge, live
 *      spei: 'SPEI Bank Transfer',            // Mexico — MXN via Bridge, live
 *  MDX content already exists at mono/content/deposit/{spei,faster-payments}/
 *  (pushed 2026-05-25). The pages 404 on the live site until the keys are
 *  registered here — generateStaticParams iterates Object.keys(DEPOSIT_RAILS).
 *  Both rails are wired end-to-end already: see src/utils/bridge.utils.ts
 *  getCurrencyConfig('MX' | 'GB', ...) — onramp + offramp via Bridge.
 *  Full context: mono/content/_system/ROADMAP.md (entry dated 2026-05-22). */
export const DEPOSIT_RAILS: Record<string, string> = {
    ach: 'ACH Bank Transfer',
    sepa: 'SEPA Bank Transfer',
    wire: 'Wire Transfer',
    arbitrum: 'Arbitrum',
    avalanche: 'Avalanche',
    base: 'Base',
    ethereum: 'Ethereum',
    polygon: 'Polygon',
    solana: 'Solana',
    tron: 'Tron',
}

const RAIL_SLUGS = new Set(Object.keys(DEPOSIT_RAILS))

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
        const content = readPageContent<DepositFrontmatter>('deposit', slug, 'en')
        if (content && content.frontmatter.published === false) continue
        result[slug] = {
            name: displayNameFromContent(slug, content?.frontmatter),
            recommendedNetwork: pickRecommendedNetwork(content?.frontmatter),
        }
    }
    return result
}

export const EXCHANGES: Record<string, Exchange> = loadExchanges()
