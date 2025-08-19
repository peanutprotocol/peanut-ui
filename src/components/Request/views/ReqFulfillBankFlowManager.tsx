'use client'

import { useAuth } from '@/context/authContext'
import { CountryListRouter } from '@/components/Common/CountryListRouter'
import { RequestFulfilmentBankFlowStep, useRequestFulfilmentFlow } from '@/context/RequestFulfilmentFlowContext'
import AddMoneyBankDetails from '@/components/AddMoney/components/AddMoneyBankDetails'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { OnrampConfirmationModal } from '@/components/AddMoney/components/OnrampConfirmationModal'
import { useCreateOnramp } from '@/hooks/useCreateOnramp'
import { usePaymentStore } from '@/redux/hooks'
import { BankRequestType, useDetermineBankRequestType } from '@/hooks/useDetermineBankRequestType'
import { createOnrampForGuest } from '@/app/actions/onramp'
import { InitiateKYCModal } from '@/components/Kyc'
import { UserDetailsForm, type UserDetailsFormData } from '@/components/AddMoney/UserDetailsForm'
import { useMemo, useState, useRef, useEffect } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { Button } from '@/components/0_Bruddle'
import { updateUserById } from '@/app/actions/users'
import { useRouter } from 'next/navigation'

/**
 * @name ReqFulfillBankFlowManager
 * @description This component manages the entire bank request fulfillment flow, acting as a state machine.
 * It determines which view to show based on the user's KYC status,
 * It handles creating onramps, adding bank accounts, and orchestrating the KYC process.
 */
