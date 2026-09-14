import { isFeatureFlagEnabled } from '@/utils/featureFlag.utils'

// Older APIs omit this contract: both flags alone must never enable signing.
export function sessionKeySignEnabled(serverContract: unknown): boolean {
    return (
        process.env.NEXT_PUBLIC_SESSION_KEY_SIGN === 'true' &&
        isFeatureFlagEnabled('session_key_spend_sign') &&
        serverContract === 'broadcast-first-revert-v1'
    )
}
