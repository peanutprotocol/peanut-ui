import { NextResponse, type NextRequest } from 'next/server'
import { captureException } from '@sentry/nextjs'
import { createTranslator } from 'next-intl'
import { getHistoryEntry } from '@/app/actions/history'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { servesAnonymousReceipt } from '@/components/TransactionDetails/transaction-predicates'
import { resolveReceiptKind } from '@/components/TransactionDetails/strategies/registry'
import { isFinalState } from '@/utils/history.utils'
import { APP_LOCALES, resolveLocale } from '@/i18n/app/config'
import { loadMessages } from '@/i18n/app/messages'
import { buildReceiptPdfModel, type PdfTranslate } from './receipt-pdf-model'
import { renderReceiptPdf } from './ReceiptPdfDocument'

export const runtime = 'nodejs'

// A full react-pdf render (font shaping, layout, deflate) on a PUBLIC route is
// expensive, and a CDN keys on the whole query string — so `?…&_=1`, `&_=2`, …
// each miss the shared cache and would force a fresh render every time. Collapse
// that: identical receipts render once per short window per instance, so
// cache-busted or uncacheable (cookie-locale, non-final) requests cost a map
// lookup instead of a render. Bounded so a wide spread of ids cannot grow it.
const RENDER_CACHE_MAX = 32
const FINAL_TTL_MS = 60_000
const PENDING_TTL_MS = 10_000
const renderCache = new Map<string, { bytes: Buffer; expiresAt: number }>()
// A cold key is the dangerous case: without this, N simultaneous requests all
// read the empty map and each run a full render before any of them writes. One
// render per key is in flight at a time; everyone else awaits it.
const inFlight = new Map<string, Promise<Buffer>>()

function readRenderCache(key: string): Buffer | undefined {
    const hit = renderCache.get(key)
    if (!hit) return undefined
    if (hit.expiresAt <= Date.now()) {
        renderCache.delete(key)
        return undefined
    }
    // refresh recency for the bounded eviction below
    renderCache.delete(key)
    renderCache.set(key, hit)
    return hit.bytes
}

function writeRenderCache(key: string, bytes: Buffer, ttlMs: number): void {
    renderCache.set(key, { bytes, expiresAt: Date.now() + ttlMs })
    while (renderCache.size > RENDER_CACHE_MAX) {
        const oldest = renderCache.keys().next().value
        if (oldest === undefined) break
        renderCache.delete(oldest)
    }
}

const notFound = () => new NextResponse('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } })

/**
 * GET /receipt/[entryId]/pdf — a downloadable, branded receipt document.
 * Existing public page kinds remain capability URLs; every other activity kind
 * requires owner/participant authentication enforced by the API.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
    const { entryId } = await params
    const searchParams = request.nextUrl.searchParams
    const kind = resolveReceiptKind(searchParams.get('kind') ?? undefined, searchParams.get('t') ?? undefined)
    if (!entryId || !kind) {
        return notFound()
    }

    // Web can authenticate with its same-origin cookie; native explicitly
    // forwards the stored bearer through CapacitorHttp. The API remains the
    // authority for participant access to non-public receipt kinds.
    const bearerHeader = request.headers.get('authorization')
    const cookieToken = request.cookies.get('jwt-token')?.value
    const authorization = bearerHeader ?? (cookieToken ? `Bearer ${cookieToken}` : undefined)

    let entry
    try {
        entry = await getHistoryEntry(entryId, kind, authorization)
    } catch (error) {
        captureException(error)
        return new NextResponse('Failed to load receipt', { status: 502, headers: { 'Cache-Control': 'no-store' } })
    }
    if (!entry) {
        return notFound()
    }

    try {
        const { transactionDetails } = mapTransactionDataForDrawer(entry)
        // An anonymous request stays on the exact public-page whitelist. A
        // bearer/cookie request may render a private kind only after the API's
        // participant check returned the entry above.
        const isPublicReceipt = servesAnonymousReceipt(transactionDetails)
        if (!isPublicReceipt && !authorization) {
            return notFound()
        }
        // The PDF bytes vary by locale, so the locale must be part of the
        // cache key — i.e. part of the URL. The affordance always passes
        // ?locale=<AppLocale>; an unknown/missing param falls back to the
        // app-locale cookie, and those responses stay uncacheable (no Vary
        // dance) — a cookie-derived body must never be CDN-shared.
        const localeParam = searchParams.get('locale')
        const paramLocale = APP_LOCALES.find((l) => l === localeParam)
        const locale = paramLocale ?? resolveLocale(request.cookies.get('app-locale')?.value)
        const messages = await loadMessages(locale)
        const t = createTranslator({ locale, messages }) as PdfTranslate
        const model = buildReceiptPdfModel(transactionDetails, t, locale)
        const isFinal = isFinalState(entry)
        const cacheKey = `${entryId}|${kind}|${locale}`
        // Authenticated renders may contain participant-only fields and can
        // differ by viewer. Keep them out of the shared process/CDN cache.
        let pdf = authorization ? undefined : readRenderCache(cacheKey)
        if (!pdf && !authorization) {
            let pending = inFlight.get(cacheKey)
            if (!pending) {
                pending = renderReceiptPdf(model)
                inFlight.set(cacheKey, pending)
                // drop the slot on rejection too, or one failure poisons the key
                pending.finally(() => inFlight.delete(cacheKey)).catch(() => {})
            }
            pdf = await pending
            writeRenderCache(cacheKey, pdf, isFinal ? FINAL_TTL_MS : PENDING_TTL_MS)
        }
        if (!pdf) pdf = await renderReceiptPdf(model)

        return new NextResponse(new Uint8Array(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                // inline + filename: renders in the browser/native sheet, and
                // saves under a sensible name (the page's anchor adds
                // `download` to force the save on web).
                'Content-Disposition': `inline; filename="${model.fileName}"`,
                'Cache-Control': !authorization && paramLocale && isFinal ? 'public, s-maxage=3600' : 'no-store',
            },
        })
    } catch (error) {
        captureException(error)
        return new NextResponse('Failed to render receipt', { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
}
