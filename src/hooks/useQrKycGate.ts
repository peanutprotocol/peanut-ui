'use client'

import { useCallback, useState, useEffect } from 'react'
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
 * @returns {QrKycGateResult} An object with the KYC gate state and a boolean indicating if the user should be blocked from paying.
 */
export function useQrKycGate(): QrKycGateResult {
    const { user } = useAuth()
    const [kycGateState, setKycGateState] = useState<QrKycState>(QrKycState.LOADING)

    const determineKycGateState = useCallback(async () => {
        const currentUser = user?.user
        if (!currentUser) {
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
                    setKycGateState(QrKycState.REQUIRES_MANTECA_KYC_FOR_ARG_BRIDGE_USER)
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
    }, [user?.user])

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
