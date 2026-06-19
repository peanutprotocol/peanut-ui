import { keccak256, type Hex } from 'viem'
import { b64ToBytes } from '@zerodev/webauthn-key'

/**
 * Public passkey material we persist server-side for every smart wallet
 * (the P-256 pubkey coordinates + the WebAuthn credential id). None of this is
 * secret — the private key never leaves the user's authenticator — so it is
 * safe to hand to the browser in a one-off recovery link.
 */
export interface RecoveryKeyInput {
    /** P-256 public key X coordinate, hex (with or without 0x). */
    pubX: string
    /** P-256 public key Y coordinate, hex (with or without 0x). */
    pubY: string
    /** WebAuthn credential id (base64url) — the authenticator id. */
    credId: string
    /** Smart-wallet address this key is expected to derive to (asserted on build). */
    address: Hex
    /** Optional pre-filled destination to sweep funds to. */
    to?: Hex
    /** Optional user-facing label (e.g. a first name) for the rescue screen. */
    label?: string
}

/**
 * The exact shape `@zerodev/webauthn-key`'s `toWebAuthnKey()` returns, minus the
 * passkey-server round-trip. ZeroDev's passkey validator signs on web via the
 * browser WebAuthn API keyed only by `authenticatorId`, so this object is enough
 * to build a fully-functional signing kernel client.
 */
export interface RescueWebAuthnKey {
    pubX: bigint
    pubY: bigint
    authenticatorId: string
    authenticatorIdHash: Hex
    rpID: string
}

const ensureHexPrefix = (value: string): Hex => (value.startsWith('0x') ? (value as Hex) : (`0x${value}` as Hex))

/**
 * Reconstruct the ZeroDev WebAuthnKey from persisted passkey material. This is
 * the bypass for the broken passkey-server *login*: a user whose device can
 * still authenticate but whose `toWebAuthnKey({mode: Login})` round-trip fails
 * can still build a signing kernel client from the pubkey we already hold.
 *
 * `authenticatorIdHash` mirrors the upstream lib exactly:
 * `keccak256(bytes(base64url(credId)))`.
 */
export function toRescueWebAuthnKey(input: RecoveryKeyInput): RescueWebAuthnKey {
    return {
        pubX: BigInt(ensureHexPrefix(input.pubX)),
        pubY: BigInt(ensureHexPrefix(input.pubY)),
        authenticatorId: input.credId,
        authenticatorIdHash: keccak256(b64ToBytes(input.credId)),
        // Unused on web — the validator signs via the page-origin WebAuthn API.
        rpID: '',
    }
}

const isHex = (value: unknown): value is string => typeof value === 'string' && /^(0x)?[0-9a-fA-F]+$/.test(value)
const isAddress = (value: unknown): value is Hex => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)

/**
 * Decode the base64url-encoded JSON blob carried in the `?k=` recovery-link
 * param. Throws on anything malformed so the page can show a clean error rather
 * than building a bogus kernel client.
 */
export function decodeRecoveryKey(blob: string): RecoveryKeyInput {
    let parsed: unknown
    try {
        parsed = JSON.parse(new TextDecoder().decode(b64ToBytes(blob)))
    } catch {
        throw new Error('Recovery link is malformed')
    }
    if (typeof parsed !== 'object' || parsed === null) throw new Error('Recovery link is malformed')
    const { pubX, pubY, credId, address, to, label } = parsed as Record<string, unknown>
    if (!isHex(pubX) || !isHex(pubY)) throw new Error('Recovery link has an invalid public key')
    if (typeof credId !== 'string' || credId.length === 0) throw new Error('Recovery link is missing a credential id')
    if (!isAddress(address)) throw new Error('Recovery link has an invalid wallet address')
    if (to !== undefined && !isAddress(to)) throw new Error('Recovery link has an invalid destination address')
    return {
        pubX,
        pubY,
        credId,
        address,
        ...(to !== undefined ? { to } : {}),
        ...(typeof label === 'string' ? { label } : {}),
    }
}

/** Encode a recovery blob for an ops-generated link (inverse of decodeRecoveryKey). */
export function encodeRecoveryKey(input: RecoveryKeyInput): string {
    const json = new TextEncoder().encode(JSON.stringify(input))
    return Buffer.from(json).toString('base64url')
}
