// LEGACY app-lock path: a local user-presence gate for binaries without the
// NativeBiometric plugin and devices without enrolled biometrics ('plain'
// session mode). On current binaries the real control is the biometric-guarded
// token in Keychain/Keystore (issue #2472, see secure-token-store.ts), where
// the unlock ceremony IS the token read and the gate fails closed.
//
// This fallback is deliberately a LOCAL check — the assertion is never sent to
// the API for verification. The threat it addresses is physical: someone
// holding an already-unlocked phone. It remains a privacy screen and a
// deterrent, NOT account protection: in plain mode the session token is
// reachable by anything that can read the app's filesystem, and clearing the
// stored credential id disables this gate entirely. Those are exactly the
// gaps the guarded mode closes.

import { base64URLToBytes } from './native-webauthn'

/** How long the app may sit in the background before it relocks. */
export const LOCK_AFTER_BACKGROUND_MS = 5 * 60 * 1000

export type UnlockOutcome = 'unlocked' | 'dismissed' | 'unsupported'

/**
 * Prompts for the device biometric/passcode via a WebAuthn assertion against
 * the user's existing passkey.
 *
 * Returns 'unsupported' when we cannot prompt at all — no WebAuthn, no stored
 * credential id, or the authenticator rejecting the request outright
 * (NotSupportedError). Callers must treat that as "do not lock": a lock we
 * can't lift would strand the user in their own app with no way back. That
 * makes every 'unsupported' path fail OPEN — this gate is a presence check for
 * an honest user, not a security boundary against someone who can strip the
 * stored credential id (see the module comment).
 */
export async function requestLocalUserPresence(credentialId?: string): Promise<UnlockOutcome> {
    if (typeof window === 'undefined') return 'unsupported'
    if (!credentialId) return 'unsupported'
    if (!window.PublicKeyCredential || !navigator.credentials?.get) return 'unsupported'

    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    try {
        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge,
                // Copy into a fresh buffer: BufferSource wants Uint8Array<ArrayBuffer>,
                // and base64URLToBytes is typed over the wider ArrayBufferLike.
                allowCredentials: [{ id: new Uint8Array(base64URLToBytes(credentialId)), type: 'public-key' }],
                userVerification: 'required',
                timeout: 60_000,
            },
        })
        return assertion ? 'unlocked' : 'dismissed'
    } catch (error) {
        // A cancelled prompt and a genuinely broken authenticator are
        // indistinguishable here; both leave the app locked with a retry, which
        // is the safe direction. NotSupportedError is the exception: it fails
        // open (like the pre-flight checks), since it means this device cannot
        // complete the ceremony at all and retrying would strand the user.
        if (error instanceof Error && error.name === 'NotSupportedError') return 'unsupported'
        return 'dismissed'
    }
}
