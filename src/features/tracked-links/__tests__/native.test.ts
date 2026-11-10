import { deepLinkToNativePath } from '@/utils/native-routes'
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true }))
it('maps direct tracked opens onto the exported bootstrap without query overrides', () => {
    expect(deepLinkToNativePath('https://peanut.me/go/alice?invite=mallory&dest=/send&fbclid=private#private')).toBe(
        '/app?tracked_link=alice'
    )
})
it('intercepts associated home entries and preserves only the deferred continuation fields', () => {
    const mapped = deepLinkToNativePath(
        'https://peanut.me/home?app_entry=1&tl=alice&tr=1&tl_seen=1&pnutdl=1&at=compact&acq_invite=alice&wid=private&fbclid=private'
    )!
    const params = new URL(mapped, 'https://peanut.me').searchParams
    expect(deepLinkToNativePath('https://peanut.me/home/?tl=alice')).toBe('/app?tracked_link=alice')
    expect(params.get('tracked_link')).toBe('alice')
    expect(params.get('tl_seen')).toBe('1')
    expect(params.get('at')).toBe('compact')
    expect(params.has('wid')).toBe(false)
    expect(params.has('fbclid')).toBe(false)
})
it.each([
    'https://evil.test/go/alice',
    'https://other.peanut.me/go/alice',
    'http://peanut.me/go/alice',
    'https://user@peanut.me/go/alice',
    'https://peanut.me/go/alice/extra',
    'https://peanut.me/home?tl=alice&tl=bob',
])('rejects an untrusted tracked link: %s', (value) => expect(deepLinkToNativePath(value)).toBeNull())
it('leaves explicit invite and ordinary native links on their existing routes', () => {
    expect(deepLinkToNativePath('https://peanut.me/invite?code=alice')).toBe('/setup?step=signup&code=alice')
    expect(deepLinkToNativePath('https://peanut.me/home')).toBe('/home')
})

it('drops forged continuation and observed markers on direct go links', () => {
    expect(
        deepLinkToNativePath(
            'https://peanut.me/go/alice?tl_seen=1&tr=99&pnutdl=1&invite=bob&acq_invite=mallory&at=forged'
        )
    ).toBe('/app?tracked_link=alice')
})
