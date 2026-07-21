// Native app lock: a local user-presence gate shown when the app is opened
// cold or resumed after a spell in the background.
//
// This is deliberately a LOCAL check — the assertion is never sent to the API
// for verification. The threat it addresses is physical: someone holding an
// already-unlocked phone. The OS will not produce an assertion without the
// user's biometric or device passcode, which is exactly the property we want.
// Server-side proof of a fresh assertion is a separate concern (step-up auth on
// sensitive endpoints) and does not belong in a UI lock.

import { base64URLToBytes } from './native-webauthn'

/** How long the app may sit in the background before it relocks. */
export const LOCK_AFTER_BACKGROUND_MS = 5 * 60 * 1000

export type UnlockOutcome = 'unlocked' | 'dismissed' | 'unsupported'

/**
 * Prompts for the device biometric/passcode via a WebAuthn assertion against
 * the user's existing passkey.
 *
 * Returns 'unsupported' when we cannot prompt at all — no WebAuthn, or no
 * stored credential id. Callers must treat that as "do not lock": a lock we
 * can't lift would strand the user in their own app with no way back.
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
        // is the safe direction. Only the pre-flight checks above fail open.
        if (error instanceof Error && error.name === 'NotSupportedError') return 'unsupported'
        return 'dismissed'
    }
}
