/** @jest-environment node */
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
import type { NextRequest } from 'next/server'

jest.mock('@/app/actions/history', () => ({ getHistoryEntry: jest.fn() }))
jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({
    mapTransactionDataForDrawer: jest.fn(),
}))
jest.mock('../ReceiptPdfDocument', () => ({ renderReceiptPdf: jest.fn() }))
jest.mock('../receipt-pdf-model', () => ({ buildReceiptPdfModel: jest.fn() }))
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

const get = async (entryId: string, query: string, cookieLocale?: string) => {
    const request = {
        nextUrl: new URL(`http://localhost/receipt/${entryId}/pdf?${query}`),
        cookies: { get: () => (cookieLocale ? { value: cookieLocale } : undefined) },
    } as unknown as NextRequest
    return GET(request, { params: Promise.resolve({ entryId }) })
}

describe('GET /receipt/[entryId]/pdf', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockMap.mockReturnValue({ transactionDetails: { id: 'entry-1' } })
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
        expect(mockGetHistoryEntry).toHaveBeenCalledWith('entry-1', 'OFFRAMP')
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
        expect(mockGetHistoryEntry).toHaveBeenCalledWith('entry-3', 'SEND_LINK')
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

    test('500s and reports when rendering fails', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })
        mockRender.mockRejectedValue(new Error('font exploded'))
        const response = await get('entry-5', 'kind=OFFRAMP')
        expect(response.status).toBe(500)
        expect(captureException).toHaveBeenCalledTimes(1)
    })

    test('honors a valid ?locale= param', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })
        const response = await get('entry-6', 'kind=OFFRAMP&locale=es-419', 'pt-BR')
        expect(response.status).toBe(200)
        // the URL param wins over the cookie
        expect(mockLoadMessages).toHaveBeenCalledWith('es-419')
    })

    test('unknown ?locale= falls back to the cookie, then the default', async () => {
        mockGetHistoryEntry.mockResolvedValue({ status: 'COMPLETED' })

        await get('entry-7', 'kind=OFFRAMP&locale=xx-XX', 'pt-BR')
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
        expect((await get('entry-10', 'kind=OFFRAMP', 'es-419')).headers.get('Cache-Control')).toBe('no-store')
        expect((await get('entry-11', 'kind=OFFRAMP&locale=xx-XX')).headers.get('Cache-Control')).toBe('no-store')

        mockGetHistoryEntry.mockResolvedValue({ status: 'PENDING' })
        expect((await get('entry-12', 'kind=OFFRAMP&locale=en')).headers.get('Cache-Control')).toBe('no-store')
    })
})
