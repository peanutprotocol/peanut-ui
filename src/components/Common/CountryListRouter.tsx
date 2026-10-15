'use client'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { formatUnits } from 'viem'
import { formatTokenAmount } from '@/utils/general.utils'
import { useRecipientDisplay } from '@/hooks/useRecipientDisplay'
import { CountryList } from '@/components/Common/CountryList'
import { type ClaimLinkData } from '@/services/sendLinks'
import { type CountryData } from '@/components/AddMoney/consts'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import useClaimLink from '@/components/Claim/useClaimLink'
import { useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'

interface ICountryListRouterViewProps {
    claimLinkData: ClaimLinkData
    inputTitle: string
}

/**
 * displays countries list for claim link flow with @PeanutActionDetailsCard component as header
 */
export const CountryListRouter = ({ claimLinkData, inputTitle }: ICountryListRouterViewProps) => {
    const t = useTranslations('global')
    const {
        setFlowStep: setClaimBankFlowStep,
        setSelectedCountry,
        setFlowStep,
        setVerificationPromptReason,
        setShowVerificationModal,
    } = useClaimBankFlow()
    const { addParamStep } = useClaimLink()
    const savedAccounts = useSavedAccounts()

    const handleCountryClick = (country: CountryData) => {
        setSelectedCountry(country)
        if (isMantecaSupportedCountryCode(country.id)) {
            // Argentina and Brazil pay out through Manteca, and a link is never
            // claimed to Manteca directly (TASK-23648): the claimer creates an
            // account, the link goes there, and they withdraw to Mercado Pago
            // or Pix. Same path as tapping those methods in the list.
            setFlowStep(null) // back to the initial view, which shows the prompt
            addParamStep('regional-claim', { method: country.id.toUpperCase() === 'BR' ? 'pix' : 'mercadopago' })
            setVerificationPromptReason('regional-account-required')
            setShowVerificationModal(true)
        } else {
            setClaimBankFlowStep(ClaimBankFlowStep.BankDetailsForm)
        }
    }

    const { displayName: recipientName } = useRecipientDisplay({
        user: claimLinkData?.sender,
        address: claimLinkData?.senderAddress ?? '',
    })

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
        <div className="flex min-h-inherit flex-col justify-normal gap-8">
            <NavHeader title={t('countryList.receiveTitle')} onPrev={onPrev} />
            <div className="flex h-full w-full flex-1 flex-col justify-start gap-4">
                <PeanutActionDetailsCard
                    transactionType="CLAIM_LINK"
                    recipientType="USERNAME"
                    recipientName={recipientName}
                    avatarKey={claimLinkData?.sender?.avatarKey}
                    amount={amount ?? '0'}
                    tokenSymbol={claimLinkData?.tokenSymbol ?? ''}
                />

                <CountryList inputTitle={inputTitle} viewMode="claim-request" onCountryClick={handleCountryClick} />
            </div>
        </div>
    )
}
