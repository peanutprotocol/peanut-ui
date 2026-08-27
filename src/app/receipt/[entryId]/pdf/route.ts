import { NextResponse, type NextRequest } from 'next/server'
import { captureException } from '@sentry/nextjs'
import { createTranslator } from 'next-intl'
import { getHistoryEntry } from '@/app/actions/history'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { resolveReceiptKind } from '@/components/TransactionDetails/strategies/registry'
import { isFinalState } from '@/utils/history.utils'
import { APP_LOCALES, resolveLocale } from '@/i18n/app/config'
import { loadMessages } from '@/i18n/app/messages'
import { buildReceiptPdfModel, type PdfTranslate } from './receipt-pdf-model'
import { renderReceiptPdf } from './ReceiptPdfDocument'

export const runtime = 'nodejs'

const notFound = () => new NextResponse('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } })

/**
 * GET /receipt/[entryId]/pdf — the receipt page as a downloadable, branded
 * PDF document. Accepts the page's own `kind`/`t` query params and rides the
 * same data path (getHistoryEntry + mapTransactionDataForDrawer), so the PDF
 * can never disagree with the page. Unknown entries and unresolvable legacy
 * `?t=` links 404 — there is no partial document worth downloading.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
    const { entryId } = await params
    const searchParams = request.nextUrl.searchParams
    const kind = resolveReceiptKind(searchParams.get('kind') ?? undefined, searchParams.get('t') ?? undefined)
    if (!entryId || !kind) {
        return notFound()
    }

    let entry
    try {
        entry = await getHistoryEntry(entryId, kind)
    } catch (error) {
        captureException(error)
        return new NextResponse('Failed to load receipt', { status: 502, headers: { 'Cache-Control': 'no-store' } })
    }
    if (!entry) {
        return notFound()
    }

    try {
        const { transactionDetails } = mapTransactionDataForDrawer(entry)
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
        const pdf = await renderReceiptPdf(model)

        return new NextResponse(new Uint8Array(pdf), {
            headers: {
                'Content-Type': 'application/pdf',
                // inline + filename: renders in the browser/native sheet, and
                // saves under a sensible name (the page's anchor adds
                // `download` to force the save on web).
                'Content-Disposition': `inline; filename="${model.fileName}"`,
                'Cache-Control': paramLocale && isFinalState(entry) ? 'public, s-maxage=3600' : 'no-store',
            },
        })
    } catch (error) {
        captureException(error)
        return new NextResponse('Failed to render receipt', { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
}
