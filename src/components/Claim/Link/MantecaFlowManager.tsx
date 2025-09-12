import { MERCADO_PAGO } from '@/assets'
import NavHeader from '@/components/Global/NavHeader'
import PeanutActionDetailsCard from '@/components/Global/PeanutActionDetailsCard'
import { useClaimBankFlow } from '@/context/ClaimBankFlowContext'
import { ClaimLinkData } from '@/services/sendLinks'
import { FC, useState } from 'react'
import MantecaDetailsStep from './views/MantecaDetailsStep.view'
import { MercadoPagoStep } from '@/types/manteca.types'
import MantecaReviewStep from './views/MantecaReviewStep'
import { Button } from '@/components/0_Bruddle'
import { useRouter } from 'next/navigation'
import { MantecaWithdrawResponseData } from '@/app/actions/types/manteca.types'

interface MantecaFlowManagerProps {
    claimLinkData: ClaimLinkData
    amount: string
    attachment: { message: string | undefined; attachmentUrl: string | undefined }
}

const MantecaFlowManager: FC<MantecaFlowManagerProps> = ({ claimLinkData, amount, attachment }) => {
    const { setClaimToMercadoPago } = useClaimBankFlow()
    const [currentStep, setCurrentStep] = useState<MercadoPagoStep>(MercadoPagoStep.DETAILS)
    const router = useRouter()
    const [withdrawDetails, setWithdrawDetails] = useState<MantecaWithdrawResponseData | undefined>()

    const isSuccess = currentStep === MercadoPagoStep.SUCCESS

    const renderStepDetails = () => {
        if (currentStep === MercadoPagoStep.DETAILS) {
            return (
                <MantecaDetailsStep
                    setCurrentStep={setCurrentStep}
                    amount={amount}
                    setWithdrawDetails={setWithdrawDetails}
                />
            )
        }
        if (currentStep === MercadoPagoStep.REVIEW) {
            return (
                <MantecaReviewStep
                    setCurrentStep={setCurrentStep}
                    withdrawDetails={withdrawDetails}
                    claimLink={claimLinkData.link}
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
                    recipientName={isSuccess ? 'You’ll receive' : 'Receive in Mercado Pago'}
                    amount={amount}
                    tokenSymbol={claimLinkData.tokenSymbol}
                    message={attachment.message}
                    fileUrl={attachment.attachmentUrl}
                    logo={isSuccess ? undefined : MERCADO_PAGO}
                />

                {renderStepDetails()}
            </div>
        </div>
    )
}

export default MantecaFlowManager
