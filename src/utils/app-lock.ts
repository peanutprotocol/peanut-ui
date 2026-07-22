// Native app lock: a local user-presence gate shown when the app is opened
// cold or resumed after a spell in the background.
//
// This is deliberately a LOCAL check — the assertion is never sent to the API
// for verification. The threat it addresses is physical: someone holding an
// already-unlocked phone. The OS will not produce an assertion without the
// user's biometric or device passcode, which is exactly the property we want.
// Server-side proof of a fresh assertion is a separate concern (step-up auth on
// sensitive endpoints) and does not belong in a UI lock.
//
// It is a privacy screen and a deterrent, NOT account protection: the session
// token stays where it always was (webview storage / cookie jar), reachable by
// anything that can read the app's filesystem, and clearing the stored
// credential id disables the gate entirely. Making it a genuine control means
// moving the token into biometric-guarded Keychain/Keystore — tracked
// separately.

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
