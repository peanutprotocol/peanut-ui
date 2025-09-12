import { MantecaWithdrawResponseData } from '@/app/actions/types/manteca.types'
import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import MantecaDetailsCard, { MantecaCardRow } from '@/components/Global/MantecaDetailsCard'
import { sendLinksApi } from '@/services/sendLinks'
import { MercadoPagoStep } from '@/types/manteca.types'
import { Dispatch, FC, SetStateAction, useState } from 'react'

interface MantecaReviewStepProps {
    setCurrentStep: Dispatch<SetStateAction<MercadoPagoStep>>
    withdrawDetails: MantecaWithdrawResponseData | undefined
    claimLink: string
}

const MantecaReviewStep: FC<MantecaReviewStepProps> = ({ setCurrentStep, withdrawDetails, claimLink }) => {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const detailsCardRows: MantecaCardRow[] = [
        {
            key: 'alias',
            label: 'Alias',
            value: withdrawDetails?.stages[2].destination.address,
            allowCopy: true,
        },
        {
            key: 'exchangeRate',
            label: 'Exchange Rate',
            value: `1 USD = ${withdrawDetails?.details.price} ARS`,
        },
        {
            key: 'fee',
            label: 'Fee',
            value: 'Sponsored by Peanut',
            hideBottomBorder: true,
        },
    ]

    const handleWithdraw = async () => {
        if (withdrawDetails) {
            try {
                setIsSubmitting(true)
                const destinationAddress = withdrawDetails.stages[2].destination.address
                await sendLinksApi.claim(destinationAddress, claimLink, destinationAddress)
                setCurrentStep(MercadoPagoStep.SUCCESS)
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Something went wrong')
                console.error('Error claiming link:', error)
            } finally {
                setIsSubmitting(false)
            }
        }
    }

    return (
        <>
            <MantecaDetailsCard rows={detailsCardRows} />

            {error && <ErrorAlert description={error} />}
            <Button disabled={isSubmitting} loading={isSubmitting} shadowSize="4" onClick={handleWithdraw}>
                Withdraw
            </Button>
        </>
    )
}

export default MantecaReviewStep
