'use client'
import { App } from '@capacitor/app'
import { useNativePlatform } from '@/utils/native-platform'
import { useCallback, useEffect, useRef, useState } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { ApiError } from '@/services/api-error'
import { rainApi, RainCardRateLimitError } from '@/services/rain'
import { StepUpError } from '@/services/step-up'
import { getClearEpoch } from '@/utils/auth-token'
import { getWalletProvisioningOwner } from '@/utils/wallet-provisioning-owner'
import { isIOSNative } from '@/utils/capacitor'
import { nativePasskeyFailure } from '@/utils/native-passkey-errors'
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
const MAX_CONSECUTIVE_ADD_FAILURES = 2

const TERMINAL_MPP_ERROR_CODES = {
    STABLE_HARDWARE_ID_ERROR: 2,
    NOT_INITIALIZED: 101,
    OS_VERSION_NOT_SUPPORTED: 102,
    DEBUGGER_ATTACHED: 106,
    SDK_DEBUG_IN_APP_RELEASE_NOT_ALLOWED: 112,
    VERSION_ROLLBACK: 503,
    INCORRECT_INPUT_DATA: 505,
    DATA_VALIDATION_ERROR: 601,
    HEADER_API_KEY_ID_ERROR: 603,
    HEADER_TRACE_ID_ERROR: 604,
    HEADER_SECRET_ERROR: 605,
    MASTERCARD_SETUP_ERROR: 608,
}
const terminalMppCodes = new Set(Object.values(TERMINAL_MPP_ERROR_CODES))
const terminalPluginCodes = new Set(['UNAVAILABLE', 'SDK_ERROR', 'BAD_PARAMS'])
// Auth, step-up expiry, timeouts and rate limits can succeed on a retry.
const retryableHttpStatuses = new Set([401, 403, 408, 425, 429])

type WalletFailure = Pick<AddCardToWalletResult, 'code' | 'error' | 'mppErrorCode'> & { status?: number }

export function isTerminalWalletFailure({ status, code, mppErrorCode }: WalletFailure): boolean {
    return (
        (status !== undefined && status >= 400 && status < 500 && !retryableHttpStatuses.has(status)) ||
        (code !== undefined && terminalPluginCodes.has(code)) ||
        (mppErrorCode !== undefined && terminalMppCodes.has(mppErrorCode))
    )
}

