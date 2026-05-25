'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/authContext'
import useProviderRejectionStatus from './useProviderRejectionStatus'
import { hasEnabledRail, hasRailInProgress } from '@/utils/railGate.utils'
import { hasMantecaUsNationalityRestrictionMetadata } from '@/utils/manteca-restriction.utils'

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
            // on public routes (like qr pay) auth may not auto-fetch; trigger
            // it once. If the fetch produced a user, the re-render will pick
            // up the new branch; if it produced nothing (returned null or
            // threw), fall through to REQUIRES_IDENTITY_VERIFICATION rather
            // than leaving the gate stuck in LOADING (CR comment on this PR).
            if (!hasRequestedUserFetchRef.current) {
                hasRequestedUserFetchRef.current = true
                setGateState(QrKycState.LOADING)
                try {
                    const fetched = await fetchUser()
                    if (fetched) return
                } catch {
                    // ignore errors and fall through
                }
            }
            setGateState(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
            return
        }

        const rails = user.rails

        // An ENABLED Manteca rail wins before the rejection check — this
        // covers dev #2092's "Sumsub-approved pool fallback" intent: a
        // user with a US-restricted rejected full-tier Manteca rail but an
        // ENABLED Sumsub-pool rail can still pay QR through the pool. The
        // rejection branches only fire when there's nothing functional.
        if (hasEnabledRail(rails, 'MANTECA')) {
            setGateState(QrKycState.PROCEED_TO_PAY)
            return
        }

        // No enabled rail — defer to the provider rejection state. The
        // userMessage carries US-nationality copy etc. when applicable.
        if (mantecaRejection.state === 'blocked') {
            // Exception (dev #2092): a Sumsub-approved user whose Manteca
            // rejection is the US-nationality restriction can still pay QR
            // through the Sumsub-pool fallback. BE enableQrPoolRails creates
            // the enabling rail on Sumsub approval — but the FE may not
            // have observed it yet (or the user is mid-migration). Surface
            // PROCEED and let the BE adjudicate.
            const hasSumsubApproved = user.user?.kycVerifications?.some(
                (v) => v.provider === 'SUMSUB' && v.status === 'APPROVED'
            )
            const rejectedMantecaMetadata = (user.rails ?? [])
                .filter((r) => r.rail.provider.code === 'MANTECA' && r.status === 'REJECTED')
                .map((r) => r.metadata)
            const mantecaKycMetadata =
                user.user?.kycVerifications?.filter((v) => v.provider === 'MANTECA').map((v) => v.metadata) ?? []
            const isUsRestricted = hasMantecaUsNationalityRestrictionMetadata([
                ...rejectedMantecaMetadata,
                ...mantecaKycMetadata,
            ])
            if (hasSumsubApproved && isUsRestricted) {
                setGateState(QrKycState.PROCEED_TO_PAY)
                return
            }
            setGateState(QrKycState.PROVIDER_REJECTION_BLOCKED, mantecaRejection.userMessage)
            return
        }
        if (mantecaRejection.state === 'fixable') {
            setGateState(QrKycState.PROVIDER_REJECTION_FIXABLE, mantecaRejection.userMessage)
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
