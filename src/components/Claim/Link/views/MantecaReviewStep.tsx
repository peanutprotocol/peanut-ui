import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import MantecaDetailsCard, { MantecaCardRow } from '@/components/Global/MantecaDetailsCard'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useCurrency } from '@/hooks/useCurrency'
import { mantecaApi } from '@/services/manteca'
import { MercadoPagoStep } from '@/types/manteca.types'
import { Dispatch, FC, SetStateAction, useState } from 'react'

interface MantecaReviewStepProps {
    setCurrentStep: Dispatch<SetStateAction<MercadoPagoStep>>
    sendLink: string
    destinationAddress: string
    amount: string
    currency: string
}

const MantecaReviewStep: FC<MantecaReviewStepProps> = ({
    setCurrentStep,
    sendLink,
    destinationAddress,
    amount,
    currency,
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { price, isLoading } = useCurrency(currency)

    const detailsCardRows: MantecaCardRow[] = [
        {
            key: 'alias',
            label: 'Alias',
            value: destinationAddress,
            allowCopy: true,
        },
        {
            key: 'exchangeRate',
            label: 'Exchange Rate',
            value: `1 USD = ${price?.buy} ${currency}`,
        },
        {
            key: 'fee',
            label: 'Fee',
            value: 'Sponsored by Peanut',
            hideBottomBorder: true,
        },
    ]
    const handleWithdraw = async () => {
        if (destinationAddress) {
            try {
                setError(null)
                setIsSubmitting(true)
                const { data, error: withdrawError } = await mantecaApi.withdraw({
                    amount: amount.replace(/,/g, ''),
                    destinationAddress,
                    sendLink,
                    currency,
                })
                if (withdrawError || !data) {
                    setError(withdrawError || 'Something went wrong. Please contact Support')
                    return
                }
                setCurrentStep(MercadoPagoStep.SUCCESS)
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Something went wrong. Please contact Support')
                console.error('Error claiming link:', error)
            } finally {
                setIsSubmitting(false)
            }
        }
    }

    if (isLoading) {
        return <PeanutLoading coverFullScreen />
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
