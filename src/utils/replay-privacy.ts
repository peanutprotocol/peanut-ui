import type { CapturedNetworkRequest, SessionRecordingOptions } from 'posthog-js'
import { maskLinkSecretsInReplayRequest, stripLinkSecrets } from './link-secret-privacy'
import { maskQrReplayRequest, redactQrTelemetryString } from './qr-telemetry-privacy'

/*
 * What a session replay hides, and what it keeps (Hugo, 2026-10-20).
 *
 * Hidden: legal names (account holder, KYC name, bank, Pix and QR recipients
 * or payers, who may not be Peanut users), emails, phone numbers, bank, card,
 * tax and ID numbers, wallet addresses, amounts and balances, document images,
 * camera, QR codes, inputs, and network bodies and headers.
 *
 * Readable: Peanut usernames and @handles, which are public pay-link handles
 * (peanut.me/<username>) and already tied to the replay through its distinct
 * id; page URLs and request paths, which every event already carries in
 * `$current_url`; and button, label and navigation text.
 */

const MASK = '*'
const maskWhole = (value: string) => MASK.repeat(value.length)
const DIGIT_RUN = /\d(?:[\d.,]*\d)?/g
// Whole-masking keeps word lengths, so collapse digit runs first: an amount in
// a data row must not show its size through its length.
const maskAll = (value: string) => value.replace(DIGIT_RUN, MASK.repeat(3)).replace(/\S/g, MASK)

/**
 * Hides the values in a text and keeps its words.
 *
 * Every run of digits (with its `.` and `,` separators) becomes `***`, which
 * covers amounts, balances, tax ids (CPF, DNI, CUIL, CUIT), card numbers, phone
 * numbers and dates, and hides their length, so a masked balance does not
 * reveal its order of magnitude. Emails, hex addresses
 * and unbroken tokens of 20+ characters (base58 and bech32 addresses, hashes,
 * IBANs) are masked whole, because their letters identify them as much as
 * their digits. Usernames are at most 12 characters, so they stay readable.
 */
export function maskReplayText(text: string): string {
    return text
        .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, maskWhole)
        .replace(/0x[0-9a-f]{6,}/gi, maskWhole)
        .replace(/[A-Za-z0-9]{20,}/g, maskWhole)
        .replace(DIGIT_RUN, MASK.repeat(3))
}

/**
 * Areas masked whole, words included: every data-row value (account holder,
 * bank details, address and amount on review and receipt screens) and
 * `ph-mask` (legal names on the shared user label, wallet addresses, Pix and
 * QR payee names). Their labels stay readable.
 */
const SENSITIVE_AREA_SELECTOR = '.ph-mask, .ds-data-row-value'

export function maskReplayTextIn(text: string, element?: Element | null): string {
    return element?.closest(SENSITIVE_AREA_SELECTOR) ? maskAll(text) : maskReplayText(text)
}

// Attributes that repeat on-screen text (an accessible name, a tooltip, an
// input value). Layout attributes such as `class` and `style` stay untouched:
// Tailwind class names have digits, and masking them would break the replay.
const TEXT_ATTRIBUTES = new Set(['aria-label', 'aria-valuetext', 'aria-valuenow', 'title', 'alt', 'value'])

export function maskReplayAttribute(name: string, value: string, element?: Element | null): string {
    const redacted = stripLinkSecrets(redactQrTelemetryString(value))
    // A link target is a URL like any other; a stylesheet's href must stay
    // loadable for the replay to render, so only links are rewritten.
    if (name === 'href') return element?.tagName === 'A' ? maskReplayUrl(redacted) : redacted
    if (!TEXT_ATTRIBUTES.has(name)) return redacted
    // A button or nav label stays readable; a label on a sensitive element
    // (an account holder's row) repeats what that element hides.
    return maskReplayTextIn(redacted, element)
}

/**
 * A recorded URL (a request, a link, or the page URL of a replay meta event)
 * keeps its origin and path, as `$current_url` does on every event. It loses
 * what a path or URL can hide: userinfo (`https://secret@host`), the query
 * string, the fragment (claim links carry their secret in `#p=`), and any
 * segment that looks like a token: 20+ characters with a digit (UUIDs, wallet
 * addresses, hashes) or 32+ characters of any kind.
 */
export function maskReplayUrl(url: string): string {
    const withoutQuery = url.split('#')[0].split('?')[0]
    const authority = withoutQuery.match(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i)?.[0] ?? ''
    const path = withoutQuery
        .slice(authority.length)
        .split('/')
        .map((segment) => ((segment.length >= 20 && /\d/.test(segment)) || segment.length >= 32 ? MASK : segment))
        .join('/')
    return authority.replace(/\/\/[^/]*@/, '//') + path
}

/**
 * Network entries keep their method, status, timing and URL path, and lose
 * every body and header, as well as what `maskReplayUrl` drops.
 */
export function maskReplayNetworkRequest(request: CapturedNetworkRequest): CapturedNetworkRequest {
    const linkSafe = maskLinkSecretsInReplayRequest(request)
    const masked = maskQrReplayRequest(linkSafe)
    // a QR URL already reads as the QR redaction marker; keep that contract
    if (!masked.name || masked.name !== linkSafe.name) return masked
    return { ...masked, name: maskReplayUrl(masked.name) }
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
    // Every text node goes through maskReplayTextIn: sensitive areas whole,
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
