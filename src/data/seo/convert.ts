// Typed re-exports for currency conversion data.
// Reads from peanut-content: input/data/currencies/
// Builds convert pairs from available currency entities.

import { readEntityData, listEntitySlugs } from '@/lib/content'

// --- Entity frontmatter (input/data/currencies/{slug}.md) ---

interface CurrencyEntityFrontmatter {
    slug: string
    name: string
    type: 'fiat' | 'stablecoin'
    symbol: string
    iso_code?: string
    countries?: string[]
}

// --- Build currency display data and pairs ---

function loadCurrencyData() {
    const slugs = listEntitySlugs('currencies')
    const display: Record<string, { name: string; symbol: string }> = {}
    const stablecoins: string[] = []
    const fiats: string[] = []

    for (const slug of slugs) {
        const entity = readEntityData<CurrencyEntityFrontmatter>('currencies', slug)
        if (!entity) continue

        const fm = entity.frontmatter
        display[slug] = { name: fm.name, symbol: fm.symbol }

        if (fm.type === 'stablecoin') {
            stablecoins.push(slug)
        } else {
            fiats.push(slug)
        }
    }

    // Build convert pairs: each stablecoin ↔ each fiat
    // Plus usd ↔ each non-USD fiat
    const pairs: string[] = []

    for (const stable of stablecoins) {
        for (const fiat of fiats) {
            pairs.push(`${stable}-to-${fiat}`)
            pairs.push(`${fiat}-to-${stable}`)
        }
    }

    // USD to/from major fiats
    if (fiats.includes('usd')) {
        for (const fiat of fiats) {
            if (fiat === 'usd') continue
            const pair1 = `usd-to-${fiat}`
            const pair2 = `${fiat}-to-usd`
            if (!pairs.includes(pair1)) pairs.push(pair1)
            if (!pairs.includes(pair2)) pairs.push(pair2)
        }
    }

    // EUR to/from major fiats
    if (fiats.includes('eur')) {
        for (const fiat of fiats) {
            if (fiat === 'eur') continue
            const pair1 = `eur-to-${fiat}`
            const pair2 = `${fiat}-to-eur`
            if (!pairs.includes(pair1)) pairs.push(pair1)
            if (!pairs.includes(pair2)) pairs.push(pair2)
        }
    }

    return { pairs, display }
}

const _loaded = loadCurrencyData()

export const CONVERT_PAIRS: readonly string[] = _loaded.pairs
export const CURRENCY_DISPLAY: Record<string, { name: string; symbol: string }> = _loaded.display

/** Parse a convert pair slug into from/to currencies: 'usd-to-ars' → { from: 'usd', to: 'ars' } */
export function parseConvertPair(pair: string): { from: string; to: string } | null {
    const match = pair.match(/^([a-z]+)-to-([a-z]+)$/)
    if (!match) return null
    return { from: match[1], to: match[2] }
}
