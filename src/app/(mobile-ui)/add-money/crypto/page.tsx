'use client'
import { CryptoSourceListCard } from '@/components/AddMoney/components/CryptoSourceListCard'
import { CRYPTO_EXCHANGES, CRYPTO_WALLETS, CryptoSource, CryptoToken } from '@/components/AddMoney/consts'
import { CryptoDepositQR } from '@/components/AddMoney/views/CryptoDepositQR.view'
import NetworkSelectionView, { SelectedNetwork } from '@/components/AddMoney/views/NetworkSelection.view'
import TokenSelectionView from '@/components/AddMoney/views/TokenSelection.view'
import ActionModal from '@/components/Global/ActionModal'
import NavHeader from '@/components/Global/NavHeader'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

type AddMoneyCryptoStep = 'sourceSelection' | 'tokenSelection' | 'networkSelection' | 'riskModal' | 'qrScreen'

const AddMoneyCryptoPage = () => {
    const router = useRouter()
    const { address: peanutWalletAddress } = useWallet()
    const { user: authUser } = useUserStore()
    const [currentStep, setCurrentStep] = useState<AddMoneyCryptoStep>('sourceSelection')
    const [selectedSource, setSelectedSource] = useState<CryptoSource | null>(null)
    const [selectedToken, setSelectedToken] = useState<CryptoToken | null>(null)
    const [selectedNetwork, setSelectedNetwork] = useState<SelectedNetwork | null>(null)
    const [isRiskAccepted, setIsRiskAccepted] = useState(false)

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

    const handleRiskContinue = () => {
        if (isRiskAccepted) {
            setCurrentStep('qrScreen')
        }
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

    const handleBackToNetworkSelectionFromQR = () => {
        if (selectedSource?.type === 'exchange') {
            setCurrentStep('sourceSelection')
        } else {
            setCurrentStep('networkSelection')
        }
    }

    if (currentStep === 'tokenSelection' && selectedSource) {
        return <TokenSelectionView onTokenSelect={handleTokenSelected} onBack={handleBackToSourceSelection} />
    }

    if (currentStep === 'networkSelection' && selectedSource && selectedToken) {
        return <NetworkSelectionView onNetworkSelect={handleNetworkSelected} onBack={handleBackToTokenSelection} />
    }

    if (currentStep === 'qrScreen' && selectedSource && selectedToken && selectedNetwork) {
        return (
            <CryptoDepositQR
                tokenName={selectedToken.symbol}
                chainName={selectedNetwork.name}
                depositAddress={peanutWalletAddress}
                onBack={handleBackToNetworkSelectionFromQR}
            />
        )
    }

    return (
        <>
            <div className="flex h-full w-full flex-col justify-start gap-8 self-start">
                <NavHeader title="Add Money" onPrev={() => router.back()} />
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

            {currentStep === 'riskModal' && selectedToken && selectedNetwork && (
                <ActionModal
                    visible={true}
                    onClose={handleBackToNetworkSelectionFromRisk}
                    icon={'alert'}
                    modalClassName="backdrop-blur"
                    title={`Only send ${selectedToken.symbol} on ${selectedNetwork.name}`}
                    description="Sending funds via any other network will result in a permanent loss of funds. Peanut is not responsible for any loss of funds due to incorrect network selection."
                    checkbox={{
                        text: 'I understand and accept the risk.',
                        checked: isRiskAccepted,
                        onChange: setIsRiskAccepted,
                    }}
                    ctas={[
                        {
                            text: 'Continue',
                            onClick: handleRiskContinue,
                            disabled: !isRiskAccepted,
                            variant: isRiskAccepted ? 'purple' : 'stroke',
                            shadowSize: '4',
                            className: twMerge(
                                !isRiskAccepted ? 'border-grey-2 text-grey-2' : '',
                                'text-black border border-black h-11 hover:text-black'
                            ),
                        },
                    ]}
                    modalPanelClassName="max-w-xs"
                />
            )}
        </>
    )
}

export default AddMoneyCryptoPage
