'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/authContext'
import { MantecaKycStatus } from '@/interfaces'
import { getBridgeCustomerCountry } from '@/app/actions/bridge/get-customer'

export enum QrKycState {
    LOADING = 'loading',
    PROCEED_TO_PAY = 'proceed_to_pay',
    REQUIRES_IDENTITY_VERIFICATION = 'requires_identity_verification',
    IDENTITY_VERIFICATION_IN_PROGRESS = 'identity_verification_in_progress',
    REQUIRES_MANTECA_KYC_FOR_ARG_BRIDGE_USER = 'requires_manteca_kyc_for_arg_bridge_user',
}

export interface QrKycGateResult {
    kycGateState: QrKycState
    shouldBlockPay: boolean
}

/**
 * This hook determines the KYC gate state for the QR pay page.
 * It checks the user's KYC status and the country of the QR code to determine the appropriate action.
 * @param paymentProcessor - The payment processor type ('MANTECA' | 'SIMPLEFI' | null)
 * @returns {QrKycGateResult} An object with the KYC gate state and a boolean indicating if the user should be blocked from paying.
 *
 * Note: KYC is only required for MANTECA payments. SimpleFi payments do not require KYC.
 */
export function useQrKycGate(paymentProcessor?: 'MANTECA' | 'SIMPLEFI' | null): QrKycGateResult {
    const { user, isFetchingUser, fetchUser } = useAuth()
    const [kycGateState, setKycGateState] = useState<QrKycState>(QrKycState.LOADING)
    const hasRequestedUserFetchRef = useRef(false)

    const determineKycGateState = useCallback(async () => {
        // SimpleFi payments do not require KYC - allow payment immediately
        if (paymentProcessor === 'SIMPLEFI') {
            setKycGateState(QrKycState.PROCEED_TO_PAY)
            return
        }

        const currentUser = user?.user
        // while auth is fetching, keep loading to avoid flashing the verify modal
        if (isFetchingUser) {
            setKycGateState(QrKycState.LOADING)
            return
        }

        if (!currentUser) {
            // on public routes (like qr pay), auth may not auto-fetch; trigger it explicitly once and wait
            if (!hasRequestedUserFetchRef.current) {
                hasRequestedUserFetchRef.current = true
                setKycGateState(QrKycState.LOADING)
                try {
                    await fetchUser()
                } catch {
                    // ignore errors and fall through after one attempt
                }
                return
            }
            // if we already tried fetching and still have no user, require verification
            setKycGateState(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
            return
        }

        const mantecaKycs = currentUser.kycVerifications?.filter((v) => v.provider === 'MANTECA') ?? []

        const hasAnyMantecaKyc = mantecaKycs.length > 0
        const hasAnyActiveMantecaKyc =
            hasAnyMantecaKyc &&
            mantecaKycs.some((v) => v.provider === 'MANTECA' && v.status === MantecaKycStatus.ACTIVE)

        if (hasAnyActiveMantecaKyc) {
            setKycGateState(QrKycState.PROCEED_TO_PAY)
            return
        }

        if (currentUser.bridgeKycStatus === 'approved' && currentUser.bridgeCustomerId) {
            try {
                const { countryCode } = await getBridgeCustomerCountry(currentUser.bridgeCustomerId)
                // if (countryCode && countryCode.toUpperCase() === 'AR') {
                if (false) {
                } else {
                    setKycGateState(QrKycState.PROCEED_TO_PAY)
                }
            } catch {
                // fail to require identity verification to avoid blocking pay due to rare outages
                setKycGateState(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
            }
            return
        }

        if (hasAnyMantecaKyc) {
            setKycGateState(QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS)
            return
        }

        setKycGateState(QrKycState.REQUIRES_IDENTITY_VERIFICATION)
    }, [user?.user, isFetchingUser, paymentProcessor, fetchUser])

    useEffect(() => {
        determineKycGateState()
    }, [determineKycGateState])

    const result: QrKycGateResult = {
        kycGateState,
        shouldBlockPay:
            kycGateState === QrKycState.REQUIRES_MANTECA_KYC_FOR_ARG_BRIDGE_USER ||
            kycGateState === QrKycState.REQUIRES_IDENTITY_VERIFICATION ||
            kycGateState === QrKycState.IDENTITY_VERIFICATION_IN_PROGRESS ||
            kycGateState === QrKycState.LOADING,
    }

    return result
}