function isPasskeyCancel(error: unknown): boolean {
    if (error instanceof StepUpError) return false
    if (nativePasskeyFailure(error) === 'canceled') return true
    const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : undefined
    return name === 'NotAllowedError' || name === 'AbortError'
}

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
    const consecutiveAddFailures = useRef(0)
    const [pushDisabledScope, setPushDisabledScope] = useState('')
    const statusSequence = useRef(0)
    const appliedStatusSequence = useRef(0)
    const presenceSource = useRef<'exact' | 'suffix' | null>(null)
    const initialAvailability = useRef<ReturnType<typeof getPushProvisioningAvailability> | null>(null)
    const [checkedScope, setCheckedScope] = useState('')
    const availabilityScope = `${wallet}:${flagOn}:${card.id}:${card.last4}`
    const availabilityScopeRef = useRef(availabilityScope)
    const latestSelectionRef = useRef({ cardId: card.id, last4: card.last4, flagOn })

    useEffect(() => {
        availabilityScopeRef.current = availabilityScope
        latestSelectionRef.current = { cardId: card.id, last4: card.last4, flagOn }
        consecutiveAddFailures.current = 0
        setPushDisabledScope('')
        return () => {
            availabilityScopeRef.current = ''
            latestSelectionRef.current = { cardId: card.id, last4: card.last4, flagOn }
        }
    }, [availabilityScope, card.id, card.last4, flagOn])

    useEffect(() => {
        let cancelled = false
        const authEpochAtStart = getClearEpoch()
        const sequence = ++statusSequence.current
        presenceSource.current = null
        initialAvailability.current = null
        setCheckedScope('')
        setAlreadyInWallet(false)
        if (!flagOn || wallet === null) {
            setNativeAvailable(false)
            return
        }
        setNativeAvailable(false)
        // Settle on the manual row after the timeout, but let a slow lookup (a
        // first suffix read on a phone with no wallet yet) still show the button.
        const timeout = setTimeout(() => {
            if (cancelled) return
            setCheckedScope(availabilityScope)
        }, AVAILABILITY_TIMEOUT_MS)
        void (async () => {
            const lookup = getPushProvisioningAvailability(card.last4)
            initialAvailability.current = lookup
            const { available, alreadyInWallet: suffixMatch } = await lookup
            if (cancelled) return
            clearTimeout(timeout)
            // A pending refresh can use initial suffix evidence; a completed newer result wins.
            if (wallet === 'google' && sequence < appliedStatusSequence.current) return
            if (getClearEpoch() !== authEpochAtStart) {
                setNativeAvailable(false)
                setCheckedScope(availabilityScope)
                return
            }
            if (wallet === 'google') {
                appliedStatusSequence.current = sequence
                presenceSource.current = suffixMatch ? 'suffix' : null
                setAlreadyInWallet(suffixMatch)
            }
            setNativeAvailable(wallet === 'google' ? available || suffixMatch : available)
            setCheckedScope(availabilityScope)
        })().catch(() => {
            if (!cancelled && (wallet !== 'google' || sequence >= appliedStatusSequence.current)) {
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
        const authEpochAtStart = getClearEpoch()
        const timers = new Set<ReturnType<typeof setTimeout>>()
        const bounded = async <T>(read: () => Promise<T>, fallback: T): Promise<T> => {
            let timeout: ReturnType<typeof setTimeout> | undefined
            try {
                return await Promise.race([
                    Promise.resolve()
                        .then(read)
                        .catch(() => fallback),
                    new Promise<T>((resolve) => {
                        timeout = setTimeout(() => resolve(fallback), AVAILABILITY_TIMEOUT_MS)
                        timers.add(timeout)
                    }),
                ])
            } finally {
                if (timeout !== undefined) {
                    clearTimeout(timeout)
                    timers.delete(timeout)
                }
            }
        }
        const refresh = (initialLookup: typeof initialAvailability.current = null) => {
            if (cancelled) return
            const sequence = initialLookup ? statusSequence.current : ++statusSequence.current
            void Promise.all([
                bounded(() => getGoogleWalletCardStatus(card.id), 'unknown'),
                bounded(async () => {
                    const result = await (initialLookup ?? getPushProvisioningAvailability(card.last4))
                    return result.lookupFailed ? null : result
                }, null),
            ]).then(([status, availability]) => {
                if (cancelled || sequence !== statusSequence.current || getClearEpoch() !== authEpochAtStart) return
                appliedStatusSequence.current = sequence
                if (availability) setNativeAvailable(availability.available || availability.alreadyInWallet)
                setCheckedScope(availabilityScope)
                // Google counts active or suspended issuer tokens matching the card suffix as present.
                const suffixMatch = availability?.alreadyInWallet === true
                if (status === 'present') {
                    presenceSource.current = 'exact'
                    setAlreadyInWallet(true)
                } else if (status === 'absent' || status === 'pending') {
                    // Exact absence says nothing about a hand-added token, so suffix presence needs a suffix miss to clear.
                    if (availability || presenceSource.current !== 'suffix') {
                        presenceSource.current = suffixMatch ? 'suffix' : null
                        setAlreadyInWallet(suffixMatch)
                    }
                } else if (suffixMatch) {
                    if (presenceSource.current !== 'exact') presenceSource.current = 'suffix'
                    setAlreadyInWallet(true)
                } else if (availability?.alreadyInWallet === false && presenceSource.current !== 'exact') {
                    // An inconclusive exact check can clear only suffix-derived presence.
                    presenceSource.current = null
                    setAlreadyInWallet(false)
                }
            })
        }
        refresh(initialAvailability.current)
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
    }, [availabilityScope, card.id, card.last4, flagOn, wallet])

    const addToWallet = useCallback(async (): Promise<AddCardToWalletResult> => {
        if (
            !flagOn ||
            wallet === null ||
            !nativeAvailable ||
            checkedScope !== availabilityScope ||
            availabilityScopeRef.current !== availabilityScope ||
            addingRef.current ||
            consecutiveAddFailures.current >= MAX_CONSECUTIVE_ADD_FAILURES
        ) {
            return { added: false, error: 'unavailable' }
        }
        addingRef.current = true
        const scopeAtStart = availabilityScope
        const selectionAtStart = latestSelectionRef.current
        const authEpochAtStart = getClearEpoch()
        const isCurrentSelection = () =>
            availabilityScopeRef.current === scopeAtStart && latestSelectionRef.current === selectionAtStart
        const recordAddFailure = ({ error, status, code, mppErrorCode }: WalletFailure) => {
            if (!isCurrentSelection() || getClearEpoch() !== authEpochAtStart) return
            const terminal = isTerminalWalletFailure({ status, code, mppErrorCode })
            consecutiveAddFailures.current = terminal
                ? MAX_CONSECUTIVE_ADD_FAILURES
                : consecutiveAddFailures.current + 1
            const disablesPush = consecutiveAddFailures.current >= MAX_CONSECUTIVE_ADD_FAILURES
            if (disablesPush) setPushDisabledScope(scopeAtStart)
            posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_FAILED, {
                wallet,
                ...(typeof error === 'string' ? { error } : {}),
                ...(typeof mppErrorCode === 'number' && Number.isFinite(mppErrorCode) ? { mppErrorCode } : {}),
                ...(typeof status === 'number' && Number.isFinite(status) ? { httpStatus: status } : {}),
                ...(typeof code === 'string' ? { pluginCode: code } : {}),
                failureClass: terminal ? 'terminal' : disablesPush ? 'second_failure' : 'temporary',
            })
        }
        posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_TAPPED, { wallet })
        setIsAdding(true)
        const cancelStaleAdd = async (nativeWriteStarted: boolean): Promise<AddCardToWalletResult | null> => {
            const loggedOut = getClearEpoch() !== authEpochAtStart
            if (isCurrentSelection() && !loggedOut) return null
            if (loggedOut && isCurrentSelection()) {
                setNativeAvailable(false)
                presenceSource.current = null
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
        try {
            const data = await rainApi.getProvisioningData(card.id, wallet)
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
            if (result.canceled) {
                posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_CANCELED, { wallet, error: result.error })
                return result
            }
            if (!result.added && !result.alreadyInWallet) {
                recordAddFailure({ error: result.error, code: result.code, mppErrorCode: result.mppErrorCode })
                return result
            }
            posthog.capture(
                result.alreadyInWallet
                    ? ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_ALREADY_ADDED
                    : ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_SUCCEEDED,
                { wallet, error: result.error }
            )
            consecutiveAddFailures.current = 0
            setPushDisabledScope('')
            if (wallet === 'google') {
                appliedStatusSequence.current = ++statusSequence.current
                if (availabilityScopeRef.current === scopeAtStart) {
                    presenceSource.current = 'exact'
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
            const stale = await cancelStaleAdd(false)
            if (stale) return stale
            if (isPasskeyCancel(e)) {
                posthog.capture(ANALYTICS_EVENTS.CARD_ADD_TO_WALLET_CANCELED, { wallet, error: 'step_up_canceled' })
                return { added: false, canceled: true }
            }
            const error = e instanceof Error ? e.message : 'unknown'
            const status = e instanceof ApiError ? e.status : e instanceof RainCardRateLimitError ? 429 : undefined
            recordAddFailure({ error, status })
            return { added: false, error }
        } finally {
            addingRef.current = false
            setIsAdding(false)
        }
    }, [availabilityScope, card.id, card.last4, checkedScope, flagOn, nativeAvailable, wallet])

    const pushDisabled = pushDisabledScope === availabilityScope
    return {
        nativeAvailable:
            flagOn &&
            checkedScope === availabilityScope &&
            nativeAvailable &&
            !pushDisabled &&
            !(wallet === 'google' && alreadyInWallet),
        pushDisabled,
        alreadyInWallet: flagOn && checkedScope === availabilityScope && alreadyInWallet,
        isChecking: flagOn && checkedScope !== availabilityScope,
        isAdding,
        addToWallet,
    }
}
