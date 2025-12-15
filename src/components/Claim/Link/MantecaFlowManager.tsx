'use client'

import { MERCADO_PAGO, PIX } from '@/assets'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { type ClaimLinkData } from '@/services/sendLinks'
import { type FC, useEffect, useState } from 'react'
import MantecaDetailsStep from './views/MantecaDetailsStep.view'
import { MercadoPagoStep } from '@/types/manteca.types'
import MantecaReviewStep from './views/MantecaReviewStep'
import { Button } from '@/components/0_Bruddle/Button'
import { useRouter } from 'next/navigation'
import useKycStatus from '@/hooks/useKycStatus'
import { MantecaGeoSpecificKycModal } from '@/components/Kyc/InitiateMantecaKYCModal'
import { useAuth } from '@/context/authContext'
import { type CountryData } from '@/components/AddMoney/consts'

interface MantecaFlowManagerProps {
    claimLinkData: ClaimLinkData
    amount: string
    attachment: { message: string | undefined; attachmentUrl: string | undefined }
}

const MantecaFlowManager: FC<MantecaFlowManagerProps> = ({ claimLinkData, amount, attachment }) => {
    const { setClaimToMercadoPago, selectedCountry, regionalMethodType } = useClaimBankFlow()
    const [currentStep, setCurrentStep] = useState<MercadoPagoStep>(MercadoPagoStep.DETAILS)
    const router = useRouter()
    const [destinationAddress, setDestinationAddress] = useState('')
    const [isKYCModalOpen, setIsKYCModalOpen] = useState(false)
    const argentinaCountryData = {
        id: 'AR',
        type: 'country',
        title: 'Argentina',
        currency: 'ARS',
        path: 'argentina',
        iso2: 'AR',
        iso3: 'ARG',
    } as CountryData

    const { isUserMantecaKycApproved, isUserBridgeKycApproved } = useKycStatus()
    const { fetchUser } = useAuth()

    const isSuccess = currentStep === MercadoPagoStep.SUCCESS
    const selectedCurrency = selectedCountry?.currency || 'ARS'
    const regionalMethodLogo = regionalMethodType === 'mercadopago' ? MERCADO_PAGO : PIX
    const logo = selectedCountry?.id ? undefined : regionalMethodLogo

    const handleKycCancel = () => {
        setIsKYCModalOpen(false)
        onPrev()
    }

    useEffect(() => {
        if (!isUserMantecaKycApproved) {
            setIsKYCModalOpen(true)
        }
    }, [isUserMantecaKycApproved])

    const renderStepDetails = () => {
        if (currentStep === MercadoPagoStep.DETAILS) {
            return (
                <MantecaDetailsStep
                    destinationAddress={destinationAddress}
                    setDestinationAddress={setDestinationAddress}
                    setCurrentStep={setCurrentStep}
                />
            )
        }
        if (currentStep === MercadoPagoStep.REVIEW) {
            return (
                <MantecaReviewStep
                    setCurrentStep={setCurrentStep}
                    claimLink={claimLinkData.link}
                    destinationAddress={destinationAddress}
                    amount={amount}
                    currency={selectedCurrency}
                />
            )
        }

        if (currentStep === MercadoPagoStep.SUCCESS) {
            return (
                <Button onClick={() => router.push('/home')} shadowSize="4">
                    Back to home
                </Button>
            )
        }
        return null
    }

    const onPrev = () => {
        if (currentStep === MercadoPagoStep.DETAILS) {
            setClaimToMercadoPago(false)
            return
        }

        if (currentStep === MercadoPagoStep.REVIEW) {
            setCurrentStep(MercadoPagoStep.DETAILS)
            return
        }
        if (currentStep === MercadoPagoStep.SUCCESS) {
            router.push('/home')
            return
        }
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-between gap-8 md:min-h-fit">
            <NavHeader icon={isSuccess ? 'cancel' : 'chevron-up'} title="Receive" onPrev={onPrev} />

            <div className="my-auto space-y-4">
                <PeanutActionDetailsCard
                    viewType={isSuccess ? 'SUCCESS' : 'NORMAL'}
                    avatarSize="medium"
                    transactionType="REGIONAL_METHOD_CLAIM"
                    recipientType="USERNAME"
                    recipientName={isSuccess ? 'You’ll receive' : 'Receive in ' + regionalMethodType}
                    amount={amount}
                    tokenSymbol={claimLinkData.tokenSymbol}
                    message={attachment.message}
                    fileUrl={attachment.attachmentUrl}
                    logo={isSuccess ? undefined : logo}
                    countryCodeForFlag={selectedCountry?.id?.toLowerCase()}
                />

                {renderStepDetails()}

                {isKYCModalOpen && (
                    <MantecaGeoSpecificKycModal
                        isUserBridgeKycApproved={isUserBridgeKycApproved}
                        isMantecaModalOpen={isKYCModalOpen}
                        setIsMantecaModalOpen={setIsKYCModalOpen}
                        onClose={handleKycCancel}
                        onManualClose={handleKycCancel}
                        onKycSuccess={() => {
                            // close the modal and let the user continue with amount input
                            setIsKYCModalOpen(false)
                            fetchUser()
                        }}
                        selectedCountry={selectedCountry || argentinaCountryData}
                    />
                )}
            </div>
        </div>
    )
}

export default MantecaFlowManager
