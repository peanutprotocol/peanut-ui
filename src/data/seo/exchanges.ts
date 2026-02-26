// Typed wrappers for exchange deposit data.
// Reads from peanut-content: input/data/exchanges/ + content/deposit/
// Public API unchanged from previous version.

import { readEntityData, readPageContent, listEntitySlugs, listContentSlugs } from '@/lib/content'
import { extractFaqs, extractSteps, extractTroubleshooting } from './utils'

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
        const steps = extractSteps(entity.body, /Deposit to Peanut Flow|Step-by-Step|How to Deposit/)
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

export const EXCHANGES: Record<string, Exchange> = loadExchanges()
