import { isPeanutApiUrl } from '../sw-api-privacy'
import { purgeCacheEntriesMatching } from '../payment-network-sw-privacy'
import { PEANUT_API_URL } from '@/constants/api-url.consts'

describe('isPeanutApiUrl', () => {
    const api = 'https://api.peanut.me'

    it.each([
        'https://api.peanut.me/users/me',
        'https://api.peanut.me/users/kyc/questions',
        'https://api.peanut.me/users/kyc/details?fresh=1',
        'https://api.peanut.me/users/kyc/plan',
        'https://api.peanut.me/',
    ])('matches every request to the API origin: %s', (url) => {
        expect(isPeanutApiUrl(url, api)).toBe(true)
        expect(isPeanutApiUrl(new URL(url), api)).toBe(true)
    })

    it.each([
        'https://peanut.me/users/me',
        'https://api.peanut.me.evil.example/users/me',
        'http://api.peanut.me/users/me',
        'https://api.peanut.me:8443/users/me',
        'https://cdn.peanut.me/logo.png',
        'not a url',
    ])('leaves other origins to the default rules: %s', (url) => {
        expect(isPeanutApiUrl(url, api)).toBe(false)
    })

    it('follows the configured base URL, including a local one', () => {
        expect(isPeanutApiUrl('http://localhost:5001/users/me', 'http://localhost:5001')).toBe(true)
        expect(isPeanutApiUrl('http://localhost:3000/users/me', 'http://localhost:5001')).toBe(false)
    })

    it('limits a base URL with a path to that path, so the app origin is not swallowed', () => {
        const base = 'https://peanut.me/api'
        expect(isPeanutApiUrl('https://peanut.me/api/users/me', base)).toBe(true)
        expect(isPeanutApiUrl('https://peanut.me/api', base)).toBe(true)
        expect(isPeanutApiUrl('https://peanut.me/home', base)).toBe(false)
        expect(isPeanutApiUrl('https://peanut.me/apiary', base)).toBe(false)
    })

    it('never matches when the base URL is not absolute', () => {
        expect(isPeanutApiUrl('https://api.peanut.me/users/me', '/api')).toBe(false)
    })

    it('defaults to the configured API URL', () => {
        expect(isPeanutApiUrl(`${PEANUT_API_URL}/users/kyc/questions`)).toBe(true)
    })
})

describe('purgeCacheEntriesMatching with the API matcher', () => {
    it('removes stored API responses from every cache and keeps everything else', async () => {
        const stores: Record<string, string[]> = {
            'cross-origin': ['https://api.peanut.me/users/kyc/questions', 'https://fonts.example/a.woff2'],
            others: ['https://peanut.me/home'],
        }
        const cacheStorage = {
            keys: async () => Object.keys(stores),
            open: async (name: string) => ({
                keys: async () => stores[name].map((url) => ({ url }) as Request),
                delete: async (request: Request) => {
                    const index = stores[name].indexOf(request.url)
                    if (index < 0) return false
                    stores[name].splice(index, 1)
                    return true
                },
            }),
        } as unknown as CacheStorage

        const deleted = await purgeCacheEntriesMatching(cacheStorage, (url) =>
            isPeanutApiUrl(url, 'https://api.peanut.me')
        )

        expect(deleted).toBe(1)
        expect(stores['cross-origin']).toEqual(['https://fonts.example/a.woff2'])
        expect(stores.others).toEqual(['https://peanut.me/home'])
    })
})
