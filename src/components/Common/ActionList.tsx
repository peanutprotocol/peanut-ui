'use client'

import { SearchResultCard } from '../SearchUsers/SearchResultCard'
import StatusBadge from '../Global/Badges/StatusBadge'
import IconStack from '../Global/IconStack'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { ClaimLinkData } from '@/services/sendLinks'
import { formatUnits } from 'viem'
import { useMemo, useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import Divider from '../0_Bruddle/Divider'
import { Button } from '../0_Bruddle'
import { PEANUT_LOGO_BLACK } from '@/assets/illustrations'
import Image from 'next/image'
import { saveRedirectUrl } from '@/utils'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PEANUTMAN_LOGO } from '@/assets/peanut'
import { BankClaimType, useDetermineBankClaimType } from '@/hooks/useDetermineBankClaimType'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { RequestFulfillmentBankFlowStep, useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { usePaymentStore } from '@/redux/hooks'
import { BankRequestType, useDetermineBankRequestType } from '@/hooks/useDetermineBankRequestType'
import { GuestVerificationModal } from '../Global/GuestVerificationModal'
import ActionListDaimoPayButton from './ActionListDaimoPayButton'
import { ACTION_METHODS, PaymentMethod } from '@/constants/actionlist.consts'
import useClaimLink from '../Claim/useClaimLink'

interface IActionListProps {
    flow: 'claim' | 'request'
    claimLinkData?: ClaimLinkData
    requestLinkData?: ParsedURL
    isLoggedIn: boolean
}

/**
 * Shows a list of available payment methods to choose from for claiming a send link or fullfilling a request link
 *
 * @param {object} props
 * @param {ClaimLinkData} props.claimLinkData The claim link data
 * @param {boolean} props.isLoggedIn Whether the user is logged in, used to show cta for continue with peanut if not logged in
 * @returns {JSX.Element}
 */
export default function ActionList({ claimLinkData, isLoggedIn, flow, requestLinkData }: IActionListProps) {
    const router = useRouter()
    const { setClaimToExternalWallet, setFlowStep: setClaimBankFlowStep, setShowVerificationModal } = useClaimBankFlow()
    const [showMinAmountError, setShowMinAmountError] = useState(false)
    const { claimType } = useDetermineBankClaimType(claimLinkData?.sender?.userId ?? '')
    const { chargeDetails } = usePaymentStore()
    const requesterUserId = chargeDetails?.requestLink?.recipientAccount?.userId ?? ''
    const { requestType } = useDetermineBankRequestType(requesterUserId)
    const savedAccounts = useSavedAccounts()
    const { usdAmount } = usePaymentStore()
    const { addParamStep } = useClaimLink()
    const {
        setShowRequestFulfilmentBankFlowManager,
        setShowExternalWalletFulfilMethods,
        setFlowStep: setRequestFulfilmentBankFlowStep,
    } = useRequestFulfillmentFlow()
    const [isGuestVerificationModalOpen, setIsGuestVerificationModalOpen] = useState(false)

    const handleMethodClick = async (method: PaymentMethod) => {
        if (flow === 'claim' && claimLinkData) {
            const amountInUsd = parseFloat(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals))
            if (method.id === 'bank' && amountInUsd < 1) {
                setShowMinAmountError(true)
                return
            }
            switch (method.id) {
                case 'bank':
                    {
                        if (claimType === BankClaimType.GuestKycNeeded) {
                            addParamStep('bank')
                            setShowVerificationModal(true)
                        } else {
                            if (savedAccounts.length) {
                                setClaimBankFlowStep(ClaimBankFlowStep.SavedAccountsList)
                            } else {
                                setClaimBankFlowStep(ClaimBankFlowStep.BankCountryList)
                            }
                        }
                    }
                    break
                case 'mercadopago':
                    break // soon tag, so no action needed
                case 'exchange-or-wallet':
                    setClaimToExternalWallet(true)
                    break
            }
        } else if (flow === 'request' && requestLinkData) {
            const amountInUsd = usdAmount ? parseFloat(usdAmount) : 0
            if (method.id === 'bank' && amountInUsd < 1) {
                setShowMinAmountError(true)
                return
            }
            switch (method.id) {
                case 'bank':
                    console.log(requestType)
                    if (requestType === BankRequestType.GuestKycNeeded) {
                        addParamStep('bank')
                        setIsGuestVerificationModalOpen(true)
                    } else {
                        setShowRequestFulfilmentBankFlowManager(true)
                        setRequestFulfilmentBankFlowStep(RequestFulfillmentBankFlowStep.BankCountryList)
                    }
                    break
                case 'mercadopago':
                    break // soon tag, so no action needed
                case 'exchange-or-wallet':
                    setShowExternalWalletFulfilMethods(true)
                    break
            }
        }
    }

    const requiresVerification = useMemo(() => {
        if (flow === 'claim') {
            return claimType === BankClaimType.GuestKycNeeded || claimType === BankClaimType.ReceiverKycNeeded
        }
        if (flow === 'request') {
            return requestType === BankRequestType.GuestKycNeeded || requestType === BankRequestType.PayerKycNeeded
        }
        return false
    }, [claimType, requestType, flow])

    const sortedActionMethods = useMemo(() => {
        return [...ACTION_METHODS].sort((a, b) => {
            const aIsUnavailable = a.soon || (a.id === 'bank' && requiresVerification)
            const bIsUnavailable = b.soon || (b.id === 'bank' && requiresVerification)

            if (aIsUnavailable === bIsUnavailable) {
                return 0
            }
            return aIsUnavailable ? 1 : -1
        })
    }, [requiresVerification])

    return (
        <div className="space-y-2">
            {!isLoggedIn && (
                <Button
                    shadowSize="4"
                    onClick={() => {
                        addParamStep('claim')
                        // push to setup page with redirect uri, to prevent the user from losing the flow context
                        const redirectUri = encodeURIComponent(
                            window.location.pathname + window.location.search + window.location.hash
                        )
                        router.push(`/setup?redirect_uri=${redirectUri}`)
                    }}
                    className="flex w-full items-center gap-1"
                >
                    <div>Continue with </div>
                    <div className="flex items-center gap-1">
                        <Image src={PEANUTMAN_LOGO} alt="Peanut Logo" className="size-5" />
                        <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                    </div>
                </Button>
            )}
            <Divider text="or" />
            <div className="space-y-2">
                {sortedActionMethods.map((method) => {
                    if (flow === 'request' && method.id === 'exchange-or-wallet') {
                        return <ActionListDaimoPayButton key={method.id} />
                    }

                    return (
                        <MethodCard
                            onClick={() => handleMethodClick(method)}
                            key={method.id}
                            method={method}
                            requiresVerification={method.id === 'bank' && requiresVerification}
                        />
                    )
                })}
            </div>
            <ActionModal
                visible={showMinAmountError}
                onClose={() => setShowMinAmountError(false)}
                title="Minimum Amount "
                description={'The minimum amount for a bank transaction is $1. Please try a different method.'}
                icon="alert"
                ctas={[{ text: 'Close', shadowSize: '4', onClick: () => setShowMinAmountError(false) }]}
                iconContainerClassName="bg-yellow-400"
                preventClose={false}
                modalPanelClassName="max-w-md mx-8"
            />
            <GuestVerificationModal
                secondaryCtaLabel="Use other method"
                isOpen={isGuestVerificationModalOpen}
                onClose={() => setIsGuestVerificationModalOpen(false)}
                description="To fulfill this request using bank account, please create an account and verify your identity."
                redirectToVerification
            />
        </div>
    )
}

export const MethodCard = ({
    method,
    onClick,
    requiresVerification,
}: {
    method: PaymentMethod
    onClick: () => void
    requiresVerification?: boolean
}) => {
    return (
        <SearchResultCard
            position="single"
            description={method.description}
            descriptionClassName="text-[12px]"
            title={
                <div className="flex items-center gap-2">
                    {method.title}
                    {(method.soon || requiresVerification) && (
                        <StatusBadge
                            status={requiresVerification ? 'custom' : 'soon'}
                            customText={requiresVerification ? 'REQUIRES VERIFICATION' : ''}
                        />
                    )}
                </div>
            }
            onClick={onClick}
            isDisabled={method.soon}
            rightContent={<IconStack icons={method.icons} iconSize={method.id === 'bank' ? 80 : 24} />}
        />
    )
}
