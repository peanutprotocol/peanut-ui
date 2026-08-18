import { PeanutWebSocket } from '@/services/websocket'

/**
 * console.error is wired to Sentry through
 * captureConsoleIntegration({ levels: ['error', 'warn'] }), and
 * beforeSendHandler scrubs headers/request.data/extra/contexts/breadcrumbs
 * by key name — it never touches event.message. So anything handed to
 * console.error leaves the browser verbatim.
 *
 * A malformed WebSocket frame carries the same shapes the good ones do
 * (kyc_status_update, history_entry, rain_card_balance_changed), which is
 * user KYC and financial data. This pins the parse-error path so nobody
 * reintroduces the raw frame into that log line.
 */
describe('PeanutWebSocket — malformed frame never reaches Sentry via console', () => {
    // A frame that fails JSON.parse but still carries recognisable PII.
    const PII_FRAME =
        '{"type":"kyc_status_update","data":{"status":"approved","fullName":"ALEKSEI SOKOLOV",' +
        '"documentNumber":"AB1234567","email":"aleksei@example.com"}' // truncated → invalid JSON

    const SECRETS = ['ALEKSEI SOKOLOV', 'AB1234567', 'aleksei@example.com', 'kyc_status_update']

    let socket: { onmessage: ((event: MessageEvent) => void) | null }
    let errorSpy: jest.SpyInstance

    beforeEach(() => {
        socket = { onmessage: null }
        // Capture the handler `connect()` binds, without a real transport.
        ;(global as unknown as { WebSocket: unknown }).WebSocket = jest.fn(() => socket)
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        errorSpy.mockRestore()
        jest.resetAllMocks()
    })

    const deliver = (data: string) => {
        const ws = new PeanutWebSocket('https://api.peanut.test', '/ws')
        ws.connect()
        socket.onmessage?.({ data } as MessageEvent)
    }

    it('logs the parse failure without echoing the frame', () => {
        deliver(PII_FRAME)

        expect(errorSpy).toHaveBeenCalled()
        const logged = errorSpy.mock.calls.flat().map(String).join(' ')

        for (const secret of SECRETS) {
            expect(logged).not.toContain(secret)
        }
    })

    it('still reports the frame size so a truncated frame stays diagnosable', () => {
        deliver(PII_FRAME)

        const logged = errorSpy.mock.calls.flat().map(String).join(' ')
        expect(logged).toContain(String(PII_FRAME.length))
        expect(logged).toContain('Error parsing WebSocket message')
    })
})
