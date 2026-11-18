'use client'

import * as Sentry from '@/utils/sentry-lazy'
import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/authContext'
import {
    activateKycFeature,
    type KycActivationFeature,
    type KycFeatureActivationResult,
} from '@/app/actions/kyc-feature-activation'
import { entryAction, reportEntry, supportRefusal, type ReportScope } from '@/features/kyc-features/report'
import type { FeatureReportEntry } from '@/types/capabilities'
import { paperworkVerificationFeaturePath } from './paperworkVerificationEntry'
import { markVerifySource } from './verifySource'

export const KYC_ACTIVATION_POLL_MS = 15_000

function canContinue(feature: KycActivationFeature, result: KycFeatureActivationResult | null): boolean {
    if (result?.kind !== 'report') return false
    return (
        result.report.state === 'on' ||
        result.report.state === 'ready' ||
        (feature === 'card' && result.report.state === 'action_required' && !result.report.action)
    )
}

export function useKycFeatureActivation(
    feature: KycActivationFeature,
    {
        scope: reportScope,
        enabled = true,
        automatic = false,
        selectedCurrency,
    }: {
        /**
         * Activate on mount, with no tap: a provider whose use needs no consent of the user's (Avenia,
         * Aleks 2026-11-14). A missing answer or an identity not approved then stays in `result` for
         * the caller to show in place, because a redirect would send Back straight into it again.
         */
        automatic?: boolean
        scope?: ReportScope
        enabled?: boolean
        selectedCurrency?: string
    } = {}
) {
    const { user, fetchUser } = useAuth()
    const fetchUserRef = useRef(fetchUser)
    fetchUserRef.current = fetchUser
    const router = useRouter()
    const routerRef = useRef(router)
    routerRef.current = router
    const userId = user?.user?.userId
    const oneShot = user?.identityVerification?.oneShot === true
    const identityStatus = user?.identityVerification?.status
    const features = user?.capabilities?.features
    // The report has no `pix` entry, and a resident abroad may hold Manteca's BRL account: only the
    // activation itself says whether their Avenia account is open.
    const existing = features
        ? reportScope
            ? reportEntry(features, 'deposit', reportScope, user?.capabilities?.rails)
            : feature === 'pix'
              ? undefined
              : features[feature]
        : undefined
    const selected =
        selectedCurrency && (feature === 'bank' || feature === 'local')
            ? features?.[feature].accounts[selectedCurrency]
            : undefined
    const selectedAction = selected && entryAction(selected, user?.capabilities?.nextActions ?? [])
    const selectedActionKind = selectedAction?.kind
    // Keep the deposit screens' existing scoped actions and local-account refusal UI.
    const handledByDepositFlow =
        selectedActionKind === 'restart-identity' ||
        (feature === 'local' && selected?.state === 'refused') ||
        (selected?.state === 'action_required' &&
            (selectedActionKind === 'sumsub' ||
                (feature === 'bank' &&
                    (selectedActionKind === 'bridge-hosted' ||
                        selectedActionKind === 'questions' ||
                        selectedActionKind === 'provide-email' ||
                        selectedActionKind === 'accept-tos'))))
    const selectedWaiting =
        selected?.state === 'pending' || selected?.state === 'setting_up' || selectedActionKind === 'wait'
    // Bank accounts a provider refused for good (a Bridge duplicate, TASK-24968): the report already
    // says why, and a new activation would only answer "setting up".
    const bankSupportRefusal =
        feature === 'bank' && !selectedCurrency
            ? supportRefusal(existing, user?.capabilities?.nextActions ?? [])
            : undefined
    const selectedStatus: FeatureReportEntry | undefined =
        !handledByDepositFlow && selected
            ? selectedWaiting
                ? { ...selected, state: 'setting_up' }
                : selected.state === 'refused' || selectedActionKind === 'contact-support'
                  ? { ...selected, state: 'refused' }
                  : undefined
            : bankSupportRefusal
    const alreadyOn = selectedCurrency ? selected?.state === 'on' || handledByDepositFlow : existing?.state === 'on'
    const ars =
        !selectedCurrency &&
        feature === 'local' &&
        reportScope?.channel === 'bank' &&
        identityStatus === 'verified' &&
        (reportScope.country === 'AR' || reportScope.method === 'BANK_TRANSFER_AR')
            ? features?.local.accounts.ARS
            : undefined
    const arsProvisioning = ars?.state === 'pending' || ars?.state === 'setting_up'
    const consentKey = JSON.stringify([
        userId,
        oneShot,
        feature,
        reportScope?.channel,
        reportScope?.country,
        reportScope?.method,
        reportScope?.railId,
        selectedCurrency,
    ])
    const recovery = useRef({ key: consentKey, waiting: false })
    if (recovery.current.key !== consentKey) recovery.current = { key: consentKey, waiting: false }
    const scopeKey = JSON.stringify([
        consentKey,
        identityStatus,
        enabled,
        arsProvisioning,
        selected?.state,
        selected?.reason,
        selectedActionKind,
        selected?.action,
    ])
    const generation = useRef({ key: scopeKey, value: 0 })
    if (generation.current.key !== scopeKey) generation.current = { key: scopeKey, value: generation.current.value + 1 }
    const scope = `${scopeKey}:${generation.current.value}`
    const currentScope = useRef(scope)
    currentScope.current = scope
    const mounted = useRef(true)
    const inFlight = useRef<{ scope: string; token: object; promise: Promise<boolean> } | null>(null)
    const [saved, setSaved] = useState<{ scope: string; result: KycFeatureActivationResult } | null>(null)
    const [loadingScope, setLoadingScope] = useState<string | null>(null)
    const result: KycFeatureActivationResult | null = arsProvisioning
        ? { kind: 'report', report: { state: ars.state } }
        : saved?.scope === scope
          ? saved.result
          : null
    // An automatic activation serves an identity of the older flow too: the API opens its account the same way.
    const gated = oneShot || automatic
    const hasSelectedStatus = !!selectedStatus
    const allowed = !!userId && !hasSelectedStatus && (!gated || alreadyOn || canContinue(feature, result))

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
            inFlight.current = null
        }
    }, [])

    // beforeRedirect runs before a redirect to /verify, so a caller's own URL write cannot supersede it.
    const activate = useCallback(
        (options?: { beforeRedirect?: () => Promise<void> }): Promise<boolean> => {
            if (!mounted.current || currentScope.current !== scope || !userId || !enabled) return Promise.resolve(false)
            if (arsProvisioning || hasSelectedStatus) return Promise.resolve(false)
            if (!gated || alreadyOn) return Promise.resolve(true)
            if (inFlight.current?.scope === scope) return inFlight.current.promise
            setLoadingScope(scope)
            const token = {}
            const promise = (async () => {
                let next: KycFeatureActivationResult
                try {
                    next = await activateKycFeature(feature)
                } catch (error) {
                    Sentry.captureException(error, {
                        tags: { ...criticalFlowTags('kyc'), kyc_step: 'feature_activation' },
                    })
                    next = { kind: 'failed' }
                }
                if (!mounted.current || currentScope.current !== scope || inFlight.current?.token !== token)
                    return false
                if (canContinue(feature, next) && fetchUserRef.current) {
                    try {
                        await fetchUserRef.current({ throwOnError: true })
                    } catch (error) {
                        Sentry.captureException(error, {
                            tags: { ...criticalFlowTags('kyc'), kyc_step: 'activation_refresh' },
                        })
                        next = { kind: 'failed' }
                    }
                    if (!mounted.current || currentScope.current !== scope || inFlight.current?.token !== token)
                        return false
                }
                setSaved({ scope, result: next })
                if (next.kind === 'conflict' && next.code === 'identity_not_approved') {
                    // /verify is the identity's status screen; a failed check is decided, so nothing waits on it.
                    recovery.current.waiting = identityStatus !== 'failed'
                    if (!automatic) {
                        await options?.beforeRedirect?.()
                        if (mounted.current && currentScope.current === scope) {
                            markVerifySource('unlock_payments')
                            routerRef.current.push('/verify')
                        }
                    }
                } else {
                    recovery.current.waiting = false
                }
                if (
                    next.kind === 'conflict' &&
                    next.code === 'questions_missing' &&
                    feature !== 'qr' &&
                    feature !== 'pix' &&
                    !automatic
                ) {
                    await options?.beforeRedirect?.()
                    if (mounted.current && currentScope.current === scope)
                        routerRef.current.push(paperworkVerificationFeaturePath(feature))
                }
                return canContinue(feature, next)
            })().finally(() => {
                if (inFlight.current?.promise === promise) {
                    inFlight.current = null
                    if (mounted.current && currentScope.current === scope) setLoadingScope(null)
                }
            })
            inFlight.current = { scope, token, promise }
            return promise
        },
        [
            scope,
            userId,
            gated,
            feature,
            alreadyOn,
            arsProvisioning,
            hasSelectedStatus,
            enabled,
            identityStatus,
            automatic,
        ]
    )

    // once per scope: a failure or a missing answer stays on screen until the user acts
    const autoStarted = useRef<string | null>(null)
    useEffect(() => {
        if (!automatic || !enabled || !userId || autoStarted.current === scope) return
        autoStarted.current = scope
        void activate()
    }, [automatic, enabled, userId, scope, activate])

    useEffect(() => {
        if (enabled && identityStatus === 'verified' && recovery.current.waiting) {
            recovery.current.waiting = false
            void activate()
        }
    }, [enabled, identityStatus, activate])

    const waiting = selectedStatus
        ? selectedStatus.state === 'setting_up'
        : result?.kind === 'report' && (result.report.state === 'setting_up' || result.report.state === 'pending')
    // The automatic activation says the account is open, yet its caller still shows: the route it
    // reads lags behind, so the user is read again until it catches up.
    const openedAhead = automatic && canContinue(feature, result)
    const refreshing = useRef(false)
    useEffect(() => {
        if ((!waiting && !openedAhead) || alreadyOn || arsProvisioning || !enabled) return
        const poll = async () => {
            if (!selectedCurrency && !openedAhead) {
                void activate()
                return
            }
            if (refreshing.current || currentScope.current !== scope) return
            refreshing.current = true
            try {
                await fetchUserRef.current?.()
            } catch {
                // Keep the last known setup status until the next profile read.
            } finally {
                refreshing.current = false
            }
        }
        const timer = setInterval(poll, KYC_ACTIVATION_POLL_MS)
        window.addEventListener('focus', poll)
        return () => {
            clearInterval(timer)
            window.removeEventListener('focus', poll)
        }
    }, [waiting, openedAhead, alreadyOn, arsProvisioning, enabled, activate, selectedCurrency, scope])

    return {
        allowed,
        userReady: !!userId,
        result,
        selectedStatus,
        arsProvisioning,
        isLoading: loadingScope === scope,
        activate,
    }
}
