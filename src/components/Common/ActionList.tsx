'use client'

import { SearchResultCard } from '../SearchUsers/SearchResultCard'
import StatusBadge from '../Global/Badges/StatusBadge'
import IconStack from '../Global/IconStack'
import mercadoPagoIcon from '@/assets/payment-apps/mercado-pago.svg'
import binanceIcon from '@/assets/exchanges/binance.svg'
import { METAMASK_LOGO, TRUST_WALLET_SMALL_LOGO } from '@/assets/wallets'
import { ClaimBankFlowStep, useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { ClaimLinkData } from '@/services/sendLinks'
import { formatUnits } from 'viem'
import { useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'
import Divider from '../0_Bruddle/Divider'
import { Button } from '../0_Bruddle'
import { PEANUT_LOGO_BLACK } from '@/assets/illustrations'
import Image from 'next/image'
import { saveRedirectUrl } from '@/utils'
import { useRouter } from 'next/navigation'
import { PEANUTMAN_LOGO } from '@/assets/peanut'
import { BankClaimType, useDetermineBankClaimType } from '@/hooks/useDetermineBankClaimType'
import useSavedAccounts from '@/hooks/useSavedAccounts'
import { useRequestFulfilmentFlow } from '@/context/RequestFulfilmentFlowContext'
import { ParsedURL } from '@/lib/url-parser/types/payment'

export interface Method {
    id: string
    title: string
    description: string
    icons: any[]
    soon: boolean
}

const ACTION_METHODS: Method[] = [
    {
        id: 'bank',
        title: 'Bank',
        description: 'EUR, USD, ARS (more coming soon)',
        icons: [
            'https://flagcdn.com/w160/ar.png',
            'https://flagcdn.com/w160/de.png',
            'https://flagcdn.com/w160/us.png',
        ],
        soon: false,
    },
    {
        id: 'mercadopago',
        title: 'Mercado Pago',
        description: 'Instant transfers',
        icons: [mercadoPagoIcon],
        soon: true,
    },
    {
        id: 'exchange-or-wallet',
        title: 'Exchange or Wallet',
        description: 'Binance, Coinbase, Metamask and more',
        icons: [binanceIcon, TRUST_WALLET_SMALL_LOGO, METAMASK_LOGO],
        soon: false,
    },
]

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
    const savedAccounts = useSavedAccounts()
    const { setExternalWalletFulfilMethod, setShowExternalWalletFulfilMethods } = useRequestFulfilmentFlow()

    const handleMethodClick = async (method: Method) => {
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
            switch (method.id) {
                case 'bank':
                    {
                        console.log('bank') // TODO: implement bank fulfilment
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

    return (
        <div className="space-y-2">
            {!isLoggedIn && (
                <Button
                    shadowSize="4"
                    onClick={() => {
                        saveRedirectUrl()
                        router.push('/setup')
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
                {ACTION_METHODS.map((method) => (
                    <MethodCard onClick={() => handleMethodClick(method)} key={method.id} method={method} />
                ))}
            </div>
            <ActionModal
                visible={showMinAmountError}
                onClose={() => setShowMinAmountError(false)}
                title="Minimum Amount "
                description="The minimum amount to claim a link to a bank account is $1. Please try claiming with a different method."
                icon="alert"
                ctas={[{ text: 'Close', shadowSize: '4', onClick: () => setShowMinAmountError(false) }]}
                iconContainerClassName="bg-yellow-400"
                preventClose={false}
                modalPanelClassName="max-w-md mx-8"
            />
        </div>
    )
}

export const MethodCard = ({ method, onClick }: { method: Method; onClick: () => void }) => {
    return (
        <SearchResultCard
            position="single"
            description={method.description}
            descriptionClassName="text-[12px]"
            title={
                <div className="flex items-center gap-2">
                    {method.title}
                    {method.soon && <StatusBadge status="soon" />}
                </div>
            }
            onClick={onClick}
            isDisabled={method.soon}
            rightContent={<IconStack icons={method.icons} iconSize={method.id === 'bank' ? 80 : 24} />}
        />
    )
}
