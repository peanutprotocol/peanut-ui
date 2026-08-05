import { getUserById } from '@/app/actions/users'
import { useAuth } from '@/context/authContext'
import { useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import { useEffect, useState } from 'react'
import { useCapabilities } from './useCapabilities'

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
    const { setRequesterDetails } = useRequestFulfillmentFlow()
    // MIGRATION-REVIEW: was useKycStatus().isUserKycApproved. The payer is the CURRENT
    // user → capability isKycApproved (any enabled rail), same proxy used elsewhere.
    const { isKycApproved } = useCapabilities()

    useEffect(() => {
        const determineBankRequestType = async () => {
            const payerKycApproved = isKycApproved

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
                    setRequesterDetails(requesterDetails)
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
    }, [user, requesterUserId, setRequesterDetails, isKycApproved])

    return { requestType, setRequestType }
}
