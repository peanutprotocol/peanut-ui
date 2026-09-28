'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { rainApi } from '@/services/rain'
import { isIOSNative } from '@/utils/capacitor'
import {
    addCardToWallet,
    clearWalletStateIfCardMatches,
    getPushProvisioningAvailability,
    PUSH_PROVISIONING_FLAG,
    rememberCardForWallet,
    syncWalletAuthorizationToken,
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
    const availabilityScope = `${flagOn}:${card.id}:${card.last4}`
    const availabilityScopeRef = useRef(availabilityScope)
    const latestSelectionRef = useRef({ cardId: card.id, last4: card.last4, flagOn })

    useEffect(() => {
        availabilityScopeRef.current = availabilityScope
        latestSelectionRef.current = { cardId: card.id, last4: card.last4, flagOn }
        return () => {
            availabilityScopeRef.current = ''
            latestSelectionRef.current = { cardId: card.id, last4: card.last4, flagOn: false }
        }
    }, [availabilityScope, card.id, card.last4, flagOn])

    useEffect(() => {
        let cancelled = false
        const iosNative = isIOSNative()
        // iOS only for now. Google requires its own supplied, localized "Add to
        // Google Wallet" button on any control that starts push provisioning, and
        // that asset ships with issuer onboarding — which is also the gate this
        // path waits on. Until then Android keeps the manual carousel rather than
        // starting the flow from a button Google has not sanctioned. The native
        // Android path underneath is complete; re-enable it with the asset.
        if (!flagOn || !iosNative) {
            setNativeAvailable(false)
            return
        }
        void getPushProvisioningAvailability(card.last4).then(({ available, alreadyInWallet }) => {
            if (!cancelled) setNativeAvailable(available && !alreadyInWallet)
        })
        return () => {
            cancelled = true
        }
    }, [flagOn, card.id, card.last4])

    const addToWallet = useCallback(async (): Promise<AddCardToWalletResult> => {
        const scopeAtStart = availabilityScope
        const wallet = isIOSNative() ? 'apple' : 'google'
        posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_TAPPED, { wallet })
        setIsAdding(true)
        try {
            const data = await rainApi.getProvisioningData(card.id, wallet)
            const cancelStaleAdd = async (nativeWriteStarted: boolean): Promise<AddCardToWalletResult | null> => {
                if (availabilityScopeRef.current === scopeAtStart) return null
                if (nativeWriteStarted) {
                    await clearWalletStateIfCardMatches(card.id)
                    // A late A write can have landed after B's app-wide mirror.
                    // Put the current card back without touching B's grant.
                    const latest = latestSelectionRef.current
                    if (latest.flagOn && latest.cardId !== card.id && isIOSNative()) {
                        await rememberCardForWallet({ peanutCardId: latest.cardId, last4: latest.last4 })
                    }
                }
                posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_CANCELED, { wallet, error: 'card_changed' })
                return { added: false, canceled: true }
            }
            const staleAfterFetch = await cancelStaleAdd(false)
            if (staleAfterFetch) return staleAfterFetch
            if (data.walletAuthorizationToken && data.walletAuthorizationExpiresIn) {
                await rememberCardForWallet({ peanutCardId: card.id, last4: card.last4 })
                const staleAfterMirror = await cancelStaleAdd(true)
                if (staleAfterMirror) return staleAfterMirror
                await syncWalletAuthorizationToken(
                    card.id,
                    data.walletAuthorizationToken,
                    data.walletAuthorizationExpiresIn
                )
                const staleAfterGrant = await cancelStaleAdd(true)
                if (staleAfterGrant) return staleAfterGrant
            }
            const staleBeforeAdd = await cancelStaleAdd(false)
            if (staleBeforeAdd) return staleBeforeAdd
            const result = await addCardToWallet({
                peanutCardId: card.id,
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
            if (result.added) {
                // The iPhone may now have the card while a paired Watch can still
                // take it. Recheck both devices instead of hiding the native row.
                // An availability failure must not turn a successful add into a
                // reported provisioning failure.
                const { available, alreadyInWallet } = await getPushProvisioningAvailability(card.last4).catch(() => ({
                    available: false,
                    alreadyInWallet: false,
                }))
                if (availabilityScopeRef.current === scopeAtStart && flagOn) {
                    setNativeAvailable(available && !alreadyInWallet)
                }
            } else if (result.alreadyInWallet) {
                setNativeAvailable(false)
            }
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
    }, [availabilityScope, card.id, card.last4, flagOn])

    return { nativeAvailable, isAdding, addToWallet }
}
