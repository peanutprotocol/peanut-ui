// QA-only observer for browser keepalive delivery across a document navigation.
// Capture route handling and bodies remain unchanged. Only an explicitly marked
// QA /app continuation is stubbed to avoid loading the downstream app layout.
const { appendFileSync } = require('node:fs')
const { Server } = require('node:http')

const sink = process.env.MARKETING_QR_REQUEST_LOG
if (!sink || process.env.NEXT_PUBLIC_POSTHOG_KEY !== 'phc_marketing_qr_test_only') {
    throw new Error('Marketing QR request observer requires an isolated log and the fake test token')
}
appendFileSync(sink, '')
const originalEmit = Server.prototype.emit
Server.prototype.emit = function marketingQrObservedEmit(event, request, response, ...rest) {
    if (
        event === 'request' &&
        request.method === 'GET' &&
        request.url.split('?')[0] === '/app' &&
        request.headers['x-marketing-qr-qa-continuation-stub'] === '1'
    ) {
        response.writeHead(200, {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
        })
        response.end('<!doctype html><title>QA continuation</title><p>Approved continuation reached.</p>')
        return true
    }
    if (event === 'request' && request.method === 'POST' && request.url.split('?')[0] === '/api/marketing-qr/open') {
        let body = ''
        const originalRequestEmit = request.emit
        request.emit = function observedRequestEmit(type, ...args) {
            if (type === 'data' && body.length <= 1024) body += args[0].toString('utf8')
            return originalRequestEmit.call(this, type, ...args)
        }
        response.once('finish', () => {
            let eventId
            try {
                const value = JSON.parse(body).event_id
                if (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) eventId = value
            } catch {}
            if (eventId) appendFileSync(sink, `${JSON.stringify({ event_id: eventId, status: response.statusCode })}\n`)
        })
    }
    return originalEmit.call(this, event, request, response, ...rest)
}
