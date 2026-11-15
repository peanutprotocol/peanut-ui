import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

export type SumsubSdkKind = 'native' | 'web'

/** Step events worth a PostHog row. The SDK also forwards its own analytics stream, which is not ours to resend. */
const STEP_EVENT_TYPES = new Set(['StepInitiated', 'StepCompleted'])

/**
 * Sumsub statuses, event types and idDocSetTypes are short codes. Anything
 * else is dropped, so a changed payload can never put free text into an event.
 */
const SDK_CODE = /^[A-Za-z0-9_.-]{1,64}$/

function sdkCode(value: unknown): string | null {
    return typeof value === 'string' && SDK_CODE.test(value) ? value : null
}

/**
 * Status and step events for one SDK session, with the same properties for
 * the native and the web SDK. Consecutive duplicates are dropped: the web SDK
 * fires some events twice (plain and `idCheck.`-prefixed) in the same tick.
 */
export function createSumsubSdkTracker(sdk: SumsubSdkKind) {
    let lastStatus: string | null = null
    let lastAnswer: string | null = null
    let lastStepKey: string | null = null

    return {
        /**
         * `prevStatus` defaults to the last status this tracker saw, because the
         * web SDK does not send one. `reviewAnswer` (GREEN/RED) is web only.
         * `snapshot` marks the status an SDK reports on launch: the state the
         * applicant already had, not a change made in this session.
         */
        statusChanged({
            newStatus,
            prevStatus,
            reviewAnswer,
            snapshot = false,
        }: {
            newStatus: unknown
            prevStatus?: unknown
            reviewAnswer?: unknown
            snapshot?: boolean
        }) {
            const next = sdkCode(newStatus)
            if (!next) return
            const answer = sdkCode(reviewAnswer)
            if (next === lastStatus && answer === lastAnswer) return
            const prev = prevStatus === undefined ? lastStatus : sdkCode(prevStatus)
            lastStatus = next
            lastAnswer = answer
            posthog.capture(ANALYTICS_EVENTS.KYC_SDK_STATUS_CHANGED, {
                sdk,
                prev_status: prev,
                new_status: next,
                ...(answer ? { review_answer: answer } : {}),
                ...(snapshot ? { snapshot: true } : {}),
            })
        },

        step(eventType: unknown, step: unknown, isCancelled?: unknown) {
            const type = sdkCode(eventType)
            if (!type || !STEP_EVENT_TYPES.has(type)) return
            const stepCode = sdkCode(step)
            const key = `${type}:${stepCode}`
            if (key === lastStepKey) return
            lastStepKey = key
            posthog.capture(ANALYTICS_EVENTS.KYC_SDK_STEP, {
                sdk,
                event_type: type,
                step: stepCode,
                ...(isCancelled === true || isCancelled === 'true' ? { is_cancelled: true } : {}),
            })
        },
    }
}

const JAVA_CLASS = /^[A-Za-z0-9_.$]{1,160}$/

function finiteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * PostHog properties for the SDK error behind a failed native close. Only
 * codes and class names: `message` and `chain` can quote applicant input, so
 * they go to Sentry alone.
 */
export function nativeErrorProperties(detail: SNSMobileSDKErrorDetail | null | undefined) {
    if (!detail) return {}
    const causes = Array.isArray(detail.causes)
        ? detail.causes.filter((name): name is string => typeof name === 'string' && JAVA_CLASS.test(name))
        : []
    return {
        error_source: sdkCode(detail.source),
        error_causes: causes,
        error_root_cause: causes.at(-1) ?? null,
        error_http_code: finiteNumber(detail.httpCode),
        error_code: finiteNumber(detail.errorCode),
        error_name: sdkCode(detail.errorName),
        error_correlation_id: sdkCode(detail.correlationId),
        error_age_ms: finiteNumber(detail.ageMs),
    }
}

/**
 * One per native launch result. `errorMsg` is left out on purpose: it is SDK
 * text that can quote the applicant's input; `errorType` is the SDK's code.
 */
export function captureNativeSdkClosed(result: SNSMobileSDKResult | undefined) {
    posthog.capture(ANALYTICS_EVENTS.KYC_SDK_CLOSED, {
        sdk: 'native',
        status: sdkCode(result?.status),
        success: result?.success ?? null,
        error_type: sdkCode(result?.errorType),
    })
}
