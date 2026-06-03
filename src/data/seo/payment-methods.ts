// Pay-with method data, read from generated content only.
//
// Source: content/pay-with/{slug}/en.md frontmatter (mirror of mono/content/).
// Display names come from the `name:` field denormalized at generation time
// (see mono/content/_system/templates/intents/pay-with-method.md); absent
// values fall through to title-casing the slug.
//
// The structured fields (countries, description, steps, faqs) that used to
// live here are no longer consumed by any route — pay-with/[method] renders
// the MDX body directly. Kept only the slug list + display name.

import { listContentSlugs, readPageContent } from '@/lib/content'
import { displayNameFromContent } from './utils'

export interface PaymentMethod {
    slug: string
    name: string
}

function loadPaymentMethods(): Record<string, PaymentMethod> {
    const result: Record<string, PaymentMethod> = {}
    for (const slug of listContentSlugs('pay-with')) {
        // Skip slug dirs with no en.md — /pay-with/{slug} would 404.
        const content = readPageContent<{ name?: unknown; published?: boolean }>('pay-with', slug, 'en')
        if (!content || content.frontmatter.published === false) continue
        result[slug] = { slug, name: displayNameFromContent(slug, content.frontmatter) }
    }
    return result
}

export const PAYMENT_METHODS = loadPaymentMethods()
export const PAYMENT_METHOD_SLUGS = Object.keys(PAYMENT_METHODS)
