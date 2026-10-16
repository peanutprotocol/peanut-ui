import { BASE_URL, IS_DEV } from '@/constants/general.consts'
import { isFeatureFlagEnabled } from '@/utils/featureFlag.utils'

export const KYC_VERIFY_ONCE_FLAG = 'kyc_verify_once'
export const KYC_VERIFY_ONCE_HEADER = 'x-kyc-verify-once'
// QA on staging, previews and local: localStorage['kyc_verify_once'] = 'true' turns the flow on without PostHog.
const QA_OVERRIDE_KEY = KYC_VERIFY_ONCE_FLAG
const IS_PROD_DOMAIN = BASE_URL === 'https://peanut.me'

function qaOverride(): boolean {
    if (!IS_DEV && IS_PROD_DOMAIN) return false
    try {
        return typeof localStorage !== 'undefined' && localStorage.getItem(QA_OVERRIDE_KEY) === 'true'
    } catch {
        return false
    }
}

/** The client half of the A/B gate: the server also needs its manifest published and answers `flow: 'verify-once'`. */
export function isVerifyOnceEnabled(): boolean {
    if (typeof window === 'undefined') return false
    if (qaOverride()) return true
    try {
        return isFeatureFlagEnabled(KYC_VERIFY_ONCE_FLAG)
    } catch {
        // PostHog not initialised (or stubbed): the flag reads as off, never as a crash in a KYC call.
        return false
    }
}

/** Sent on every KYC call while the flag is on; without it the API keeps today's flow. */
export function verifyOnceHeaders(): Record<string, string> {
    return isVerifyOnceEnabled() ? { [KYC_VERIFY_ONCE_HEADER]: '1' } : {}
}
