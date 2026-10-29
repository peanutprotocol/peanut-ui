import { updateUserById } from '@/app/actions/users'
import { storeDeclaredResidence, storeSecondResidence } from '@/utils/declared-residence.storage'

/**
 * Saves the residence and nationality from the sign-up residence step on the
 * account, in the background: the caller moves on without waiting, so a slow
 * write never holds up the next screen. A failed write is logged, not retried;
 * the last sign-up screen saves the same answers again.
 */
export function saveSignupResidence(
    userId: string,
    residenceCountry: string,
    nationality: string,
    onSaved?: () => void
): void {
    storeDeclaredResidence(userId, residenceCountry)
    storeSecondResidence(userId, null)
    void updateUserById({ userId, residenceCountry, nationality })
        .then((result) => {
            // updateUserById maps API failures to { error } instead of throwing.
            if (result?.error) {
                console.error('[saveSignupResidence] Failed to save the residence:', result.error)
                return
            }
            onSaved?.()
        })
        .catch((err: unknown) => console.error('[saveSignupResidence] Failed to save the residence:', err))
}
