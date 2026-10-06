/** @jest-environment node */
import { normalizeResidence } from '@/utils/residence-profile'

// Wiring-only route test (the exchange-rate route precedent): data layer,
// transformer, and PDF renderer are mocked — the real render pipeline is
// covered by receipt-pdf-render.test.ts, the model by receipt-pdf-model.test.ts.
import { GET } from '../route'
import { getHistoryEntry } from '@/app/actions/history'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { renderReceiptPdf } from '../ReceiptPdfDocument'
import { buildReceiptPdfModel } from '../receipt-pdf-model'
import { captureException } from '@sentry/nextjs'
import { loadMessages } from '@/i18n/app/messages'
import { serverFetch } from '@/utils/api-fetch'
import type { NextRequest } from 'next/server'

jest.mock('@/app/actions/history', () => ({ getHistoryEntry: jest.fn() }))
jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({
    mapTransactionDataForDrawer: jest.fn(),
}))
jest.mock('../ReceiptPdfDocument', () => ({ renderReceiptPdf: jest.fn() }))
jest.mock('../receipt-pdf-model', () => ({ buildReceiptPdfModel: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
// The registry/history.utils graph reaches @/app/actions/clients, whose
// module-scope ranked fallback transport pings every Arbitrum RPC on import
// and re-ranks on a 60s interval — jest never exits. Cut both edges here.
jest.mock('@/app/actions/currency', () => ({ getCachedCurrencyPrice: jest.fn() }))
jest.mock('@/app/actions/clients', () => ({ getPublicClient: jest.fn(), PUBLIC_CLIENTS_BY_CHAIN: {} }))
jest.mock('@/i18n/app/messages', () => ({ loadMessages: jest.fn().mockResolvedValue({}) }))
jest.mock('next-intl', () => ({ createTranslator: jest.fn(() => (key: string) => key) }))

const mockGetHistoryEntry = getHistoryEntry as jest.Mock
const mockMap = mapTransactionDataForDrawer as jest.Mock
const mockRender = renderReceiptPdf as jest.Mock
const mockBuildModel = buildReceiptPdfModel as jest.Mock
const mockLoadMessages = loadMessages as jest.Mock
const mockServerFetch = serverFetch as jest.Mock

const get = async (
    entryId: string,
    query: string,
    options: { cookieLocale?: string; authorization?: string; cookieToken?: string } = {}
) => {
    const request = {
        nextUrl: new URL(`http://localhost/receipt/${entryId}/pdf?${query}`),
        headers: { get: (name: string) => (name === 'authorization' ? options.authorization : undefined) },
        cookies: {
            get: (name: string) => {
                if (name === 'app-locale' && options.cookieLocale) return { value: options.cookieLocale }
                if (name === 'jwt-token' && options.cookieToken) return { value: options.cookieToken }
                return undefined
            },
        },
    } as unknown as NextRequest
    return GET(request, { params: Promise.resolve({ entryId }) })
}

describe('GET /receipt/[entryId]/pdf', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMap.mockReturnValue({ transactionDetails: { id: 'entry-1', extraDataForDrawer: { kind: 'OFFRAMP' } } })
        mockBuildModel.mockReturnValue({ fileName: 'peanut-receipt-entry-1.pdf' })
        mockRender.mockResolvedValue(Buffer.from('%PDF-1.7 fake-pdf-bytes'))
    })

    test('renders the PDF for a resolvable entry with the page/document headers', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })

        const response = await get('entry-1', 'kind=OFFRAMP')

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toBe('application/pdf')
        expect(response.headers.get('Content-Disposition')).toBe('inline; filename="peanut-receipt-entry-1.pdf"')
        expect(
            Buffer.from(await response.arrayBuffer())
                .subarray(0, 5)
                .toString()
        ).toBe('%PDF-')
        // same data path as the page
        expect(mockGetHistoryEntry).toHaveBeenCalledWith('entry-1', 'OFFRAMP', undefined)
        expect(mockMap).toHaveBeenCalledWith({ status: 'COMPLETED' })
    })

    test('404s without a resolvable kind (unresolvable legacy ?t= links included)', async () => {
        const response = await get('entry-2', 't=nonsense')
        expect(response.status).toBe(404)
        expect(mockGetHistoryEntry).not.toHaveBeenCalled()
    })

    test('accepts a legacy ?t= index that still resolves', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })
        const response = await get('entry-3', 't=3')
        expect(response.status).toBe(200)
        expect(mockGetHistoryEntry).toHaveBeenCalledWith('entry-3', 'SEND_LINK', undefined)
    })

    test('404s for an unknown entry', async () => {
        mockGetHistoryEntry.mockResolvedValue(null)
        const response = await get('nope', 'kind=OFFRAMP')
        expect(response.status).toBe(404)
        expect(mockRender).not.toHaveBeenCalled()
    })

    test('502s and reports when the backend fetch fails', async () => {
        mockGetHistoryEntry.mockRejectedValue(new Error('BE down'))
        const response = await get('entry-4', 'kind=OFFRAMP')
        expect(response.status).toBe(502)
        expect(captureException).toHaveBeenCalledTimes(1)
    })

    // A CDN keys on the whole query string, so `&_=1`, `&_=2`, … each miss the
    // shared cache; without the per-instance memo every one of them would force
    // a fresh react-pdf render on a public, unauthenticated route.
    test('renders once for cache-busted repeats of the same receipt', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })
        mockRender.mockClear()

        const first = await get('entry-burst', 'kind=OFFRAMP&locale=en&_=1')
        const second = await get('entry-burst', 'kind=OFFRAMP&locale=en&_=2')
        const third = await get('entry-burst', 'kind=OFFRAMP&locale=en&_=3')

        expect([first.status, second.status, third.status]).toEqual([200, 200, 200])
        expect(mockRender).toHaveBeenCalledTimes(1)
    })

    test('does not serve one receipt bytes for another', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })
        mockRender.mockClear()

        await get('entry-a', 'kind=OFFRAMP&locale=en')
        await get('entry-b', 'kind=OFFRAMP&locale=en')

        expect(mockRender).toHaveBeenCalledTimes(2)
    })

    test('404s for a private receipt kind without authentication', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED', kind: 'DIRECT_TRANSFER' })
        mockMap.mockReturnValueOnce({
            transactionDetails: { id: 'entry-excluded', extraDataForDrawer: { kind: 'DIRECT_TRANSFER' } },
        } as never)
        mockRender.mockClear()

        const response = await get('entry-excluded', 'kind=DIRECT_TRANSFER')

        expect(response.status).toBe(404)
        expect(mockRender).not.toHaveBeenCalled()
    })

    // The page already serves a crypto deposit to a reader with no session, so
    // its document must answer too. It used to 404, leaving a receipt page with
    // no way to save or send what it showed.
    test('renders a crypto deposit for a reader with no session', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED', kind: 'CRYPTO_DEPOSIT' } as never)
        mockMap.mockReturnValueOnce({
            transactionDetails: { id: 'entry-deposit', extraDataForDrawer: { kind: 'CRYPTO_DEPOSIT' } },
        } as never)
        mockRender.mockClear()

        const response = await get('entry-deposit', 'kind=CRYPTO_DEPOSIT')

        expect(response.status).toBe(200)
        expect(mockRender).toHaveBeenCalled()
    })

    test('renders a private receipt with bearer auth and never caches it publicly', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED', kind: 'DIRECT_TRANSFER' })
        mockMap.mockReturnValue({
            transactionDetails: { id: 'entry-private', extraDataForDrawer: { kind: 'DIRECT_TRANSFER' } },
        } as never)

        const response = await get('entry-private', 'kind=DIRECT_TRANSFER&locale=en', {
            authorization: 'Bearer owner-token',
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('no-store')
        expect(mockGetHistoryEntry).toHaveBeenCalledWith('entry-private', 'DIRECT_TRANSFER', 'Bearer owner-token')
        expect(mockRender).toHaveBeenCalledTimes(1)
    })

    test('forwards the same-origin session cookie as bearer auth', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED', kind: 'CARD_SPEND_CLEAR' })
        mockMap.mockReturnValue({
            transactionDetails: { id: 'entry-card', extraDataForDrawer: { kind: 'CARD_SPEND_CLEAR' } },
        } as never)

        expect((await get('entry-card', 'kind=CARD_SPEND_CLEAR', { cookieToken: 'cookie-owner-token' })).status).toBe(
            200
        )
        expect(mockGetHistoryEntry).toHaveBeenCalledWith('entry-card', 'CARD_SPEND_CLEAR', 'Bearer cookie-owner-token')
    })

    test('coalesces concurrent renders of the same receipt', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })
        mockRender.mockClear()
        let release: (v: Buffer) => void = () => {}
        mockRender.mockReturnValueOnce(new Promise<Buffer>((r) => (release = r)) as never)

        const all = Promise.all([
            get('entry-concurrent', 'kind=OFFRAMP&locale=en&_=1'),
            get('entry-concurrent', 'kind=OFFRAMP&locale=en&_=2'),
            get('entry-concurrent', 'kind=OFFRAMP&locale=en&_=3'),
        ])
        release(Buffer.from('%PDF-1.3 concurrent'))
        const responses = await all

        expect(responses.map((r) => r.status)).toEqual([200, 200, 200])
        // without the in-flight map each cold request would start its own render
        expect(mockRender).toHaveBeenCalledTimes(1)
    })

    test('500s and reports when rendering fails', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })
        mockRender.mockRejectedValue(new Error('font exploded'))
        const response = await get('entry-5', 'kind=OFFRAMP')
        expect(response.status).toBe(500)
        expect(captureException).toHaveBeenCalledTimes(1)
    })

    test.each(['en', 'es-419', 'es-AR', 'pt-BR'])('honors the supported ?locale=%s param', async (locale) => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })
        const response = await get(`entry-locale-${locale}`, `kind=OFFRAMP&locale=${locale}`, {
            cookieLocale: locale === 'pt-BR' ? 'es-419' : 'pt-BR',
        })
        expect(response.status).toBe(200)
        // the URL param wins over the cookie
        expect(mockLoadMessages).toHaveBeenCalledWith(locale)
    })

    test('unknown ?locale= falls back to the cookie, then the default', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })

        await get('entry-7', 'kind=OFFRAMP&locale=xx-XX', { cookieLocale: 'pt-BR' })
        expect(mockLoadMessages).toHaveBeenLastCalledWith('pt-BR')

        await get('entry-8', 'kind=OFFRAMP&locale=xx-XX')
        expect(mockLoadMessages).toHaveBeenLastCalledWith('en')
    })

    test('caches only final states, and only when the locale is in the URL (the cache key)', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })
        expect((await get('entry-9', 'kind=OFFRAMP&locale=en')).headers.get('Cache-Control')).toBe(
            'public, s-maxage=3600'
        )
        // cookie-derived bytes must never be CDN-shared under a locale-less URL
        expect((await get('entry-10', 'kind=OFFRAMP', { cookieLocale: 'es-419' })).headers.get('Cache-Control')).toBe(
            'no-store'
        )
        expect((await get('entry-11', 'kind=OFFRAMP&locale=xx-XX')).headers.get('Cache-Control')).toBe('no-store')

        mockGetHistoryEntry.mockResolvedValue({ status: 'PENDING' })
        expect((await get('entry-12', 'kind=OFFRAMP&locale=en')).headers.get('Cache-Control')).toBe('no-store')
    })
})

