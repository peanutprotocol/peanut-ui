'use client'

import { useAuth } from '@/context/authContext'
import { CountryListRouter } from '@/components/Common/CountryListRouter'
import { RequestFulfilmentBankFlowStep, useRequestFulfilmentFlow } from '@/context/RequestFulfilmentFlowContext'
import AddMoneyBankDetails from '@/components/AddMoney/components/AddMoneyBankDetails'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { OnrampConfirmationModal } from '@/components/AddMoney/components/OnrampConfirmationModal'
import { useCreateOnramp } from '@/hooks/useCreateOnramp'
import { usePaymentStore } from '@/redux/hooks'

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

    // state from the centralized context
    const {
        flowStep: requestFulfilmentBankFlowStep,
        setFlowStep: setRequestFulfilmentBankFlowStep,
        setShowRequestFulfilmentBankFlowManager,
        selectedCountry,
        setOnrampData,
    } = useRequestFulfilmentFlow()

    const handleOnrampConfirmation = async () => {
        if (!selectedCountry) return

        try {
            const onrampDataResponse = await createOnramp({
                amount: chargeDetails?.tokenAmount ?? '0',
                country: selectedCountry,
            })

            if (onrampDataResponse && onrampDataResponse.transferId) {
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

    // main render logic based on the current flow step
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
        default:
            return null
    }
}
