// native webauthn utilities for capacitor passkey integration
// extracted from the native-poc page (pr #1766) into production-ready modules

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

function base64URLToBytes(base64url: string): Uint8Array {
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
 * extracts p256 public key coordinates from SPKI DER-encoded public key returned by
 * the capacitor-webauthn plugin during registration.
 *
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
const RIP7212_CHAIN_IDS = [137, 80001] // polygon mainnet, polygon mumbai

/**
 * creates a signMessageCallback that uses the capacitor-webauthn native plugin
 * instead of the browser WebAuthn API. this is required on android where the
 * browser WebAuthn API doesn't work inside a webview.
 *
 * the callback produces ABI-encoded signatures in the format zerodev expects
 * for on-chain passkey verification.
 */
export function createNativeSignMessageCallback(rpId: string) {
    return async (
        message: SignableMessage,
        _rpId: string,
        chainId: number,
        allowCredentials?: AllowCredentialDescriptor[]
    ): Promise<Hex> => {
        // dynamic import that webpack can't statically analyze — capacitor-webauthn
        // is only available in native builds, not in the web bundle
        const pluginName = 'capacitor-webauthn'
        const { Webauthn } = await import(/* webpackIgnore: true */ pluginName)

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
            challenge,
            rpId,
            allowCredentials: allowCredentials?.map((cred) => ({
                id: cred.id,
                type: 'public-key' as const,
            })),
            userVerification: 'required' as const,
            timeout: 60000,
        }

        const cred: any = await Webauthn.startAuthentication(assertionOptions)

        // parse response in zerodev's expected format
        const authenticatorData = base64URLToBytes(cred.response.authenticatorData)
        const authenticatorDataHex = uint8ArrayToHexString(authenticatorData)

        const clientDataJSON = atob(cred.response.clientDataJSON.replace(/-/g, '+').replace(/_/g, '/'))

        // zerodev looks for '"type":"webauthn.get"' in clientDataJSON
        const beforeType = BigInt(clientDataJSON.lastIndexOf('"type":"webauthn.get"'))

        // parse and normalize signature
        const signatureBytes = base64URLToBytes(cred.response.signature)
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
