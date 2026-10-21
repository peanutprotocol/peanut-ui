import type { CaptureResult, PostHog, PostHogConfig } from 'posthog-js'

/*
 * Click autocapture on buttons and links only: about 0.3-0.5M events a month,
 * against 35% of the bill when every element and event type was captured
 * (off since 2026-09-10, TASK-22516). No input, change or submit events, so
 * no field values.
 *
 * Element text and attributes are masked. A button or link can show a balance,
 * an amount or another person's name, as text or in its aria-label, and none
 * of that may reach PostHog. An event keeps the tag, classes, position, the
 * page URL and a cut link target (redactAutocaptureLinks, run in
 * `before_send`). To name a control, give it a code in
 * `data-ph-capture-attribute-<name>`; `ph-no-capture` drops its clicks.
 *
 * The project's server-side autocapture opt-out overrides these settings.
 */
export const AUTOCAPTURE_SETTINGS = {
    autocapture: {
        dom_event_allowlist: ['click'],
        element_allowlist: ['button', 'a'],
    },
    mask_all_text: true,
    mask_all_element_attributes: true,
} satisfies Partial<PostHogConfig>

/**
 * A link target cut to what analytics needs: the path of a link inside the app,
 * the scheme and host of any other link. Queries and fragments never stay: an
 * external link can be a user's uploaded document or carry a token.
 */
export function autocaptureLinkTarget(href: string, pageUrl: string): string {
    try {
        const page = new URL(pageUrl)
        const url = new URL(href, page)
        // Compare scheme and host, not `origin`: it is "null" for capacitor:// pages.
        const inApp = url.protocol === page.protocol && url.host === page.host
        return inApp ? url.pathname : `${url.protocol}//${url.host}`
    } catch {
        return ''
    }
}

// The chain carries a link target twice, as `attr__href` and as `href`.
// posthog-js escapes `"` inside chain values as `\"`.
const CHAIN_HREF = /\b(attr__href|href)="((?:[^"\\]|\\.)*)"/g

/** Applies {@link autocaptureLinkTarget} to every link target in an `$autocapture` event, in place. */
export function redactAutocaptureLinks(event: CaptureResult | null, pageUrl: string): CaptureResult | null {
    if (event?.event !== '$autocapture') return event
    const properties = event.properties
    if (typeof properties.$elements_chain === 'string') {
        properties.$elements_chain = properties.$elements_chain.replace(
            CHAIN_HREF,
            (_match: string, key: string, href: string) => `${key}="${autocaptureLinkTarget(href, pageUrl)}"`
        )
    }
    if (Array.isArray(properties.$elements)) {
        for (const element of properties.$elements) {
            if (typeof element?.attr__href === 'string') {
                element.attr__href = autocaptureLinkTarget(element.attr__href, pageUrl)
            }
        }
    }
    if (typeof properties.$external_click_url === 'string') {
        properties.$external_click_url = autocaptureLinkTarget(properties.$external_click_url, pageUrl)
    }
    return event
}

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
