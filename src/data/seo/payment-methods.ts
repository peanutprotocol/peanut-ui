// Typed wrapper for payment method data.
// Reads from peanut-content: input/data/spending-methods/ + content/pay-with/
// Note: "payment-methods" → "spending-methods" in new repo.
// Public API unchanged from previous version.

import { readEntityData, readPageContent, listEntitySlugs, listContentSlugs } from '@/lib/content'
import { extractFaqs, extractSteps } from './utils'

// --- Entity frontmatter (input/data/spending-methods/{slug}.md) ---

interface SpendingMethodEntityFrontmatter {
    slug: string
    name: string
    type: string
    countries: string[]
    user_base?: string
    transaction_types?: string[]
    availability?: string
    speed?: string
}

// --- Content frontmatter (content/pay-with/{slug}/{lang}.md) ---

interface PayWithContentFrontmatter {
    title: string
    description: string
    slug: string
    lang: string
    published: boolean
    schema_types: string[]
    alternates?: Record<string, string>
}

// --- Public types (unchanged) ---

export interface PaymentMethod {
    slug: string
    name: string
    countries: string[]
    description: string
    steps: string[]
    faqs: Array<{ q: string; a: string }>
}

// --- Loader ---

function loadPaymentMethods(): Record<string, PaymentMethod> {
    const result: Record<string, PaymentMethod> = {}

    // Get methods that have both entity data and content pages
    const contentSlugs = new Set(listContentSlugs('pay-with'))
    const entitySlugs = listEntitySlugs('spending-methods')

    for (const slug of entitySlugs) {
        // Only include methods that have a pay-with content page
        if (!contentSlugs.has(slug)) continue

        const entity = readEntityData<SpendingMethodEntityFrontmatter>('spending-methods', slug)
        if (!entity) continue

        const content = readPageContent<PayWithContentFrontmatter>('pay-with', slug, 'en')
        if (!content) continue

        const fm = entity.frontmatter

        result[slug] = {
            slug,
            name: fm.name,
            countries: fm.countries ?? [],
            description: content.body,
            steps: extractSteps(content.body, /Merchant QR Payments|How to Pay|Steps|How It Works/, (line) => {
                const match = line.match(/^\d+\.\s+\*\*(.+?)\*\*/)
                return match ? match[1].trim() : null
            }),
            faqs: extractFaqs(content.body),
        }
    }

    return result
}

export const PAYMENT_METHODS = loadPaymentMethods()
export const PAYMENT_METHOD_SLUGS = Object.keys(PAYMENT_METHODS)
