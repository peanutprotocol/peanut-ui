'use client'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard, {
    PeanutActionDetailsCardRecipientType,
    PeanutActionDetailsCardTransactionType,
} from '@/components/Global/PeanutActionDetailsCard'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { formatUnits } from 'viem'
import { formatTokenAmount, printableAddress } from '@/utils/general.utils'
import { CountryList } from '@/components/Common/CountryList'
import { ClaimLinkData } from '@/services/sendLinks'
import { CountryData } from '@/components/AddMoney/consts'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { useCallback, useMemo } from 'react'
import { RequestFulfilmentBankFlowStep, useRequestFulfilmentFlow } from '@/context/RequestFulfilmentFlowContext'
import { usePaymentStore } from '@/redux/hooks'
import { useAuth } from '@/context/authContext'
import { BankRequestType, useDetermineBankRequestType } from '@/hooks/useDetermineBankRequestType'

interface ICountryListRouterViewProps {
    claimLinkData?: ClaimLinkData
    inputTitle: string
    requestLinkData?: ParsedURL
    flow: 'claim' | 'request'
}

/**
 * Used to display countries list for claim link and request flow with @PeanutActionDetailsCard component as header
 *
 * @param {object} props
 * @param {'claim' | 'request'} props.flow The flow type (claim or request)
 * @param {ClaimLinkData} props.claimLinkData The claim link data
 * @param {ParsedURL} props.requestLinkData The request link data
 * @param {string} props.inputTitle The input title to be passed to @CountryList component
 * @returns {JSX.Element}
 */
export const CountryListRouter = ({
    flow,
    claimLinkData,
    requestLinkData,
    inputTitle,
}: ICountryListRouterViewProps) => {
    const { setFlowStep: setClaimBankFlowStep, setSelectedCountry } = useClaimBankFlow()
    const {
        setFlowStep: setRequestFulfilmentBankFlowStep,
        setShowRequestFulfilmentBankFlowManager,
        setSelectedCountry: setSelectedCountryForRequest,
        setShowVerificationModal,
    } = useRequestFulfilmentFlow()
    const savedAccounts = useSavedAccounts()
    const { chargeDetails } = usePaymentStore()
    const { requestType } = useDetermineBankRequestType(chargeDetails?.requestLink.recipientAccount.userId ?? '')
    const { user } = useAuth()

    const handleCountryClick = (country: CountryData) => {
        if (flow === 'claim') {
            setSelectedCountry(country)
            setClaimBankFlowStep(ClaimBankFlowStep.BankDetailsForm)
        } else if (flow === 'request') {
            setSelectedCountryForRequest(country)

            if (requestType === BankRequestType.PayerKycNeeded) {
                if (user && (!user.user.fullName || !user.user.email)) {
                    setRequestFulfilmentBankFlowStep(RequestFulfilmentBankFlowStep.CollectUserDetails)
                } else {
                    setShowVerificationModal(true)
                }
            } else {
                setRequestFulfilmentBankFlowStep(RequestFulfilmentBankFlowStep.OnrampConfirmation)
            }
        }
    }

    const receipientType = useCallback((): PeanutActionDetailsCardRecipientType => {
        switch (flow) {
            case 'claim':
                return 'USERNAME'
            case 'request': {
                if (requestLinkData?.recipient?.recipientType === 'USERNAME') {
                    return 'USERNAME'
                } else if (requestLinkData?.recipient?.recipientType === 'ADDRESS') {
                    return 'ADDRESS'
                } else if (requestLinkData?.recipient?.recipientType === 'ENS') {
                    return 'ENS'
                }
                return 'USERNAME'
            }
        }
    }, [flow, requestLinkData])

    const receipientName = useCallback(() => {
        switch (flow) {
            case 'claim':
                return claimLinkData?.sender?.username ?? printableAddress(claimLinkData?.senderAddress ?? '')
            case 'request':
                return (
                    chargeDetails?.requestLink.recipientAccount.user.username ??
                    printableAddress(chargeDetails?.requestLink.recipientAddress as string)
                )
        }
    }, [flow, claimLinkData, chargeDetails])

    const amount = useCallback(() => {
        switch (flow) {
            case 'claim':
                return formatTokenAmount(
                    Number(formatUnits(claimLinkData?.amount ?? 0n, claimLinkData?.tokenDecimals ?? 0))
                )
            case 'request':
                return chargeDetails?.tokenAmount ?? '0'
        }
    }, [flow, claimLinkData, chargeDetails])

    const tokenSymbol = useCallback(() => {
        switch (flow) {
            case 'claim':
                return claimLinkData?.tokenSymbol ?? requestLinkData?.token?.symbol
            case 'request':
                return chargeDetails?.tokenSymbol
        }
    }, [flow, claimLinkData, requestLinkData, chargeDetails])

    const peanutActionDetailsCardProps = useMemo(() => {
        const transactionType: PeanutActionDetailsCardTransactionType =
            flow === 'claim' ? 'CLAIM_LINK' : 'REQUEST_PAYMENT'

        return {
            avatarSize: 'small',
            transactionType,
            recipientType: receipientType(),
            recipientName: receipientName(),
            amount: amount(),
            tokenSymbol: tokenSymbol(),
        }
    }, [flow, claimLinkData, requestLinkData, chargeDetails])

    const onPrev = useCallback(() => {
        if (flow === 'claim') {
            if (savedAccounts.length > 0) {
                setClaimBankFlowStep(ClaimBankFlowStep.SavedAccountsList)
            } else {
                setClaimBankFlowStep(null)
            }
        } else if (flow === 'request') {
            setRequestFulfilmentBankFlowStep(null)
            setShowRequestFulfilmentBankFlowManager(false)
        }
    }, [
        flow,
        savedAccounts,
        setClaimBankFlowStep,
        setRequestFulfilmentBankFlowStep,
        setShowRequestFulfilmentBankFlowManager,
    ])

    return (
        <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
            <NavHeader title={flow === 'claim' ? 'Receive' : 'Send'} onPrev={onPrev} />
            <div className="flex h-full w-full flex-1 flex-col justify-start gap-4">
                <PeanutActionDetailsCard
                    transactionType={peanutActionDetailsCardProps.transactionType}
                    recipientType={peanutActionDetailsCardProps.recipientType}
                    recipientName={peanutActionDetailsCardProps.recipientName}
                    amount={peanutActionDetailsCardProps.amount ?? '0'}
                    tokenSymbol={peanutActionDetailsCardProps.tokenSymbol ?? ''}
                />

                <CountryList inputTitle={inputTitle} viewMode="claim-request" onCountryClick={handleCountryClick} />
            </div>
        </div>
    )
}
