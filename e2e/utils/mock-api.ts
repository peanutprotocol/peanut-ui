/**
 * Shared API mocks for E2E tests.
 *
 * Intercepts API calls that fail for harness users (CORS mismatch
 * between localhost:3000 and 127.0.0.1:5000) and returns realistic
 * mock data so screenshots show actual UI, not error states.
 *
 * Mock shapes validated against production (peanut.me) on 2026-04-16.
 */

import type { Page, Route } from '@playwright/test'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_TIER_INFO = {
    userId: 'mock-user-id',
    directPoints: 200,
    transitivePoints: 300,
    totalPoints: 500,
    currentTier: 1,
    leaderboardRank: 42,
    nextTierThreshold: 1000,
    pointsToNextTier: 500,
}

const MOCK_CASH_STATUS = {
    hasCashbackLeft: true,
    lifetimeEarned: 25.5,
    lifetimeBreakdown: {
        cashback: 10.0,
        inviterRewards: 10.0,
        withdrawPerks: 3.0,
        depositPerks: 2.0,
        other: 0.5,
    },
    rewards: {
        pendingUsd: 5.0,
        lifetimeEarnedUsd: 25.5,
    },
}

const MOCK_INVITES = {
    invitees: [
        {
            inviteeId: 'test-invitee-1',
            username: 'testfriend1',
            fullName: 'Test Friend',
            kycVerified: true,
            contributedPoints: 50,
            showFullName: false,
            lifetimeEarnedUsd: 0.5,
        },
    ],
    summary: {
        multiplier: 1,
        pendingInvites: 0,
        totalContributedPoints: 50,
        totalDirectPoints: 200,
        totalInvites: 1,
        verifiedInvites: 1,
        totalLifetimeEarnedUsd: 0.5,
        totalPendingUsd: 0,
    },
}

const MOCK_INVITE_GRAPH = {
    nodes: [
        { id: 'mock-user', username: 'e2euser', totalPoints: 500, isCurrentUser: true },
        { id: 'mock-invitee', username: 'testfriend1', totalPoints: 50 },
    ],
    edges: [{ source: 'mock-user', target: 'mock-invitee' }],
    p2pEdges: [],
    stats: {
        totalNodes: 2,
        totalEdges: 1,
        totalP2PEdges: 0,
        usersWithAccess: 2,
        orphans: 0,
    },
}

const MOCK_ACCOUNTS = [
    {
        account_id: 'mock-iban-1',
        account_type: 'iban',
        account_identifier: 'ES27 0075 0984 2206 0708 0217',
        asset: 'EUR',
        is_active: true,
        country: 'ES',
    },
    {
        account_id: 'mock-us-1',
        account_type: 'us',
        account_identifier: '938636999398030',
        asset: 'USD',
        routing_number: '021000021',
        is_active: true,
        country: 'US',
    },
]

// ---------------------------------------------------------------------------
// API mock installer
// ---------------------------------------------------------------------------

/**
 * Intercept all API requests and return mock data.
 * Call BEFORE navigating to the page.
 */
export async function installApiMocks(page: Page) {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
    }

    const handler = async (route: Route) => {
        const url = route.request().url()
        const method = route.request().method()

        if (method === 'OPTIONS') {
            await route.fulfill({
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-test-harness-secret',
                },
            })
            return
        }

        // Routes ordered most-specific first
        if (url.includes('/users/history')) {
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                body: JSON.stringify({ entries: [], hasMore: false }),
            })
            return
        }

        if (url.includes('/points/cash-status')) {
            await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(MOCK_CASH_STATUS) })
            return
        }

        if (url.match(/\/points(\?|$)/)) {
            await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(MOCK_TIER_INFO) })
            return
        }

        if (url.includes('/invites/user-graph')) {
            await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(MOCK_INVITE_GRAPH) })
            return
        }

        if (url.includes('/invites') && method === 'GET') {
            await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(MOCK_INVITES) })
            return
        }

        if (url.includes('/metrics/login')) {
            await route.fulfill({ status: 200, headers: corsHeaders, body: '{}' })
            return
        }

        if (url.includes('/users/accounts') && method === 'GET') {
            await route.fulfill({ status: 200, headers: corsHeaders, body: JSON.stringify(MOCK_ACCOUNTS) })
            return
        }

        await route.fulfill({ status: 200, headers: corsHeaders, body: '{}' })
    }

    await page.route('**/127.0.0.1:5000/**', handler)
    await page.route('**/localhost:5000/**', handler)
    await page.route('**/api.peanut.me/**', handler)
}

// ---------------------------------------------------------------------------
// Send-link mock helpers (used by claim + KYC tests)
// ---------------------------------------------------------------------------

/** Base mock response for a claimable send-link. */
export function makeMockLink(overrides: Record<string, unknown> = {}) {
    return {
        pubKey: '0xmockpubkey',
        depositIdx: 0,
        chainId: '42161',
        contractVersion: 'v4.3',
        status: 'completed',
        amount: '1000000',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        tokenDecimals: 6,
        tokenSymbol: 'USDC',
        tokenType: 'ERC20',
        senderAddress: '0x14F86e9f60604d56b929a2719B92c661e3799217',
        sender: {
            userId: 'mock-sender',
            username: 'testsender',
            bridgeKycStatus: 'approved',
        },
        claim: null,
        events: [],
        textContent: null,
        fileUrl: null,
        ...overrides,
    }
}

/** Extract pubKey from a send-links request URL. */
export function extractPubKeyFromUrl(url: string): string | null {
    const match = url.match(/\/send-links\/([^?/]+)/)
    return match ? match[1] : null
}

/**
 * Intercept send-links API calls and return mock link data.
 * Echoes the pubKey from the request URL so SDK crypto checks pass.
 */
export async function interceptSendLinks(page: Page, overrides: Record<string, unknown> = {}) {
    await page.route('**/send-links/**', async (route) => {
        const url = route.request().url()
        const pubKey = extractPubKeyFromUrl(url) || '0xfallback'
        const body = makeMockLink({ pubKey, ...overrides })

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(body),
        })
    })
}
