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
import { paperworkVerificationFeaturePath } from './paperworkVerificationEntry'

export const KYC_ACTIVATION_POLL_MS = 15_000

function canContinue(feature: KycActivationFeature, result: KycFeatureActivationResult | null): boolean {
    if (result?.kind !== 'report') return false
    return (
        result.report.state === 'on' ||
        result.report.state === 'ready' ||
        (feature === 'card' && result.report.state === 'action_required' && !result.report.action)
    )
}

export function useKycFeatureActivation(feature: KycActivationFeature, { automatic = true } = {}) {
    const { user, fetchUser } = useAuth()
    const fetchUserRef = useRef(fetchUser)
    fetchUserRef.current = fetchUser
    const router = useRouter()
    const routerRef = useRef(router)
    routerRef.current = router
    const userId = user?.user?.userId
    const oneShot = user?.identityVerification?.oneShot === true
    const scopeKey = `${userId ?? ''}:${oneShot}:${feature}`
    const generation = useRef({ key: scopeKey, value: 0 })
    if (generation.current.key !== scopeKey) generation.current = { key: scopeKey, value: generation.current.value + 1 }
    const scope = `${scopeKey}:${generation.current.value}`
    const currentScope = useRef(scope)
    currentScope.current = scope
    const mounted = useRef(true)
    const inFlight = useRef<{ scope: string; token: object; promise: Promise<boolean> } | null>(null)
    const [saved, setSaved] = useState<{ scope: string; result: KycFeatureActivationResult } | null>(null)
    const [loadingScope, setLoadingScope] = useState<string | null>(null)
    const result = saved?.scope === scope ? saved.result : null
    const allowed = !!userId && (!oneShot || canContinue(feature, result))

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
            inFlight.current = null
        }
    }, [])

    const activate = useCallback((): Promise<boolean> => {
        if (!mounted.current || currentScope.current !== scope || !userId) return Promise.resolve(false)
        if (!oneShot) return Promise.resolve(true)
        if (inFlight.current?.scope === scope) return inFlight.current.promise
        setLoadingScope(scope)
        const token = {}
        const promise = (async () => {
            let next: KycFeatureActivationResult
            try {
                next = await activateKycFeature(feature)
            } catch (error) {
                Sentry.captureException(error, { tags: { ...criticalFlowTags('kyc'), kyc_step: 'feature_activation' } })
                next = { kind: 'failed' }
            }
            if (!mounted.current || currentScope.current !== scope || inFlight.current?.token !== token) return false
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
            if (next.kind === 'conflict' && next.code === 'questions_missing' && feature !== 'qr') {
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
    }, [scope, userId, oneShot, feature])

    useEffect(() => {
        if (automatic && userId && oneShot) void activate()
    }, [automatic, userId, oneShot, activate])

    const waiting = result?.kind === 'report' && ['setting_up', 'pending'].includes(result.report.state)
    useEffect(() => {
        if (!waiting) return
        const poll = () => void activate()
        const timer = setInterval(poll, KYC_ACTIVATION_POLL_MS)
        window.addEventListener('focus', poll)
        return () => {
            clearInterval(timer)
            window.removeEventListener('focus', poll)
        }
    }, [waiting, activate])

    return { allowed, result, isLoading: loadingScope === scope, activate }
}
