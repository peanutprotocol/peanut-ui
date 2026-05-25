'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/authContext'
import useProviderRejectionStatus from './useProviderRejectionStatus'
import { hasEnabledRail, hasRailInProgress } from '@/utils/railGate.utils'

export enum QrKycState {
    LOADING = 'loading',
    PROCEED_TO_PAY = 'proceed_to_pay',
    REQUIRES_IDENTITY_VERIFICATION = 'requires_identity_verification',
    IDENTITY_VERIFICATION_IN_PROGRESS = 'identity_verification_in_progress',
    PROVIDER_REJECTION_FIXABLE = 'provider_rejection_fixable',
    PROVIDER_REJECTION_BLOCKED = 'provider_rejection_blocked',
}

export interface QrKycGateResult {
    kycGateState: QrKycState
    shouldBlockPay: boolean
    userMessage: string | null
}

/**
 * KYC gate for the QR-pay page, derived from the user's Manteca rails
 * (Phase 6 of rail-gating):
 *   - rejected rail   → fixable / blocked (via useProviderRejectionStatus)
 *   - ENABLED rail    → proceed
 *   - in-progress rail → verification in progress
 *   - no Manteca rail → identity verification required
 *
 * Geo-agnostic by design (unchanged signature): any ENABLED Manteca rail
 * passes, since QR-tier rails enable PIX_BR and MERCADOPAGO_QR_AR together
 * on Sumsub approval. The backend QR gate is the geo-scoped authority.
 *
 * @param _paymentProcessor retained for call-site compatibility; the gate is
 * Manteca-rail based and does not branch on it.
 */
export function useQrKycGate(_paymentProcessor?: 'MANTECA' | null): QrKycGateResult {
    const { user, isFetchingUser, fetchUser } = useAuth()
    const { manteca: mantecaRejection } = useProviderRejectionStatus()
    const [kycGateState, setKycGateState] = useState<QrKycState>(QrKycState.LOADING)
    const [userMessage, setUserMessage] = useState<string | null>(null)
    const hasRequestedUserFetchRef = useRef(false)

    const setGateState = useCallback((state: QrKycState, message: string | null = null) => {
        setKycGateState(state)
        setUserMessage(message)
    }, [])

    const determineKycGateState = useCallback(async () => {
        // while auth is fetching, keep loading to avoid flashing the verify modal
        if (isFetchingUser) {
            setGateState(QrKycState.LOADING)
            return
        }

        if (!user) {
            // on public routes (like qr pay) auth may not auto-fetch; trigger it once and wait
            if (!hasRequestedUserFetchRef.current) {
                hasRequestedUserFetchRef.current = true
                setGateState(QrKycState.LOADING)
                try {
                    await fetchUser()
                } catch {
                    // ignore errors and fall through after one attempt
                }
                return
            }
            setGateState(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
            return
        }

        // a provider rejection takes precedence over rail presence. propagate the
        // hook's userMessage (carries US-nationality restriction copy etc.) so
        // the consumer surfaces the same wording dev's legacy gate produced.
        if (mantecaRejection.state === 'blocked') {
            setGateState(QrKycState.PROVIDER_REJECTION_BLOCKED, mantecaRejection.userMessage)
            return
        }
        if (mantecaRejection.state === 'fixable') {
            setGateState(QrKycState.PROVIDER_REJECTION_FIXABLE, mantecaRejection.userMessage)
            return
        }

        const rails = user.rails
        if (hasEnabledRail(rails, 'MANTECA')) {
            setGateState(QrKycState.PROCEED_TO_PAY)
            return
        }
        if (hasRailInProgress(rails, 'MANTECA')) {
            setGateState(QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS)
            return
        }

        setGateState(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
    }, [user, isFetchingUser, fetchUser, mantecaRejection.state, mantecaRejection.userMessage, setGateState])

    useEffect(() => {
        determineKycGateState()
    }, [determineKycGateState])

    const result: QrKycGateResult = {
        kycGateState,
        userMessage,
        shouldBlockPay:
            kycGateState === QrKycState.REQUIRES_IDENTITY_VERIFICATION ||
            kycGateState === QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS ||
            kycGateState === QrKycState.PROVIDER_REJECTION_FIXABLE ||
            kycGateState === QrKycState.PROVIDER_REJECTION_BLOCKED ||
            kycGateState === QrKycState.LOADING,
    }

    return result
}
