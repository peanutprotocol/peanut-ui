/** @jest-environment node */
import { NextRequest } from 'next/server'
import { GET } from '../route'

it('returns the edge country without caching or requiring native credentials', async () => {
    const response = await GET(
        new NextRequest('https://peanut.me/api/geo-country', {
            headers: { 'x-vercel-ip-country': 'br' },
        })
    )
    expect(await response.json()).toEqual({ country: 'BR' })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
})

it.each([undefined, 'XX', 'ZZ', '419', 'Brazil'])(
    'returns unknown for an absent or invalid header %s',
    async (country) => {
        const request = new NextRequest('https://peanut.me/api/geo-country', {
            headers: country ? { 'x-vercel-ip-country': country } : {},
        })
        expect(await (await GET(request)).json()).toEqual({ country: null })
    }
)
