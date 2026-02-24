// Typed wrapper for payment method data.
// Reads from peanut-content: input/data/spending-methods/ + content/pay-with/
// Note: "payment-methods" → "spending-methods" in new repo.
// Public API unchanged from previous version.

import { readEntityData, readPageContent, listEntitySlugs, listContentSlugs } from '@/lib/content'

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
            steps: extractSteps(content.body),
            faqs: extractFaqs(content.body),
        }
    }

    return result
}

/** Extract numbered steps from markdown body */
function extractSteps(body: string): string[] {
    const steps: string[] = []
    // Look for numbered lists in "How to" or step sections
    const section = body.match(
        /###?\s+(?:Merchant QR Payments|How to Pay|Steps|How It Works)\s*\n([\s\S]*?)(?=\n###?\s|$)/i
    )
    if (!section) return steps

    const lines = section[1].split('\n')
    for (const line of lines) {
        const match = line.match(/^\d+\.\s+\*\*(.+?)\*\*/)
        if (match) {
            steps.push(match[1].trim())
        }
    }
    return steps
}

/** Extract FAQ items from markdown body */
function extractFaqs(body: string): Array<{ q: string; a: string }> {
    const faqs: Array<{ q: string; a: string }> = []
    const faqSection = body.match(/## (?:FAQ|Frequently Asked Questions)\s*\n([\s\S]*?)(?=\n## [^#]|$)/i)
    if (!faqSection) return faqs

    const lines = faqSection[1].split('\n')
    let currentQ = ''
    let currentA = ''

    for (const line of lines) {
        if (line.startsWith('### ')) {
            if (currentQ && currentA.trim()) faqs.push({ q: currentQ, a: currentA.trim() })
            currentQ = line.replace(/^### /, '').replace(/\*\*/g, '').trim()
            currentA = ''
        } else if (currentQ) {
            currentA += line + '\n'
        }
    }
    if (currentQ && currentA.trim()) faqs.push({ q: currentQ, a: currentA.trim() })

    return faqs
}

export const PAYMENT_METHODS = loadPaymentMethods()
export const PAYMENT_METHOD_SLUGS = Object.keys(PAYMENT_METHODS)