// TASK-23188: the render cache must never hand out bytes rendered for an
// earlier state of the same receipt — least of all under the final-state
// public cache policy.
describe('GET /receipt/[entryId]/pdf — receipt freshness', () => {
    type Entry = { status: string; amount: string }
    const bytesOf = async (response: Response) => Buffer.from(await response.arrayBuffer()).toString()

    beforeEach(() => {
        jest.clearAllMocks()
        mockMap.mockImplementation((entry: Entry) => ({
            transactionDetails: { id: 'entry', extraDataForDrawer: { kind: 'OFFRAMP' }, ...entry },
        }))
        mockBuildModel.mockImplementation((details: Entry) => ({
            fileName: 'peanut-receipt.pdf',
            amountDisplay: details.amount,
            rows: [{ label: 'status', value: details.status }],
        }))
        mockRender.mockImplementation(async (model: { amountDisplay: string; rows: { value: string }[] }) =>
            Buffer.from(`%PDF ${model.rows[0].value} ${model.amountDisplay}`)
        )
    })

    test('a receipt that completes after a pending render gets fresh bytes', async () => {
        mockGetHistoryEntry.mockResolvedValueOnce({ status: 'PENDING', amount: '10' })
        const pending = await get('entry-status', 'kind=OFFRAMP&locale=en')
        expect(await bytesOf(pending)).toBe('%PDF PENDING 10')
        expect(pending.headers.get('Cache-Control')).toBe('no-store')

        mockGetHistoryEntry.mockResolvedValueOnce({ status: 'COMPLETED', amount: '10' })
        const completed = await get('entry-status', 'kind=OFFRAMP&locale=en')
        expect(await bytesOf(completed)).toBe('%PDF COMPLETED 10')
        expect(completed.headers.get('Cache-Control')).toBe('public, s-maxage=3600')
    })

    test('a completed receipt that is refunded gets fresh bytes', async () => {
        mockGetHistoryEntry.mockResolvedValueOnce({ status: 'COMPLETED', amount: '10' })
        await get('entry-refund', 'kind=OFFRAMP&locale=en')

        mockGetHistoryEntry.mockResolvedValueOnce({ status: 'REFUNDED', amount: '10' })
        expect(await bytesOf(await get('entry-refund', 'kind=OFFRAMP&locale=en'))).toBe('%PDF REFUNDED 10')
    })

    test('a changed amount on the same receipt gets fresh bytes', async () => {
        mockGetHistoryEntry.mockResolvedValueOnce({ status: 'COMPLETED', amount: '10' })
        await get('entry-amount', 'kind=OFFRAMP&locale=en')

        mockGetHistoryEntry.mockResolvedValueOnce({ status: 'COMPLETED', amount: '12' })
        expect(await bytesOf(await get('entry-amount', 'kind=OFFRAMP&locale=en'))).toBe('%PDF COMPLETED 12')
    })

    test('a request after completion never joins an in-flight pending render', async () => {
        let releasePending: (v: Buffer) => void = () => {}
        mockRender.mockImplementationOnce(() => new Promise<Buffer>((r) => (releasePending = r)))
        mockGetHistoryEntry
            .mockResolvedValueOnce({ status: 'PENDING', amount: '10' })
            .mockResolvedValueOnce({ status: 'COMPLETED', amount: '10' })

        const pendingRequest = get('entry-race', 'kind=OFFRAMP&locale=en&_=1')
        // let the pending request reach the render before the state changes
        await new Promise((r) => setImmediate(r))
        const completedRequest = get('entry-race', 'kind=OFFRAMP&locale=en&_=2')
        await new Promise((r) => setImmediate(r))
        releasePending(Buffer.from('%PDF PENDING 10'))
        const [pending, completed] = await Promise.all([pendingRequest, completedRequest])

        expect(await bytesOf(pending)).toBe('%PDF PENDING 10')
        expect(pending.headers.get('Cache-Control')).toBe('no-store')
        expect(await bytesOf(completed)).toBe('%PDF COMPLETED 10')
        expect(completed.headers.get('Cache-Control')).toBe('public, s-maxage=3600')

        // the pending bytes were not promoted into the completed receipt's cache
        mockGetHistoryEntry.mockResolvedValueOnce({ status: 'COMPLETED', amount: '10' })
        expect(await bytesOf(await get('entry-race', 'kind=OFFRAMP&locale=en&_=3'))).toBe('%PDF COMPLETED 10')
    })
})

