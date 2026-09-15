'use client'

import { useEffect } from 'react'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { isIOSNative } from '@/utils/capacitor'
import {
    clearLegacyWalletSessionForWallet,
    clearWalletAuthorizationToken,
    clearWalletCardForWallet,
    PUSH_PROVISIONING_FLAG,
} from '@/utils/push-provisioning'

/**
 * App-wide Wallet state maintenance. This is mounted independently of the
 * card screen so a flag kill-switch or app restart cannot leave the issuer
 * extension advertising stale card/grant state.
 */
export function useWalletProvisioningLifecycle(): void {
    const isFlagEnabled = useFeatureFlags()
    const flagOn = isFlagEnabled(PUSH_PROVISIONING_FLAG)

    useEffect(() => {
        if (!isIOSNative()) return

        // Older app bundles copied the account JWT into this shared keychain
        // group. Remove that legacy item on every app start; logout also calls
        // clearWalletSession, which clears the complete Wallet state.
        void clearLegacyWalletSessionForWallet()
        if (!flagOn) {
            void Promise.all([clearWalletCardForWallet(), clearWalletAuthorizationToken()])
        }
    }, [flagOn])
}
