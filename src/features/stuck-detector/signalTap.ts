import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

/**
 * Lightweight PostHog `before_send` tap for stuck-detection signals.
 *
 * Kept intentionally dependency-free (mirroring `app-review-friction.ts`) so
 * `instrumentation-client.ts` does not pull React, Sentry, or Lottie into boot.
 */

export type StuckSignalKind = 'appError' | 'moneyFailed' | 'moneyStuck' | 'kycBlocked' | 'passkeyCancel'

const MONEY_FAILED_EVENTS = new Set<string>([
    ANALYTICS_EVENTS.SEND_FAILED,
    ANALYTICS_EVENTS.SEND_LINK_FAILED,
    ANALYTICS_EVENTS.CLAIM_LINK_FAILED,
    ANALYTICS_EVENTS.DEPOSIT_FAILED,
    ANALYTICS_EVENTS.WITHDRAW_FAILED,
    ANALYTICS_EVENTS.CARD_WITHDRAW_FAILED,
    ANALYTICS_EVENTS.CARD_APPLY_FAILED,
])

const APP_ERROR_EVENTS = new Set<string>([
    '$exception',
    ANALYTICS_EVENTS.BACKEND_ERROR_SHOWN,
    ANALYTICS_EVENTS.KYC_PV_LOAD_FAILED,
    ANALYTICS_EVENTS.KYC_PV_FORM_ERROR,
    ANALYTICS_EVENTS.SUPPORT_CHAT_OPEN_FAILED,
])

const KYC_BLOCKED_EVENTS = new Set<string>([
    ANALYTICS_EVENTS.KYC_REJECTED,
    ANALYTICS_EVENTS.KYC_ABANDONED,
    ANALYTICS_EVENTS.MANTECA_KYC_ABANDONED,
    ANALYTICS_EVENTS.KYC_PV_STEP_REJECTED,
    ANALYTICS_EVENTS.KYC_PV_FIELD_ERROR,
])

const PASSKEY_CANCEL_EVENTS = new Set<string>([
    ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED,
    ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR,
])

type SignalListener = (kind: StuckSignalKind, eventName: string) => void

const listeners = new Set<SignalListener>()

export function subscribeStuckSignals(listener: SignalListener): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function emitStuckSignal(kind: StuckSignalKind, eventName: string): void {
    listeners.forEach((listener) => {
        try {
            listener(kind, eventName)
        } catch {
            // never break analytics or callers
        }
    })
}

/** Called synchronously inside PostHog `before_send`. Never throws. */
export function noteStuckAnalyticsEvent(eventName: string): void {
    if (!eventName) return
    if (MONEY_FAILED_EVENTS.has(eventName)) {
        emitStuckSignal('moneyFailed', eventName)
        return
    }
    if (KYC_BLOCKED_EVENTS.has(eventName)) {
        emitStuckSignal('kycBlocked', eventName)
        return
    }
    if (PASSKEY_CANCEL_EVENTS.has(eventName)) {
        emitStuckSignal('passkeyCancel', eventName)
        return
    }
    if (APP_ERROR_EVENTS.has(eventName)) {
        emitStuckSignal('appError', eventName)
    }
}
