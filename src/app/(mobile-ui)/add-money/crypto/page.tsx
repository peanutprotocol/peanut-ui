'use client'
import { CryptoSourceListCard } from '@/components/AddMoney/components/CryptoSourceListCard'
import { CRYPTO_EXCHANGES, CRYPTO_WALLETS, CryptoSource, CryptoToken } from '@/components/AddMoney/consts'
import { CryptoDepositQR } from '@/components/AddMoney/views/CryptoDepositQR.view'
import NetworkSelectionView, { SelectedNetwork } from '@/components/AddMoney/views/NetworkSelection.view'
import TokenSelectionView from '@/components/AddMoney/views/TokenSelection.view'
import ActionModal from '@/components/Global/ActionModal'
import NavHeader from '@/components/Global/NavHeader'
import { Slider } from '@/components/Slider'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type AddMoneyCryptoStep = 'sourceSelection' | 'tokenSelection' | 'networkSelection' | 'riskModal' | 'qrScreen'

interface AddMoneyCryptoPageProps {
    headerTitle?: string
    onBack?: () => void
    depositAddress?: string
}

const AddMoneyCryptoPage = ({ headerTitle, onBack, depositAddress }: AddMoneyCryptoPageProps) => {
    const router = useRouter()
    const { address: peanutWalletAddress } = useWallet()
    const [currentStep, setCurrentStep] = useState<AddMoneyCryptoStep>('tokenSelection') // hotfix for deposit - select tokenSelection view as default
    const [selectedSource, setSelectedSource] = useState<CryptoSource | null>(CRYPTO_EXCHANGES[3]) // hotfix for deposit - select Other exhange by default
    const [selectedToken, setSelectedToken] = useState<CryptoToken | null>(null)
    const [selectedNetwork, setSelectedNetwork] = useState<SelectedNetwork | null>(null)
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
        // hotfix for deposit - redirect to previous route if user is on tokenSelection and selected source is other-exchanges
        if (selectedSource?.id === 'other-exchanges' && currentStep === 'tokenSelection') {
            router.back()
            return
        }
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

    const handleBackToNetworkSelectionFromQR = () => {
        if (selectedSource?.type === 'exchange') {
            setCurrentStep('tokenSelection') // hotfix for deposit - redirect to tokenSelection view if user is on qrScreen and selected source is exchange
        } else {
            setCurrentStep('networkSelection')
        }
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
                    <ActionModal
                        visible={true}
                        onClose={handleBackToNetworkSelectionFromRisk}
                        icon={'alert'}
                        iconContainerClassName="bg-yellow-1"
                        title={`Only send ${selectedToken.symbol} on ${selectedNetwork.name}`}
                        description={
                            <span className="text-sm">
                                Sending funds via any other network will result in a <b>permanent loss.</b>
                            </span>
                        }
                        footer={
                            <div className="w-full">
                                <Slider onValueChange={(v) => v && setIsRiskAccepted(true)} />
                            </div>
                        }
                        ctas={[]}
                        modalPanelClassName="max-w-xs"
                    />
                )}
            </>
        )
    }

    if (currentStep === 'qrScreen' && selectedSource && selectedToken && selectedNetwork) {
        return (
            <CryptoDepositQR
                tokenName={selectedToken.symbol}
                chainName={selectedNetwork.name}
                depositAddress={depositAddress ?? peanutWalletAddress}
                onBack={handleBackToNetworkSelectionFromQR}
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
