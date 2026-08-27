/**
 * The cache readers exist so the support snapshot never issues a request —
 * SupportDrawer mounts app-wide, so a subscribing hook there would start a poll
 * for every user on every screen. These tests pin both halves of that contract:
 * the readers find what is genuinely cached, and they return `undefined` rather
 * than fetching when it isn't.
 */

import { QueryClient } from '@tanstack/react-query'
import { LIMITS, TRANSACTIONS } from '@/constants/query.consts'
import { readCachedLimits, readLatestHistoryEntry } from '../support-cache'
import type { HistoryEntry } from '@/utils/history.utils'

const entry = (uuid: string, timestamp: string): HistoryEntry =>
    ({ uuid, timestamp: new Date(timestamp) }) as HistoryEntry

describe('readLatestHistoryEntry', () => {
    let client: QueryClient

    beforeEach(() => {
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    /*
     * The `latest` key carries its own `limit` and `targetUsername`, so the cache
     * legitimately holds several variants at once (home Activity at 5, the
     * carousel at 50). Reading one hardcoded key would silently return nothing
     * the day a caller changed its limit — hence the scan.
     */
    it('finds the newest entry across every cached history variant', () => {
        client.setQueryData([TRANSACTIONS, 'latest', { limit: 5, targetUsername: undefined }], {
            entries: [entry('older', '2026-08-01T00:00:00Z')],
            hasMore: false,
        })
        client.setQueryData([TRANSACTIONS, 'latest', { limit: 50, targetUsername: undefined }], {
            entries: [entry('newest', '2026-08-26T00:00:00Z')],
            hasMore: false,
        })

        expect(readLatestHistoryEntry(client)?.uuid).toBe('newest')
    })

    it('reads paged infinite-query data too', () => {
        client.setQueryData([TRANSACTIONS, 'infinite', { limit: 50 }], {
            pages: [
                { entries: [entry('page-1', '2026-08-02T00:00:00Z')], hasMore: true },
                { entries: [entry('page-2', '2026-08-20T00:00:00Z')], hasMore: false },
            ],
            pageParams: [undefined, 'cursor'],
        })

        expect(readLatestHistoryEntry(client)?.uuid).toBe('page-2')
    })

    it('returns undefined on a cold cache instead of fetching', () => {
        expect(readLatestHistoryEntry(client)).toBeUndefined()
        expect(client.getQueryCache().findAll().length).toBe(0)
    })
})

describe('readCachedLimits', () => {
    it('returns undefined rather than triggering the request', () => {
        const client = new QueryClient()
        expect(readCachedLimits(client)).toBeUndefined()

        client.setQueryData([LIMITS], { manteca: null, bridge: null })
        expect(readCachedLimits(client)).toEqual({ manteca: null, bridge: null })
    })
})
