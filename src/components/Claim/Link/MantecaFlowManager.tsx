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
import { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import { SumsubKycModals } from '@/components/Kyc/SumsubKycModals'
import { InitiateKycModal } from '@/components/Kyc/InitiateKycModal'

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
    const { isUserMantecaKycApproved } = useKycStatus()

    // inline sumsub kyc flow for manteca users who need LATAM verification
    // regionIntent is NOT passed here to avoid creating a backend record on mount.
    // intent is passed at call time: handleInitiateKyc('LATAM')
    const sumsubFlow = useMultiPhaseKycFlow({})
    const [showKycModal, setShowKycModal] = useState(false)

    const isSuccess = currentStep === MercadoPagoStep.SUCCESS
    const selectedCurrency = selectedCountry?.currency || 'ARS'
    const regionalMethodLogo = regionalMethodType === 'mercadopago' ? MERCADO_PAGO : PIX
    const logo = selectedCountry?.id ? undefined : regionalMethodLogo

    // show confirmation modal if user hasn't completed manteca verification
    useEffect(() => {
        if (!isUserMantecaKycApproved) {
            setShowKycModal(true)
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
            </div>
            <InitiateKycModal
                visible={showKycModal}
                onClose={() => setShowKycModal(false)}
                onVerify={async () => {
                    setShowKycModal(false)
                    await sumsubFlow.handleInitiateKyc('LATAM')
                }}
                isLoading={sumsubFlow.isLoading}
            />
            <SumsubKycModals flow={sumsubFlow} />
        </div>
    )
}

export default MantecaFlowManager
