/** Capture-only API adapter. No historical components or styles are copied. */
import { demoRespond } from '../../src/utils/demo-api'
import {
    RESTRICTED_RESIDENCE_ISO2,
    CARD_RESTRICTED_RESIDENCE_ISO2,
    BANKING_RESTRICTED_RESIDENCE_ISO2,
} from '../../src/constants/residence.consts'
import { FIXTURES } from '../../src/dev/fixtures/registry'
export const ADAPTER_VERSION = 'synthetic-api-v1'

// A blank, valid PDF: capture only needs the prefetched file to settle so the
// receipt actions are ready. Never invoke Next's server-side receipt/API path.
const receiptPdf = (() => {
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] >>',
    ]
    let pdf = '%PDF-1.4\n'
    const offsets = objects.map((object, index) => {
        const offset = pdf.length
        pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
        return offset
    })
    const start = pdf.length
    pdf += `xref\n0 4\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`
    return `${pdf}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`
})()

export function isReceiptPdfRequest(url: URL, origin: string): boolean {
    return url.origin === origin && /^\/receipt\/[^/]+\/pdf$/.test(url.pathname)
}

export function merge(base: unknown, patch: unknown): unknown {
    if (
        !base ||
        !patch ||
        typeof base !== 'object' ||
        typeof patch !== 'object' ||
        Array.isArray(base) ||
        Array.isArray(patch)
    )
        return patch
    const result = { ...base } as Record<string, unknown>
    for (const [key, value] of Object.entries(patch)) result[key] = merge(result[key], value)
    return result
}
export async function answer(fixture: string, path: string, method: string, body?: string): Promise<Response> {
    const state = FIXTURES[fixture]
    if (!state) throw new Error(`Unknown fixture ${fixture}`)
    const key = `${method} ${path.split('?')[0].replace(/\/+$/, '')}`
    if (state.fails?.includes(key)) return Response.json({ error: 'Synthetic failure' }, { status: 500 })
    const receipt = /^GET \/receipt\/([^/]+)\/pdf$/.exec(key)
    if (receipt && state.receiptPdfs?.includes(decodeURIComponent(receipt[1])))
        return new Response(receiptPdf, { headers: { 'content-type': 'application/pdf' } })
    if (key === 'GET /notifications') return Response.json({ items: [], nextCursor: null })
    if (key === 'POST /invites/validate')
        return Response.json({ success: true, attributionResolved: true, onboardingResolved: true, username: 'demo' })
    if (key === 'GET /config/residence-restrictions')
        return Response.json({
            full: [...RESTRICTED_RESIDENCE_ISO2],
            cardOnly: [...CARD_RESTRICTED_RESIDENCE_ISO2],
            bankingOnly: [...BANKING_RESTRICTED_RESIDENCE_ISO2],
        })
    if (key === 'GET /qr/synthetic-invalid') return Response.json({ claimed: false, available: false })
    if (key === 'GET /qr/synthetic-success')
        return Response.json({ claimed: true, available: false, claimedAt: '2026-09-01T12:00:00Z' })
    if (key === 'GET /bridge/onramp/quote') {
        const query = new URL(path, 'http://capture.invalid').searchParams
        const from = query.get('accountType')?.includes('iban') ? 'EUR' : 'USD'
        return Response.json({
            from,
            to: 'USD',
            grossRate: '1',
            netRate: '1',
            peanutFee: '0.0000',
            updatedAt: '2026-09-01T12:00:00Z',
            ...(query.has('sourceAmount') ? { netAmount: query.get('sourceAmount') } : {}),
        })
    }
    let base: Response
    try {
        base = await demoRespond(path, { method, body }, { offline: true, strict: true })
    } catch (error) {
        // A fixture may explicitly declare an endpoint absent from the shared
        // demo API. Undeclared endpoints must still fail the capture.
        if (
            !(error instanceof Error) ||
            error.message !== `Unmapped capture API: ${key}` ||
            !Object.hasOwn(state.responses ?? {}, key)
        )
            throw error
        return Response.json(state.responses![key])
    }
    let data = await base.json()
    if (key === 'GET /users/me') data = merge(data, { user: { activationCelebratedAt: '2026-01-01T00:00:00Z' } })
    return Response.json(state.responses?.[key] === undefined ? data : merge(data, state.responses[key]), {
        status: base.status,
    })
}
