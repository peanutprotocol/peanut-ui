import {
    isSensitivePaymentNetworkPathname,
    isSensitivePaymentNetworkUrl,
    purgeSensitivePaymentNetworkCacheEntries,
} from '../payment-network-sw-privacy'

class FakeCache {
    constructor(private readonly requests: Request[]) {}

    async keys(): Promise<readonly Request[]> {
        return [...this.requests]
    }

    async delete(request: Request): Promise<boolean> {
        const index = this.requests.findIndex((candidate) => candidate.url === request.url)
        if (index < 0) return false
        this.requests.splice(index, 1)
        return true
    }

    urls(): string[] {
        return this.requests.map((request) => request.url)
    }
}

const request = (url: string) => ({ url }) as Request

describe('payment network service-worker privacy', () => {
    it.each([
        '/dev/payment-graph',
        '/dev/payment-graph/',
        '/dev/payment-graph/child',
        '/invites/graph',
        '/invites/graph/session',
        '/invites/graph/focus',
        '/invites/graph/legacy-child',
    ])('matches the entire sensitive pathname family: %s', (pathname) => {
        expect(isSensitivePaymentNetworkPathname(pathname)).toBe(true)
    })

    it.each(['/dev/payment-graphs', '/invites/graphs', '/dev/other', '/users/me'])(
        'does not overmatch unrelated pathname: %s',
        (pathname) => {
            expect(isSensitivePaymentNetworkPathname(pathname)).toBe(false)
        }
    )

    it('matches across origins and ignores query contents', () => {
        expect(isSensitivePaymentNetworkUrl('https://api.peanut.me/invites/graph?password=secret')).toBe(true)
        expect(isSensitivePaymentNetworkUrl('https://peanut.me/dev/payment-graph?_rsc=opaque&focus=signed')).toBe(true)
        expect(isSensitivePaymentNetworkUrl('not a url')).toBe(false)
    })

    it('purges sensitive entries one by one while preserving unrelated entries and caches', async () => {
        const runtime = new FakeCache([
            request('https://api.peanut.me/invites/graph?user=alice&password=secret'),
            request('https://api.peanut.me/invites/graph/session'),
            request('https://api.peanut.me/users/me'),
        ])
        const pages = new FakeCache([
            request('https://peanut.me/dev/payment-graph?focus=signed'),
            request('https://peanut.me/dev/payment-graph/child?_rsc=opaque'),
            request('https://peanut.me/home'),
        ])
        const opened: string[] = []
        const storage = {
            keys: jest.fn().mockResolvedValue(['runtime', 'pages']),
            open: jest.fn(async (name: string) => {
                opened.push(name)
                return name === 'runtime' ? runtime : pages
            }),
        } as unknown as CacheStorage

        await expect(purgeSensitivePaymentNetworkCacheEntries(storage)).resolves.toBe(4)
        expect(opened).toEqual(['runtime', 'pages'])
        expect(runtime.urls()).toEqual(['https://api.peanut.me/users/me'])
        expect(pages.urls()).toEqual(['https://peanut.me/home'])
    })

    it('continues after an unreadable cache and a failing sensitive entry', async () => {
        const failingEntry = request('https://api.peanut.me/invites/graph?focus=corrupt')
        const healthyEntry = request('https://api.peanut.me/invites/graph/legacy-child')
        const laterCache = new FakeCache([healthyEntry, request('https://peanut.me/home')])
        const storage = {
            keys: jest.fn().mockResolvedValue(['unreadable', 'mixed', 'later']),
            open: jest.fn(async (name: string) => {
                if (name === 'unreadable') throw new Error('corrupt cache')
                if (name === 'mixed') {
                    return {
                        keys: async () => [failingEntry],
                        delete: async () => {
                            throw new Error('corrupt entry')
                        },
                    }
                }
                return laterCache
            }),
        } as unknown as CacheStorage

        await expect(purgeSensitivePaymentNetworkCacheEntries(storage)).resolves.toBe(1)
        expect(laterCache.urls()).toEqual(['https://peanut.me/home'])
    })

    it('contains a CacheStorage keys failure so service-worker activation can continue', async () => {
        const storage = {
            keys: jest.fn().mockRejectedValue(new Error('cache storage unavailable')),
        } as unknown as CacheStorage

        await expect(purgeSensitivePaymentNetworkCacheEntries(storage)).resolves.toBe(0)
    })
})
