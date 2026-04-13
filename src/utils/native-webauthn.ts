// native webauthn utilities for capacitor passkey integration
// extracted from the native-poc page (pr #1766) into production-ready modules

import { keccak256, type Hex, type SignableMessage, encodeAbiParameters } from 'viem'
import { bytesToBigInt, hexToBytes } from 'viem'
// @ts-ignore -- @noble/curves/p256 requires pinning to v1.9.7 (v2 removed this export)
import { p256 } from '@noble/curves/p256'
import { registerPlugin } from '@capacitor/core'
import { setAuthToken } from './auth-token'

// register the webauthn plugin bridge — the native code is loaded by capacitor runtime,
// this just creates the js-to-native communication channel
const Webauthn: any = registerPlugin('Webauthn')

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

// --- native registration and login ---
// these replace @simplewebauthn/browser with the capacitor-webauthn native plugin
// while still communicating with the passkey server for credential storage.
//
// note: for dev, these calls go through next.js proxy (/api/proxy/passkeys/...)
// which forwards to the local backend. for production static export, these
// will need to call the backend directly via getApiBaseUrl().

/**
 * registers a new passkey via the native capacitor-webauthn plugin and stores
 * the credential on zerodev's passkey server. returns a WebAuthnKey with
 * signMessageCallback attached.
 *
 * this replaces toWebAuthnKey({ mode: Register }) which uses browser WebAuthn API
 * (doesn't work in android webview).
 */
export async function nativeRegister(params: {
    passkeyName: string
    passkeyServerUrl: string
    rpId: string
    passkeyServerHeaders?: Record<string, string>
}): Promise<WebAuthnKey> {
    const { passkeyName, passkeyServerUrl, rpId, passkeyServerHeaders = {} } = params
    // Webauthn plugin is registered at module level via @capacitor/core

    // 1. get registration options from passkey server
    const optionsRes = await fetch(`${passkeyServerUrl}/register/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...passkeyServerHeaders },
        body: JSON.stringify({ username: passkeyName, rpID: rpId }),
        credentials: 'include',
    })
    const registerOptions = await optionsRes.json()

    // 2. create passkey via native plugin (instead of @simplewebauthn/browser)
    const options = registerOptions.options || registerOptions
    // ensure rpId is set correctly
    if (options.rp) {
        options.rp.id = rpId
    }
    const credential: any = await Webauthn.startRegistration(options)

    // 3. verify registration with zerodev passkey server
    // TODO: remove debug logs after testing
    console.log('[nativeRegister] credential from plugin:', JSON.stringify(credential))
    console.log('[nativeRegister] registerOptions.userId:', registerOptions.userId)

    const verifyPayload = {
        userId: registerOptions.userId,
        username: passkeyName,
        cred: credential,
        rpID: rpId,
    }
    console.log('[nativeRegister] verify payload:', JSON.stringify(verifyPayload))

    const verifyRes = await fetch(`${passkeyServerUrl}/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...passkeyServerHeaders },
        body: JSON.stringify(verifyPayload),
        credentials: 'include',
    })
    const verifyResult = await verifyRes.json()
    console.log('[nativeRegister] verify result:', JSON.stringify(verifyResult))

    if (!verifyResult.verified) {
        throw new Error(`native passkey registration not verified by server: ${JSON.stringify(verifyResult)}`)
    }

    // save jwt token from response body (Set-Cookie doesn't work cross-origin in static export)
    if (verifyResult.token) {
        setAuthToken(verifyResult.token)
    }

    // 4. parse public key and build WebAuthnKey
    const publicKey = credential.response?.publicKey
    if (!publicKey) {
        throw new Error('no public key in native registration response')
    }

    const webAuthnKey = await parsePublicKeyToWebAuthnKey(publicKey, credential.id, rpId)
    webAuthnKey.signMessageCallback = createNativeSignMessageCallback(rpId)

    return webAuthnKey
}

/**
 * logs in with an existing passkey via the native capacitor-webauthn plugin,
 * verified against zerodev's passkey server. returns a WebAuthnKey with
 * signMessageCallback attached.
 *
 * this replaces toWebAuthnKey({ mode: Login }) which uses browser WebAuthn API.
 */
export async function nativeLogin(params: {
    passkeyServerUrl: string
    rpId: string
    passkeyServerHeaders?: Record<string, string>
}): Promise<WebAuthnKey> {
    const { passkeyServerUrl, rpId, passkeyServerHeaders = {} } = params
    // Webauthn plugin is registered at module level via @capacitor/core

    // 1. get login options from passkey server
    const optionsRes = await fetch(`${passkeyServerUrl}/login/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...passkeyServerHeaders },
        body: JSON.stringify({ rpID: rpId }),
        credentials: 'include',
    })
    const loginOptions = await optionsRes.json()

    // 2. authenticate via native plugin (instead of @simplewebauthn/browser)
    if (!loginOptions.rpId) {
        loginOptions.rpId = rpId
    }
    const assertion: any = await Webauthn.startAuthentication(loginOptions)

    // 3. verify with passkey server to get the public key
    const verifyRes = await fetch(`${passkeyServerUrl}/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...passkeyServerHeaders },
        body: JSON.stringify({ cred: assertion, rpID: rpId }),
        credentials: 'include',
    })
    const verifyResult = await verifyRes.json()
    if (!verifyResult.verification?.verified) {
        throw new Error('native passkey login not verified by server')
    }

    // save jwt token from response body (Set-Cookie doesn't work cross-origin in static export)
    if (verifyResult.token) {
        setAuthToken(verifyResult.token)
    }

    // 4. parse public key from server response
    const pubKey = verifyResult.pubkey
    if (!pubKey) {
        throw new Error('no public key returned from login verification')
    }

    // server returns base64-encoded SPKI public key
    const spkiDer = Uint8Array.from(atob(pubKey), (c) => c.charCodeAt(0))
    const key = await crypto.subtle.importKey('spki', spkiDer, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify'])
    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key))
    const pubKeyX = rawKey.slice(1, 33)
    const pubKeyY = rawKey.slice(33, 65)

    const authenticatorIdBytes = base64URLToBytes(assertion.id)
    const authenticatorIdHash = keccak256(uint8ArrayToHexString(authenticatorIdBytes))

    const webAuthnKey: WebAuthnKey = {
        pubX: BigInt(uint8ArrayToHexString(pubKeyX)),
        pubY: BigInt(uint8ArrayToHexString(pubKeyY)),
        authenticatorId: assertion.id,
        authenticatorIdHash,
        rpID: rpId,
        signMessageCallback: createNativeSignMessageCallback(rpId),
    }

    return webAuthnKey
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
        // Webauthn plugin is registered at module level via @capacitor/core

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
