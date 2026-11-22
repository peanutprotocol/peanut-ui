/** @jest-environment node */
import GoPage, { metadata } from '@/app/go/[...key]/page'

jest.mock('@/features/tracked-links/go-map', () => {
    const actual = jest.requireActual('@/features/tracked-links/go-map')
    const redirects = { shortlink: '/en/pricing?utm_source=flyer', 'promo/flyer': '/app', 'press-kit': '/en/press' }
    // Uses any map the page passes, so a page that hands over some other map fails here.
    return {
        ...actual,
        resolveGoRedirect: (segments: string[], map?: Record<string, string>) =>
            actual.resolveGoRedirect(segments, map ?? redirects),
    }
})

/** Renders the page as Next answers it: a thrown redirect or 404 becomes the response. */
async function open(...key: string[]): Promise<{ status: number; location?: string }> {
    try {
        await GoPage({ params: Promise.resolve({ key }) })
    } catch (error) {
        const digest = (error as { digest?: string }).digest ?? ''
        const [code, , url, status] = digest.split(';')
        if (code === 'NEXT_REDIRECT') return { status: Number(status), location: url }
        if (digest === 'NEXT_HTTP_ERROR_FALLBACK;404') return { status: 404 }
        throw error
    }
    throw new Error('The /go/ page rendered instead of answering a redirect or a 404')
}

it('answers a 307 to the exact mapped path', async () => {
    expect(await open('shortlink')).toEqual({ status: 307, location: '/en/pricing?utm_source=flyer' })
    expect(await open('press-kit')).toEqual({ status: 307, location: '/en/press' })
})

it('ignores the case of the key', async () => {
    expect(await open('ShortLink')).toEqual({ status: 307, location: '/en/pricing?utm_source=flyer' })
})

it('joins the segments into one key', async () => {
    expect(await open('promo', 'flyer')).toEqual({ status: 307, location: '/app' })
    expect(await open('promo')).toEqual({ status: 404 })
    expect(await open('promo', 'ig')).toEqual({ status: 404 })
})

// Former username links included: /go/ no longer knows usernames.
it.each(['konrad', 'konrad/1', 'juanacervio/ig', 'constructor'])('answers 404 for /go/%s', async (path) => {
    expect(await open(...path.split('/'))).toEqual({ status: 404 })
})

it('keeps every answer out of the index', () => {
    expect(metadata).toEqual({ robots: { index: false, follow: false } })
})
