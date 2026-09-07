import { isFeatureFlagEnabled } from '@/utils/featureFlag.utils'

// Separate from the live broadcasting engine. Neither release lane enables this.
export function sessionKeySignEnabled(): boolean {
    return process.env.NEXT_PUBLIC_SESSION_KEY_SIGN === 'true' && isFeatureFlagEnabled('session_key_spend_sign')
}
