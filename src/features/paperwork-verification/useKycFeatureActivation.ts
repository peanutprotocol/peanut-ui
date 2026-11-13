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
import { reportEntry, type ReportScope } from '@/features/kyc-features/report'
import { paperworkVerificationFeaturePath } from './paperworkVerificationEntry'

export const KYC_ACTIVATION_POLL_MS = 15_000

/**
 * A step the activation names no action for is the provider's own: the card application's, or the
 * one Bridge's Pix rail asks for (TASK-24910). The refreshed capabilities carry it, and the screen
 * behind the gate shows it.
 */
const STEP_ON_OWN_SCREEN: ReadonlySet<KycActivationFeature> = new Set(['card', 'local'])

function canContinue(feature: KycActivationFeature, result: KycFeatureActivationResult | null): boolean {
    if (result?.kind !== 'report') return false
    return (
        result.report.state === 'on' ||
        result.report.state === 'ready' ||
        (STEP_ON_OWN_SCREEN.has(feature) &&
            result.report.state === 'action_required' &&
            !result.report.action &&
            !result.report.nextAction)
    )
}

export function useKycFeatureActivation(
    feature: KycActivationFeature,
    {
        scope: reportScope,
        enabled = true,
        everyUser = false,
    }: {
        automatic?: boolean
        scope?: ReportScope
        enabled?: boolean
        /**
         * The first use asks the API for every user, whatever verified them: the API answers a legacy
         * approval with its own step (the Pix setup, API-CONTRACT.md 4a). Otherwise a legacy approval
         * passes, because its approval already enrolled it.
         */
        everyUser?: boolean
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
    const existing = features
        ? reportScope
            ? reportEntry(features, 'deposit', reportScope, user?.capabilities?.rails)
            : features[feature]
        : undefined
    const alreadyOn = existing?.state === 'on'
    const ars =
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
    ])
    const recovery = useRef({ key: consentKey, waiting: false })
    if (recovery.current.key !== consentKey) recovery.current = { key: consentKey, waiting: false }
    const scopeKey = `${consentKey}:${identityStatus ?? ''}:${enabled}:${arsProvisioning}`
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
    // a legacy approval passes unless the caller asks the API for every user
    const passesUnasked = !oneShot && !everyUser
    const allowed = !!userId && (passesUnasked || alreadyOn || canContinue(feature, result))

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
            if (passesUnasked || alreadyOn) return Promise.resolve(true)
            if (arsProvisioning) return Promise.resolve(false)
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
                    await options?.beforeRedirect?.()
                    routerRef.current.push('/verify')
                } else {
                    recovery.current.waiting = false
                }
                if (next.kind === 'conflict' && next.code === 'questions_missing' && feature !== 'qr') {
                    await options?.beforeRedirect?.()
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
        [scope, userId, passesUnasked, feature, alreadyOn, arsProvisioning, enabled, identityStatus]
    )

    useEffect(() => {
        if (enabled && identityStatus === 'verified' && recovery.current.waiting) {
            recovery.current.waiting = false
            void activate()
        }
    }, [enabled, identityStatus, activate])

    const waiting = result?.kind === 'report' && ['setting_up', 'pending'].includes(result.report.state)
    useEffect(() => {
        if (!waiting || alreadyOn || arsProvisioning || !enabled) return
        const poll = () => void activate()
        const timer = setInterval(poll, KYC_ACTIVATION_POLL_MS)
        window.addEventListener('focus', poll)
        return () => {
            clearInterval(timer)
            window.removeEventListener('focus', poll)
        }
    }, [waiting, alreadyOn, arsProvisioning, enabled, activate])

    return { allowed, userReady: !!userId, result, arsProvisioning, isLoading: loadingScope === scope, activate }
}
