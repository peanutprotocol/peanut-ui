/**
 * createQrPaymentAttemptTelemetry — the client half of `qr_payment_stage`.
 *
 * Contracts: one UUID per attempt, monotonic runtime-local elapsed_ms, the
 * strategy sticks from strategy_ready on, one terminal event, bounded fields
 * only (rail label from the API's closed set), and a broken analytics client
 * can neither throw nor block.
 */
import posthog from 'posthog-js'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

import { boundedQrType, createQrPaymentAttemptTelemetry } from '../qr-payment-telemetry'

const mockCapture = posthog.capture as jest.Mock
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const stageEvents = () =>
    mockCapture.mock.calls.filter(([event]) => event === 'qr_payment_stage').map(([, props]) => props)

let now = 0
beforeEach(() => {
    jest.clearAllMocks()
    now = 1000
    jest.spyOn(performance, 'now').mockImplementation(() => now)
})

afterEach(() => {
    jest.restoreAllMocks()
})

describe('boundedQrType', () => {
    test.each([
        // lock provider types (what the server prefers too)
        ['PIX', 'PIX'],
        ['QR3_PAYMENT', 'QR3'],
        ['CODI', 'CODI'],
        // scanner EQrType names
        ['PIX_KEY', 'PIX'],
        ['pix', 'PIX'],
        ['ARGENTINA_QR3', 'QR3'],
        ['MERCADO_PAGO', 'QR3'],
        ['CODI_MX', 'CODI'],
        // anything else collapses — never a free-form label
        ['EVM_ADDRESS', 'OTHER'],
        ['merchant name here', 'OTHER'],
    ])('%s → %s', (input, expected) => {
        expect(boundedQrType(input)).toBe(expected)
    })

    test.each([null, undefined, ''])('%s → undefined (omitted, not OTHER)', (input) => {
        expect(boundedQrType(input)).toBeUndefined()
    })
})

test('each attempt has its own v4 UUID and every stage carries the shared contract fields', () => {
    const a = createQrPaymentAttemptTelemetry({ qrType: 'QR3' })
    const b = createQrPaymentAttemptTelemetry({ qrType: undefined })
    expect(a.attemptId).toMatch(UUID_V4)
    expect(b.attemptId).toMatch(UUID_V4)
    expect(a.attemptId).not.toBe(b.attemptId)

    now = 1250
    a.stage('pay_clicked')
    b.stage('pay_clicked')

    expect(stageEvents()[0]).toEqual({
        schema_version: 1,
        client_payment_attempt_id: a.attemptId,
        source: 'client',
        stage: 'pay_clicked',
        elapsed_ms: 250,
        qr_type: 'QR3',
    })
    // no qr_type key at all when unknown — never a null placeholder
    expect(stageEvents()[1]).not.toHaveProperty('qr_type')
})

test('elapsed_ms never goes backwards even if the clock does, and strategy sticks once known', () => {
    const t = createQrPaymentAttemptTelemetry({ qrType: 'PIX' })
    now = 1100
    t.stage('lock_ready', { outcome: 'success' })
    now = 1400
    t.stage('strategy_ready', { strategy: 'smart-only' })
    now = 1300 // a clock that stepped back must not produce a smaller elapsed
    t.stage('signing_preparation_ready', { preparation: 'reused' })
    now = 1900
    t.stage('signature_ready', { outcome: 'success' })

    const events = stageEvents()
    expect(events.map((e) => e.elapsed_ms)).toEqual([100, 400, 400, 900])
    expect(events[0]).not.toHaveProperty('strategy')
    expect(events.slice(1).every((e) => e.strategy === 'smart-only')).toBe(true)
    expect(events[2]).toMatchObject({ preparation: 'reused' })
    expect(events[3]).toMatchObject({ outcome: 'success' })
})

test('an unresolved submit is reported as unknown, distinct from a confirmed failure', () => {
    const t = createQrPaymentAttemptTelemetry({ qrType: 'PIX' })
    t.stage('attempt_finished', { outcome: 'unknown' })
    expect(stageEvents()[0]).toMatchObject({ stage: 'attempt_finished', outcome: 'unknown' })
})

test('attempt_finished is terminal: nothing is reported after it, and it is reported once', () => {
    const t = createQrPaymentAttemptTelemetry({ qrType: 'PIX' })
    t.stage('attempt_finished', { outcome: 'failed' })
    t.stage('attempt_finished', { outcome: 'success' })
    t.stage('success_committed', { outcome: 'success' })
    const events = stageEvents()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ stage: 'attempt_finished', outcome: 'failed' })
})

test('a throwing analytics client cannot break the payment', () => {
    mockCapture.mockImplementation(() => {
        throw new Error('posthog down')
    })
    const t = createQrPaymentAttemptTelemetry({ qrType: 'PIX' })
    expect(() => t.stage('pay_clicked')).not.toThrow()
    expect(() => t.stage('attempt_finished', { outcome: 'failed' })).not.toThrow()
})
