// native webauthn utilities for capacitor passkey integration
// provides signing callback and public key parsing for @capgo/capacitor-passkey autoShim

import { keccak256, type Hex, type SignableMessage, encodeAbiParameters } from 'viem'
import { bytesToBigInt, hexToBytes } from 'viem'
// @ts-ignore -- @noble/curves/p256 requires pinning to v1.9.7 (v2 removed this export)
import { p256 } from '@noble/curves/p256'

// credential request options shape used by the signing callback
interface AllowCredentialDescriptor {
    id: string
    type: 'public-key'
    transports?: string[]
}

// matches zerodev's WebAuthnKey interface
interface WebAuthnKey {
    pubX: bigint
    pubY: bigint
    authenticatorId: string
    authenticatorIdHash: Hex
    rpID: string
    signMessageCallback?: (
        message: SignableMessage,
        rpId: string,
        chainId: number,
        allowCredentials?: AllowCredentialDescriptor[]
    ) => Promise<Hex>
}

// --- encoding helpers ---

function bufferToBase64URL(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let str = ''
    for (const byte of bytes) {
        str += String.fromCharCode(byte)
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function base64URLToBytes(base64url: string): Uint8Array {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

function uint8ArrayToHexString(arr: Uint8Array): Hex {
    return `0x${Array.from(arr)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')}` as Hex
}

// --- signature parsing ---

// secp256r1 (p256) curve order
const SECP256R1_N = BigInt('0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551')

/**
 * parses a DER-encoded ECDSA signature and normalizes the S value to prevent malleability
 * uses @noble/curves/p256 for reliable DER parsing
 */
function parseAndNormalizeSig(derSig: Hex): { r: bigint; s: bigint } {
    const sigWithoutPrefix = derSig.startsWith('0x') ? derSig.slice(2) : derSig
    const parsedSignature = p256.Signature.fromDER(sigWithoutPrefix)
    const compactHex = parsedSignature.toCompactHex()
    const bSig = hexToBytes(`0x${compactHex}`)
    const bR = bSig.slice(0, 32)
    const bS = bSig.slice(32)

    const r = bytesToBigInt(bR)
    let s = bytesToBigInt(bS)

    // ensure low S (<= N/2) to avoid signature malleability
    if (s > SECP256R1_N / 2n) {
        s = SECP256R1_N - s
    }
    return { r, s }
}

// --- public key parsing ---

/**
 * extracts p256 public key coordinates from SPKI DER-encoded public key.
 * the returned WebAuthnKey object is compatible with zerodev's passkey-validator.
 */
export async function parsePublicKeyToWebAuthnKey(
    publicKeyBase64: string,
    authenticatorId: string,
    rpId: string
): Promise<WebAuthnKey> {
    const spkiDer = base64URLToBytes(publicKeyBase64)

    const key = await crypto.subtle.importKey(
        'spki',
        spkiDer as BufferSource,
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['verify']
    )

    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key))

    // raw format: 0x04 (uncompressed) + X (32 bytes) + Y (32 bytes)
    const pubKeyX = rawKey.slice(1, 33)
    const pubKeyY = rawKey.slice(33, 65)

    const authenticatorIdBytes = base64URLToBytes(authenticatorId)
    const authenticatorIdHash = keccak256(uint8ArrayToHexString(authenticatorIdBytes))

    return {
        pubX: BigInt(uint8ArrayToHexString(pubKeyX)),
        pubY: BigInt(uint8ArrayToHexString(pubKeyY)),
        authenticatorId,
        authenticatorIdHash,
        rpID: rpId,
    }
}

// --- signing callback ---

// chains that support the RIP-7212 precompile for on-chain p256 verification
const RIP7212_CHAIN_IDS = [137, 8453, 10, 42161] // polygon, base, optimism, arbitrum

/**
 * creates a signMessageCallback that uses the native credential manager
 * via @capgo/capacitor-passkey autoShim (which patches navigator.credentials).
 *
 * this callback is re-attached after restoring a WebAuthnKey from storage
 * since functions can't be serialized to cookies/localStorage.
 */
export function createNativeSignMessageCallback(rpId: string) {
    return async (
        message: SignableMessage,
        _rpId: string,
        chainId: number,
        allowCredentials?: AllowCredentialDescriptor[]
    ): Promise<Hex> => {
        // convert message to hex string
        let messageContent: string
        if (typeof message === 'string') {
            messageContent = message
        } else if ('raw' in message && typeof message.raw === 'string') {
            messageContent = message.raw
        } else if ('raw' in message && message.raw instanceof Uint8Array) {
            messageContent = uint8ArrayToHexString(message.raw)
        } else {
            throw new Error('unsupported message format for native signing')
        }

        // convert hex to base64url challenge
        const formattedMessage = messageContent.startsWith('0x') ? messageContent.slice(2) : messageContent
        const messageBytes = new Uint8Array(formattedMessage.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))
        const challenge = bufferToBase64URL(messageBytes.buffer)

        const assertionOptions = {
            challenge: messageBytes as BufferSource,
            rpId,
            allowCredentials: allowCredentials?.map((cred) => ({
                id: base64URLToBytes(cred.id) as BufferSource,
                type: 'public-key' as const,
            })),
            userVerification: 'required' as const,
            timeout: 60000,
        }

        // uses navigator.credentials.get() which is shimmed by @capgo/capacitor-passkey
        const cred = (await navigator.credentials.get({
            publicKey: assertionOptions,
        })) as PublicKeyCredential

        if (!cred || !cred.response) {
            throw new Error('native signing failed — no credential returned')
        }

        const response = cred.response as AuthenticatorAssertionResponse

        // parse response in zerodev's expected format
        const authenticatorData = new Uint8Array(response.authenticatorData)
        const authenticatorDataHex = uint8ArrayToHexString(authenticatorData)

        const clientDataJSON = new TextDecoder().decode(new Uint8Array(response.clientDataJSON))

        // zerodev looks for '"type":"webauthn.get"' in clientDataJSON
        const beforeType = BigInt(clientDataJSON.lastIndexOf('"type":"webauthn.get"'))

        // parse and normalize signature
        const signatureBytes = new Uint8Array(response.signature)
        const signatureHex = uint8ArrayToHexString(signatureBytes)
        const { r, s } = parseAndNormalizeSig(signatureHex)

        const isRIP7212Supported = RIP7212_CHAIN_IDS.includes(chainId)

        return encodeAbiParameters(
            [
                { name: 'authenticatorData', type: 'bytes' },
                { name: 'clientDataJSON', type: 'string' },
                { name: 'responseTypeLocation', type: 'uint256' },
                { name: 'r', type: 'uint256' },
                { name: 's', type: 'uint256' },
                { name: 'usePrecompiled', type: 'bool' },
            ],
            [authenticatorDataHex, clientDataJSON, beforeType, r, s, isRIP7212Supported]
        )
    }
}
