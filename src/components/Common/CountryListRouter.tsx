'use client'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { formatUnits } from 'viem'
import { formatTokenAmount, printableAddress } from '@/utils/general.utils'
import { CountryList } from '@/components/Common/CountryList'
import { ClaimLinkData } from '@/services/sendLinks'
import { CountryData } from '@/components/AddMoney/consts'
import useSavedAccounts from '@/hooks/useSavedAccounts'

interface ICountryListRouterViewProps {
    claimLinkData: ClaimLinkData
    inputTitle: string
}

/**
 * Used to display countries list for claim link and request flow with @PeanutActionDetailsCard component as header
 *
 * @param {object} props
 * @param {ClaimLinkData} props.claimLinkData The claim link data
 * @param {string} props.inputTitle The input title to be passed to @CountryList component
 * @returns {JSX.Element}
 */
export const CountryListRouter = ({ claimLinkData, inputTitle }: ICountryListRouterViewProps) => {
    const { setFlowStep: setClaimBankFlowStep, setSelectedCountry } = useClaimBankFlow()
    const savedAccounts = useSavedAccounts()

    const handleCountryClick = (country: CountryData) => {
        setSelectedCountry(country)
        setClaimBankFlowStep(ClaimBankFlowStep.BankDetailsForm)
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-normal gap-8">
            <NavHeader
                title="Receive"
                onPrev={() => {
                    if (savedAccounts.length > 0) {
                        setClaimBankFlowStep(ClaimBankFlowStep.SavedAccountsList)
                    } else {
                        setClaimBankFlowStep(null)
                    }
                }}
            />
            <div className="flex h-full w-full flex-1 flex-col justify-start gap-4">
                <PeanutActionDetailsCard
                    avatarSize="small"
                    transactionType="CLAIM_LINK"
                    recipientType="USERNAME"
                    recipientName={claimLinkData.sender?.username ?? printableAddress(claimLinkData.senderAddress)}
                    amount={formatTokenAmount(Number(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals)))!}
                    tokenSymbol={claimLinkData.tokenSymbol}
                />

                <CountryList inputTitle={inputTitle} viewMode="claim-request" onCountryClick={handleCountryClick} />
            </div>
        </div>
    )
}
