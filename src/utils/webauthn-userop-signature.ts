import { p256 } from '@noble/curves/p256'
import { bytesToHex, concat, decodeAbiParameters, hexToBytes, sha256, stringToBytes, type Hex } from 'viem'

/*
 * The checks the deployed passkey validator (v0.0.3, 0x7ab16Ff354AcB328452F1D445b3Ddee9a91e9e69,
 * source verified on Sourcify) runs on a UserOperation signature: src/WebAuthnValidator.sol
 * passes the constant CHALLENGE_LOCATION = 23 and the signature's own responseTypeLocation to
 * src/WebAuthn.sol verifySignature, which requires UP and UV, the type and challenge strings at
 * those byte offsets, and a low-s P-256 signature over sha256(authenticatorData || sha256(clientDataJSON)).
 */
export const VALIDATOR_CHALLENGE_LOCATION = 23

const P256_N_DIV_2 = p256.CURVE.n / 2n
const RESPONSE_TYPE = '"type":"webauthn.get"'
const FLAG_UP = 0x01
const FLAG_UV = 0x04
const FLAG_BE = 0x08
const FLAG_BS = 0x10

export type PasskeySignatureRejection = 'malformed' | 'flags' | 'type' | 'challenge' | 'high_s' | 'signature'

export type PasskeySignatureCheck =
    | { valid: true; challengeOffset: number }
    | { valid: false; reason: PasskeySignatureRejection; challengeOffset?: number }

const base64Url = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

const containsAt = (haystack: Uint8Array, needle: Uint8Array, location: number) =>
    location + needle.length <= haystack.length && needle.every((byte, i) => haystack[location + i] === byte)

const flagsAccepted = (flags: number) =>
    (flags & FLAG_UP) === FLAG_UP &&
    (flags & FLAG_UV) === FLAG_UV &&
    ((flags & FLAG_BE) !== 0 || (flags & FLAG_BS) === 0)

export function checkPasskeyUserOpSignature({
    signature,
    userOpHash,
    publicKey,
}: {
    signature: Hex
    userOpHash: Hex
    publicKey: { x: bigint; y: bigint }
}): PasskeySignatureCheck {
    let decoded: readonly [Hex, string, bigint, bigint, bigint, boolean]
    try {
        decoded = decodeAbiParameters(
            [
                { name: 'authenticatorData', type: 'bytes' },
                { name: 'clientDataJSON', type: 'string' },
                { name: 'responseTypeLocation', type: 'uint256' },
                { name: 'r', type: 'uint256' },
                { name: 's', type: 'uint256' },
                { name: 'usePrecompiled', type: 'bool' },
            ],
            signature
        )
    } catch {
        return { valid: false, reason: 'malformed' }
    }
    const [authenticatorData, clientDataJSON, responseTypeLocation, r, s] = decoded
    const authData = hexToBytes(authenticatorData)
    const clientData = stringToBytes(clientDataJSON)
    const challengeProperty = stringToBytes(`"challenge":"${base64Url(hexToBytes(userOpHash))}"`)
    const found = new TextDecoder().decode(clientData).indexOf('"challenge":"')
    const challengeOffset = found >= 0 ? found : undefined

    if (authData.length < 37 || !flagsAccepted(authData[32])) return { valid: false, reason: 'flags', challengeOffset }
    if (
        responseTypeLocation > BigInt(Number.MAX_SAFE_INTEGER) ||
        !containsAt(clientData, stringToBytes(RESPONSE_TYPE), Number(responseTypeLocation))
    ) {
        return { valid: false, reason: 'type', challengeOffset }
    }
    if (!containsAt(clientData, challengeProperty, VALIDATOR_CHALLENGE_LOCATION)) {
        return { valid: false, reason: 'challenge', challengeOffset }
    }
    if (s > P256_N_DIV_2) return { valid: false, reason: 'high_s', challengeOffset }

    const messageHash = sha256(concat([authenticatorData, sha256(bytesToHex(clientData))]))
    let verified = false
    try {
        const sig = new p256.Signature(r, s)
        const point = p256.ProjectivePoint.fromAffine({ x: publicKey.x, y: publicKey.y })
        verified = p256.verify(sig.toCompactRawBytes(), hexToBytes(messageHash), point.toRawBytes(false), {
            lowS: true,
        })
    } catch {
        verified = false
    }
    return verified
        ? { valid: true, challengeOffset: VALIDATOR_CHALLENGE_LOCATION }
        : { valid: false, reason: 'signature', challengeOffset }
}
