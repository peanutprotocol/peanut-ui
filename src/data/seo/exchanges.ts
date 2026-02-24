// Typed wrappers for exchange deposit data.
// Reads from peanut-content: input/data/exchanges/ + content/deposit/
// Public API unchanged from previous version.

import { readEntityData, readPageContent, listEntitySlugs, listContentSlugs } from '@/lib/content'

// --- Entity frontmatter (input/data/exchanges/{slug}.md) ---

interface ExchangeEntityFrontmatter {
    slug: string
    name: string
    type: string
    supported_networks: string[]
    supported_stablecoins: string[]
    withdrawal_fee_usdc: string
    min_withdrawal: string
    kyc_required: boolean
    geo_restrictions: string
}

// --- Content frontmatter (content/deposit/{slug}/{lang}.md) ---

interface DepositContentFrontmatter {
    title: string
    description: string
    slug: string
    deposit_source?: string
    lang: string
    published: boolean
    schema_types: string[]
}

// --- Public types (unchanged) ---

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

// --- Loader ---

function loadExchanges(): Record<string, Exchange> {
    const result: Record<string, Exchange> = {}
    const entitySlugs = listEntitySlugs('exchanges')

    for (const slug of entitySlugs) {
        const entity = readEntityData<ExchangeEntityFrontmatter>('exchanges', slug)
        if (!entity) continue

        const fm = entity.frontmatter

        // Extract steps from entity body (numbered list under ## Deposit to Peanut Flow)
        const steps = extractSteps(entity.body)
        const troubleshooting = extractTroubleshooting(entity.body)
        const faqs = extractFaqs(entity.body)

        // Determine recommended network (first in list, or common fast ones)
        const networks = fm.supported_networks ?? []
        const recommended = pickRecommendedNetwork(networks)

        result[slug] = {
            name: fm.name,
            recommendedNetwork: recommended,
            alternativeNetworks: networks.filter((n) => n !== recommended),
            withdrawalFee: fm.withdrawal_fee_usdc ?? 'Varies',
            processingTime: estimateProcessingTime(recommended),
            networkFee: 'Covered by Peanut',
            steps,
            troubleshooting,
            faqs,
        }
    }

    return result
}

function pickRecommendedNetwork(networks: string[]): string {
    // Prefer fast/cheap networks
    const preference = ['polygon', 'arbitrum', 'base', 'solana', 'tron', 'avalanche', 'ethereum']
    for (const pref of preference) {
        if (networks.includes(pref)) return pref
    }
    return networks[0] ?? 'polygon'
}

function estimateProcessingTime(network: string): string {
    const times: Record<string, string> = {
        polygon: '~2 minutes',
        arbitrum: '~2 minutes',
        base: '~2 minutes',
        solana: '~1 minute',
        tron: '~3 minutes',
        avalanche: '~2 minutes',
        ethereum: '~5 minutes',
    }
    return times[network] ?? '1-10 minutes'
}

/** Extract numbered steps from markdown body */
function extractSteps(body: string): string[] {
    const steps: string[] = []
    const stepSection = body.match(
        /## (?:Deposit to Peanut Flow|Step-by-Step|How to Deposit)\s*\n([\s\S]*?)(?=\n## [^#]|$)/i
    )
    if (!stepSection) return steps

    const lines = stepSection[1].split('\n')
    for (const line of lines) {
        const match = line.match(/^\d+\.\s+(.+)/)
        if (match) {
            steps.push(match[1].replace(/\*\*/g, '').trim())
        }
    }
    return steps
}

/** Extract troubleshooting items from markdown body */
function extractTroubleshooting(body: string): Array<{ issue: string; fix: string }> {
    const items: Array<{ issue: string; fix: string }> = []
    const section = body.match(/## (?:Troubleshooting|Common Issues)\s*\n([\s\S]*?)(?=\n## [^#]|$)/i)
    if (!section) return items

    const lines = section[1].split('\n')
    for (const line of lines) {
        const match = line.match(/^[-*]\s+\*\*(.+?)\*\*[:\s]+(.+)/)
        if (match) {
            items.push({ issue: match[1], fix: match[2].trim() })
        }
    }
    return items
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

export const EXCHANGES: Record<string, Exchange> = loadExchanges()
