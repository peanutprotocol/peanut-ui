import { getUserById } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useEffect, useState } from 'react'
import { useCapabilities } from './useCapabilities'

export enum BankClaimType {
    GuestBankClaim = 'guest-bank-claim',
    UserBankClaim = 'user-bank-claim',
    ReceiverKycNeeded = 'receiver-kyc-needed',
    GuestKycNeeded = 'guest-kyc-needed',
}

/**
 * Used to determine the bank claim type based on the sender and receiver kyc status
 * @param {string} senderUserId The user id of the sender
 * @returns {object} An object containing the bank claim type and a function to set the claim type
 */
export function useDetermineBankClaimType(senderUserId: string): {
    claimType: BankClaimType
    setClaimType: (claimType: BankClaimType) => void
} {
    const { user } = useAuth()
    const [claimType, setClaimType] = useState<BankClaimType>(BankClaimType.ReceiverKycNeeded)
    const { setSenderDetails } = useClaimBankFlow()
    // MIGRATION-REVIEW: was useKycStatus().isUserKycApproved (any provider approved).
    // The receiver is the CURRENT user, so this reads the capability model directly:
    // isKycApproved = any enabled rail — the established proxy for "identity cleared".
    const { isKycApproved } = useCapabilities()

    useEffect(() => {
        const determineBankClaimType = async () => {
            // check if receiver (logged in user) exists and is KYC approved
            const receiverKycApproved = isKycApproved

            if (receiverKycApproved) {
                // condition 1: Receiver is KYC approved → UserBankClaim
                setClaimType(BankClaimType.UserBankClaim)
                return
            }

            // condition 2: Receiver is not KYC approved, check sender status
            if (!senderUserId) {
                if (user?.user.userId) {
                    setClaimType(BankClaimType.ReceiverKycNeeded)
                } else {
                    setClaimType(BankClaimType.GuestKycNeeded)
                }
                return
            }

            try {
                const senderDetails = await getUserById(senderUserId)
                // BE-computed counterparty capability — true iff the sender has an enabled
                // Bridge bank rail, which is exactly the gate for routing to GuestBankClaim.
                const senderKycApproved = senderDetails?.canReceiveBankOfframp ?? false

                if (senderKycApproved) {
                    // condition 3: Receiver not KYC approved BUT sender is → GuestBankClaim
                    setSenderDetails(senderDetails)
                    setClaimType(BankClaimType.GuestBankClaim)
                } else {
                    // condition 4: Neither receiver nor sender are KYC approved → KycNeeded
                    if (user?.user.userId) {
                        setClaimType(BankClaimType.ReceiverKycNeeded)
                    } else {
                        setClaimType(BankClaimType.GuestKycNeeded)
                    }
                }
            } catch {
                if (user?.user.userId) {
                    setClaimType(BankClaimType.ReceiverKycNeeded)
                } else {
                    setClaimType(BankClaimType.GuestKycNeeded)
                }
            }
        }

        determineBankClaimType()
    }, [user, senderUserId, setSenderDetails, isKycApproved])

    return { claimType, setClaimType }
}
