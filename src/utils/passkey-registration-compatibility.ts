/** Layout facts of a refused registration. Never the note's values: they hold the challenge and the origin. */
export type ClientDataLayoutFacts = {
    /** Index of `"challenge":"` in the decoded clientDataJSON; the standard registration layout gives 26. */
    challengeOffset?: number
    /** Top-level keys of the clientDataJSON in signed order. */
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

export function assertPasskeyRegistrationCompatible(credential: unknown): void {
    const response = (credential as { response?: { clientDataJSON?: unknown; attestationObject?: unknown } } | null)
        ?.response
    const encoded = response?.clientDataJSON
    const facts: ClientDataLayoutFacts = { backupEligible: backupEligibleOf(response?.attestationObject) }
    try {
        if (typeof encoded !== 'string' || !/^[A-Za-z0-9_-]+={0,2}$/.test(encoded)) throw new Error()
        const clientData = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(base64urlBytes(encoded))
        const challengeOffset = clientData.indexOf('"challenge":"')
        if (challengeOffset >= 0) facts.challengeOffset = challengeOffset
        const parsed = JSON.parse(clientData)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) facts.clientDataKeys = Object.keys(parsed)
        if (
            parsed.type !== 'webauthn.create' ||
            typeof parsed.challenge !== 'string' ||
            !/^[A-Za-z0-9_-]+$/.test(parsed.challenge) ||
            typeof parsed.origin !== 'string' ||
            !parsed.origin
        ) {
            throw new Error()
        }
        // The deployed validator fixes the get challenge at byte 23 (create uses byte 26).
        if (!clientData.startsWith(`{"type":"webauthn.create","challenge":${JSON.stringify(parsed.challenge)}`)) {
            throw new Error()
        }
    } catch {
        throw new PasskeyProviderUnsupportedError(facts)
    }
}
