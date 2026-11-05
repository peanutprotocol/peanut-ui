import { p256 } from '@noble/curves/p256'
import { bytesToHex, concat, encodeAbiParameters, hexToBytes, sha256, stringToHex, type Hex } from 'viem'

const base64Url = (bytes: Uint8Array) =>
    Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function passkeyFixture(seed = 7) {
    const privateKey = new Uint8Array(32).fill(seed)
    const point = p256.ProjectivePoint.fromHex(p256.getPublicKey(privateKey, false)).toAffine()
    return { privateKey, publicKey: { x: point.x, y: point.y } }
}

/** clientDataJSON the way browsers and the Android platform serialise it: type, then challenge. */
export const standardClientData = (challenge: string, origin = 'https://peanut.me') =>
    `{"type":"webauthn.get","challenge":"${challenge}","origin":"${origin}","crossOrigin":false}`

/** The sorted layout some Android password managers return (TASK-23931). */
export const sortedClientData = (challenge: string) =>
    `{"androidPackageName":"me.peanut.wallet","challenge":"${challenge}","origin":"android:apk-key-hash:abc","type":"webauthn.get"}`

export function signPasskeyUserOp({
    userOpHash,
    privateKey,
    clientData = standardClientData,
    flags = 0x05,
    highS = false,
}: {
    userOpHash: Hex
    privateKey: Uint8Array
    clientData?: (challenge: string) => string
    flags?: number
    highS?: boolean
}): Hex {
    const clientDataJSON = clientData(base64Url(hexToBytes(userOpHash)))
    const authenticatorData = bytesToHex(new Uint8Array([...new Uint8Array(32).fill(0x49), flags, 0, 0, 0, 1]))
    const messageHash = sha256(concat([authenticatorData, sha256(stringToHex(clientDataJSON))]))
    const signature = p256.sign(hexToBytes(messageHash), privateKey, { lowS: true })
    const s = highS ? p256.CURVE.n - signature.s : signature.s
    return encodeAbiParameters(
        [
            { name: 'authenticatorData', type: 'bytes' },
            { name: 'clientDataJSON', type: 'string' },
            { name: 'responseTypeLocation', type: 'uint256' },
            { name: 'r', type: 'uint256' },
            { name: 's', type: 'uint256' },
            { name: 'usePrecompiled', type: 'bool' },
        ],
        [
            authenticatorData,
            clientDataJSON,
            BigInt(clientDataJSON.lastIndexOf('"type":"webauthn.get"')),
            signature.r,
            s,
            true,
        ]
    )
}
