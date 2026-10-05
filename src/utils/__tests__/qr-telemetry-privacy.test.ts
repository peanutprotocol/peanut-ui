import { redactQrTelemetry, redactQrTelemetryString, maskQrReplayRequest } from '../qr-telemetry-privacy'
import { beforeSendHandler, beforeSendRouteAwareTransaction } from '../../../sentry.utils'

const secret = 'private-payee@example.test'
const qrUrl = `/qr-pay?qrCode=${encodeURIComponent(secret)}&pixKey=${encodeURIComponent(secret)}`
const traceSpanId = '0123456789abcdef'
const traceId = `${traceSpanId}${traceSpanId}`

it.each([
    qrUrl,
    `capacitor://localhost${qrUrl}`,
    `https://peanut.me${qrUrl}#fragment`,
    `/qr?code=${secret}`,
    `/qr?foo=1&code=${secret}`,
    `/qr/${secret}/success`,
    `/qr-pay?%71r%43ode=${secret}`,
    `/qr-pay?x=%broken&%71r%43ode=${secret}`,
    encodeURIComponent(qrUrl),
    encodeURIComponent(encodeURIComponent(qrUrl)),
    Array.from({ length: 8 }).reduce<string>((url) => encodeURIComponent(url), qrUrl),
    `Failed to fetch ${qrUrl}`,
    JSON.stringify({ qrCode: secret }),
    JSON.stringify({ pix_key: secret }),
])('removes QR data from telemetry string %s', (value) => {
    expect(redactQrTelemetryString(value)).toBe('[REDACTED QR DATA]')
})

it('scrubs nested, previous and delayed URLs plus raw QR fields without changing unrelated metadata', () => {
    const event = {
        event: 'qr_scanned',
        properties: {
            $current_url: '/home',
            $referrer: qrUrl,
            navigation: { navigationURL: qrUrl },
            qrKind: 'pix',
            qrLengthBucket: '64-255',
            qr_type: 'PIX',
            qrCode: secret,
            pixKey: secret,
            nested: [{ 'qr-payload': secret }],
            status: 422,
        },
    }
    expect(redactQrTelemetry(event)).toBe(event)
    expect(JSON.stringify(event)).not.toContain(secret)
    expect(JSON.stringify(event)).not.toContain(encodeURIComponent(secret))
    expect(event.properties).toMatchObject({
        $current_url: '/home',
        qrKind: 'pix',
        qrLengthBucket: '64-255',
        qr_type: 'PIX',
        status: 422,
    })
})

it('redacts Sentry errors and transactions across URL, breadcrumb, message, stack and fingerprint copies', () => {
    const event = {
        type: undefined,
        message: `Lookup failed ${qrUrl}`,
        request: { url: qrUrl },
        fingerprint: ['network', qrUrl],
        breadcrumbs: [{ message: qrUrl, data: { from: qrUrl, to: '/home' } }],
        exception: { values: [{ type: 'Error', value: qrUrl, stacktrace: { frames: [{ filename: qrUrl }] } }] },
        contexts: {
            trace: { span_id: traceSpanId, trace_id: traceId, data: { url: qrUrl } },
        },
    }
    const result = beforeSendHandler(event)
    expect(result).not.toBeNull()
    expect(JSON.stringify(result)).not.toContain('private-payee')
    const transaction = { transaction: `GET ${qrUrl}`, spans: [{ description: qrUrl, data: { url: qrUrl } }] }
    expect(JSON.stringify(beforeSendRouteAwareTransaction(transaction))).not.toContain('private-payee')
})

it('keeps ordinary URL, error and non-string property semantics', () => {
    const timestamp = new Date()
    const event = { url: '/home?tab=cards', error: 'Network timeout', method: 'GET', timestamp, count: 2 }
    expect(redactQrTelemetry(event)).toBe(event)
    expect(event).toEqual({ url: '/home?tab=cards', error: 'Network timeout', method: 'GET', timestamp, count: 2 })
})

it('masks replay history URLs and drops bodies and headers before the custom callback bypasses SDK defaults', () => {
    const timing = { duration: 1, entryType: 'resource', startTime: 0 }
    expect(maskQrReplayRequest({ ...timing, name: qrUrl })).toEqual({ ...timing, name: '[REDACTED QR DATA]' })
    const result = maskQrReplayRequest({
        ...timing,
        name: qrUrl,
        method: 'GET',
        status: 200,
        requestBody: secret,
        responseBody: secret,
        requestHeaders: { authorization: 'secret' },
        responseHeaders: { 'set-cookie': 'secret' },
    })
    expect(result).toEqual({ ...timing, name: '[REDACTED QR DATA]', method: 'GET', status: 200 })
    expect(maskQrReplayRequest({ ...timing, name: '/home', requestBody: 'password=secret' })).toEqual({
        ...timing,
        name: '/home',
    })
})

// TASK-23329: GET /config/kyc-intents names the passport country in its query.
describe('the passport country of the unlock checklist config request', () => {
    const configUrl = 'https://api.peanut.me/config/kyc-intents?residence=AR&idCountry=VE'
    const scrubbed = 'https://api.peanut.me/config/kyc-intents?residence=AR&idCountry=[redacted]'

    it('is dropped from the breadcrumb and the message of a failed request', () => {
        const event = {
            type: undefined,
            message: `Config lookup failed ${configUrl}`,
            breadcrumbs: [{ category: 'fetch', data: { method: 'GET', url: configUrl, status_code: 500 } }],
            exception: { values: [{ type: 'Error', value: `Config lookup failed ${configUrl}` }] },
        }
        const result = beforeSendHandler(event)
        // a dropped event would pass the next line for the wrong reason
        expect(result).not.toBeNull()
        expect(JSON.stringify(result)).not.toContain('idCountry=VE')
        expect(result?.breadcrumbs?.[0].data?.url).toBe(scrubbed)
    })

    it('is dropped from tracing spans and replay network capture, and the residence stays', () => {
        const transaction = {
            transaction: 'GET /config/kyc-intents',
            spans: [
                {
                    description: `GET ${configUrl}`,
                    data: { 'http.query': '?residence=AR&idCountry=VE', url: configUrl },
                },
            ],
        }
        const sent = JSON.stringify(beforeSendRouteAwareTransaction(transaction))
        expect(sent).not.toContain('idCountry=VE')
        expect(sent).toContain('residence=AR')
        const timing = { duration: 1, entryType: 'resource', startTime: 0 }
        expect(maskQrReplayRequest({ ...timing, name: configUrl })).toEqual({ ...timing, name: scrubbed })
    })

    it('leaves a URL without the parameter alone', () => {
        const url = '/config/kyc-intents?residence=AR'
        expect(redactQrTelemetry({ url })).toEqual({ url })
    })
})
