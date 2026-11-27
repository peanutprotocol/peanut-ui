import { getUserById } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import { useEffect, useState } from 'react'
import { useVerification } from './useVerification'

export enum BankRequestType {
    GuestBankRequest = 'guest-bank-request',
    UserBankRequest = 'user-bank-request',
    PayerKycNeeded = 'payer-kyc-needed',
    GuestKycNeeded = 'guest-kyc-needed',
}

/**
 * Used to determine the bank request type based on the sender and receiver kyc status
 * @param {string} requesterUserId The user id of the requester
 * @returns {object} An object containing the bank request type and a function to set the request type
 */
export function useDetermineBankRequestType(requesterUserId: string): {
    requestType: BankRequestType
    setRequestType: (requestType: BankRequestType) => void
} {
    const { user } = useAuth()
    const [requestType, setRequestType] = useState<BankRequestType>(BankRequestType.PayerKycNeeded)
    // The payer is the current user: an enabled rail means they can pay by bank.
    const { hasAnyEnabledRail } = useVerification()

    useEffect(() => {
        const determineBankRequestType = async () => {
            const payerKycApproved = hasAnyEnabledRail

            if (payerKycApproved) {
                setRequestType(BankRequestType.UserBankRequest)
                return
            }

            if (!requesterUserId) {
                if (user?.user.userId) {
                    setRequestType(BankRequestType.PayerKycNeeded)
                } else {
                    setRequestType(BankRequestType.GuestKycNeeded)
                }
                return
            }

            try {
                const requesterDetails = await getUserById(requesterUserId)
                // BE-computed counterparty capability — gates the GuestBankRequest flow,
                // mirroring useDetermineBankClaimType. True iff the requester has an
                // enabled Bridge bank rail.
                const requesterKycApproved = requesterDetails?.canReceiveBankOfframp ?? false

                if (requesterKycApproved) {
                    setRequestType(BankRequestType.GuestBankRequest)
                } else {
                    if (user?.user.userId) {
                        setRequestType(BankRequestType.PayerKycNeeded)
                    } else {
                        setRequestType(BankRequestType.GuestKycNeeded)
                    }
                }
            } catch {
                if (user?.user.userId) {
                    setRequestType(BankRequestType.PayerKycNeeded)
                } else {
                    setRequestType(BankRequestType.GuestKycNeeded)
                }
            }
        }

        determineBankRequestType()
    }, [user, requesterUserId, hasAnyEnabledRail])

    return { requestType, setRequestType }
}
