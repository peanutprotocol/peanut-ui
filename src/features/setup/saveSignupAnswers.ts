import { updateUserById } from '@/app/actions/users'
import type { SetupFundingChannel, SetupPaymentChannel } from '@/features/setup/paymentChannels'
import { storeDeclaredResidence, storeSecondResidence } from '@/utils/declared-residence.storage'

/**
 * Sign-up saves each step's answers on the account when its Next is tapped, in
 * the background: the caller moves on without waiting, so a slow write never
 * holds up the next screen. A failed write is logged, not retried; the last
 * sign-up screen sends the same answers again.
 */
function saveInBackground(userId: string, fields: Record<string, unknown>, onSaved?: () => void): void {
    void updateUserById({ userId, ...fields })
        .then((result) => {
            // updateUserById maps API failures to { error } instead of throwing.
            if (result?.error) {
                console.error('[saveSignupAnswers] Failed to save:', Object.keys(fields), result.error)
                return
            }
            onSaved?.()
        })
        .catch((err: unknown) => console.error('[saveSignupAnswers] Failed to save:', Object.keys(fields), err))
}

export function saveSignupResidence(
    userId: string,
    residenceCountry: string,
    nationality: string,
    onSaved?: () => void
): void {
    storeDeclaredResidence(userId, residenceCountry)
    storeSecondResidence(userId, null)
    saveInBackground(userId, { residenceCountry, nationality }, onSaved)
}

/** The API takes it only before the wallet exists; the last screen records it with the wallet. */
export function saveSignupPaymentPlan(
    userId: string,
    fundingChannel: SetupFundingChannel,
    paymentChannel: SetupPaymentChannel
): void {
    saveInBackground(userId, { signupPreferences: { fundingChannel, paymentChannel } })
}
