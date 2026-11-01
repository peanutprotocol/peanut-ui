import { updateUserById } from '@/app/actions/users'
import type { SetupFundingChannel, SetupPaymentChannel } from '@/features/setup/paymentChannels'
import { storeDeclaredResidence, storeSecondResidence } from '@/utils/declared-residence.storage'

const pendingSaves = new Map<string, Promise<void>>()

function saveInBackground(userId: string, fields: Record<string, unknown>, onSaved?: () => void): void {
    const previous = pendingSaves.get(userId) ?? Promise.resolve()
    // Serialize all signup writes per account so an older answer cannot land after a newer one.
    const save = previous
        .then(() => updateUserById({ userId, ...fields }))
        .then((result) => {
            if (result?.error) {
                console.error('[saveSignupAnswers] Failed to save:', Object.keys(fields))
                return
            }
            onSaved?.()
        })
        .catch(() => console.error('[saveSignupAnswers] Failed to save:', Object.keys(fields)))
        .finally(() => {
            if (pendingSaves.get(userId) === save) pendingSaves.delete(userId)
        })
    pendingSaves.set(userId, save)
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
