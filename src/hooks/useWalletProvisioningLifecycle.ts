'use client'

import { useEffect, useRef } from 'react'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { rainApi } from '@/services/rain'
import { getCachedStepUpToken } from '@/services/step-up-cache'
import { areFeatureFlagsLoaded } from '@/utils/featureFlag.utils'
import { isIOSNative } from '@/utils/capacitor'
import {
    clearLegacyWalletSessionForWallet,
    clearWalletAuthorizationToken,
    clearWalletCardForWallet,
    PUSH_PROVISIONING_FLAG,
    rememberCardForWallet,
    syncWalletAuthorizationToken,
} from '@/utils/push-provisioning'

/**
 * App-wide Wallet state maintenance. This is mounted independently of the
 * card screen so a flag kill-switch or app restart cannot leave the issuer
 * extension advertising stale card/grant state.
 */
export function useWalletProvisioningLifecycle(): void {
    const isFlagEnabled = useFeatureFlags()
    const flagOn = isFlagEnabled(PUSH_PROVISIONING_FLAG)
    const flagsLoaded = areFeatureFlagsLoaded()
    const iosNative = isIOSNative()
    const { overview } = useRainCardOverview()
    const activeCard = findActiveCard(overview)
    const activeCardId = activeCard?.id
    const activeCardLast4 = activeCard?.last4
    const cachedStepUpToken = getCachedStepUpToken()
    const bootstrapGeneration = useRef(0)

    useEffect(() => {
        if (!iosNative) return

        // Older app bundles copied the account JWT into this shared keychain
        // group. Remove that legacy item on every app start; logout also calls
        // clearWalletSession, which clears the complete Wallet state.
        void clearLegacyWalletSessionForWallet()
    }, [iosNative])

    useEffect(() => {
        if (!iosNative) return
        // `isFeatureEnabled` returns false before PostHog has answered. Do not
        // treat that unknown startup state as an explicit rollout kill.
        if (flagsLoaded && !flagOn) {
            void Promise.all([clearWalletCardForWallet(), clearWalletAuthorizationToken()])
        }
    }, [flagOn, flagsLoaded, iosNative])

    useEffect(() => {
        const generation = ++bootstrapGeneration.current
        if (!iosNative || !flagsLoaded || !flagOn || !activeCardId || !activeCardLast4) return

        const isCurrent = () => bootstrapGeneration.current === generation
        void (async () => {
            // This app-wide path may run on Home or another persisted-session
            // destination. It may mirror metadata immediately, but it can only
            // mint a grant with a proof already cached from a recent assertion;
            // never start Face ID just because the app opened.
            if (!isCurrent()) return
            await rememberCardForWallet({ peanutCardId: activeCardId, last4: activeCardLast4 })
            if (!isCurrent()) return

            if (!cachedStepUpToken) return
            try {
                const authorization = await rainApi.getProvisioningAuthorization(activeCardId, 'apple', {
                    stepUpToken: cachedStepUpToken,
                })
                if (!isCurrent()) return
                await syncWalletAuthorizationToken(
                    authorization.walletAuthorizationToken,
                    authorization.walletAuthorizationExpiresIn
                )
            } catch {
                // An expired cached proof or an older API binary must not make
                // the app-wide bootstrap hide the in-app card flow.
            }
        })()

        return () => {
            // Invalidate in-flight authorization and all later shared writes
            // before a replacement card or rollout state can win the render.
            bootstrapGeneration.current += 1
        }
    }, [activeCardId, activeCardLast4, cachedStepUpToken, flagOn, flagsLoaded, iosNative])
}
