/**
 * Two contracts, both load-bearing.
 *
 * The readers never issue a request — SupportDrawer mounts app-wide, so a
 * subscribing hook there would start a poll for every user on every screen —
 * and they only read keys that name their owner, so a cached entry can be
 * proved to belong to the person support is open for.
 */

import { QueryClient } from '@tanstack/react-query'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import { readCachedRainOverview, readCachedSmartBalance } from '../support-cache'
import type { RainCardOverview } from '@/services/rain'

const WALLET = '0xb8ed0b7578e658cb6718ae92facb98f718d445e3'

describe('support cache readers', () => {
    let client: QueryClient

    beforeEach(() => {
        client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    })

    it('returns undefined on a cold cache instead of fetching', () => {
        expect(readCachedSmartBalance(client, WALLET)).toBeUndefined()
        expect(readCachedRainOverview(client, 'user-1')).toBeUndefined()
        expect(client.getQueryCache().findAll()).toHaveLength(0)
    })

    it('reads what is already cached for this identity', () => {
        client.setQueryData(['balance', WALLET], 100_000_000n)
        client.setQueryData([RAIN_CARD_OVERVIEW_QUERY_KEY, 'user-1'], { status: { hasApplication: false } })

        expect(readCachedSmartBalance(client, WALLET)).toBe(100_000_000n)
        expect(readCachedRainOverview(client, 'user-1')?.status?.hasApplication).toBe(false)
    })

    /*
     * The reason limits and latest activity are absent from the snapshot: their
     * keys name no owner, so there is no equivalent of this test for them. Here
     * a different identity simply reads nothing, because the identity is part of
     * the key rather than an assumption about who was signed in.
     */
    it('reads nothing for an identity that has no cached entry', () => {
        client.setQueryData([RAIN_CARD_OVERVIEW_QUERY_KEY, 'user-1'], {
            status: { hasApplication: true },
        } as RainCardOverview)

        expect(readCachedRainOverview(client, 'user-2')).toBeUndefined()
        expect(readCachedSmartBalance(client, undefined)).toBeUndefined()
    })
})
