import type { CaptureResult, PostHog } from 'posthog-js'

/*
 * Ops can cut `$autocapture` volume without a release: the JSON payload of this
 * feature flag is the share of `$autocapture` events to keep (0 to 1). With no
 * flag, no payload or an unreadable payload, every event is kept. Named events,
 * `$pageview` and `$exception` are never sampled.
 */
export const AUTOCAPTURE_SAMPLE_RATE_FLAG = 'autocapture-sample-rate'

let currentSampleRate = 1

/** The share of `$autocapture` events to keep, from the flag payload. Anything but a number keeps all. */
export function autocaptureSampleRate(payload: unknown): number {
    if (typeof payload !== 'number' || !Number.isFinite(payload)) return 1
    return Math.min(1, Math.max(0, payload))
}

/**
 * Reads the rate each time flags load or reload, so `before_send` does not
 * touch the flag store on every event. Until flags arrive, every event is kept.
 */
export function trackAutocaptureSampleRate(ph: Pick<PostHog, 'onFeatureFlags' | 'getFeatureFlagResult'>): void {
    ph.onFeatureFlags(() => {
        const payload = ph.getFeatureFlagResult(AUTOCAPTURE_SAMPLE_RATE_FLAG, { send_event: false })?.payload
        currentSampleRate = autocaptureSampleRate(payload)
    })
}

/** Drops a share of `$autocapture` events; returns every other event unchanged. */
export function sampleAutocapture(
    event: CaptureResult | null,
    rate: number = currentSampleRate,
    random: () => number = Math.random
): CaptureResult | null {
    if (event?.event !== '$autocapture' || rate >= 1) return event
    return random() < rate ? event : null
}
