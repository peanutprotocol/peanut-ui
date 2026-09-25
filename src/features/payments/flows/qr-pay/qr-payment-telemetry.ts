import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

/**
 * Client half of the `qr_payment_stage` contract (TASK-22692). One attempt =
 * one signed payment; the id is minted at Pay, before any open-amount init,
 * and rides on the completion request so the server's stages join to ours.
 *
 * Rules the contract sets and this module enforces:
 * - `elapsed_ms` is monotonic and runtime-local (performance.now, never Date),
 *   so nobody subtracts it from a server clock.
 * - A stage that did not happen is not reported; there is no zero-duration
 *   success. Failures, pending and unknown outcomes ARE reported, with `outcome`.
 * - Every label is drawn from a closed set: no free-form strings reach analytics.
 * - Nothing here can throw or block: capture failures are swallowed.
 * - No QR payload, signature, callData, address, name or provider payload.
 */

export type QrPaymentClientStage =
    | 'pay_clicked'
    | 'lock_ready'
    | 'strategy_ready'
    | 'preflight_ready'
    | 'signing_preparation_ready'
    | 'signature_ready'
    | 'request_sent'
    | 'response_received'
    | 'success_committed'
    | 'attempt_finished'

/**
 * Shared client/server vocabulary. `unknown` is for an attempt whose money
 * outcome the client could not observe (transport failure after the request
 * left, an unclassified submit error) — the screen says "status unknown" and
 * so must the telemetry; only a deterministic rejection is `failed`.
 */
export type QrPaymentStageOutcome = 'success' | 'failed' | 'pending' | 'cancelled' | 'unknown'

export type QrPaymentStageStrategy = 'smart-only' | 'mixed' | 'collateral-only'

/** Same closed rail set as the API's `boundedQrType`. */
export type QrPaymentStageQrType = 'PIX' | 'QR3' | 'CODI' | 'OTHER'

export interface QrPaymentStageDetail {
    outcome?: QrPaymentStageOutcome
    strategy?: QrPaymentStageStrategy
    /** `signing_preparation_ready` only: whether the pre-Pay candidate was signed. */
    preparation?: 'reused' | 'fresh'
    /**
     * `lock_ready` failures only: the deterministic refusal code, so a refused
     * sender id (a support case) is distinguishable from a cap hit.
     */
    failureCode?: string
}

export interface QrPaymentAttemptTelemetry {
    readonly attemptId: string
    stage: (stage: QrPaymentClientStage, detail?: QrPaymentStageDetail) => void
}

export const QR_PAYMENT_STAGE_SCHEMA_VERSION = 1

/**
 * Bound a rail label to the API's vocabulary. Accepts either the lock's
 * provider type (`QR3_PAYMENT`, `PIX`) or the scanner's `EQrType` name
 * (`MERCADO_PAGO`, `ARGENTINA_QR3`, `PIX_KEY`); anything else is `OTHER`.
 */
export function boundedQrType(value: string | null | undefined): QrPaymentStageQrType | undefined {
    if (!value) return undefined
    const upper = value.toUpperCase()
    if (upper.startsWith('PIX')) return 'PIX'
    if (upper.includes('QR3') || upper === 'MERCADO_PAGO') return 'QR3'
    if (upper.startsWith('CODI')) return 'CODI'
    return 'OTHER'
}

function newAttemptId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    // RFC 4122 v4 layout from Math.random — only for runtimes without WebCrypto.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
}

function monotonicNow(): number {
    return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : 0
}

export function createQrPaymentAttemptTelemetry(context: {
    qrType: QrPaymentStageQrType | undefined
}): QrPaymentAttemptTelemetry {
    const attemptId = newAttemptId()
    const startedAt = monotonicNow()
    let lastElapsed = 0
    let finished = false
    // Known from `strategy_ready` on; every later stage carries it.
    let strategy: QrPaymentStageStrategy | undefined

    const stage: QrPaymentAttemptTelemetry['stage'] = (name, detail) => {
        // One terminal event per attempt, whichever path reaches it first.
        if (finished) return
        if (name === 'attempt_finished') finished = true
        try {
            const elapsed = Math.max(lastElapsed, Math.round(monotonicNow() - startedAt))
            lastElapsed = elapsed
            if (detail?.strategy) strategy = detail.strategy
            posthog.capture(ANALYTICS_EVENTS.QR_PAYMENT_STAGE, {
                schema_version: QR_PAYMENT_STAGE_SCHEMA_VERSION,
                client_payment_attempt_id: attemptId,
                source: 'client',
                stage: name,
                elapsed_ms: elapsed,
                ...(context.qrType ? { qr_type: context.qrType } : {}),
                ...(strategy ? { strategy } : {}),
                ...(detail?.outcome ? { outcome: detail.outcome } : {}),
                ...(detail?.preparation ? { preparation: detail.preparation } : {}),
                ...(detail?.failureCode ? { failure_code: detail.failureCode } : {}),
            })
        } catch {
            // Analytics must never delay or fail a payment.
        }
    }

    return { attemptId, stage }
}
