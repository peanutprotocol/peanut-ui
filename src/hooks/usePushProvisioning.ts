'use client'
import { App } from '@capacitor/app'
import { useNativePlatform } from '@/utils/native-platform'
import { useCallback, useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { rainApi } from '@/services/rain'
import { getClearEpoch } from '@/utils/auth-token'
import { getWalletProvisioningOwner } from '@/utils/wallet-provisioning-owner'
import { isIOSNative } from '@/utils/capacitor'
import {
    addCardToWallet,
    clearWalletStateIfCardMatches,
    getPushProvisioningAvailability,
    getGoogleWalletCardStatus,
    PUSH_PROVISIONING_FLAGS,
    rememberCardForWallet,
    syncWalletAuthorizationToken,
    type AddCardToWalletResult,
} from '@/utils/push-provisioning'

const AVAILABILITY_TIMEOUT_MS = 5000

async function getBoundedPushProvisioningAvailability(last4: string) {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
        return await Promise.race([
            getPushProvisioningAvailability(last4).catch(() => null),
            new Promise<null>((resolve) => {
                timeout = setTimeout(() => resolve(null), AVAILABILITY_TIMEOUT_MS)
            }),
        ])
    } finally {
        if (timeout !== undefined) clearTimeout(timeout)
    }
}

/**
 * Native one-tap add-to-wallet (Apple Pay / Google Pay via MeaWallet MPP).
 * `nativeAvailable` is false on web, on binaries without the SDK, behind the
 * launch flag, and when the card is already in the wallet. Callers use manual
 * instructions or an added status, so old binaries degrade cleanly.
 */
export function usePushProvisioning(card: { id: string; last4: string }) {
    const nativePlatform = useNativePlatform()

    const isFlagEnabled = useFeatureFlags()
    const wallet = nativePlatform.isIOSNative ? 'apple' : nativePlatform.isAndroidNative ? 'google' : null
    // Platform approvals and the API gate apply in every environment.
    const flagOn = wallet !== null && isFlagEnabled(PUSH_PROVISIONING_FLAGS[wallet])
    const [nativeAvailable, setNativeAvailable] = useState(false)
    const [isAdding, setIsAdding] = useState(false)
    const [alreadyInWallet, setAlreadyInWallet] = useState(false)
    const addingRef = useRef(false)
    const statusSequence = useRef(0)
    const [checkedScope, setCheckedScope] = useState('')
    const availabilityScope = `${wallet}:${flagOn}:${card.id}:${card.last4}`
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
        const authEpochAtStart = getClearEpoch()
        setAlreadyInWallet(false)
        if (!flagOn || wallet === null) {
            setNativeAvailable(false)
            return
        }
        setNativeAvailable(false)
        const timeout = setTimeout(() => {
            if (cancelled) return
            cancelled = true
            setCheckedScope(availabilityScope)
        }, AVAILABILITY_TIMEOUT_MS)
        void (async () => {
            const { available, alreadyInWallet: suffixMatch } = await getPushProvisioningAvailability(card.last4)
            if (cancelled) return
            clearTimeout(timeout)
            if (getClearEpoch() !== authEpochAtStart) {
                setNativeAvailable(false)
                setCheckedScope(availabilityScope)
                return
            }
            // Only the native add result identifies this card on this device.
            setNativeAvailable(wallet === 'google' ? available || suffixMatch : available)
            setCheckedScope(availabilityScope)
        })().catch(() => {
            if (!cancelled) {
                clearTimeout(timeout)
                setNativeAvailable(false)
                setCheckedScope(availabilityScope)
            }
        })
        return () => {
            cancelled = true
            clearTimeout(timeout)
        }
    }, [availabilityScope, flagOn, card.id, card.last4, wallet])

    useEffect(() => {
        if (!flagOn || wallet !== 'google' || !card.id) return
        let cancelled = false
        let removeListener: (() => void) | undefined
        const timers = new Set<ReturnType<typeof setTimeout>>()
        const refresh = () => {
            if (cancelled) return
            const sequence = ++statusSequence.current
            const epoch = getClearEpoch()
            let timeout: ReturnType<typeof setTimeout> | undefined
            void Promise.race([
                Promise.resolve()
                    .then(() => getGoogleWalletCardStatus(card.id))
                    .catch(() => 'unknown' as const),
                new Promise<'unknown'>((resolve) => {
                    timeout = setTimeout(() => resolve('unknown'), AVAILABILITY_TIMEOUT_MS)
                    timers.add(timeout)
                }),
            ]).then((status) => {
                if (timeout !== undefined) {
                    clearTimeout(timeout)
                    timers.delete(timeout)
                }
                if (cancelled || sequence !== statusSequence.current || getClearEpoch() !== epoch) return
                // An OTA can run on a binary that predates this method. Preserve its mounted add result.
                if (status !== 'unsupported') setAlreadyInWallet(status === 'present')
            })
        }
        refresh()
        void Promise.resolve()
            .then(() =>
                App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) refresh()
                })
            )
            .then((listener) => {
                if (cancelled) void listener.remove()
                else
                    removeListener = () => {
                        void listener.remove()
                    }
            })
            .catch(() => {})
        return () => {
            cancelled = true
            timers.forEach(clearTimeout)
            removeListener?.()
        }
    }, [availabilityScope, card.id, flagOn, wallet])

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
                if (loggedOut && availabilityScopeRef.current === scopeAtStart) {
                    setNativeAvailable(false)
                    setAlreadyInWallet(false)
                }
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
            // A native sheet already started cannot be undone, but its late
            // result must not update a cleared or replaced app session.
            const staleAfterAdd = await cancelStaleAdd(wallet === 'apple')
            if (staleAfterAdd) return staleAfterAdd
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
                statusSequence.current++
                // Both results identify the exact card, unlike a suffix match.
                if (availabilityScopeRef.current === scopeAtStart) {
                    setAlreadyInWallet(true)
                }
            } else if (result.added) {
                // The iPhone may now have the card while a paired Watch can still
                // take it. Recheck both devices instead of hiding the native row.
                // An availability failure must not turn a successful add into a
                // reported provisioning failure.
                const availability = await getBoundedPushProvisioningAvailability(card.last4)
                const staleAfterRefresh = await cancelStaleAdd(true)
                if (staleAfterRefresh) return staleAfterRefresh
                if (availabilityScopeRef.current === scopeAtStart && flagOn) {
                    setNativeAvailable(availability?.available ?? false)
                    setAlreadyInWallet(!!availability?.alreadyInWallet && !availability.available)
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
        nativeAvailable:
            flagOn &&
            checkedScope === availabilityScope &&
            nativeAvailable &&
            !(wallet === 'google' && alreadyInWallet),
        alreadyInWallet: flagOn && checkedScope === availabilityScope && alreadyInWallet,
        isChecking: flagOn && checkedScope !== availabilityScope,
        isAdding,
        addToWallet,
    }
}
