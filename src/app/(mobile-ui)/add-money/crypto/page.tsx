'use client'
import { ARBITRUM_ICON } from '@/assets'
import { CryptoSourceListCard } from '@/components/AddMoney/components/CryptoSourceListCard'
import {
    CRYPTO_EXCHANGES,
    CRYPTO_WALLETS,
    type CryptoSource,
    type CryptoToken,
    DEPOSIT_CRYPTO_TOKENS,
} from '@/components/AddMoney/consts'
import { CryptoDepositQR } from '@/components/AddMoney/views/CryptoDepositQR.view'
import NetworkSelectionView, { type SelectedNetwork } from '@/components/AddMoney/views/NetworkSelection.view'
import TokenSelectionView from '@/components/AddMoney/views/TokenSelection.view'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useWallet } from '@/hooks/wallet/useWallet'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import TokenAndNetworkConfirmationModal from '@/components/Global/TokenAndNetworkConfirmationModal'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'

type AddMoneyCryptoStep = 'sourceSelection' | 'tokenSelection' | 'networkSelection' | 'riskModal' | 'qrScreen'

interface AddMoneyCryptoPageProps {
    headerTitle?: string
    onBack?: () => void
    depositAddress?: string
}

const AddMoneyCryptoPage = ({ headerTitle, onBack, depositAddress }: AddMoneyCryptoPageProps) => {
    const router = useRouter()
    const { address: peanutWalletAddress, isConnected } = useWallet()
    const [currentStep, setCurrentStep] = useState<AddMoneyCryptoStep>('qrScreen')
    const [selectedSource, setSelectedSource] = useState<CryptoSource | null>(CRYPTO_EXCHANGES[3])
    const [selectedToken, setSelectedToken] = useState<CryptoToken | null>(DEPOSIT_CRYPTO_TOKENS[0])
    const [selectedNetwork, setSelectedNetwork] = useState<SelectedNetwork | null>({
        chainId: PEANUT_WALLET_CHAIN.id.toString(),
        name: PEANUT_WALLET_CHAIN.name,
        iconUrl: ARBITRUM_ICON,
    })
    const [isRiskAccepted, setIsRiskAccepted] = useState(false)

    useEffect(() => {
        if (isRiskAccepted) {
            setCurrentStep('qrScreen')
        }
    }, [isRiskAccepted])

    const handleCryptoSourceSelected = (source: CryptoSource) => {
        setSelectedSource(source)
        setCurrentStep('tokenSelection')
    }

    const handleTokenSelected = (token: CryptoToken) => {
        setSelectedToken(token)
        setCurrentStep('networkSelection')
    }

    const handleNetworkSelected = (network: SelectedNetwork) => {
        setSelectedNetwork(network)
        setIsRiskAccepted(false)
        setCurrentStep('riskModal')
    }

    const resetSelections = () => {
        setSelectedToken(null)
        setSelectedNetwork(null)
        setIsRiskAccepted(false)
    }

    const handleBackToSourceSelection = () => {
        setCurrentStep('sourceSelection')
        setSelectedSource(null)
        resetSelections()
    }

    const handleBackToTokenSelection = () => {
        setCurrentStep('tokenSelection')
        setSelectedNetwork(null)
        setIsRiskAccepted(false)
    }

    const handleBackToNetworkSelectionFromRisk = () => {
        setCurrentStep('networkSelection')
        setIsRiskAccepted(false)
    }

    if (currentStep === 'tokenSelection' && selectedSource) {
        return (
            <TokenSelectionView
                headerTitle={headerTitle}
                onTokenSelect={handleTokenSelected}
                onBack={onBack ?? handleBackToSourceSelection}
            />
        )
    }

    if ((currentStep === 'networkSelection' || currentStep === 'riskModal') && selectedSource && selectedToken) {
        return (
            <>
                <NetworkSelectionView
                    headerTitle={headerTitle}
                    onNetworkSelect={handleNetworkSelected}
                    onBack={handleBackToTokenSelection}
                />
                {currentStep === 'riskModal' && selectedToken && selectedNetwork && (
                    <TokenAndNetworkConfirmationModal
                        token={selectedToken}
                        network={selectedNetwork}
                        onClose={handleBackToNetworkSelectionFromRisk}
                        onAccept={() => setIsRiskAccepted(true)}
                    />
                )}
            </>
        )
    }

    if (currentStep === 'qrScreen' && selectedSource && selectedToken && selectedNetwork) {
        if (!isConnected) {
            return <PeanutLoading />
        }

        // Ensure we have a valid deposit address
        const finalDepositAddress = depositAddress ?? peanutWalletAddress
        if (!finalDepositAddress) {
            router.push('/')
            return null
        }

        return (
            <CryptoDepositQR
                tokenName={selectedToken.symbol}
                tokenIcon={selectedToken.icon}
                chainName={selectedNetwork.name}
                chainIcon={selectedNetwork.iconUrl}
                depositAddress={finalDepositAddress}
                onBack={() => router.back()}
            />
        )
    }

    return (
        <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
            <NavHeader title={'Add Money'} onPrev={() => router.back()} />
            <div className="flex flex-col gap-2 px-1">
                <h2 className="text-base font-bold">Where are you adding from?</h2>

                {/* Exchanges Section */}
                <div className="flex flex-col gap-2">
                    <CryptoSourceListCard sources={CRYPTO_EXCHANGES} onItemClick={handleCryptoSourceSelected} />
                </div>

                {/* Wallets Section - with a top margin for separation */}
                <div className="mt-1 flex flex-col gap-2 pb-5">
                    <CryptoSourceListCard
                        sources={CRYPTO_WALLETS}
                        onItemClick={() => router.push('/add-money/crypto/direct')}
                    />
                </div>
            </div>
        </div>
    )
}

export default AddMoneyCryptoPage
