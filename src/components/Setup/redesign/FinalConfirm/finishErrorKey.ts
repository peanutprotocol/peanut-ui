import type en from '@/i18n/app/messages/en.json'
import type { SignupTestTxFailure } from '@/features/setup/signup-test-tx-failure'
import { getPasskeySetupKey } from '@/utils/webauthn.utils'

/** A `setup` catalog key: the final confirmation's own errors or the shared passkey copy. Stored and tracked as is. */
export type FinishErrorKey =
    | `testTransaction.errors.${keyof typeof en.setup.testTransaction.errors}`
    | ReturnType<typeof getPasskeySetupKey>

/** dev's mapping (`Views/SignTestTransaction.tsx`) from a classified failure to the line the screen shows. */
export function failureErrorKey({ mode, errorCode }: SignupTestTxFailure): FinishErrorKey {
    switch (mode) {
        case 'signature_invalid':
            return 'testTransaction.errors.passkeyProviderUnsupported'
        case 'bundler_transient':
            return 'testTransaction.errors.networkBusy'
        case 'needs_new_signature':
            return 'testTransaction.errors.confirmAgain'
        case 'passkey':
            return !errorCode || errorCode === 'LOGIN_ERROR' ? 'passkey.interrupted' : getPasskeySetupKey(errorCode)
        case 'unknown':
            return 'testTransaction.errors.supportNeeded'
        default: {
            const unhandled: never = mode
            return unhandled
        }
    }
}
