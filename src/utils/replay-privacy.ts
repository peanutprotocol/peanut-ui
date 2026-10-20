import type { CapturedNetworkRequest, SessionRecordingOptions } from 'posthog-js'
import { maskQrReplayRequest, redactQrTelemetryString } from './qr-telemetry-privacy'

const MASK = '*'
const maskWhole = (value: string) => MASK.repeat(value.length)

/**
 * Hides the values a replay must not show, and keeps the words around them.
 *
 * Every digit becomes `*`, which covers amounts, balances, tax ids (CPF, DNI,
 * CUIL), card numbers, phone numbers and dates. Emails, hex addresses and long
 * unbroken tokens (base58 and bech32 addresses, hashes, IBANs) are masked
 * whole, because their letters identify them as much as their digits. Labels,
 * buttons and navigation stay readable, so a replay still shows where the user
 * went and what they tapped.
 */
export function maskReplayText(text: string): string {
    return text
        .replace(/[^\s@]+@[^\s@]+/g, maskWhole)
        .replace(/0x[0-9a-f]{6,}/gi, maskWhole)
        .replace(/[A-Za-z0-9]{20,}/g, maskWhole)
        .replace(/\d/g, MASK)
}

/**
 * Text masked whole, words included: `ph-mask` (names and usernames, set on
 * the shared user label) and every data-row value (account holder, bank,
 * address, amount on review and receipt screens). Their labels stay readable.
 */
const FULLY_MASKED_SELECTOR = '.ph-mask, .ds-data-row-value'

export function maskReplayTextIn(text: string, element?: HTMLElement): string {
    return element?.closest(FULLY_MASKED_SELECTOR) ? text.replace(/\S/g, MASK) : maskReplayText(text)
}

// Attributes that repeat on-screen text (an accessible name, a tooltip, an
// input value) or carry ids in a link. Layout attributes such as `class` and
// `style` stay untouched: Tailwind class names have digits, and masking them
// would break how the replay renders.
const TEXT_ATTRIBUTES = new Set(['aria-label', 'aria-valuetext', 'aria-valuenow', 'title', 'alt', 'value', 'href'])

export function maskReplayAttribute(name: string, value: string): string {
    const redacted = redactQrTelemetryString(value)
    return TEXT_ATTRIBUTES.has(name) ? maskReplayText(redacted) : redacted
}

/**
 * Network entries keep their method, status, timing and path, and lose every
 * body, header and query value: a query can carry an amount, an address or an
 * email, and the path is what makes a request recognisable in a replay.
 */
export function maskReplayNetworkRequest(request: CapturedNetworkRequest): CapturedNetworkRequest {
    const masked = maskQrReplayRequest(request)
    if (!masked.name) return masked
    const [beforeHash] = masked.name.split('#')
    const queryStart = beforeHash.indexOf('?')
    if (queryStart < 0) return { ...masked, name: beforeHash }
    const params = new URLSearchParams(beforeHash.slice(queryStart + 1))
    const keys = [...new Set(params.keys())]
    return { ...masked, name: `${beforeHash.slice(0, queryStart)}?${keys.map((key) => `${key}=`).join('&')}` }
}

/**
 * Session replay privacy for posthog.init. Set here rather than in the
 * PostHog project settings, so the code owns it and a settings change cannot
 * unmask replays. The `ph-no-capture` class (rrweb's block class) still hides
 * a whole element, as on the card number, PIN and QR codes.
 */
export const SESSION_RECORDING_PRIVACY: SessionRecordingOptions = {
    // Typed values: amounts, search terms, bank and tax ids, addresses.
    maskAllInputs: true,
    // Every text node goes through maskReplayTextIn: values and names whole,
    // other text keeps its words.
    maskTextSelector: '*',
    maskTextFn: (text, element) => maskReplayTextIn(text, element),
    maskAttributeFn: (name, value) => maskReplayAttribute(name, value),
    // Images a user picked or the camera captured (documents, receipts) and
    // the file inputs that hold them.
    blockSelector: 'img[src^="blob:"], video, input[type="file"]',
    recordBody: false,
    recordHeaders: false,
    maskCapturedNetworkRequestFn: maskReplayNetworkRequest,
}
