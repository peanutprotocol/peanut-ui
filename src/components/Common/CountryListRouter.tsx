'use client'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { formatUnits } from 'viem'
import { formatTokenAmount, printableAddress } from '@/utils/general.utils'
import { CountryList } from '@/components/Common/CountryList'
import { type ClaimLinkData } from '@/services/sendLinks'
import { type CountryData, MantecaSupportedExchanges } from '@/components/AddMoney/consts'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { useCallback, useMemo } from 'react'

interface ICountryListRouterViewProps {
    claimLinkData: ClaimLinkData
    inputTitle: string
}

/**
 * displays countries list for claim link flow with @PeanutActionDetailsCard component as header
 */
export const CountryListRouter = ({ claimLinkData, inputTitle }: ICountryListRouterViewProps) => {
    const {
        setFlowStep: setClaimBankFlowStep,
        setSelectedCountry,
        setClaimToMercadoPago,
        setFlowStep,
    } = useClaimBankFlow()
    const savedAccounts = useSavedAccounts()

    const handleCountryClick = (country: CountryData) => {
        const isMantecaSupportedCountry = Object.keys(MantecaSupportedExchanges).includes(country.id)
        setSelectedCountry(country)
        if (isMantecaSupportedCountry) {
            setFlowStep(null) // reset the flow step to initial view first
            setClaimToMercadoPago(true)
        } else {
            setClaimBankFlowStep(ClaimBankFlowStep.BankDetailsForm)
        }
    }

    const recipientName = useMemo(() => {
        return claimLinkData?.sender?.username ?? printableAddress(claimLinkData?.senderAddress ?? '')
    }, [claimLinkData])

    const amount = useMemo(() => {
        return formatTokenAmount(Number(formatUnits(claimLinkData?.amount ?? 0n, claimLinkData?.tokenDecimals ?? 0)))
    }, [claimLinkData])

    const onPrev = useCallback(() => {
        if (savedAccounts.length > 0) {
            setClaimBankFlowStep(ClaimBankFlowStep.SavedAccountsList)
        } else {
            setClaimBankFlowStep(null)
        }
    }, [savedAccounts, setClaimBankFlowStep])

    return (
        <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
            <NavHeader title="Receive" onPrev={onPrev} />
            <div className="flex h-full w-full flex-1 flex-col justify-start gap-4">
                <PeanutActionDetailsCard
                    transactionType="CLAIM_LINK"
                    recipientType="USERNAME"
                    recipientName={recipientName}
                    amount={amount ?? '0'}
                    tokenSymbol={claimLinkData?.tokenSymbol ?? ''}
                />

                <CountryList inputTitle={inputTitle} viewMode="claim-request" onCountryClick={handleCountryClick} />
            </div>
        </div>
    )
}
