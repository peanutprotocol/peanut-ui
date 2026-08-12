/**
 * @jest-environment jsdom
 *
 * Split content transport contract for the parent service worker.
 *
 * src/app/sw.ts has no importer anywhere in the app, so its routing table is
 * only ever exercised by a real browser. This suite imports it under mocks and
 * pins the one property that cannot be recovered from a passing build: Serwist
 * routing is first-match-wins, so the NetworkOnly entry for Split paths must sit
 * AHEAD of defaultCache. Behind it, defaultCache's precache/asset strategies
 * claim /split-static/** and hand returning PWA users stale chunks.
 *
 * jsdom, not node: sw.ts registers push/notificationclick on `self` at import.
 */
import { splitContentServiceWorkerMatcher } from '@/utils/split-content-edge'

type RuntimeCachingEntry = { matcher: unknown; handler: unknown }
type CapturedSerwistOptions = { runtimeCaching: RuntimeCachingEntry[] }

const mockSerwistOptions: CapturedSerwistOptions[] = []

class MockNetworkOnly {}

class MockSerwist {
    constructor(options: CapturedSerwistOptions) {
        mockSerwistOptions.push(options)
    }
    addEventListeners(): void {}
}

// Distinguishable stand-ins for whatever @serwist/next ships as defaults: the
// contract is about position relative to them, not their strategies.
const mockDefaultCache: RuntimeCachingEntry[] = [
    { matcher: () => true, handler: { sentinel: 'default-cache-0' } },
    { matcher: () => true, handler: { sentinel: 'default-cache-1' } },
]

jest.mock('serwist', () => ({
    NetworkOnly: MockNetworkOnly,
    Serwist: MockSerwist,
}))

jest.mock('@serwist/next/worker', () => ({
    defaultCache: mockDefaultCache,
}))

let runtimeCaching: RuntimeCachingEntry[]

beforeAll(() => {
    require('@/app/sw')
    expect(mockSerwistOptions).toHaveLength(1)
    runtimeCaching = mockSerwistOptions[0].runtimeCaching
})

describe('parent service-worker Split content routing', () => {
    it('registers exactly one NetworkOnly route for Split content paths', () => {
        const splitEntries = runtimeCaching.filter((entry) => entry.matcher === splitContentServiceWorkerMatcher)

        expect(splitEntries).toHaveLength(1)
        expect(splitEntries[0].handler).toBeInstanceOf(MockNetworkOnly)
    })

    it('matches Split content before every defaultCache strategy', () => {
        const splitIndex = runtimeCaching.findIndex((entry) => entry.matcher === splitContentServiceWorkerMatcher)
        const defaultCacheIndexes = mockDefaultCache.map((entry) => runtimeCaching.indexOf(entry))

        // Guards the comparison itself: without defaultCache in the table the
        // ordering assertion below would pass for any placement.
        expect(defaultCacheIndexes).not.toContain(-1)
        expect(splitIndex).toBeGreaterThanOrEqual(0)
        expect(splitIndex).toBeLessThan(Math.min(...defaultCacheIndexes))
    })
})
