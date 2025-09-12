import { mantecaWithdraw } from '@/app/actions/manteca'
import { MantecaWithdrawResponseData } from '@/app/actions/types/manteca.types'
import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { Icon } from '@/components/Global/Icons/Icon'
import { MercadoPagoStep } from '@/types/manteca.types'
import { Dispatch, FC, SetStateAction, useCallback, useState } from 'react'

interface MantecaDetailsStepProps {
    setCurrentStep: Dispatch<SetStateAction<MercadoPagoStep>>
    amount: string
    setWithdrawDetails: Dispatch<SetStateAction<MantecaWithdrawResponseData | undefined>>
}

const MantecaDetailsStep: FC<MantecaDetailsStepProps> = ({ setCurrentStep, amount, setWithdrawDetails }) => {
    const [destinationAddress, setDestinationAddress] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const createMantecaWithdraw = async () => {
        setError(null)
        setIsSubmitting(true)
        const response = await mantecaWithdraw({
            amount,
            destinationAddress,
        })

        if (response.error) {
            console.error(response.error)
            setError(response.error)
            setIsSubmitting(false)
            return
        }

        if (response.data) {
            setWithdrawDetails(response.data)
            setCurrentStep(MercadoPagoStep.REVIEW)
        }
        setIsSubmitting(false)
    }

    return (
        <>
            <p className="font-bold">Enter Mercado Pago account details</p>

            <BaseInput
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                placeholder="CVU or Alias"
            />
            <div className="flex items-center gap-2 text-xs text-grey-1">
                <Icon name="info" width={16} height={16} />
                <span>You can only withdraw to accounts under your name.</span>
            </div>

            {error && <ErrorAlert description={error} />}

            <Button
                loading={isSubmitting}
                disabled={!destinationAddress || isSubmitting}
                onClick={() => createMantecaWithdraw()}
                shadowSize="4"
            >
                Review
            </Button>
        </>
    )
}

export default MantecaDetailsStep
