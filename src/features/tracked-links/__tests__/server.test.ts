/** @jest-environment node */
import type { lookupInviteLink as LookupInviteLink } from '../server'

jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.example.test' }))
const originalFetch = global.fetch
const MAX_ENTRIES = 1000
const fetched = (slug: string) =>
    jest.mocked(global.fetch).mock.calls.filter(([url]) => String(url).endsWith(`/${slug}`)).length

async function fill(prefix: string, count: number) {
    for (let i = 0; i < count; i++) await lookupInviteLink(`${prefix}${i}`)
}

// The cache is module state: each test starts with an empty one.
let lookupInviteLink: typeof LookupInviteLink
beforeEach(async () => {
    jest.resetModules()
    ;({ lookupInviteLink } = await import('../server'))
    global.fetch = jest.fn(() => Promise.resolve(Response.json({ linkId: 'invite_x' })))
})
afterEach(() => {
    jest.useRealTimers()
})
afterAll(() => {
    global.fetch = originalFetch
})

it('drops only the oldest entry once the cache is full', async () => {
    jest.useFakeTimers({ now: 1_000_000 })
    await lookupInviteLink('oldest')
    await lookupInviteLink('second')
    await fill('full', MAX_ENTRIES - 2)

    await lookupInviteLink('newcomer')
    await lookupInviteLink('second')
    await lookupInviteLink('oldest')

    expect(fetched('second')).toBe(1)
    expect(fetched('oldest')).toBe(2)
})

it('drops expired entries before a live one', async () => {
    jest.useFakeTimers({ now: 2_000_000 })
    await fill('stale', MAX_ENTRIES - 1)
    jest.setSystemTime(2_030_000)
    await lookupInviteLink('live')
    jest.setSystemTime(2_060_001)

    await fill('random', 10)
    await lookupInviteLink('live')

    expect(fetched('live')).toBe(1)
})
