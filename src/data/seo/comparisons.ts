// Typed wrappers for competitor comparison data.
// Reads from peanut-content: input/data/competitors/ + content/compare/
// Public API unchanged from previous version.

import { readEntityData, readPageContent, listEntitySlugs, listContentSlugs, isPublished } from '@/lib/content'
import { extractFaqs } from './utils'

// --- Entity frontmatter (input/data/competitors/{slug}.md) ---

interface CompetitorEntityFrontmatter {
    slug: string
    name: string
    type: string
    fee_model: string
    speed: string
    rate_type: string
    supports_mercadopago: boolean
    supports_pix: boolean
    local_spending_argentina: boolean
    local_spending_brazil: boolean
    global_availability: boolean
}

// --- Content frontmatter (content/compare/{slug}/{lang}.md) ---

interface CompareContentFrontmatter {
    title: string
    description: string
    slug: string
    lang: string
    published: boolean
    competitor: string
    schema_types: string[]
    alternates?: Record<string, string>
}

// --- Public types (unchanged) ---

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

// --- Loader ---

function loadCompetitors(): Record<string, Competitor> {
    const result: Record<string, Competitor> = {}

    // Get competitor slugs from content directory (content/compare/)
    const contentSlugs = listContentSlugs('compare')
    // Also check entity data for completeness
    const entitySlugs = listEntitySlugs('competitors')
    const allSlugs = [...new Set([...contentSlugs, ...entitySlugs])]

    for (const slug of allSlugs) {
        const entity = readEntityData<CompetitorEntityFrontmatter>('competitors', slug)
        if (!entity) continue

        const content = readPageContent<CompareContentFrontmatter>('compare', slug, 'en')

        if (!content || !isPublished(content)) continue

        const fm = entity.frontmatter
        const body = content.body

        // Extract structured data from entity + generated content
        result[slug] = {
            name: fm.name,
            tagline: buildTagline(fm),
            rows: buildComparisonRows(fm),
            prosCompetitor: buildPros(fm),
            consCompetitor: buildCons(fm),
            verdict: buildVerdict(fm),
            faqs: extractFaqs(body),
        }
    }

    return result
}

function buildTagline(fm: CompetitorEntityFrontmatter): string {
    return `Compare Peanut with ${fm.name} for sending money to Latin America.`
}

function buildComparisonRows(
    fm: CompetitorEntityFrontmatter
): Array<{ feature: string; peanut: string; competitor: string }> {
    return [
        { feature: 'Fee Model', peanut: 'Free deposits & payments', competitor: fm.fee_model },
        { feature: 'Speed', peanut: 'Instant local payments', competitor: fm.speed },
        { feature: 'Rate Type', peanut: 'Cripto dólar / market rate', competitor: fm.rate_type },
        {
            feature: 'Mercado Pago',
            peanut: 'Yes',
            competitor: fm.supports_mercadopago ? 'Yes' : 'No',
        },
        { feature: 'Pix', peanut: 'Yes', competitor: fm.supports_pix ? 'Yes' : 'No' },
        {
            feature: 'Local Spending (Argentina)',
            peanut: 'Yes — QR + ATM',
            competitor: fm.local_spending_argentina ? 'Yes' : 'No',
        },
        {
            feature: 'Local Spending (Brazil)',
            peanut: 'Yes — Pix QR',
            competitor: fm.local_spending_brazil ? 'Yes' : 'No',
        },
    ]
}

function buildPros(fm: CompetitorEntityFrontmatter): string[] {
    const pros: string[] = []
    if (fm.global_availability) pros.push('Available globally')
    if (fm.speed.includes('instant') || fm.speed.includes('Instant')) pros.push('Fast transfers')
    pros.push('Well-known brand')
    return pros
}

function buildCons(fm: CompetitorEntityFrontmatter): string[] {
    const cons: string[] = []
    if (!fm.supports_mercadopago) cons.push('No Mercado Pago support')
    if (!fm.supports_pix) cons.push('No Pix support')
    if (!fm.local_spending_argentina) cons.push('No local spending in Argentina')
    if (!fm.local_spending_brazil) cons.push('No local spending in Brazil')
    if (fm.rate_type !== 'cripto-dolar') cons.push('Uses less favorable exchange rate')
    return cons
}

function buildVerdict(fm: CompetitorEntityFrontmatter): string {
    if (!fm.supports_mercadopago && !fm.supports_pix) {
        return `${fm.name} is a solid choice for international transfers, but if you need to pay locally in Argentina or Brazil, Peanut offers better rates and direct local payment access.`
    }
    return `Both services have their strengths. Peanut excels for local payments in Latin America with better exchange rates.`
}

export const COMPETITORS: Record<string, Competitor> = loadCompetitors()
