// Typed wrapper for payment method data.
// Raw data lives in peanut-content/payment-methods/{slug}/. Types and logic live here.

import { readEntitySeo, readEntityContent, readEntityIndex, isPublished } from '@/lib/content'

export interface PaymentMethod {
    slug: string
    name: string
    countries: string[]
    description: string
    steps: string[]
    faqs: Array<{ q: string; a: string }>
}

interface PaymentMethodDataJson {
    name: string
    countries: string[]
}

interface PaymentMethodFrontmatter {
    title: string
    description: string
    steps: string[]
    faqs: Array<{ q: string; a: string }>
}

interface PaymentMethodIndex {
    methods: Array<{ slug: string; name: string; status?: string; locales: string[] }>
}

function loadPaymentMethods(): Record<string, PaymentMethod> {
    const index = readEntityIndex<PaymentMethodIndex>('payment-methods')
    if (!index) return {}

    const result: Record<string, PaymentMethod> = {}

    for (const entry of index.methods) {
        if (!isPublished(entry)) continue
        const data = readEntitySeo<PaymentMethodDataJson>('payment-methods', entry.slug)
        const content = readEntityContent<PaymentMethodFrontmatter>('payment-methods', entry.slug, 'en')

        if (!data || !content) continue

        result[entry.slug] = {
            slug: entry.slug,
            name: data.name,
            countries: data.countries,
            description: content.body,
            steps: content.frontmatter.steps ?? [],
            faqs: content.frontmatter.faqs ?? [],
        }
    }

    return result
}

export const PAYMENT_METHODS = loadPaymentMethods()
export const PAYMENT_METHOD_SLUGS = Object.keys(PAYMENT_METHODS)
