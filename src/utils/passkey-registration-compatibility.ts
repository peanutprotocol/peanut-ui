/** Layout facts of a refused registration. Never the note's values: they hold the challenge and the origin. */
export type ClientDataLayoutFacts = {
    /** Index of `"challenge":"` in the decoded clientDataJSON; the standard registration layout gives 26. */
    challengeOffset?: number
    /** The first top-level keys of the clientDataJSON in signed order, at most 10, each unknown key as 'other'. */
    clientDataKeys?: string[]
    /** The authenticator's backup-eligible flag; false means a device-bound passkey. */
    backupEligible?: boolean
}

export class PasskeyProviderUnsupportedError extends Error {
    readonly code = 'PASSKEY_PROVIDER_UNSUPPORTED'
    readonly challengeOffset?: number
    readonly clientDataKeys?: string[]
    readonly backupEligible?: boolean

    constructor(facts: ClientDataLayoutFacts = {}) {
        super('This passkey provider is incompatible with the wallet validator')
        this.name = 'PasskeyProviderUnsupportedError'
        this.challengeOffset = facts.challengeOffset
        this.clientDataKeys = facts.clientDataKeys
        this.backupEligible = facts.backupEligible
    }
}

function base64urlBytes(encoded: string): Uint8Array {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

// The CBOR text key "authData" (0x68: a text string of 8 bytes) in an attestation object.
const AUTH_DATA_KEY = [0x68, 0x61, 0x75, 0x74, 0x68, 0x44, 0x61, 0x74, 0x61]
// authenticatorData: rpIdHash (32 bytes) | flags (1 byte) | signCount (4 bytes) | …
const AUTHENTICATOR_FLAGS_INDEX = 32
const BACKUP_ELIGIBLE_FLAG = 0x08

/**
 * The backup-eligible flag from a registration's attestation object, without a
 * CBOR parser: find the `authData` key, skip the byte-string header, read the
 * flags byte. The native plugin returns no separate authenticator data for a
 * registration. Undefined when the shape is not found; never throws.
 */
function backupEligibleOf(attestationObject: unknown): boolean | undefined {
    try {
        if (typeof attestationObject !== 'string') return undefined
        const bytes = base64urlBytes(attestationObject)
        const key = bytes.findIndex((_, start) => AUTH_DATA_KEY.every((byte, i) => bytes[start + i] === byte))
        if (key < 0) return undefined
        // A CBOR byte string header: 0x40–0x57 holds the length, 0x58 adds one length byte, 0x59 two.
        const header = bytes[key + AUTH_DATA_KEY.length]
        const headerLength =
            header === 0x58 ? 2 : header === 0x59 ? 3 : header >= 0x40 && header <= 0x57 ? 1 : undefined
        if (headerLength === undefined) return undefined
        const flags = bytes[key + AUTH_DATA_KEY.length + headerLength + AUTHENTICATOR_FLAGS_INDEX]
        return flags === undefined ? undefined : (flags & BACKUP_ELIGIBLE_FLAG) !== 0
    } catch {
        return undefined
    }
}

/**
 * True when a registration's clientDataJSON starts with
 * `{"type":"webauthn.create","challenge":"<its challenge>"`: type first,
 * challenge second, no spaces. The deployed validator reads the get challenge
 * at byte 23, and a provider writes the same layout when it signs as when it
 * registers (TASK-24498).
 *
 * peanut-api-ts refuses with the same rule at register/verify
 * (`src/utils/webauthn.ts`). Both test suites hold the same vectors: change
 * the rule on both sides together.
 */
export function hasValidatorRegistrationLayout(clientDataJSON: unknown): boolean {
    if (typeof clientDataJSON !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(clientDataJSON)) return false
    try {
        const note = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(base64urlBytes(clientDataJSON))
        const parsed = JSON.parse(note)
        return (
            parsed?.type === 'webauthn.create' &&
            typeof parsed.challenge === 'string' &&
            /^[A-Za-z0-9_-]+$/.test(parsed.challenge) &&
            typeof parsed.origin === 'string' &&
            parsed.origin !== '' &&
            note.startsWith(`{"type":"webauthn.create","challenge":${JSON.stringify(parsed.challenge)}`)
        )
    } catch {
        return false
    }
}

/**
 * The clientDataJSON members that WebAuthn, Android and Chrome write. Any other
 * key is client input and can hold any text (an email address, a token), so
 * telemetry sees it only as 'other'. peanut-api-ts keeps the same list.
 */
const KNOWN_CLIENT_DATA_KEYS = new Set([
    'type',
    'challenge',
    'origin',
    'crossOrigin',
    'topOrigin',
    'tokenBinding',
    'androidPackageName',
    // Chrome adds this member at random so that sites do not compare the note to a template.
    'other_keys_can_be_added_here',
])
const MAX_CLIENT_DATA_KEYS = 10

/** The offset and the bounded keys of a note, for telemetry only. Never throws. */
function clientDataLayoutFacts(clientDataJSON: unknown): ClientDataLayoutFacts {
    const facts: ClientDataLayoutFacts = {}
    try {
        if (typeof clientDataJSON !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(clientDataJSON)) return facts
        const note = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(base64urlBytes(clientDataJSON))
        const challengeOffset = note.indexOf('"challenge":"')
        if (challengeOffset >= 0) facts.challengeOffset = challengeOffset
        const parsed = JSON.parse(note)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            facts.clientDataKeys = Object.keys(parsed)
                .slice(0, MAX_CLIENT_DATA_KEYS)
                .map((key) => (KNOWN_CLIENT_DATA_KEYS.has(key) ? key : 'other'))
        }
    } catch {
        // A note that does not decode or parse keeps the facts read so far.
    }
    return facts
}

export function assertPasskeyRegistrationCompatible(credential: unknown): void {
    const response = (credential as { response?: { clientDataJSON?: unknown; attestationObject?: unknown } } | null)
        ?.response
    if (hasValidatorRegistrationLayout(response?.clientDataJSON)) return
    throw new PasskeyProviderUnsupportedError({
        ...clientDataLayoutFacts(response?.clientDataJSON),
        backupEligible: backupEligibleOf(response?.attestationObject),
    })
}
