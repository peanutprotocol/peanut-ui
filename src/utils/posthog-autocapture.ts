import type { CaptureResult, PostHog, PostHogConfig } from 'posthog-js'

/*
 * Click autocapture on buttons and links only: about 0.3-0.5M events a month,
 * against 35% of the bill when every element and event type was captured
 * (off since 2026-09-10, TASK-22516). No input, change or submit events, so
 * no field values.
 *
 * A click keeps the words on the control ("Add money", "Send $25 to @alice"),
 * its tag, classes and position. `redactAutocapture`, run in `before_send`,
 * removes what identifies a person: long digit runs, emails, addresses, tokens
 * and the query of every link target. A real name cannot be found by pattern,
 * so a control that shows one carries `ph-sensitive`: its click is sent
 * without text or attributes. `ph-no-capture` drops a click. To name a
 * control, give it a code in `data-ph-capture-attribute-<name>`.
 *
 * The project's server-side autocapture opt-out overrides these settings.
 */
export const AUTOCAPTURE_SETTINGS = {
    autocapture: {
        dom_event_allowlist: ['click'],
        element_allowlist: ['button', 'a'],
    },
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

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const ADDRESS = /\b0x[0-9a-fA-F]{6,}\b/g
// 20 or more letters and digits, with at least one of each: ids, keys, secrets.
const TOKEN = /\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{20,}\b/g
// Digits with at most one separator between them: "4111 1111 1111 1111", "+54 11 1234-5678".
const DIGIT_RUN = /\d(?:[ .,\/-]?\d)*/g
// Kept whole, so "21/10/2026 10:30" is not read as one long number.
const DATE_TIME = /(\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b)/
const MIN_MASKED_DIGITS = 6

function maskLongDigitRun(run: string): string {
    const digits = run.replace(/\D/g, '').length
    return digits < MIN_MASKED_DIGITS ? run : run.replace(/\d/g, '*')
}

/**
 * Removes personal data from a control's text or attribute: runs of 6 or more
 * digits (card, phone, document and account numbers) become `*`, emails
 * `[email]`, 0x addresses `[address]`, long letter-and-digit tokens `[token]`.
 * Short numbers (amounts such as "$25", counts, dates, a card's last 4) and
 * @usernames stay. The same idea as mono's journey-review transcript masking.
 */
export function scrubAutocaptureText(text: string): string {
    const masked = text.replace(EMAIL, '[email]').replace(ADDRESS, '[address]').replace(TOKEN, '[token]')
    // Odd parts are dates and times.
    return masked
        .split(DATE_TIME)
        .map((part, i) => (i % 2 ? part : part.replace(DIGIT_RUN, maskLongDigitRun)))
        .join('')
}

const SENSITIVE_CLASS = 'ph-sensitive'

// One `key="value"` pair of an elements chain. posthog-js escapes `"` inside values as `\"`.
const CHAIN_PAIR = /([\w-]+)="((?:[^"\\]|\\.)*)"/g
const CHAIN_PAIR_START = /[\w-]+="/

/** Splits an elements chain into its elements, at the `;` outside quoted values. */
function splitChain(chain: string): string[] {
    const elements: string[] = []
    let start = 0
    let quoted = false
    for (let i = 0; i < chain.length; i++) {
        const char = chain[i]
        if (quoted && char === '\\') i++
        else if (char === '"') quoted = !quoted
        else if (char === ';' && !quoted) {
            elements.push(chain.slice(start, i))
            start = i + 1
        }
    }
    elements.push(chain.slice(start))
    return elements
}

function chainElementClasses(element: string): string[] {
    const firstPair = element.search(CHAIN_PAIR_START)
    const prefixClasses = element
        .slice(0, firstPair < 0 ? undefined : firstPair)
        .split('.')
        .slice(1)
    const classAttr = /\battr__class="((?:[^"\\]|\\.)*)"/.exec(element)?.[1] ?? ''
    return [...prefixClasses, ...classAttr.split(/\s+/)].map((name) => name.replace(/:$/, ''))
}

/**
 * Elements run from the clicked one to its ancestors, so the clicked element
 * sits inside every `ph-sensitive` element of the list. Returns how many
 * elements, counted from the clicked one, are inside one (0 when none is).
 */
function sensitiveDepth(classLists: string[][]): number {
    let depth = 0
    classLists.forEach((classes, index) => {
        if (classes.includes(SENSITIVE_CLASS)) depth = index + 1
    })
    return depth
}

/** The value a link target or text-bearing attribute is sent with. */
function redactValue(key: string, value: string, pageUrl: string): string {
    if (key === 'attr__class') return value
    const isLink = key === 'href' || key === 'attr__href'
    return scrubAutocaptureText(isLink ? autocaptureLinkTarget(value, pageUrl) : value)
}

/** The redacted chain, and whether the clicked element is inside a `ph-sensitive` one. */
function redactChain(chain: string, pageUrl: string): { chain: string; sensitive: boolean } {
    const elements = splitChain(chain)
    const depth = sensitiveDepth(elements.map(chainElementClasses))
    const redacted = elements
        .map((element, index) => {
            const sensitive = index < depth
            return element.replace(CHAIN_PAIR, (pair: string, key: string, value: string) => {
                if (key === 'nth-child' || key === 'nth-of-type') return pair
                if (sensitive && key !== 'attr__class') return ''
                return `${key}="${redactValue(key, value, pageUrl)}"`
            })
        })
        .join(';')
    return { chain: redacted, sensitive: depth > 0 }
}

type CapturedElement = Record<string, unknown>

function elementClasses(element: CapturedElement): string[] {
    const { classes, attr__class } = element
    if (Array.isArray(classes)) return classes.map(String)
    return typeof attr__class === 'string' ? attr__class.split(/\s+/) : []
}

function redactElement(element: CapturedElement, sensitive: boolean, pageUrl: string): void {
    for (const [key, value] of Object.entries(element)) {
        if (key !== '$el_text' && !key.startsWith('attr__')) continue
        if (key === 'attr__class') continue
        if (sensitive) delete element[key]
        else if (typeof value === 'string') element[key] = redactValue(key, value, pageUrl)
    }
}

/**
 * Removes personal data from an `$autocapture` event, in place: link targets
 * are cut ({@link autocaptureLinkTarget}), text and attributes are scrubbed
 * ({@link scrubAutocaptureText}), and inside a `ph-sensitive` element only the
 * tag, classes and position stay. Every other event is returned unchanged.
 */
export function redactAutocapture(event: CaptureResult | null, pageUrl: string): CaptureResult | null {
    if (event?.event !== '$autocapture') return event
    const properties = event.properties
    let sensitive = false
    if (typeof properties.$elements_chain === 'string') {
        const redacted = redactChain(properties.$elements_chain, pageUrl)
        properties.$elements_chain = redacted.chain
        sensitive = redacted.sensitive
    }
    if (Array.isArray(properties.$elements)) {
        const elements = properties.$elements.filter(
            (element: unknown): element is CapturedElement => typeof element === 'object' && element !== null
        )
        const depth = sensitiveDepth(elements.map(elementClasses))
        sensitive ||= depth > 0
        elements.forEach((element, index) => redactElement(element, index < depth, pageUrl))
    }
    if (sensitive) {
        delete properties.$el_text
        delete properties.$external_click_url
    }
    if (typeof properties.$el_text === 'string') properties.$el_text = scrubAutocaptureText(properties.$el_text)
    if (typeof properties.$external_click_url === 'string') {
        properties.$external_click_url = redactValue('href', properties.$external_click_url, pageUrl)
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
