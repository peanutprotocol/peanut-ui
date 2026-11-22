/** @jest-environment node */
import GoPage, { metadata } from '@/app/go/[...key]/page'

/** Renders the page as Next answers it: a thrown redirect or 404 becomes the response. */
async function open(path: string): Promise<{ status: number; location?: string }> {
    try {
        await GoPage({ params: Promise.resolve({ key: path.split('/') }) })
    } catch (error) {
        const digest = (error as { digest?: string }).digest ?? ''
        const [code, , url, status] = digest.split(';')
        if (code === 'NEXT_REDIRECT') return { status: Number(status), location: url }
        if (digest === 'NEXT_HTTP_ERROR_FALLBACK;404') return { status: 404 }
        throw error
    }
    throw new Error('The /go/ page rendered instead of answering a redirect or a 404')
}

it('answers a 307 to the exact mapped path, ignoring case', async () => {
    expect(await open('app')).toEqual({ status: 307, location: '/app' })
    expect(await open('APP')).toEqual({ status: 307, location: '/app' })
})

// Former username links included: /go/ no longer knows usernames.
it.each(['app/x', 'konrad', 'konrad/1', 'juanacervio/ig', 'constructor', '__proto__'])(
    'answers 404 for /go/%s, which is not a key',
    async (path) => {
        expect(await open(path)).toEqual({ status: 404 })
    }
)

it('keeps every answer out of the index', () => {
    expect(metadata).toEqual({ robots: { index: false, follow: false } })
})
