'use client'
import { useCallback, useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { rainApi } from '@/services/rain'
import { isAndroidNative, isIOSNative } from '@/utils/capacitor'
import {
    addCardToWallet,
    getPushProvisioningAvailability,
    PUSH_PROVISIONING_FLAG,
    type AddCardToWalletResult,
} from '@/utils/push-provisioning'

/**
 * Native one-tap add-to-wallet (Apple Pay / Google Pay via MeaWallet MPP).
 * `nativeAvailable` is false on web, on binaries without the SDK, behind the
 * launch flag, and when the card is already in the wallet — callers keep the
 * manual carousel in all those cases, so an OTA'd JS bundle on an old binary
 * degrades cleanly.
 */
export function usePushProvisioning(card: { id: string; last4: string }) {
    const isFlagEnabled = useFeatureFlags()
    // No nonProdBypass: the backend route (peanut-api-ts#1425) is not deployed
    // anywhere yet, so bypassing on staging/preview/local would send every
    // native build's tap through step-up into a 404 and the failure toast.
    // Add the bypass back once the route is live.
    const flagOn = isFlagEnabled(PUSH_PROVISIONING_FLAG)
    const [nativeAvailable, setNativeAvailable] = useState(false)
    const [isAdding, setIsAdding] = useState(false)

    useEffect(() => {
        let cancelled = false
        if (!flagOn || (!isIOSNative() && !isAndroidNative())) {
            setNativeAvailable(false)
            return
        }
        void getPushProvisioningAvailability(card.last4).then(({ available, alreadyInWallet }) => {
            if (!cancelled) setNativeAvailable(available && !alreadyInWallet)
        })
        return () => {
            cancelled = true
        }
    }, [flagOn, card.last4])

    const addToWallet = useCallback(async (): Promise<AddCardToWalletResult> => {
        const wallet = isIOSNative() ? 'apple' : 'google'
        posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_TAPPED, { wallet })
        setIsAdding(true)
        try {
            const data = await rainApi.getProvisioningData(card.id, wallet)
            const result = await addCardToWallet({
                cardId: data.cardId,
                cardSecret: data.cardSecret,
                cardholderName: data.cardholderName,
                last4: data.last4,
                address: data.billingAddress,
            })
            posthog.capture(
                result.added
                    ? ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_SUCCEEDED
                    : result.canceled
                      ? ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_CANCELED
                      : ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_FAILED,
                { wallet, error: result.error }
            )
            if (result.added || result.alreadyInWallet) setNativeAvailable(false)
            return result
        } catch (e) {
            // Step-up cancel/timeout or the provisioning-data fetch failing
            // (429 rate limit, 409 billing missing) all land here.
            const error = e instanceof Error ? e.message : 'unknown'
            posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_FAILED, { wallet, error })
            return { added: false, error }
        } finally {
            setIsAdding(false)
        }
    }, [card.id])

    return { nativeAvailable, isAdding, addToWallet }
}
