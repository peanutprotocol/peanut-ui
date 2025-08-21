import { getUserById } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { useEffect, useState } from 'react'

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

    useEffect(() => {
        const determineBankClaimType = async () => {
            // check if receiver (logged in user) exists and is KYC approved
            const receiverKycApproved = user?.user?.kycStatus === 'approved'

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
                const senderKycApproved = senderDetails?.kycStatus === 'approved'

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
            } catch (error) {
                if (user?.user.userId) {
                    setClaimType(BankClaimType.ReceiverKycNeeded)
                } else {
                    setClaimType(BankClaimType.GuestKycNeeded)
                }
            }
        }

        determineBankClaimType()
    }, [user, senderUserId, setSenderDetails])

    return { claimType, setClaimType }
}
