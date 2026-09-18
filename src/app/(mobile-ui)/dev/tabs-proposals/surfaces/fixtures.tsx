'use client'

import type { ContentItem } from '@/lib/content'
import type { ContentLandingStrings } from '@/components/Marketing/ContentLanding'
import type { ExplorerFilters, ExplorerRelationship } from '@/features/payment-network-explorer/types'
import type { CreateDepositAddressResponse } from '@/services/services.types'
import type { MantecaLimit, UserLimitsResponse } from '@/interfaces/interfaces'

/**
 * Fixtures for `/dev/tabs-proposals/surfaces` — the props and cache entries the
 * REAL screens need to render outside their flow. Real currency codes, real
 * chain names, real content titles from `src/content`, plausible amounts.
 * Nothing here is fetched and nothing here ships.
 */

/** two currencies, so the repeated per-card control is visible */
const MANTECA_LIMITS: MantecaLimit[] = [
    {
        exchangeCountry: 'ARG',
        type: 'EXCHANGE',
        asset: 'ARS',
        yearlyLimit: '120000',
        availableYearlyLimit: '86400',
        monthlyLimit: '10000',
        availableMonthlyLimit: '4310',
    },
    {
        exchangeCountry: 'BRA',
        type: 'EXCHANGE',
        asset: 'BRL',
        yearlyLimit: '60000',
        availableYearlyLimit: '51200',
        monthlyLimit: '5000',
        availableMonthlyLimit: '900',
    },
]

export const LIMITS_FIXTURE: UserLimitsResponse = { manteca: MANTECA_LIMITS, bridge: null }

export const EXPLORER_FILTERS: ExplorerFilters = {
    view: 'graph',
    types: ['SEND_LINK', 'REQUEST_PAYMENT', 'DIRECT_TRANSFER'],
    direction: 'all',
    minCount: 1,
    minUsd: 0,
    topNodes: 500,
    focus: null,
}

export const EXPLORER_RELATIONSHIPS: ExplorerRelationship[] = [
    {
        id: 'kamila-arsenii-SEND_LINK',
        source: 'kamila',
        target: 'arsenii',
        type: 'SEND_LINK',
        count: 12,
        totalUsd: 480.5,
        bidirectional: true,
    },
    {
        id: 'lynn-kamila-REQUEST_PAYMENT',
        source: 'lynn',
        target: 'kamila',
        type: 'REQUEST_PAYMENT',
        count: 4,
        totalUsd: 96,
        bidirectional: false,
    },
    {
        id: 'arsenii-lynn-DIRECT_TRANSFER',
        source: 'arsenii',
        target: 'lynn',
        type: 'DIRECT_TRANSFER',
        count: 7,
        totalUsd: 1240,
        bidirectional: false,
    },
]

/** a sandbox-shaped address: this screen only ever shows it in a QR and a copy field */
export const RHINO_DEPOSIT: CreateDepositAddressResponse = {
    depositAddress: '0x7a9f3c1b4e2d8a6f05c3b91e7d42f8a0c6b15e93',
    minDepositLimitUsd: 5,
    maxDepositLimitUsd: 10000,
    supportedChains: ['arbitrum', 'base', 'optimism', 'polygon'],
}

/** real titles and descriptions from src/content — the hub lists these today */
export const CONTENT_ITEMS: ContentItem[] = [
    {
        type: 'compare',
        slug: 'wise',
        title: 'Peanut vs Wise: Best Rate for LATAM (2026) | Peanut',
        description:
            'Peanut delivers the cripto dólar rate and instant Mercado Pago and Pix access that Wise cannot offer. Better rate than your card. No fees.',
        href: '/en/compare/wise',
        lang: 'en',
    },
    {
        type: 'compare',
        slug: 'western-union',
        title: 'Peanut vs Western Union: 2026 Comparison | Peanut',
        description:
            'Western Union charges $5-15+ per transfer with a 1.5-10% rate markup. Peanut has no fees and instant local payments. See the full breakdown.',
        href: '/en/compare/western-union',
        lang: 'en',
    },
    {
        type: 'use-cases',
        slug: 'digital-nomads',
        title: 'Digital Nomads: Pay Like a Local in LATAM | Peanut',
        description:
            'Stop losing 2–11% on every payment in Argentina and Brazil. Pay via Mercado Pago and Pix without a local ID. Get the real rate, no fees.',
        href: '/en/use-cases/digital-nomads',
        lang: 'en',
    },
    {
        type: 'stories',
        slug: 'kamila',
        title: 'Kamila: Paying Like a Local Without a DNI | Peanut',
        description:
            'How an English freelancer in Buenos Aires unlocked MercadoPago without an Argentine DNI and started saving on every payment.',
        href: '/en/stories/kamila',
        lang: 'en',
    },
    {
        type: 'blog',
        slug: 'rewards-v2-savings-calculator',
        title: 'Your Payment App Pays You Back | Peanut',
        description:
            "Peanut's new rewards system turns every invite into real, ongoing earnings. Share a link, your friends use the app, you earn revenue share on every transaction.",
        href: '/en/blog/rewards-v2-savings-calculator',
        lang: 'en',
        date: '2026-08-14',
    },
    {
        type: 'blog',
        slug: 'earn-with-peanut-3min-setup',
        title: 'Earn Money From Peanut in Minutes | Peanut',
        description:
            'Make a payment, get a surprise reward, invite a friend. Three steps to start earning real money from Peanut. Here is how it works.',
        href: '/en/blog/earn-with-peanut-3min-setup',
        lang: 'en',
        date: '2026-08-02',
    },
]

/** the en strings the hub ships with */
export const CONTENT_STRINGS: ContentLandingStrings = {
    searchPlaceholder: 'Search articles',
    clearSearch: 'Clear search',
    noResults: 'No results',
    filterAll: 'All',
    filterBlog: 'Blog',
    filterStories: 'Stories',
    filterUseCases: 'Use cases',
    filterCompare: 'Compare',
}
