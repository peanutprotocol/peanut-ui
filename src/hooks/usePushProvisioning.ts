'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { rainApi } from '@/services/rain'
import { getClearEpoch } from '@/utils/auth-token'
import { getWalletProvisioningOwner } from '@/utils/wallet-provisioning-owner'
import { isAndroidNative, isIOSNative } from '@/utils/capacitor'
import {
    addCardToWallet,
    clearWalletStateIfCardMatches,
    getPushProvisioningAvailability,
    PUSH_PROVISIONING_FLAGS,
    rememberCardForWallet,
    syncWalletAuthorizationToken,
    type AddCardToWalletResult,
} from '@/utils/push-provisioning'

/**
 * Native one-tap add-to-wallet (Apple Pay / Google Pay via MeaWallet MPP).
 * `nativeAvailable` is false on web, on binaries without the SDK, behind the
 * launch flag, and when the card is already in the wallet. Callers use manual
 * instructions or an added status, so old binaries degrade cleanly.
 */
export function usePushProvisioning(card: { id: string; last4: string }) {
    const isFlagEnabled = useFeatureFlags()
    const wallet = isIOSNative() ? 'apple' : isAndroidNative() ? 'google' : null
    // Platform approvals and the API gate apply in every environment.
    const flagOn = wallet !== null && isFlagEnabled(PUSH_PROVISIONING_FLAGS[wallet])
    const [nativeAvailable, setNativeAvailable] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [alreadyInWallet, setAlreadyInWallet] = useState(false)
    const addingRef = useRef(false)
    const [checkedScope, setCheckedScope] = useState('')
    const availabilityScope = `${flagOn}:${card.id}:${card.last4}`
    const availabilityScopeRef = useRef(availabilityScope)
    const latestSelectionRef = useRef({ cardId: card.id, last4: card.last4, flagOn })

    useEffect(() => {
        availabilityScopeRef.current = availabilityScope
        latestSelectionRef.current = { cardId: card.id, last4: card.last4, flagOn }
        return () => {
            availabilityScopeRef.current = ''
            latestSelectionRef.current = { cardId: card.id, last4: card.last4, flagOn }
        }
    }, [availabilityScope, card.id, card.last4, flagOn])

    useEffect(() => {
        let cancelled = false
        setAlreadyInWallet(false)
        if (!flagOn) {
            setNativeAvailable(false)
            return
        }
        setNativeAvailable(false)
        // Android's suffix lookup can match a different card. Check only wallet
        // availability here; addCard checks the exact MeaWallet card token.
        void getPushProvisioningAvailability(wallet === 'google' ? undefined : card.last4)
            .then(({ available, alreadyInWallet }) => {
                if (!cancelled) {
                    setNativeAvailable(available && !alreadyInWallet)
                    setAlreadyInWallet(alreadyInWallet)
                    setCheckedScope(availabilityScope)
                }
            })
            .catch(() => {
                if (!cancelled) setNativeAvailable(false)
            })
        return () => {
            cancelled = true
        }
    }, [availabilityScope, flagOn, card.id, card.last4, wallet])

    const addToWallet = useCallback(async (): Promise<AddCardToWalletResult> => {
        if (!flagOn || wallet === null || !nativeAvailable || checkedScope !== availabilityScope || addingRef.current) {
            return { added: false, error: 'unavailable' }
        }
        addingRef.current = true
        const scopeAtStart = availabilityScope
        const authEpochAtStart = getClearEpoch()
        posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_TAPPED, { wallet })
        setIsAdding(true)
        try {
            const data = await rainApi.getProvisioningData(card.id, wallet)
            const cancelStaleAdd = async (nativeWriteStarted: boolean): Promise<AddCardToWalletResult | null> => {
                const loggedOut = getClearEpoch() !== authEpochAtStart
                if (availabilityScopeRef.current === scopeAtStart && !loggedOut) return null
                const currentSelection = () =>
                    (availabilityScopeRef.current === '' && getWalletProvisioningOwner()) || latestSelectionRef.current
                const latest = currentSelection()
                const cardChanged = latest.cardId !== card.id
                // Unmounting the card screen cancels the sheet, but Home still
                // owns this active card's Wallet metadata and grant. Only a
                // replacement card, disabled rollout, or logout may erase it.
                if (nativeWriteStarted && (cardChanged || !latest.flagOn || loggedOut)) {
                    await clearWalletStateIfCardMatches(card.id)
                    // A late A write can have landed after B's app-wide mirror.
                    // Re-read after the clear: selection, flag, or auth may have
                    // changed while the native bridge was in flight.
                    const replacement = currentSelection()
                    if (
                        getClearEpoch() === authEpochAtStart &&
                        replacement.flagOn &&
                        replacement.cardId &&
                        replacement.last4 &&
                        isIOSNative()
                    ) {
                        await rememberCardForWallet({ peanutCardId: replacement.cardId, last4: replacement.last4 })
                    }
                }
                posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_CANCELED, { wallet, error: 'card_changed' })
                return { added: false, canceled: true }
            }
            const staleAfterFetch = await cancelStaleAdd(false)
            if (staleAfterFetch) return staleAfterFetch
            if (wallet === 'apple' && data.walletAuthorizationToken && data.walletAuthorizationExpiresIn) {
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
                result.alreadyInWallet
                    ? ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_ALREADY_ADDED
                    : result.added
                      ? ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_SUCCEEDED
                      : result.canceled
                        ? ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_CANCELED
                        : ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_FAILED,
                { wallet, error: result.error }
            )
            if (wallet === 'google' && (result.added || result.alreadyInWallet)) {
                // Both results identify the exact card, unlike a suffix match.
                if (availabilityScopeRef.current === scopeAtStart) {
                    setNativeAvailable(false)
                    setAlreadyInWallet(true)
                }
            } else if (result.added) {
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
                    setAlreadyInWallet(alreadyInWallet)
                }
            } else if (result.alreadyInWallet && availabilityScopeRef.current === scopeAtStart) {
                setNativeAvailable(false)
                setAlreadyInWallet(true)
            }
            return result
        } catch (e) {
            // Step-up cancel/timeout or the provisioning-data fetch failing
            // (429 rate limit, 409 billing missing) all land here.
            const error = e instanceof Error ? e.message : 'unknown'
            posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_FAILED, { wallet, error })
            return { added: false, error }
        } finally {
            addingRef.current = false
            setIsAdding(false)
        }
    }, [availabilityScope, card.id, card.last4, checkedScope, flagOn, nativeAvailable, wallet])

    return {
        nativeAvailable: flagOn && checkedScope === availabilityScope && nativeAvailable,
        alreadyInWallet: flagOn && checkedScope === availabilityScope && alreadyInWallet,
        isAdding,
        addToWallet,
    }
}
