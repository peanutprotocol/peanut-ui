// QA-only Node preload for the isolated production-mode Next runtime.
// Run with NODE_OPTIONS="--require=<absolute path to this file>" and a fresh
// MARKETING_QR_CAPTURE_FILE. The sink never contacts the real collector.
const { appendFileSync, existsSync, readFileSync } = require('node:fs')

const sink = process.env.MARKETING_QR_CAPTURE_FILE
const token = 'phc_marketing_qr_test_only'
if (!sink || process.env.NEXT_PUBLIC_POSTHOG_KEY !== token) {
    throw new Error('Marketing QR QA preload requires an isolated sink and the fake test token')
}

const originalFetch = globalThis.fetch
globalThis.fetch = async function marketingQrQaFetch(input, init) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (url.href === 'https://eu.i.posthog.com/i/v0/e/') {
        const request = new Request(input, init)
        const body = await request.text()
        const modePath = `${sink}.mode`
        const mode = existsSync(modePath) ? readFileSync(modePath, 'utf8').trim() : 'ok'
        appendFileSync(
            sink,
            `${JSON.stringify({
                url: url.href,
                method: request.method,
                headers: Object.fromEntries(request.headers),
                body: JSON.parse(body),
                mode,
            })}\n`
        )
        if (mode === 'reject') throw new TypeError('Synthetic collector network failure')
        if (mode === 'http-error') return new Response(null, { status: 503 })
        if (mode === 'timeout') {
            return new Promise((_, reject) => {
                if (request.signal.aborted) reject(request.signal.reason)
                else request.signal.addEventListener('abort', () => reject(request.signal.reason), { once: true })
            })
        }
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]') {
        return originalFetch.call(this, input, init)
    }
    // A source-code or configuration mistake cannot turn a fake-token QA run
    // into real analytics traffic or another external service call.
    throw new TypeError(`External fetch blocked by marketing QR QA preload: ${url.origin}`)
}