describe('GET /receipt/[entryId]/pdf — bridge entity from the owner residence', () => {
    const bridgeOfframp = (flow = 'OFFRAMP') => ({
        status: 'COMPLETED',
        extraData: { provider: 'BRIDGE', bridgeFlow: flow },
        senderAccount: { userId: 'owner-1' },
        recipientAccount: {},
    })
    const me = (userId: string) => ({
        ok: true,
        json: async () => ({ user: { userId }, residence: normalizeResidence({ verified: 'DE' }) }),
    })
    const residencePassed = () => mockBuildModel.mock.calls[0][3]

    beforeEach(() => {
        jest.clearAllMocks()
        mockMap.mockReturnValue({ transactionDetails: { id: 'entry-1', extraDataForDrawer: { kind: 'OFFRAMP' } } })
        mockBuildModel.mockReturnValue({ fileName: 'peanut-receipt-entry-1.pdf' })
        mockRender.mockResolvedValue(Buffer.from('%PDF-1.7'))
    })

    test('the signed-in owner gets their residence, uncached', async () => {
        mockGetHistoryEntry.mockResolvedValue(bridgeOfframp())
        mockServerFetch.mockResolvedValue(me('owner-1'))
        const response = await get('entry-own', 'kind=OFFRAMP&locale=en', { cookieToken: 'tok' })
        expect(mockServerFetch).toHaveBeenCalledWith('/users/me', {
            headers: { Authorization: 'Bearer tok', 'x-residence-format': 'compact' },
        })
        expect(residencePassed()).toBe('DE')
        expect(response.headers.get('Cache-Control')).toBe('no-store')
    })

    test('a signed-in non-owner gets the brand-only record', async () => {
        mockGetHistoryEntry.mockResolvedValue(bridgeOfframp())
        mockServerFetch.mockResolvedValue(me('someone-else'))
        await get('entry-other', 'kind=OFFRAMP&locale=en', { cookieToken: 'tok' })
        expect(residencePassed()).toBeNull()
    })

    test('an anonymous request never asks who is viewing', async () => {
        mockGetHistoryEntry.mockResolvedValue(bridgeOfframp())
        await get('entry-anon', 'kind=OFFRAMP&locale=en')
        expect(mockServerFetch).not.toHaveBeenCalled()
        expect(residencePassed()).toBeNull()
    })

    test('a bank send-link claim keeps the brand-only record even for a party', async () => {
        mockGetHistoryEntry.mockResolvedValue(bridgeOfframp('BANK_SEND_LINK_CLAIM'))
        await get('entry-claim', 'kind=OFFRAMP&locale=en', { cookieToken: 'tok' })
        expect(mockServerFetch).not.toHaveBeenCalled()
        expect(residencePassed()).toBeNull()
    })

    test('a failed /users/me still renders, brand-only', async () => {
        mockGetHistoryEntry.mockResolvedValue(bridgeOfframp())
        mockServerFetch.mockRejectedValue(new Error('down'))
        const response = await get('entry-down', 'kind=OFFRAMP&locale=en', { cookieToken: 'tok' })
        expect(response.status).toBe(200)
        expect(residencePassed()).toBeNull()
    })
})
