import { SearchResultCard } from '../SearchUsers/SearchResultCard'
import StatusBadge from '../Global/Badges/StatusBadge'
import IconStack from '../Global/IconStack'
import mercadoPagoIcon from '@/assets/payment-apps/mercado-pago.svg'
import lemonIcon from '@/assets/exchanges/lemon.svg'
import binanceIcon from '@/assets/exchanges/binance.svg'
import ripioIcon from '@/assets/exchanges/ripio.svg'
import { RAINBOW_LOGO, METAMASK_LOGO, TRUST_WALLET_SMALL_LOGO } from '@/assets/wallets'
import { Button } from '../0_Bruddle'
import { useGuestFlow } from '@/context/GuestFlowContext'
import { getUserById } from '@/app/actions/users'
import { ClaimLinkData } from '@/services/sendLinks'
import { formatUnits } from 'viem'
import { useState } from 'react'
import ActionModal from '@/components/Global/ActionModal'

interface Method {
    id: string
    title: string
    description: string
    icons: any[]
    soon: boolean
}

const GUEST_ACTION_METHODS: Method[] = [
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
        id: 'exchange',
        title: 'Exchange',
        description: 'Lemon, Binance, Ripio and more',
        icons: [lemonIcon, binanceIcon, ripioIcon],
        soon: false,
    },
    {
        id: 'crypto',
        title: 'Crypto Wallet',
        description: 'Metamask, Trustwallet and more',
        icons: [RAINBOW_LOGO, TRUST_WALLET_SMALL_LOGO, METAMASK_LOGO],
        soon: false,
    },
]

export default function GuestActionList({ claimLinkData }: { claimLinkData: ClaimLinkData }) {
    const {
        showGuestActionsList,
        setShowGuestActionsList,
        setClaimToExternalWallet,
        setGuestFlowStep,
        setSenderDetails,
        setShowVerificationModal,
    } = useGuestFlow()
    const [showMinAmountError, setShowMinAmountError] = useState(false)

    const handleMethodClick = async (method: Method) => {
        const amountInUsd = parseFloat(formatUnits(claimLinkData.amount, claimLinkData.tokenDecimals))
        if (method.id === 'bank' && amountInUsd < 1) {
            setShowMinAmountError(true)
            return
        }
        switch (method.id) {
            case 'bank':
                {
                    if (!claimLinkData.sender?.userId) {
                        setShowVerificationModal(true)
                        return
                    }
                    const senderDetails = await getUserById(claimLinkData.sender?.userId ?? claimLinkData.senderAddress)
                    if (senderDetails && senderDetails.kycStatus === 'approved') {
                        setSenderDetails(senderDetails)
                        setGuestFlowStep('bank-country-list')
                    } else {
                        setShowVerificationModal(true)
                    }
                }
                break
            case 'mercadopago':
                break // soon tag, so no action needed
            case 'crypto':
            case 'exchange':
                setClaimToExternalWallet(true)
                break
        }
    }

    if (showGuestActionsList) {
        return (
            <div className="space-y-2">
                <h2 className="text-base font-bold">Where would you like to receive this?</h2>
                <div className="space-y-2">
                    {GUEST_ACTION_METHODS.map((method) => (
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

    return (
        <Button variant="primary-soft" shadowSize="4" className="w-full" onClick={() => setShowGuestActionsList(true)}>
            Continue without account
        </Button>
    )
}

const MethodCard = ({ method, onClick }: { method: Method; onClick: () => void }) => {
    return (
        <SearchResultCard
            position="single"
            description={method.description}
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