export const ReqFulfillBankFlowManager = ({ parsedPaymentData }: { parsedPaymentData: ParsedURL }) => {
    // props and basic setup
    const { user, fetchUser } = useAuth()
    const { createOnramp, isLoading: isCreatingOnramp, error: onrampError } = useCreateOnramp()
    const { chargeDetails } = usePaymentStore()
    const { requestType } = useDetermineBankRequestType(chargeDetails?.requestLink.recipientAccount.userId ?? '')
    const [isUpdatingUser, setIsUpdatingUser] = useState(false)
    const [userUpdateError, setUserUpdateError] = useState<string | null>(null)
    const [isUserDetailsFormValid, setIsUserDetailsFormValid] = useState(false)
    const formRef = useRef<{ handleSubmit: () => void }>(null)
    const router = useRouter()
    const [isKycModalOpen, setIsKycModalOpen] = useState(false)

    // state from the centralized context
    const {
        flowStep: requestFulfilmentBankFlowStep,
        setFlowStep: setRequestFulfilmentBankFlowStep,
        setShowRequestFulfilmentBankFlowManager,
        selectedCountry,
        setOnrampData,
        requesterDetails,
        showVerificationModal,
        setShowVerificationModal,
        resetFlow,
    } = useRequestFulfilmentFlow()

    useEffect(() => {
        if (showVerificationModal) {
            setIsKycModalOpen(true)
        }
    }, [showVerificationModal])

    const handleOnrampConfirmation = async () => {
        if (!selectedCountry) return

        try {
            let onrampDataResponse

            if (requestType === BankRequestType.GuestBankRequest) {
                onrampDataResponse = await createOnrampForGuest({
                    amount: chargeDetails?.tokenAmount ?? '0',
                    country: selectedCountry,
                    userId: requesterDetails?.userId ?? '',
                    chargeId: chargeDetails?.uuid,
                })
            } else {
                onrampDataResponse = await createOnramp({
                    amount: chargeDetails?.tokenAmount ?? '0',
                    country: selectedCountry,
                    chargeId: chargeDetails?.uuid,
                })
            }

            if (
                requestType === BankRequestType.GuestBankRequest &&
                onrampDataResponse.data &&
                onrampDataResponse.data.transferId
            ) {
                setOnrampData(onrampDataResponse.data)
                setRequestFulfilmentBankFlowStep(RequestFulfilmentBankFlowStep.DepositBankDetails)
            } else if (onrampDataResponse.transferId) {
                setOnrampData(onrampDataResponse)
                setRequestFulfilmentBankFlowStep(RequestFulfilmentBankFlowStep.DepositBankDetails)
            } else {
                console.error('Onramp creation response issue:', onrampDataResponse)
                setRequestFulfilmentBankFlowStep(RequestFulfilmentBankFlowStep.BankCountryList)
            }
        } catch (error) {
            console.error('Failed to create onramp', error)
            setRequestFulfilmentBankFlowStep(RequestFulfilmentBankFlowStep.BankCountryList)
        }
    }
    const handleKycSuccess = () => {
        setShowVerificationModal(false)
        setRequestFulfilmentBankFlowStep(RequestFulfilmentBankFlowStep.BankCountryList)
        fetchUser()
    }

    const handleUserDetailsSubmit = async (data: UserDetailsFormData) => {
        setIsUpdatingUser(true)
        setUserUpdateError(null)
        try {
            if (!user?.user.userId) throw new Error('User not found')
            const result = await updateUserById({
                userId: user.user.userId,
                fullName: `${data.firstName} ${data.lastName}`,
                email: data.email,
            })
            if (result.error) {
                throw new Error(result.error)
            }
            await fetchUser()
            setShowVerificationModal(true)
        } catch (error: any) {
            setUserUpdateError(error.message)
            return { error: error.message }
        } finally {
            setIsUpdatingUser(false)
        }
        return {}
    }

    const [firstName, ...lastNameParts] = (user?.user.fullName ?? '').split(' ')
    const lastName = lastNameParts.join(' ')

    const initialUserDetails: Partial<UserDetailsFormData> = useMemo(
        () => ({
            firstName: user?.user.fullName ? firstName : '',
            lastName: user?.user.fullName ? lastName : '',
            email: user?.user.email ?? '',
        }),
        [user?.user.fullName, user?.user.email, firstName, lastName]
    )

    // main render logic based on the current flow step
    if (showVerificationModal) {
        return (
            <InitiateKYCModal
                isOpen={isKycModalOpen}
                onClose={() => {
                    setIsKycModalOpen(false)
                }}
                onKycSuccess={handleKycSuccess}
                onManualClose={() => {
                    setShowVerificationModal(false)
                    setRequestFulfilmentBankFlowStep(RequestFulfilmentBankFlowStep.BankCountryList)
                }}
                flow="request_fulfillment"
            />
        )
    }

    switch (requestFulfilmentBankFlowStep) {
        case RequestFulfilmentBankFlowStep.BankCountryList:
            return (
                <CountryListRouter
                    flow="request"
                    requestLinkData={parsedPaymentData}
                    inputTitle="Which country do you want to receive to?"
                />
            )
        case RequestFulfilmentBankFlowStep.OnrampConfirmation:
            return (
                <OnrampConfirmationModal
                    visible={true}
                    onClose={() => {
                        setRequestFulfilmentBankFlowStep(RequestFulfilmentBankFlowStep.BankCountryList)
                    }}
                    onConfirm={() => {
                        handleOnrampConfirmation()
                    }}
                />
            )
        case RequestFulfilmentBankFlowStep.DepositBankDetails:
            return <AddMoneyBankDetails flow="request-fulfillment" />

        case RequestFulfilmentBankFlowStep.CollectUserDetails:
            return (
                <div className="flex flex-col justify-start space-y-8">
                    <NavHeader
                        onPrev={() => setRequestFulfilmentBankFlowStep(RequestFulfilmentBankFlowStep.BankCountryList)}
                        title="Identity Verification"
                    />
                    <div className="flex flex-grow flex-col justify-center space-y-4">
                        <h3 className="text-sm font-bold">Verify your details</h3>
                        <UserDetailsForm
                            ref={formRef}
                            onSubmit={handleUserDetailsSubmit}
                            isSubmitting={isUpdatingUser}
                            onValidChange={setIsUserDetailsFormValid}
                            initialData={initialUserDetails}
                        />
                        <Button
                            onClick={() => {
                                formRef.current?.handleSubmit()
                            }}
                            loading={isUpdatingUser}
                            variant="purple"
                            shadowSize="4"
                            className="w-full"
                            disabled={!isUserDetailsFormValid || isUpdatingUser}
                        >
                            Continue
                        </Button>
                        {userUpdateError && <ErrorAlert description={userUpdateError} />}
                    </div>
                </div>
            )
        default:
            return null
    }
}
