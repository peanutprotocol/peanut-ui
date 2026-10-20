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

// Accessible names and tooltips are masked whole: they often name a person
// ("Avatar for alice", a payer's full name on a receipt avatar), and a replay
// shows nothing of them on screen, so masking them costs no usefulness.
const ACCESSIBLE_NAME_ATTRIBUTES = new Set(['aria-label', 'aria-valuetext', 'title', 'alt'])
// Attributes that carry an input value or ids in a link keep their words.
// Layout attributes such as `class` and `style` stay untouched: Tailwind class
// names have digits, and masking them would break how the replay renders.
const VALUE_ATTRIBUTES = new Set(['aria-valuenow', 'value', 'href'])

export function maskReplayAttribute(name: string, value: string, element?: Element): string {
    const redacted = redactQrTelemetryString(value)
    if (ACCESSIBLE_NAME_ATTRIBUTES.has(name)) return redacted.replace(/\S/g, MASK)
    if (!VALUE_ATTRIBUTES.has(name)) return redacted
    return element?.closest(FULLY_MASKED_SELECTOR) ? redacted.replace(/\S/g, MASK) : maskReplayText(redacted)
}

/**
 * Masks the identifying segments of a request path and keeps the route words:
 * a segment with a digit (ids, UUIDs, addresses), a segment longer than 24
 * characters (base58 addresses, tokens), and the handle after `username`
 * (`/users/username/<handle>`), which looks like a route word otherwise.
 */
export function maskReplayPath(path: string): string {
    const segments = path.split('/')
    return segments
        .map((segment, i) =>
            segment && (segments[i - 1] === 'username' || /\d/.test(segment) || segment.length > 24) ? MASK : segment
        )
        .join('/')
}

/**
 * Network entries keep their method, status, timing and route, and lose every
 * body, header, query value and identifying path segment: a query or a path
 * can carry an amount, an address, a username or an email, and the route is
 * what makes a request recognisable in a replay.
 */
export function maskReplayNetworkRequest(request: CapturedNetworkRequest): CapturedNetworkRequest {
    const masked = maskQrReplayRequest(request)
    if (!masked.name) return masked
    const [beforeHash] = masked.name.split('#')
    const queryStart = beforeHash.indexOf('?')
    const target = queryStart < 0 ? beforeHash : beforeHash.slice(0, queryStart)
    // keep the origin as it is (a port or a host can hold digits), mask the path
    const originEnd = target.match(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i)?.[0].length ?? 0
    const url = target.slice(0, originEnd) + maskReplayPath(target.slice(originEnd))
    if (queryStart < 0) return { ...masked, name: url }
    const params = new URLSearchParams(beforeHash.slice(queryStart + 1))
    const keys = [...new Set(params.keys())]
    return { ...masked, name: `${url}?${keys.map((key) => `${key}=`).join('&')}` }
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
    maskAttributeFn: (name, value, element) => maskReplayAttribute(name, value, element),
    // Images a user picked or the camera captured (documents, receipts) and
    // the file inputs that hold them.
    blockSelector: 'img[src^="blob:"], video, input[type="file"]',
    recordBody: false,
    recordHeaders: false,
    maskCapturedNetworkRequestFn: maskReplayNetworkRequest,
}
