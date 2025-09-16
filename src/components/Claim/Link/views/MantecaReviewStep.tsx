import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import MantecaDetailsCard, { MantecaCardRow } from '@/components/Global/MantecaDetailsCard'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { MANTECA_DEPOSIT_ADDRESS } from '@/constants'
import { useCurrency } from '@/hooks/useCurrency'
import { mantecaApi } from '@/services/manteca'
import { sendLinksApi } from '@/services/sendLinks'
import { MercadoPagoStep } from '@/types/manteca.types'
import { Dispatch, FC, SetStateAction, useState } from 'react'

interface MantecaReviewStepProps {
    setCurrentStep: Dispatch<SetStateAction<MercadoPagoStep>>
    claimLink: string
    destinationAddress: string
    amount: string
}

const MantecaReviewStep: FC<MantecaReviewStepProps> = ({ setCurrentStep, claimLink, destinationAddress, amount }) => {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { price, isLoading } = useCurrency('ARS') // TODO: change to the currency of the selected Method

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
            value: `1 USD = ${price?.buy} ARS`,
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
                setIsSubmitting(true)
                const claimResponse = await sendLinksApi.claim(MANTECA_DEPOSIT_ADDRESS, claimLink)
                await mantecaApi.withdraw({
                    amount,
                    destinationAddress,
                    txHash: claimResponse.claim?.txHash ?? '',
                    currency: 'ARS',
                })
                setCurrentStep(MercadoPagoStep.SUCCESS)
            } catch (error) {
                setError(error instanceof Error ? error.message : 'Something went wrong')
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
